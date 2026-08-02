const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client, LocalAuth, MessageMedia } = require('./index');
const fs = require('fs');
const path = require('path');
const statusScheduler = require('./services/statusScheduler');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' })); // Menambah limit ukuran JSON untuk upload media base64
app.use(express.static(path.join(__dirname, 'public')));

const RULES_FILE = path.join(__dirname, 'rules.json');

// Helper to find local Chrome/Edge/Chromium (Termux, Linux, Windows support)
function getLocalBrowserPath() {
    // Deteksi Termux (Android)
    if (process.env.PREFIX && process.env.PREFIX.includes('com.termux')) {
        const termuxChrome = `${process.env.PREFIX}/bin/chromium`;
        if (fs.existsSync(termuxChrome)) return termuxChrome;
    }

    // Deteksi Linux Desktop
    if (process.platform === 'linux') {
        const linuxPaths = [
            '/usr/bin/chromium-browser',
            '/usr/bin/chromium',
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
        ];
        for (const p of linuxPaths) {
            if (fs.existsSync(p)) return p;
        }
    }

    // Windows
    const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return undefined;
}

// Global State
let botStatus = 'DISCONNECTED';
let qrCodeData = null;
let broadcastInProgress = false;
let autoReplyConfig = { enabled: true, rules: [] };
let globalSendMode = 'wwebjs';

function loadRules() {
    try {
        if (fs.existsSync(RULES_FILE)) {
            const data = fs.readFileSync(RULES_FILE, 'utf8');
            autoReplyConfig = JSON.parse(data);
            console.log('Auto-reply rules loaded successfully.');
        } else {
            saveRules(); // Create default
        }
    } catch (error) {
        console.error('Failed to load auto-reply rules:', error.message);
    }
}

function saveRules() {
    try {
        fs.writeFileSync(
            RULES_FILE,
            JSON.stringify(autoReplyConfig, null, 2),
            'utf8',
        );
    } catch (error) {
        console.error('Failed to save auto-reply rules:', error.message);
    }
}

const CAMPAIGNS_FILE = path.join(__dirname, 'campaigns.json');
const AI_CONFIG_FILE = path.join(__dirname, 'ai_config.json');

let campaigns = [];
let aiConfig = {
    enabled: false,
    fallbackToKeyword: true,
    systemPrompt:
        'Kamu adalah asisten virtual WhatsApp yang ramah, sopan, dan profesional. Jawablah pertanyaan pelanggan secara singkat, padat, dan jelas.',
    defaultProvider: 'gemini',
    providers: {
        gemini: { keys: [], currentIndex: 0, model: 'gemini-1.5-flash' },
        openai: { keys: [], currentIndex: 0, model: 'gpt-4o-mini' },
        claude: {
            keys: [],
            currentIndex: 0,
            model: 'claude-3-5-sonnet-20260229',
        },
    },
};

const runningCampaigns = new Map();

function loadCampaigns() {
    try {
        if (fs.existsSync(CAMPAIGNS_FILE)) {
            const data = fs.readFileSync(CAMPAIGNS_FILE, 'utf8');
            campaigns = JSON.parse(data);

            // Reset any campaigns stuck in PROCESSING to PAUSED on startup
            let resetCount = 0;
            campaigns.forEach((c) => {
                if (c.status === 'PROCESSING') {
                    c.status = 'PAUSED';
                    resetCount++;
                }
            });
            if (resetCount > 0) {
                console.log(
                    `Reset ${resetCount} stuck campaign status(es) to PAUSED.`,
                );
            }

            console.log('Campaigns loaded successfully.');
            saveCampaigns();
        } else {
            saveCampaigns();
        }
    } catch (error) {
        console.error('Error loading campaigns:', error);
    }
}

function saveCampaigns() {
    try {
        fs.writeFileSync(
            CAMPAIGNS_FILE,
            JSON.stringify(campaigns, null, 2),
            'utf8',
        );
    } catch (error) {
        console.error('Error saving campaigns:', error);
    }
}

function loadAIConfig() {
    try {
        if (fs.existsSync(AI_CONFIG_FILE)) {
            const data = fs.readFileSync(AI_CONFIG_FILE, 'utf8');
            aiConfig = JSON.parse(data);
            console.log('AI configuration loaded successfully.');
        } else {
            saveAIConfig();
        }
    } catch (error) {
        console.error('Error loading AI config:', error);
    }
}

function saveAIConfig() {
    try {
        fs.writeFileSync(
            AI_CONFIG_FILE,
            JSON.stringify(aiConfig, null, 2),
            'utf8',
        );
    } catch (error) {
        console.error('Error saving AI config:', error);
    }
}

// Initial loads
loadRules();
loadCampaigns();
loadAIConfig();

// Helper to log and send logs to frontend
function logToFrontend(type, message) {
    const timestamp = new Date().toLocaleTimeString();
    io.emit('bot-log', { timestamp, type, message });
    console.log(`[${type}] [${timestamp}] ${message}`);
}

function setBotStatus(status) {
    botStatus = status;
    io.emit('status-update', { status, qrCode: qrCodeData });
    logToFrontend('STATUS', `Status bot berubah menjadi: ${status}`);
}

// Initialize Client
const isTermux =
    process.env.PREFIX && process.env.PREFIX.includes('com.termux');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: isTermux ? 'new' : false, // Di Termux wajib headless karena tidak ada GUI (X11)
        executablePath: getLocalBrowserPath(),
        args: isTermux
            ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
            : [],
    },
});

// Event Listeners for WhatsApp Web
client.on('loading_screen', (percent, message) => {
    setBotStatus('LOADING');
    logToFrontend('LOADING', `Memuat halaman: ${percent}% - ${message}`);
});

client.on('qr', (qr) => {
    qrCodeData = qr;
    setBotStatus('QR_READY');
    logToFrontend('QR', 'QR Code baru diterima. Silakan scan di dashboard.');
});

client.on('authenticated', () => {
    qrCodeData = null;
    setBotStatus('AUTHENTICATING');
    logToFrontend('AUTH', 'Otentikasi berhasil! Sedang memulai sesi...');
});

client.on('auth_failure', (msg) => {
    setBotStatus('DISCONNECTED');
    logToFrontend('ERROR', `Otentikasi gagal: ${msg}`);
});

client.on('ready', () => {
    qrCodeData = null;
    setBotStatus('READY');
    logToFrontend('READY', 'WhatsApp Client SIAP digunakan dan terhubung!');
    statusScheduler.initStatusScheduler(client, logToFrontend);
});

client.on('disconnected', (reason) => {
    setBotStatus('DISCONNECTED');
    logToFrontend('ERROR', `WhatsApp terputus: ${reason}`);

    if (reason === 'LOGOUT') {
        logToFrontend(
            'SYSTEM',
            'Sesi telah dikeluarkan (Logout). Silakan scan ulang QR Code di dashboard.',
        );
        return;
    }

    logToFrontend('SYSTEM', 'Mencoba menghubungkan ulang dalam 5 detik...');
    setTimeout(() => {
        client.initialize().catch((err) => {
            logToFrontend('ERROR', `Gagal inisialisasi ulang: ${err.message}`);
        });
    }, 5000);
});

// Stream new messages to WebSocket (Incoming & Outgoing)
client.on('message_create', (msg) => {
    // Cari id chat yang aktif
    const chatId = msg.id.remote;
    io.emit('new-message', {
        chatId: chatId,
        id: msg.id.id,
        body: msg.body,
        fromMe: msg.fromMe,
        timestamp: msg.timestamp,
        type: msg.type,
        sender: msg.author || msg.from,
    });
});

// ==========================================
// AI ENGINE: FETCH WITH RETRY & ROTATION
// ==========================================
const delayMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, options, retries = 3, backoff = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) {
                return response;
            }
            if (response.status === 429 || response.status >= 500) {
                console.warn(
                    `[AI Request] Gagal dengan status ${response.status}. Retry ${
                        i + 1
                    }/${retries}...`,
                );
                if (i < retries - 1) {
                    await delayMs(backoff);
                    backoff *= 2;
                    continue;
                }
            }
            return response;
        } catch (error) {
            console.warn(
                `[AI Request] Network error: ${error.message}. Retry ${
                    i + 1
                }/${retries}...`,
            );
            if (i < retries - 1) {
                await delayMs(backoff);
                backoff *= 2;
                continue;
            }
            throw error;
        }
    }
}

async function queryGemini(apiKey, systemPrompt, historyOrMessage) {
    const primaryModel = aiConfig.providers.gemini.model || 'gemini-2.5-flash';
    const models = [primaryModel];
    if (primaryModel === 'gemini-2.5-flash') {
        models.push('gemini-1.5-flash');
        models.push('gemini-1.5-pro');
    } else if (primaryModel === 'gemini-1.5-flash') {
        models.push('gemini-2.5-flash');
        models.push('gemini-1.5-pro');
    }

    let history = [];
    if (typeof historyOrMessage === 'string') {
        history = [{ role: 'user', text: historyOrMessage }];
    } else {
        history = historyOrMessage;
    }

    // Map history ke format Gemini API
    const contents = history.map((h) => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.text }],
    }));

    const requestBody = {
        contents: contents,
    };

    if (systemPrompt) {
        requestBody.systemInstruction = {
            parts: [{ text: systemPrompt }],
        };
    }

    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    };

    let lastError = null;
    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            console.log(`[AI Engine] Mengirim request ke model: ${model}...`);
            const res = await fetchWithRetry(url, options);
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
            }
            const data = await res.json();
            if (
                data.candidates &&
                data.candidates[0] &&
                data.candidates[0].content &&
                data.candidates[0].content.parts &&
                data.candidates[0].content.parts[0]
            ) {
                return data.candidates[0].content.parts[0].text;
            }
            throw new Error('Struktur respon Gemini tidak valid.');
        } catch (err) {
            lastError = err;
            if (err.message.includes('429')) {
                console.log(
                    `[AI Engine] Model ${model} terkena Limit/Quota Exceeded (429), mencoba fallback ke model berikutnya...`,
                );
                continue;
            }
            throw err;
        }
    }
    throw lastError;
}

async function queryOpenAI(apiKey, systemPrompt, historyOrMessage) {
    const model = aiConfig.providers.openai.model || 'gpt-4o-mini';
    const url = 'https://api.openai.com/v1/chat/completions';

    let history = [];
    if (typeof historyOrMessage === 'string') {
        history = [{ role: 'user', text: historyOrMessage }];
    } else {
        history = historyOrMessage;
    }

    const messages = [];
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    history.forEach((h) => {
        messages.push({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.text,
        });
    });

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
        }),
    };

    const res = await fetchWithRetry(url, options);
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI HTTP ${res.status}: ${errText}`);
    }
    const data = await res.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
    }
    throw new Error('Struktur respon OpenAI tidak valid.');
}

async function queryClaude(apiKey, systemPrompt, historyOrMessage) {
    const model =
        aiConfig.providers.claude.model || 'claude-3-5-sonnet-20260229';
    const url = 'https://api.anthropic.com/v1/messages';

    let history = [];
    if (typeof historyOrMessage === 'string') {
        history = [{ role: 'user', text: historyOrMessage }];
    } else {
        history = historyOrMessage;
    }

    const messages = history.map((h) => ({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.text,
    }));

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages,
        }),
    };

    const res = await fetchWithRetry(url, options);
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Claude HTTP ${res.status}: ${errText}`);
    }
    const data = await res.json();
    if (data.content && data.content[0]) {
        return data.content[0].text;
    }
    throw new Error('Struktur respon Claude tidak valid.');
}

async function generateAIResponse(
    historyOrMessage,
    customSystemPrompt,
    customDefaultProvider,
    senderName,
) {
    const providersOrder = ['gemini', 'openai', 'claude'];
    const defaultProv =
        customDefaultProvider !== undefined
            ? customDefaultProvider
            : aiConfig.defaultProvider || 'gemini';
    let sysPrompt =
        customSystemPrompt !== undefined
            ? customSystemPrompt
            : aiConfig.systemPrompt;

    if (senderName) {
        sysPrompt = `Nama kontak pengirim saat ini adalah "${senderName}". Panggilah dia dengan namanya jika dirasa perlu/cocok agar terasa sangat akrab.\n\n${sysPrompt}`;
    }

    // Tambahkan instruksi pemformatan chat manusia alami ke System Prompt
    const humanizerInstructions =
        '\n\n[ATURAN PENTING GAYA CHAT WHATSAPP MANUSIA]:\n' +
        '1. Jawablah dengan gaya chat WhatsApp yang santai, kasual, singkat, dan alami layaknya manusia (bukan asisten robot).\n' +
        '2. HINDARI pembuka/penutup formal, penjelasan teoretis panjang lebar, bullet points, daftar bernomor, dan simbol berlebih.\n' +
        '3. JANGAN PERNAH menyebutkan bahwa Anda adalah AI, LLM, atau program komputer. Berperanlah sepenuhnya sebagai admin/rekan manusia.\n' +
        '4. Panjang jawaban maksimal 1-2 kalimat pendek saja agar terasa natural dan nyata.';

    sysPrompt = sysPrompt + humanizerInstructions;

    const activeProviders = [
        defaultProv,
        ...providersOrder.filter((p) => p !== defaultProv),
    ];

    for (const provider of activeProviders) {
        const provConfig = aiConfig.providers[provider];
        if (!provConfig || !provConfig.keys || provConfig.keys.length === 0) {
            continue;
        }

        const numKeys = provConfig.keys.length;
        const startIndex = provConfig.currentIndex || 0;

        for (let attempt = 0; attempt < numKeys; attempt++) {
            const keyIndex = (startIndex + attempt) % numKeys;
            const apiKey = provConfig.keys[keyIndex];

            try {
                console.log(
                    `[AI Engine] Mencoba ${provider} dengan key index ${keyIndex}...`,
                );
                let replyText = '';
                if (provider === 'gemini') {
                    replyText = await queryGemini(
                        apiKey,
                        sysPrompt,
                        historyOrMessage,
                    );
                } else if (provider === 'openai') {
                    replyText = await queryOpenAI(
                        apiKey,
                        sysPrompt,
                        historyOrMessage,
                    );
                } else if (provider === 'claude') {
                    replyText = await queryClaude(
                        apiKey,
                        sysPrompt,
                        historyOrMessage,
                    );
                }

                if (replyText) {
                    // Simpan index berikutnya agar round-robin berjalan
                    provConfig.currentIndex = (keyIndex + 1) % numKeys;
                    saveAIConfig();

                    console.log(
                        `[AI Engine] Sukses mendapatkan respon dari ${provider}.`,
                    );
                    return { success: true, provider, replyText };
                }
            } catch (err) {
                console.error(
                    `[AI Engine Error] ${provider} gagal pada key index ${keyIndex}:`,
                    err.message,
                );
                logToFrontend(
                    'ERROR',
                    `AI ${provider} key-idx ${keyIndex} gagal: ${err.message}`,
                );
            }
        }

        console.warn(
            `[AI Engine] Seluruh API key untuk ${provider} gagal/habis. Mencoba provider berikutnya...`,
        );
    }

    return {
        success: false,
        error: 'Seluruh AI Provider gagal atau belum dikonfigurasi.',
    };
}

// ==========================================
// CAMPAIGN RUNNER: SCHEDULER & SENDER
// ==========================================
// Helper for Spintax
function resolveSpintax(text) {
    const spintaxPattern = /\{([^{}|]+(?:\|[^{}|]+)+)\}/g;
    let matches;
    let newText = text;
    while ((matches = spintaxPattern.exec(newText)) !== null) {
        const options = matches[1].split('|');
        const chosenOption =
            options[Math.floor(Math.random() * options.length)];
        newText = newText.replace(matches[0], chosenOption);
        spintaxPattern.lastIndex = 0;
    }
    return newText;
}

const { spawn, exec } = require('child_process');

function sendAdbMessage(phone, message) {
    return new Promise((resolve, reject) => {
        const pythonScriptPath = path.join(
            __dirname,
            'adb-automation',
            'adb_sender.py',
        );
        console.log(
            `[ADB SENDER] Spawning Python script to send message to ${phone}`,
        );

        const pythonProcess = spawn('python', [
            pythonScriptPath,
            '--phone',
            phone,
            '--message',
            message,
        ]);

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                console.log(
                    `[ADB SENDER] Python script success: ${stdout.trim()}`,
                );
                resolve(stdout);
            } else {
                console.error(
                    `[ADB SENDER] Python script failed with code ${code}. Stderr: ${stderr}`,
                );
                reject(
                    new Error(
                        stderr.trim() ||
                            `Python script exited with code ${code}`,
                    ),
                );
            }
        });

        pythonProcess.on('error', (err) => {
            console.error('[ADB SENDER] Failed to start Python process:', err);
            reject(new Error(`Failed to start python: ${err.message}`));
        });
    });
}

// ==========================================
// CAMPAIGN RUNNER: SCHEDULER & SENDER
// ==========================================
async function runCampaign(campaignId) {
    if (runningCampaigns.get(campaignId)) {
        return;
    }
    runningCampaigns.set(campaignId, true);

    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) {
        runningCampaigns.delete(campaignId);
        return;
    }

    campaign.status = 'PROCESSING';
    saveCampaigns();
    io.emit('campaign-update', campaign);

    logToFrontend('CAMPAIGN', `Memulai projek siaran "${campaign.name}"...`);

    let sentCount = 0;

    for (let i = 0; i < campaign.recipients.length; i++) {
        const currentCampaign = campaigns.find((c) => c.id === campaignId);
        if (!currentCampaign || currentCampaign.status !== 'PROCESSING') {
            logToFrontend(
                'CAMPAIGN',
                `Projek siaran "${campaign.name}" dihentikan/pause.`,
            );
            runningCampaigns.delete(campaignId);
            return;
        }

        const recipient = currentCampaign.recipients[i];
        if (recipient.status === 'SENT' || recipient.status === 'FAILED') {
            continue;
        }

        const rawPhone = recipient.phone.trim();
        const cleanNumber = rawPhone.replace(/\D/g, '');
        if (!cleanNumber) {
            recipient.status = 'FAILED';
            recipient.error = 'Nomor tidak valid';
            saveCampaigns();
            io.emit('campaign-update', currentCampaign);
            continue;
        }

        const activeSendMode =
            globalSendMode === 'adb' ? 'adb' : currentCampaign.sendMode;

        // Resolusi JID/LID menggunakan getNumberId sebelum kirim pesan
        let formattedNumber = null;
        if (activeSendMode !== 'adb') {
            try {
                const numberId = await client.getNumberId(cleanNumber);
                if (numberId) {
                    formattedNumber = numberId._serialized;
                } else {
                    recipient.status = 'FAILED';
                    recipient.error = 'Nomor tidak terdaftar di WhatsApp';
                    saveCampaigns();
                    io.emit('campaign-update', currentCampaign);
                    continue;
                }
            } catch (err) {
                recipient.status = 'FAILED';
                recipient.error = `Gagal verifikasi nomor: ${err.message}`;
                saveCampaigns();
                io.emit('campaign-update', currentCampaign);
                continue;
            }
        }

        let personalizedMsg = currentCampaign.message
            .replace(/{name}/gi, recipient.name || 'Pelanggan')
            .replace(/{phone}/gi, cleanNumber);

        // Resolve spintax (contoh: {Halo|Hai|Selamat pagi})
        personalizedMsg = resolveSpintax(personalizedMsg);

        if (activeSendMode !== 'adb') {
            // Simulasi Mengetik (Typing Presence)
            try {
                await client.pupPage.evaluate(async (chatId) => {
                    await window.WWebJS.sendChatstate('typing', chatId);
                }, formattedNumber);

                // Delay mengetik proporsional: 40ms per karakter (min 2 detik, max 7 detik)
                const typingDelay = Math.min(
                    Math.max(personalizedMsg.length * 40, 2000),
                    7000,
                );
                await new Promise((resolve) =>
                    setTimeout(resolve, typingDelay),
                );

                // Matikan status mengetik setelah selesai
                await client.pupPage
                    .evaluate(async (chatId) => {
                        await window.WWebJS.sendChatstate('stop', chatId);
                    }, formattedNumber)
                    .catch(() => {});
            } catch (e) {
                console.log(
                    `[DEBUG] Lewati simulasi mengetik untuk ${cleanNumber}:`,
                    e.message,
                );
            }
        } else {
            // Untuk ADB, berikan jeda statis sebelum mulai proses kirim
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        try {
            logToFrontend(
                'CAMPAIGN',
                `[Projek: ${currentCampaign.name}] Mengirim ke ${recipient.name} (${cleanNumber}) via ${activeSendMode === 'adb' ? 'ADB' : 'WhatsApp Web'}...`,
            );
            if (activeSendMode === 'adb') {
                await sendAdbMessage(cleanNumber, personalizedMsg);
            } else {
                await client.sendMessage(formattedNumber, personalizedMsg);
            }

            recipient.status = 'SENT';
            recipient.sentAt = new Date().toISOString();
            recipient.error = null;
        } catch (error) {
            logToFrontend(
                'ERROR',
                `[Projek: ${currentCampaign.name}] Gagal mengirim ke ${recipient.name}: ${error.message}`,
            );
            recipient.status = 'FAILED';
            recipient.error = error.message;
        }

        saveCampaigns();
        io.emit('campaign-update', currentCampaign);

        const pendingCount = currentCampaign.recipients.filter(
            (r) => r.status === 'PENDING',
        ).length;

        if (pendingCount > 0) {
            if (recipient.status === 'SENT') {
                sentCount++;
                const isAdb = activeSendMode === 'adb';
                if (sentCount % 10 === 0) {
                    // Istirahat pendinginan yang lebih lama agar menyerupai perilaku manusia (ADB: 10-20s, Web: 60-120s)
                    const coolDown = isAdb
                        ? Math.floor(Math.random() * 10000) + 10000
                        : Math.floor(Math.random() * 60000) + 60000;
                    logToFrontend(
                        'CAMPAIGN',
                        `Batch limit tercapai (10 pesan). Istirahat pendinginan selama ${
                            coolDown / 1000
                        } detik...`,
                    );
                    for (let d = 0; d < coolDown; d += 1000) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, 1000),
                        );
                        const checkCampaign = campaigns.find(
                            (c) => c.id === campaignId,
                        );
                        if (
                            !checkCampaign ||
                            checkCampaign.status !== 'PROCESSING'
                        ) {
                            runningCampaigns.delete(campaignId);
                            return;
                        }
                    }
                } else {
                    // Jeda acak antar-pesan (ADB: 4-8s, Web: 30-60s)
                    const delay = isAdb
                        ? Math.floor(Math.random() * 4000) + 4000
                        : Math.floor(Math.random() * 30000) + 30000;
                    logToFrontend(
                        'CAMPAIGN',
                        `Jeda aman acak: menunggu ${delay / 1000} detik...`,
                    );

                    for (let d = 0; d < delay; d += 1000) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, 1000),
                        );
                        const checkCampaign = campaigns.find(
                            (c) => c.id === campaignId,
                        );
                        if (
                            !checkCampaign ||
                            checkCampaign.status !== 'PROCESSING'
                        ) {
                            runningCampaigns.delete(campaignId);
                            return;
                        }
                    }
                }
            } else {
                // Jika gagal, berikan jeda singkat saja (2 detik) untuk transisi antar nomor
                const failDelay = 2000;
                logToFrontend(
                    'CAMPAIGN',
                    `Pengiriman gagal. Menunggu ${failDelay / 1000} detik sebelum lanjut ke penerima berikutnya...`,
                );
                for (let d = 0; d < failDelay; d += 1000) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    const checkCampaign = campaigns.find(
                        (c) => c.id === campaignId,
                    );
                    if (
                        !checkCampaign ||
                        checkCampaign.status !== 'PROCESSING'
                    ) {
                        runningCampaigns.delete(campaignId);
                        return;
                    }
                }
            }
        }
    }

    const finalCampaign = campaigns.find((c) => c.id === campaignId);
    if (finalCampaign) {
        const failedCount = finalCampaign.recipients.filter(
            (r) => r.status === 'FAILED',
        ).length;
        finalCampaign.status = 'COMPLETED';
        saveCampaigns();
        io.emit('campaign-update', finalCampaign);
        logToFrontend(
            'CAMPAIGN',
            `🎉 Projek siaran "${finalCampaign.name}" selesai! (Gagal: ${failedCount})`,
        );
    }
    runningCampaigns.delete(campaignId);
}

// Helper for human-like response delay (read delay + typing delay proportional to response length)
// Helper for human-like response delay (read delay + typing delay proportional to response length)
async function sendNaturalReply(msg, replyText, senderPhone) {
    if (globalSendMode === 'adb') {
        const cleanPhone = senderPhone || msg.from.split('@')[0];
        console.log(
            `[SYSTEM] Sending AI/Auto-reply to ${cleanPhone} via Android ADB...`,
        );
        try {
            await sendAdbMessage(cleanPhone, replyText);
            console.log(`[SYSTEM] AI/Auto-reply sent successfully via ADB.`);
        } catch (error) {
            console.error(
                `[SYSTEM] Gagal mengirim AI/Auto-reply via ADB:`,
                error.message,
            );
        }
        return;
    }

    try {
        const jids = [msg.from];
        if (senderPhone) {
            const pnJid = `${senderPhone}@c.us`;
            if (pnJid !== msg.from) {
                jids.push(pnJid);
            }
        }

        console.log(
            `[SYSTEM] [Live Status] Memulai alur jeda natural. Target JID: ${jids.join(
                ', ',
            )}`,
        );

        // 1. Jeda Membaca (Read Delay): 1 - 3 detik acak
        const readDelay = Math.floor(Math.random() * 2000) + 1000;
        console.log(
            `[SYSTEM] [Live Status] Jeda membaca: menunggu ${
                readDelay / 1000
            } detik...`,
        );
        await new Promise((resolve) => setTimeout(resolve, readDelay));

        // Kirim status dilihat (Seen/Read) ke semua target JID
        for (const jid of jids) {
            try {
                console.log(
                    `[SYSTEM] [Live Status] Mengirim sinyal BACA (seen) ke JID: ${jid}`,
                );
                await client.pupPage.evaluate(async (chatId) => {
                    await window.WWebJS.sendSeen(chatId);
                }, jid);
            } catch (err) {
                console.warn(
                    `[SYSTEM] [Live Status] Gagal sendSeen ke ${jid}:`,
                    err.message,
                );
            }
        }

        // 2. Jeda Mengetik (Typing Delay) dinamis sesuai panjang respons
        const charsCount = replyText.length;
        const typingSpeed = Math.floor(Math.random() * 20) + 30; // 30-50 ms per karakter
        let typingDuration = charsCount * typingSpeed;
        typingDuration = Math.max(1500, Math.min(typingDuration, 8000));

        // Nyalakan indikator status mengetik ke semua target JID
        for (const jid of jids) {
            try {
                console.log(
                    `[SYSTEM] [Live Status] Mengaktifkan sinyal MENGETIK (typing) ke JID: ${jid} selama ${
                        typingDuration / 1000
                    } detik...`,
                );
                await client.pupPage.evaluate(async (chatId) => {
                    await window.WWebJS.sendChatstate('typing', chatId);
                }, jid);
            } catch (err) {
                console.warn(
                    `[SYSTEM] [Live Status] Gagal sendChatstate typing ke ${jid}:`,
                    err.message,
                );
            }
        }

        // Tunggu durasi mengetik selesai
        console.log(
            `[SYSTEM] [Live Status] Menunggu durasi mengetik selesai (${
                typingDuration / 1000
            } detik)...`,
        );
        await new Promise((resolve) => setTimeout(resolve, typingDuration));

        // Kirim pesan balasan
        console.log(
            `[SYSTEM] [Live Status] Mengirim pesan balasan ke JID: ${msg.from}`,
        );
        await msg.reply(replyText);

        // Hentikan status mengetik
        for (const jid of jids) {
            try {
                console.log(
                    `[SYSTEM] [Live Status] Membersihkan status mengetik di JID: ${jid}`,
                );
                await client.pupPage.evaluate(async (chatId) => {
                    await window.WWebJS.sendChatstate('stop', chatId);
                }, jid);
            } catch (ignoredError) {
                // Abaikan
            }
        }
    } catch (error) {
        console.error('[SYSTEM] Gagal mengirim natural reply:', error);
        await msg.reply(replyText);
    }
}

// Auto-Reply Engine (Static Rules & AI Assistant)
client.on('message', async (msg) => {
    // Abaikan jika pesan dari diri sendiri atau dari grup
    if (msg.fromMe) return;
    if (msg.from.endsWith('@g.us')) return;

    // Resolusi Contact untuk mengatasi LID JID (@lid) dan mendapatkan nomor HP asli (@c.us) serta Nama Kontak
    let senderPhone = '';
    let senderName = '';
    const isLid = msg.from.endsWith('@lid');
    try {
        const contact = await msg.getContact();
        if (contact) {
            senderName = contact.name || contact.pushname || '';
            if (contact.id && contact.id.user) {
                senderPhone = contact.id.user.replace(/\D/g, '');
            } else {
                senderPhone = msg.from.replace(/\D/g, '');
            }
        } else {
            senderPhone = msg.from.replace(/\D/g, '');
        }
    } catch (err) {
        console.warn(
            '[SYSTEM] Gagal mendapatkan detail contact, fallback ke raw JID:',
            err.message,
        );
        senderPhone = msg.from.replace(/\D/g, '');
    }

    if (senderPhone.startsWith('0')) {
        senderPhone = '62' + senderPhone.slice(1);
    }

    // Log Penerimaan Pesan
    console.log(
        `[SYSTEM] Pesan masuk diterima dari ${msg.from} (Resolved Phone: ${senderPhone}, isLID: ${isLid}): "${msg.body}"`,
    );
    logToFrontend(
        'AUTO-REPLY',
        `Menerima pesan dari ${msg.from} (Resolved Phone: ${senderPhone}): "${msg.body}"`,
    );

    // Ambil riwayat chat dinamis dari WhatsApp Web (Memori Chat)
    const history = [];
    try {
        const rawMsgs = await client.pupPage.evaluate(
            async (fromJid, phoneJid) => {
                const ChatColl = window.require('WAWebCollections').Chat;
                if (!ChatColl) return [];

                // Cari chat secara manual berdasarkan serialized ID
                const chat = ChatColl.getModelsArray().find((c) => {
                    const serialized = c.id && c.id._serialized;
                    return (
                        serialized === fromJid ||
                        (phoneJid && serialized === phoneJid)
                    );
                });

                if (!chat) return [];

                const msgFilter = (m) => {
                    return !m.isNotification && m.type === 'chat';
                };

                let msgs = chat.msgs.getModelsArray().filter(msgFilter);

                // Load messages jika kurang dari 12
                if (msgs.length < 12) {
                    try {
                        const loadEarlierMsgs = window.require(
                            'WAWebChatLoadMessages',
                        ).loadEarlierMsgs;
                        if (typeof loadEarlierMsgs === 'function') {
                            for (let i = 0; i < 2; i++) {
                                const loaded = await loadEarlierMsgs({ chat });
                                if (!loaded || !loaded.length) break;
                                msgs = [...loaded.filter(msgFilter), ...msgs];
                                if (msgs.length >= 12) break;
                            }
                        }
                    } catch (ignoredError) {
                        console.log(
                            '[DEBUG] Gagal memuat pesan sebelumnya di browser',
                        );
                    }
                }

                return msgs.map((m) => ({
                    id: m.id._serialized,
                    fromMe: m.id.fromMe,
                    type: m.type,
                    body: m.body,
                    t: m.t,
                }));
            },
            msg.from,
            senderPhone ? `${senderPhone}@c.us` : null,
        );

        rawMsgs.sort((a, b) => a.t - b.t);
        const recentMsgs = rawMsgs.filter((m) => m.type === 'chat').slice(-12);

        recentMsgs.forEach((m) => {
            history.push({
                role: m.fromMe ? 'model' : 'user',
                text: m.body,
            });
        });

        console.log(
            `[SYSTEM] [Memory] Berhasil mengambil ${history.length} pesan riwayat melalui evaluasi Chat.`,
        );
    } catch (err) {
        console.log(
            '[SYSTEM] [Memory] Gagal mengambil riwayat via evaluasi Chat:',
            err.message,
        );
    }

    // Pastikan pesan terakhir dari user masuk ke riwayat
    const lastInHist = history[history.length - 1];
    if (!lastInHist || lastInHist.text !== msg.body) {
        history.push({ role: 'user', text: msg.body });
    }

    // Cari projek terakhir yang berasosiasi dengan nomor pengirim ini (dengan normalisasi nomor)
    const activeProject = campaigns
        .slice()
        .reverse()
        .find((c) => {
            return (
                c.recipients &&
                c.recipients.some((r) => {
                    let rPhone = r.phone.replace(/\D/g, '');
                    if (rPhone.startsWith('0')) {
                        rPhone = '62' + rPhone.slice(1);
                    }
                    return rPhone === senderPhone;
                })
            );
        });

    if (activeProject) {
        console.log(
            `[SYSTEM] Nomor ${senderPhone} terdaftar di projek: "${
                activeProject.name
            }" (AI Aktif: ${
                activeProject.aiConfig ? activeProject.aiConfig.enabled : false
            })`,
        );
        logToFrontend(
            'AI-ASSISTANT',
            `Nomor ${senderPhone} terdaftar di projek "${
                activeProject.name
            }" (AI Aktif: ${
                activeProject.aiConfig ? activeProject.aiConfig.enabled : false
            })`,
        );
    }

    // Jika pengirim terdaftar di suatu projek dan AI khusus projek tersebut aktif
    if (
        activeProject &&
        activeProject.aiConfig &&
        activeProject.aiConfig.enabled
    ) {
        try {
            console.log(
                `[SYSTEM] Memproses AI auto-reply untuk projek "${activeProject.name}"...`,
            );
            logToFrontend(
                'AI-ASSISTANT',
                `[Projek: ${activeProject.name}] Meminta respons AI menggunakan provider "${activeProject.aiConfig.provider}"...`,
            );

            const aiRes = await generateAIResponse(
                history,
                activeProject.aiConfig.systemPrompt,
                activeProject.aiConfig.provider,
                senderName,
            );

            if (aiRes.success) {
                console.log(
                    `[SYSTEM] AI berhasil merespons: "${aiRes.replyText}"`,
                );
                logToFrontend(
                    'AI-ASSISTANT',
                    `[Projek: ${activeProject.name}] AI menghasilkan output: "${aiRes.replyText}"`,
                );

                await sendNaturalReply(msg, aiRes.replyText, senderPhone);
                logToFrontend(
                    'AI-ASSISTANT',
                    `✅ Sukses membalas pesan AI Projek ke ${msg.from}`,
                );
                return; // Selesai
            } else {
                console.warn(`[SYSTEM] AI gagal merespons: ${aiRes.error}`);
                logToFrontend(
                    'ERROR',
                    `[Projek: ${activeProject.name}] AI Projek gagal menjawab: ${aiRes.error}`,
                );
            }
        } catch (error) {
            console.error(
                `[SYSTEM] Gagal memproses AI Projek auto-reply ke ${msg.from}:`,
                error,
            );
            logToFrontend(
                'ERROR',
                `Gagal memproses AI Projek auto-reply ke ${msg.from}: ${error.message}`,
            );
        }
    }

    if (!autoReplyConfig.enabled && !aiConfig.enabled) {
        return;
    }

    const messageText = msg.body.toLowerCase().trim();

    // 1. Coba static keyword matching terlebih dahulu (jika global static rules aktif)
    let matchedRule = null;
    if (autoReplyConfig.enabled) {
        matchedRule = autoReplyConfig.rules.find(
            (rule) => rule.keyword.toLowerCase().trim() === messageText,
        );
    }

    if (matchedRule) {
        try {
            logToFrontend(
                'AUTO-REPLY',
                `Pesan masuk "${msg.body}" memicu keyword "${matchedRule.keyword}". Membalas...`,
            );
            await sendNaturalReply(msg, matchedRule.reply, senderPhone);
            logToFrontend(
                'AUTO-REPLY',
                `Sukses membalas pesan dari ${msg.from}`,
            );
            return; // Selesai
        } catch (error) {
            logToFrontend(
                'ERROR',
                `Gagal memproses auto-reply static ke ${msg.from}: ${error.message}`,
            );
        }
    }

    // 2. Jika tidak ada keyword yang cocok, dan AI aktif, panggil AI Engine
    if (aiConfig.enabled) {
        try {
            logToFrontend(
                'AI-ASSISTANT',
                `Mencari jawaban AI untuk pesan: "${msg.body}" dari ${msg.from}...`,
            );
            const aiRes = await generateAIResponse(
                history,
                undefined,
                undefined,
                senderName,
            );
            if (aiRes.success) {
                logToFrontend(
                    'AI-ASSISTANT',
                    `✅ Membalas dengan AI (${aiRes.provider}) ke ${msg.from}...`,
                );
                await sendNaturalReply(msg, aiRes.replyText, senderPhone);
                logToFrontend(
                    'AI-ASSISTANT',
                    `Sukses membalas pesan AI ke ${msg.from}`,
                );
            } else {
                logToFrontend('ERROR', `AI gagal menjawab: ${aiRes.error}`);
            }
        } catch (error) {
            logToFrontend(
                'ERROR',
                `Gagal memproses AI auto-reply ke ${msg.from}: ${error.message}`,
            );
        }
    }
});

// Socket.io Connection Handler
let activeMirrorClients = new Set();
let mirrorLoopTimeout = null;
let cachedAdbResolution = null;

function getAdbResolution() {
    return new Promise((resolve) => {
        exec('adb shell wm size', (err, stdout) => {
            if (err) {
                console.error(
                    '[ADB RESOLUTION] Error fetching resolution, using default 1080x2400:',
                    err.message,
                );
                resolve({ width: 1080, height: 2400 });
                return;
            }
            const match = stdout.match(/Physical size:\s*(\d+)x(\d+)/i);
            if (match) {
                const width = parseInt(match[1]);
                const height = parseInt(match[2]);
                console.log(
                    `[ADB RESOLUTION] Detected device resolution: ${width}x${height}`,
                );
                resolve({ width, height });
            } else {
                resolve({ width: 1080, height: 2400 });
            }
        });
    });
}

function startAdbMirrorLoop() {
    if (activeMirrorClients.size === 0 || mirrorLoopTimeout) return;

    const runCapture = () => {
        if (activeMirrorClients.size === 0) {
            mirrorLoopTimeout = null;
            return;
        }

        const adb = spawn('adb', ['exec-out', 'screencap', '-p']);
        let chunks = [];

        adb.stdout.on('data', (chunk) => {
            chunks.push(chunk);
        });

        adb.on('close', (code) => {
            if (code === 0) {
                const buffer = Buffer.concat(chunks);
                if (buffer.length > 0) {
                    const base64Data = buffer.toString('base64');
                    io.emit('adb-screen', base64Data);
                }
            }
            mirrorLoopTimeout = setTimeout(runCapture, 500); // 500ms delay between frames
        });

        adb.on('error', (err) => {
            console.error('[ADB SCREEN] Error capturing screen:', err.message);
            mirrorLoopTimeout = setTimeout(runCapture, 1500); // longer delay if error
        });
    };

    runCapture();
}

function stopAdbMirrorLoop() {
    if (activeMirrorClients.size === 0 && mirrorLoopTimeout) {
        clearTimeout(mirrorLoopTimeout);
        mirrorLoopTimeout = null;
    }
}

io.on('connection', (socket) => {
    console.log('Koneksi dashboard terhubung ke WebSocket');
    socket.emit('status-update', { status: botStatus, qrCode: qrCodeData });
    socket.emit('global-mode-update', globalSendMode);

    socket.on('start-adb-mirror', () => {
        console.log(`Socket ${socket.id} started viewing ADB screen`);
        activeMirrorClients.add(socket.id);
        startAdbMirrorLoop();
    });

    socket.on('stop-adb-mirror', () => {
        console.log(`Socket ${socket.id} stopped viewing ADB screen`);
        activeMirrorClients.delete(socket.id);
        stopAdbMirrorLoop();
    });

    socket.on('set-global-mode', (mode) => {
        if (mode === 'wwebjs' || mode === 'adb') {
            globalSendMode = mode;
            console.log(
                `[SETTINGS] Global Send Mode updated to: ${globalSendMode}`,
            );
            io.emit('global-mode-update', globalSendMode);
        }
    });

    socket.on('adb-tap', async (coords) => {
        if (
            typeof coords !== 'object' ||
            coords.x === undefined ||
            coords.y === undefined
        )
            return;
        try {
            if (!cachedAdbResolution) {
                cachedAdbResolution = await getAdbResolution();
            }
            const absX = Math.round(coords.x * cachedAdbResolution.width);
            const absY = Math.round(coords.y * cachedAdbResolution.height);
            console.log(
                `[ADB INPUT] Tapping at coordinates: (${absX}, ${absY})`,
            );
            exec(`adb shell input tap ${absX} ${absY}`, (err) => {
                if (err) console.error(`[ADB INPUT] Tap error:`, err.message);
            });
        } catch (err) {
            console.error('[ADB INPUT] Tap resolution error:', err.message);
        }
    });

    socket.on('adb-keyevent', (keycode) => {
        if (!keycode) return;
        console.log(`[ADB INPUT] Keyevent: ${keycode}`);
        exec(`adb shell input keyevent ${keycode}`, (err) => {
            if (err) console.error(`[ADB INPUT] Keyevent error:`, err.message);
        });
    });

    socket.on('adb-text', (text) => {
        if (typeof text !== 'string') return;
        console.log(`[ADB INPUT] Typing text: ${text}`);
        // Replace spaces with %s and escape characters for shell
        const escapedText = text.replace(/[^a-zA-Z0-9.,!?@-]/g, (char) => {
            if (char === ' ') return '%s';
            return ''; // strip out other special chars
        });
        exec(`adb shell input text ${escapedText}`, (err) => {
            if (err)
                console.error(`[ADB INPUT] Text input error:`, err.message);
        });
    });

    socket.on('disconnect', () => {
        if (activeMirrorClients.has(socket.id)) {
            activeMirrorClients.delete(socket.id);
            stopAdbMirrorLoop();
        }
    });
});

// ================== API ENDPOINTS ==================

// 1. Get Chat List
app.get('/api/chats', async (req, res) => {
    if (botStatus !== 'READY') {
        return res
            .status(400)
            .json({ success: false, error: 'WhatsApp belum siap.' });
    }

    try {
        console.log('[DEBUG] Memulai pengambilan chat dari WhatsApp...');
        const rawChats = await client.getChats();
        console.log(`[DEBUG] Berhasil mengambil ${rawChats.length} chat.`);
        const chats = rawChats
            .slice(0, 30)
            .map((chat) => {
                if (!chat) return null;
                return {
                    id: chat.id ? chat.id._serialized : 'unknown@c.us',
                    name: chat.name || 'WhatsApp User',
                    unreadCount: chat.unreadCount || 0,
                    timestamp: chat.timestamp || Math.floor(Date.now() / 1000),
                    isGroup:
                        typeof chat.isGroup === 'boolean'
                            ? chat.isGroup
                            : false,
                };
            })
            .filter(Boolean);
        res.json({ success: true, chats: chats });
    } catch (error) {
        console.error('[ERROR] Gagal di GET /api/chats:', error);
        logToFrontend(
            'ERROR',
            `Gagal mengambil chat: ${error.stack || error.message}`,
        );
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Get Message History for a Chat
app.get('/api/chats/:id/messages', async (req, res) => {
    if (botStatus !== 'READY') {
        return res
            .status(400)
            .json({ success: false, error: 'WhatsApp belum siap.' });
    }

    try {
        const chat = await client.getChatById(req.params.id);
        const rawMessages = await chat.fetchMessages({ limit: 40 });
        const messages = rawMessages.map((msg) => ({
            id: msg.id.id,
            body: msg.body,
            fromMe: msg.fromMe,
            timestamp: msg.timestamp,
            type: msg.type,
            sender: msg.author || msg.from,
        }));
        res.json({ success: true, messages: messages });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Kirim Pesan Tunggal
app.post('/api/send', async (req, res) => {
    const { to, message } = req.body;

    if (globalSendMode !== 'adb' && botStatus !== 'READY') {
        return res
            .status(400)
            .json({ success: false, error: 'WhatsApp belum siap.' });
    }
    if (!to || !message) {
        return res.status(400).json({
            success: false,
            error: 'Nomor tujuan dan pesan wajib diisi.',
        });
    }

    let cleanNumber = to.replace(/\D/g, '');

    if (globalSendMode === 'adb') {
        try {
            logToFrontend('SEND', `Mengirim pesan tunggal ke ${to} via ADB...`);
            await sendAdbMessage(cleanNumber, message);
            logToFrontend('SEND', `Pesan sukses terkirim ke ${to} via ADB`);
            res.json({ success: true });
        } catch (error) {
            logToFrontend(
                'ERROR',
                `Gagal mengirim ke ${to} via ADB: ${error.message}`,
            );
            res.status(500).json({ success: false, error: error.message });
        }
        return;
    }

    if (!cleanNumber.endsWith('@c.us') && !cleanNumber.endsWith('@g.us')) {
        cleanNumber = `${cleanNumber}@c.us`;
    }

    try {
        logToFrontend('SEND', `Mengirim pesan ke ${to}...`);
        await client.sendMessage(cleanNumber, message);
        logToFrontend('SEND', `Pesan terkirim ke ${to}`);
        res.json({ success: true });
    } catch (error) {
        logToFrontend('ERROR', `Gagal mengirim ke ${to}: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. Kirim Pesan Media (Gambar, Dokumen, dll)
app.post('/api/send-media', async (req, res) => {
    const { to, data, filename, mimetype, caption } = req.body;

    if (botStatus !== 'READY') {
        return res
            .status(400)
            .json({ success: false, error: 'WhatsApp belum siap.' });
    }
    if (!to || !data || !mimetype) {
        return res.status(400).json({
            success: false,
            error: 'Nomor tujuan, file data, dan tipe mime wajib diisi.',
        });
    }

    let cleanNumber = to.replace(/\D/g, '');
    if (!cleanNumber.endsWith('@c.us') && !cleanNumber.endsWith('@g.us')) {
        cleanNumber = `${cleanNumber}@c.us`;
    }

    // Jika base64 berisi prefix 'data:image/png;base64,' buang prefixnya
    let rawBase64 = data;
    if (data.includes(',')) {
        rawBase64 = data.split(',')[1];
    }

    try {
        logToFrontend(
            'MEDIA',
            `Mengirim file ${filename || 'media'} ke ${to}...`,
        );
        const media = new MessageMedia(mimetype, rawBase64, filename);
        await client.sendMessage(cleanNumber, media, { caption: caption });
        logToFrontend(
            'MEDIA',
            `File ${filename || 'media'} sukses terkirim ke ${to}`,
        );
        res.json({ success: true });
    } catch (error) {
        logToFrontend(
            'ERROR',
            `Gagal mengirim media ke ${to}: ${error.message}`,
        );
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. Broadcast (Bulk Message)
app.post('/api/broadcast', async (req, res) => {
    const { numbers, message } = req.body;

    if (globalSendMode !== 'adb' && botStatus !== 'READY') {
        return res
            .status(400)
            .json({ success: false, error: 'WhatsApp belum siap.' });
    }
    if (broadcastInProgress) {
        return res.status(400).json({
            success: false,
            error: 'Proses broadcast lain sedang berjalan.',
        });
    }
    if (
        !numbers ||
        !Array.isArray(numbers) ||
        numbers.length === 0 ||
        !message
    ) {
        return res.status(400).json({
            success: false,
            error: 'Nomor tidak valid atau pesan kosong.',
        });
    }

    broadcastInProgress = true;
    io.emit('broadcast-status', {
        inProgress: true,
        total: numbers.length,
        current: 0,
    });
    res.json({ success: true, message: 'Proses broadcast dimulai.' });

    (async () => {
        logToFrontend(
            'BROADCAST',
            `Memulai broadcast ke ${numbers.length} nomor...`,
        );
        for (let i = 0; i < numbers.length; i++) {
            const rawNumber = numbers[i].trim();
            const cleanNumber = rawNumber.replace(/\D/g, '');

            if (!cleanNumber) {
                continue;
            }

            const formattedNumber = `${cleanNumber}@c.us`;
            io.emit('broadcast-status', {
                inProgress: true,
                total: numbers.length,
                current: i + 1,
            });

            try {
                logToFrontend(
                    'BROADCAST',
                    `[${i + 1}/${numbers.length}] Mengirim ke ${cleanNumber} via ${globalSendMode === 'adb' ? 'ADB' : 'WhatsApp Web'}...`,
                );
                if (globalSendMode === 'adb') {
                    await sendAdbMessage(cleanNumber, message);
                } else {
                    await client.sendMessage(formattedNumber, message);
                }
                logToFrontend(
                    'BROADCAST',
                    `✅ Sukses terkirim ke ${cleanNumber}`,
                );
            } catch (error) {
                logToFrontend(
                    'ERROR',
                    `❌ Gagal mengirim ke ${cleanNumber}: ${error.message}`,
                );
            }

            if (i < numbers.length - 1) {
                const delay = Math.floor(Math.random() * 5000) + 5000;
                logToFrontend(
                    'BROADCAST',
                    `Jeda aman: menunggu ${delay / 1000} detik sebelum pesan berikutnya...`,
                );
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        broadcastInProgress = false;
        io.emit('broadcast-status', {
            inProgress: false,
            total: numbers.length,
            current: numbers.length,
        });
        logToFrontend('BROADCAST', '🎉 Proses broadcast selesai!');
    })().catch((err) => {
        broadcastInProgress = false;
        io.emit('broadcast-status', {
            inProgress: false,
            total: numbers.length,
            current: 0,
        });
        logToFrontend('ERROR', `Kesalahan fatal broadcast: ${err.message}`);
    });
});

// 6. Get Auto-Reply Rules
app.get('/api/rules', (req, res) => {
    res.json(autoReplyConfig);
});

// 7. Save Auto-Reply Rules
app.post('/api/rules', (req, res) => {
    const { enabled, rules } = req.body;

    if (typeof enabled === 'boolean') {
        autoReplyConfig.enabled = enabled;
    }
    if (Array.isArray(rules)) {
        autoReplyConfig.rules = rules;
    }

    saveRules();
    logToFrontend(
        'SYSTEM',
        `Konfigurasi auto-reply diperbarui. Status bot: ${autoReplyConfig.enabled ? 'ON' : 'OFF'}`,
    );
    res.json({ success: true, config: autoReplyConfig });
});

// 8. Create Group
app.post('/api/groups/create', async (req, res) => {
    const { name, participants } = req.body;

    if (botStatus !== 'READY') {
        return res
            .status(400)
            .json({ success: false, error: 'WhatsApp belum siap.' });
    }
    if (
        !name ||
        !participants ||
        !Array.isArray(participants) ||
        participants.length === 0
    ) {
        return res.status(400).json({
            success: false,
            error: 'Nama grup dan minimal satu anggota wajib diisi.',
        });
    }

    const formattedParticipants = participants
        .map((num) => num.replace(/\D/g, '') + '@c.us')
        .filter((jid) => jid.length > 5);

    try {
        logToFrontend(
            'GROUP',
            `Membuat grup "${name}" dengan ${formattedParticipants.length} anggota...`,
        );
        const result = await client.createGroup(name, formattedParticipants);
        logToFrontend(
            'GROUP',
            `Grup "${name}" sukses dibuat! JID: ${result.gid._serialized}`,
        );
        res.json({ success: true, gid: result.gid._serialized });
    } catch (error) {
        logToFrontend(
            'ERROR',
            `Gagal membuat grup "${name}": ${error.message}`,
        );
        res.status(500).json({ success: false, error: error.message });
    }
});

// 9. Get Group List
app.get('/api/groups', async (req, res) => {
    if (botStatus !== 'READY') {
        return res
            .status(400)
            .json({ success: false, error: 'WhatsApp belum siap.' });
    }

    try {
        console.log('[DEBUG] Memulai pengambilan daftar grup...');
        const chats = await client.getChats();
        const groups = chats
            .filter((c) => c && c.isGroup)
            .map((c) => ({
                id: c.id ? c.id._serialized : 'unknown@g.us',
                name: c.name || (c.id && c.id.user) || 'Grup WhatsApp',
            }));
        res.json({ success: true, groups });
    } catch (error) {
        console.error('[ERROR] Gagal di GET /api/groups:', error);
        logToFrontend(
            'ERROR',
            `Gagal mengambil grup: ${error.stack || error.message}`,
        );
        res.status(500).json({ success: false, error: error.message });
    }
});

// 10. Get Group Participants
app.get('/api/groups/:id/participants', async (req, res) => {
    if (botStatus !== 'READY') {
        return res
            .status(400)
            .json({ success: false, error: 'WhatsApp belum siap.' });
    }

    try {
        const chat = await client.getChatById(req.params.id);
        if (!chat.isGroup) {
            return res
                .status(400)
                .json({ success: false, error: 'Chat ini bukan sebuah grup.' });
        }

        const participants = chat.participants.map((p) => ({
            id: p.id._serialized,
            user: p.id.user,
            isAdmin: p.isAdmin,
            isSuperAdmin: p.isSuperAdmin,
        }));

        res.json({ success: true, participants: participants });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// 11. CAMPAIGNS & AI CONFIG REST APIS
// ==========================================

// Get All Campaigns
app.get('/api/campaigns', (req, res) => {
    res.json({ success: true, campaigns });
});

// Create New Campaign
app.post('/api/campaigns', (req, res) => {
    const { name, message, recipients, sendMode } = req.body;

    if (
        !name ||
        !message ||
        !recipients ||
        !Array.isArray(recipients) ||
        recipients.length === 0
    ) {
        return res.status(400).json({
            success: false,
            error: 'Nama projek, pesan template, dan minimal satu penerima wajib diisi.',
        });
    }

    const newCampaign = {
        id:
            'camp_' +
            Date.now() +
            '_' +
            Math.random().toString(36).substr(2, 5),
        name,
        message,
        sendMode: sendMode || 'wwebjs',
        recipients: recipients.map((r) => ({
            phone: r.phone.replace(/\D/g, ''),
            name: r.name || 'Pelanggan',
            status: 'PENDING',
            sentAt: null,
            error: null,
        })),
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        aiConfig: {
            enabled: false,
            provider: 'gemini',
            systemPrompt: 'Anda adalah asisten AI ramah khusus projek ini.',
        },
    };

    campaigns.push(newCampaign);
    saveCampaigns();
    logToFrontend(
        'CAMPAIGN',
        `Projek siaran baru "${name}" berhasil dibuat dengan ${newCampaign.recipients.length} penerima.`,
    );
    res.json({ success: true, campaign: newCampaign });
});

// Update Campaign (CRUD Update & AI Config)
app.put('/api/campaigns/:id', (req, res) => {
    const campaign = campaigns.find((c) => c.id === req.params.id);
    if (!campaign) {
        return res
            .status(404)
            .json({ success: false, error: 'Projek siaran tidak ditemukan.' });
    }

    const {
        name,
        message,
        recipients,
        sendMode,
        aiConfig: reqAiConfig,
    } = req.body;

    if (name !== undefined) campaign.name = name;
    if (message !== undefined) campaign.message = message;
    if (sendMode !== undefined) campaign.sendMode = sendMode;

    if (recipients !== undefined && Array.isArray(recipients)) {
        const currentRecipients = campaign.recipients;
        const newRecipients = recipients
            .map((r) => ({
                phone: r.phone.replace(/\D/g, ''),
                name: r.name || 'Pelanggan',
            }))
            .filter((r) => r.phone.length > 5);

        const merged = [];
        newRecipients.forEach((newR) => {
            const existing = currentRecipients.find(
                (currR) => currR.phone === newR.phone,
            );
            if (existing) {
                merged.push({
                    ...existing,
                    name: newR.name, // Update name if changed
                });
            } else {
                merged.push({
                    phone: newR.phone,
                    name: newR.name,
                    status: 'PENDING',
                    sentAt: null,
                    error: null,
                });
            }
        });
        campaign.recipients = merged;
    }

    if (reqAiConfig) {
        if (!campaign.aiConfig) {
            campaign.aiConfig = {
                enabled: false,
                provider: 'gemini',
                systemPrompt: 'Anda adalah asisten AI ramah khusus projek ini.',
            };
        }
        if (typeof reqAiConfig.enabled === 'boolean') {
            campaign.aiConfig.enabled = reqAiConfig.enabled;
        }
        if (typeof reqAiConfig.provider === 'string') {
            campaign.aiConfig.provider = reqAiConfig.provider;
        }
        if (typeof reqAiConfig.systemPrompt === 'string') {
            campaign.aiConfig.systemPrompt = reqAiConfig.systemPrompt;
        }
    }

    saveCampaigns();
    io.emit('campaign-update', campaign);
    logToFrontend(
        'CAMPAIGN',
        `Projek siaran "${campaign.name}" berhasil diperbarui.`,
    );
    res.json({ success: true, campaign });
});

// Start/Resume Campaign
app.post('/api/campaigns/:id/start', (req, res) => {
    const campaign = campaigns.find((c) => c.id === req.params.id);
    if (!campaign) {
        return res
            .status(404)
            .json({ success: false, error: 'Projek siaran tidak ditemukan.' });
    }

    const activeSendMode = globalSendMode === 'adb' ? 'adb' : campaign.sendMode;
    if (activeSendMode !== 'adb' && botStatus !== 'READY') {
        return res.status(400).json({
            success: false,
            error: 'WhatsApp Web belum siap. (Kecuali menggunakan Metode ADB)',
        });
    }

    if (campaign.status === 'PROCESSING') {
        return res
            .status(400)
            .json({ success: false, error: 'Projek siaran sedang berjalan.' });
    }

    campaign.status = 'PROCESSING';
    saveCampaigns();
    runCampaign(campaign.id).catch((err) => {
        console.error('Error running campaign:', err);
    });

    res.json({ success: true, campaign });
});

// Pause Campaign
app.post('/api/campaigns/:id/pause', (req, res) => {
    const campaign = campaigns.find((c) => c.id === req.params.id);
    if (!campaign) {
        return res
            .status(404)
            .json({ success: false, error: 'Projek siaran tidak ditemukan.' });
    }

    if (campaign.status !== 'PROCESSING') {
        return res.status(400).json({
            success: false,
            error: 'Projek siaran tidak sedang berjalan.',
        });
    }

    campaign.status = 'PAUSED';
    saveCampaigns();
    res.json({ success: true, campaign });
});

// Delete Campaign
app.delete('/api/campaigns/:id', (req, res) => {
    const index = campaigns.findIndex((c) => c.id === req.params.id);
    if (index === -1) {
        return res
            .status(404)
            .json({ success: false, error: 'Projek siaran tidak ditemukan.' });
    }

    const campaign = campaigns[index];
    campaigns.splice(index, 1);
    saveCampaigns();
    runningCampaigns.delete(campaign.id);

    logToFrontend(
        'CAMPAIGN',
        `Projek siaran "${campaign.name}" telah dihapus.`,
    );
    res.json({ success: true, message: 'Projek siaran berhasil dihapus.' });
});

// Get AI Configuration
app.get('/api/ai/config', (req, res) => {
    res.json({ success: true, config: aiConfig });
});

// Save AI Configuration
app.post('/api/ai/config', (req, res) => {
    const {
        enabled,
        fallbackToKeyword,
        systemPrompt,
        defaultProvider,
        providers,
    } = req.body;

    if (typeof enabled === 'boolean') aiConfig.enabled = enabled;
    if (typeof fallbackToKeyword === 'boolean') {
        aiConfig.fallbackToKeyword = fallbackToKeyword;
    }
    if (typeof systemPrompt === 'string') aiConfig.systemPrompt = systemPrompt;
    if (typeof defaultProvider === 'string') {
        aiConfig.defaultProvider = defaultProvider;
    }
    if (providers) {
        for (const prov in providers) {
            if (aiConfig.providers[prov]) {
                if (Array.isArray(providers[prov].keys)) {
                    aiConfig.providers[prov].keys = providers[prov].keys;
                }
                if (typeof providers[prov].model === 'string') {
                    aiConfig.providers[prov].model = providers[prov].model;
                }
            }
        }
    }

    saveAIConfig();
    logToFrontend(
        'SYSTEM',
        `Konfigurasi AI diperbarui. Status AI: ${
            aiConfig.enabled ? 'ON' : 'OFF'
        }`,
    );
    res.json({ success: true, config: aiConfig });
});

// ==========================================
// STATUS SCHEDULER API ENDPOINTS
// ==========================================
// Get all status schedules
app.get('/api/statuses/schedule', (req, res) => {
    try {
        const schedules = statusScheduler.getSchedules();
        res.json({ success: true, schedules });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Create a new scheduled status
app.post('/api/statuses/schedule', (req, res) => {
    try {
        const { name, cronExpression, type, content, mediaPath, enabled } =
            req.body;
        if (!name || !cronExpression || !type) {
            return res.status(400).json({
                success: false,
                error: 'Name, cronExpression, dan type wajib diisi.',
            });
        }

        const newSchedule = {
            id: Date.now().toString(),
            name,
            cronExpression,
            type, // 'text', 'image', 'video', etc.
            content: content || '',
            mediaPath: mediaPath || '',
            enabled: enabled !== false,
        };

        statusScheduler.addSchedule(newSchedule);
        logToFrontend(
            'SYSTEM',
            `Jadwal status baru "${name}" berhasil ditambahkan.`,
        );
        res.json({ success: true, schedule: newSchedule });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update a scheduled status
app.put('/api/statuses/schedule/:id', (req, res) => {
    try {
        const { name, cronExpression, type, content, mediaPath, enabled } =
            req.body;
        const id = req.params.id;

        const schedules = statusScheduler.getSchedules();
        const existing = schedules.find((s) => s.id === id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: 'Jadwal status tidak ditemukan.',
            });
        }

        const updatedSchedule = {
            id,
            name: name || existing.name,
            cronExpression: cronExpression || existing.cronExpression,
            type: type || existing.type,
            content: content !== undefined ? content : existing.content,
            mediaPath: mediaPath !== undefined ? mediaPath : existing.mediaPath,
            enabled: enabled !== undefined ? enabled : existing.enabled,
        };

        statusScheduler.updateSchedule(updatedSchedule);
        logToFrontend(
            'SYSTEM',
            `Jadwal status "${updatedSchedule.name}" berhasil diperbarui.`,
        );
        res.json({ success: true, schedule: updatedSchedule });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete a scheduled status
app.delete('/api/statuses/schedule/:id', (req, res) => {
    try {
        const id = req.params.id;
        const schedules = statusScheduler.getSchedules();
        const existing = schedules.find((s) => s.id === id);
        if (!existing) {
            return res.status(404).json({
                success: false,
                error: 'Jadwal status tidak ditemukan.',
            });
        }

        statusScheduler.deleteSchedule(id);
        logToFrontend(
            'SYSTEM',
            `Jadwal status "${existing.name}" telah dihapus.`,
        );
        res.json({ success: true, message: 'Jadwal status berhasil dihapus.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Post/trigger a scheduled status immediately
app.post('/api/statuses/schedule/:id/trigger', async (req, res) => {
    try {
        const id = req.params.id;
        if (botStatus !== 'READY') {
            return res.status(400).json({
                success: false,
                error: 'WhatsApp client belum siap/terhubung.',
            });
        }

        await statusScheduler.triggerStatusNow(id);
        res.json({
            success: true,
            message: 'Status berhasil dipicu dan dikirim.',
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Jalankan HTTP Server
server.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
    logToFrontend('SYSTEM', `Server dimulai pada port ${PORT}`);
    logToFrontend('SYSTEM', 'Menghubungkan ke WhatsApp (membuka browser)...');

    client.initialize().catch((err) => {
        logToFrontend('ERROR', `Gagal menghubungkan WhatsApp: ${err.message}`);
    });
});
