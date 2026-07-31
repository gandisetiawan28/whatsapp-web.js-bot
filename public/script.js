/* global io, QRCode */

document.addEventListener('DOMContentLoaded', () => {
    // Connect to Socket.IO server
    const socket = io();

    // DOM Elements: Header Status
    const connectionPill = document.getElementById('connection-pill');
    const statusText = document.getElementById('status-text');
    const statusDisplayWrapper = document.getElementById(
        'status-display-wrapper',
    );
    const statusDescription = document.getElementById('status-description');
    const statusSpinner = document.getElementById('status-spinner');
    const qrContainer = document.getElementById('qr-container');
    const qrcodeDiv = document.getElementById('qrcode');

    // DOM Elements: Console Log
    const consoleOutput = document.getElementById('console-output');
    const clearConsoleBtn = document.getElementById('clear-console-btn');

    // DOM Elements: Navigation Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    // DOM Elements: Live Chats Tab
    const chatListContainer = document.getElementById('chat-list-container');
    const refreshChatsBtn = document.getElementById('refresh-chats-btn');
    const chatWindowEmpty = document.getElementById('chat-window-empty');
    const chatWindow = document.getElementById('chat-window');
    const activeChatName = document.getElementById('active-chat-name');
    const activeChatJid = document.getElementById('active-chat-jid');
    const chatMessagesContainer = document.getElementById(
        'chat-messages-container',
    );
    const chatReplyForm = document.getElementById('chat-reply-form');
    const chatReplyInput = document.getElementById('chat-reply-input');
    const chatReplySubmit = document.getElementById('chat-reply-submit');
    const viewMembersBtn = document.getElementById('view-members-btn');
    const groupMembersListWrapper = document.getElementById(
        'group-members-list-wrapper',
    );
    const groupMembersList = document.getElementById('group-members-list');

    // DOM Elements: Message & Broadcast Tab
    const singleForm = document.getElementById('single-send-form');
    const singlePhone = document.getElementById('single-phone');
    const singleMessage = document.getElementById('single-message');
    const singleSubmitBtn = document.getElementById('single-submit-btn');

    const mediaForm = document.getElementById('media-send-form');
    const mediaPhone = document.getElementById('media-phone');
    const mediaFile = document.getElementById('media-file');
    const mediaCaption = document.getElementById('media-caption');
    const mediaSubmitBtn = document.getElementById('media-submit-btn');

    const broadcastForm = document.getElementById('broadcast-form');
    const broadcastPhones = document.getElementById('broadcast-phones');
    const broadcastMessage = document.getElementById('broadcast-message');
    const broadcastProgressContainer = document.getElementById(
        'broadcast-progress-container',
    );
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressValue = document.getElementById('progress-value');
    const broadcastSubmitBtn = document.getElementById('broadcast-submit-btn');

    // DOM Elements: Auto-Reply Tab
    const botStatusCheckbox = document.getElementById('bot-status-checkbox');
    const botToggleStatusText = document.getElementById(
        'bot-toggle-status-text',
    );
    const addRuleForm = document.getElementById('add-rule-form');
    const ruleKeyword = document.getElementById('rule-keyword');
    const ruleReply = document.getElementById('rule-reply');
    const addRuleSubmit = document.getElementById('add-rule-submit');
    const rulesTableBody = document.getElementById('rules-table-body');

    // DOM Elements: Group Tab
    const createGroupForm = document.getElementById('create-group-form');
    const groupName = document.getElementById('group-name');
    const groupMembers = document.getElementById('group-members');
    const groupSubmitBtn = document.getElementById('group-submit-btn');
    const groupSelect = document.getElementById('group-select');
    const groupViewerMembersBox = document.getElementById(
        'group-viewer-members-box',
    );
    const groupViewerMembersList = document.getElementById(
        'group-viewer-members-list',
    );
    const refreshGroupsBtn = document.getElementById('refresh-groups-btn');

    // DOM Elements: Campaign Tab
    const createCampaignForm = document.getElementById('create-campaign-form');
    const campaignName = document.getElementById('campaign-name');
    const campaignMessage = document.getElementById('campaign-message');
    const campaignRecipients = document.getElementById('campaign-recipients');
    const refreshCampaignsBtn = document.getElementById(
        'refresh-campaigns-btn',
    );
    const campaignsTableBody = document.getElementById('campaigns-table-body');
    const campaignSubmitBtn = document.getElementById('campaign-submit-btn');
    const campaignTabBadge = document.getElementById('campaign-tab-badge');

    // DOM Elements: AI Tab
    const aiConfigForm = document.getElementById('ai-config-form');
    const aiStatusCheckbox = document.getElementById('ai-status-checkbox');
    const aiToggleStatusText = document.getElementById('ai-toggle-status-text');
    const aiFallbackCheckbox = document.getElementById('ai-fallback-checkbox');
    const aiFallbackStatusText = document.getElementById(
        'ai-fallback-status-text',
    );
    const aiDefaultProvider = document.getElementById('ai-default-provider');
    const aiSystemPrompt = document.getElementById('ai-system-prompt');
    const aiKeyProviderSelect = document.getElementById(
        'ai-key-provider-select',
    );
    const addAiKeyForm = document.getElementById('add-ai-key-form');
    const newAiKey = document.getElementById('new-ai-key');
    const providerKeysDisplay = document.getElementById(
        'provider-keys-display',
    );

    // DOM Elements: Project Details Modal
    const projectDetailsModal = document.getElementById(
        'project-details-modal',
    );
    const closeProjectModalBtn = document.getElementById(
        'close-project-modal-btn',
    );
    const modalProjectTitle = document.getElementById('modal-project-title');
    const modalMessagePreview = document.getElementById(
        'modal-message-preview',
    );
    const modalRecipientsBody = document.getElementById(
        'modal-recipients-body',
    );
    const editProjectForm = document.getElementById('edit-project-form');
    const editCampaignName = document.getElementById('edit-campaign-name');
    const editCampaignMessage = document.getElementById(
        'edit-campaign-message',
    );
    const editCampaignRecipients = document.getElementById(
        'edit-campaign-recipients',
    );
    const projectAiForm = document.getElementById('project-ai-form');
    const projectAiStatusText = document.getElementById(
        'project-ai-status-text',
    );
    const projectAiCheckbox = document.getElementById('project-ai-checkbox');
    const projectAiProvider = document.getElementById('project-ai-provider');
    const projectAiPrompt = document.getElementById('project-ai-prompt');
    const modalTabBtns = document.querySelectorAll('.modal-tab-btn');
    const modalTabPanes = document.querySelectorAll('.modal-tab-pane');

    let activeModalCampaignId = null;

    // Global State
    let activeChatId = null;
    let botStatus = 'DISCONNECTED';
    let autoReplyRules = [];

    // ==========================================
    // 1. NAVIGATION & TAB SWITCHING
    // ==========================================
    tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            // Set active button
            tabBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');

            // Switch content panes
            tabPanes.forEach((pane) => {
                if (pane.id === targetTab) {
                    pane.classList.remove('hidden');
                } else {
                    pane.classList.add('hidden');
                }
            });

            // Trigger specific actions when switching tabs
            if (targetTab === 'chat-tab' && botStatus === 'READY') {
                loadChatList();
            } else if (targetTab === 'autoreply-tab') {
                loadRules();
            } else if (targetTab === 'group-tab' && botStatus === 'READY') {
                loadGroupsDropdown();
            } else if (targetTab === 'campaign-tab') {
                loadCampaigns();
            } else if (targetTab === 'ai-tab') {
                loadAIConfig();
            } else if (targetTab === 'status-tab') {
                loadStatusSchedules();
            }
        });
    });

    // ==========================================
    // 2. CONNECTION STATUS & SOCKETS
    // ==========================================
    socket.on('status-update', (data) => {
        const { status, qrCode } = data;
        botStatus = status;

        // Reset classes
        connectionPill.className = 'connection-pill ' + status.toLowerCase();
        statusText.innerText = status.replace('_', ' ');

        // Update UI berdasarkan status
        if (status === 'READY') {
            statusDescription.innerHTML =
                '<span style="color: var(--color-success); font-weight: 600;">✓ WhatsApp Terhubung</span>';
            statusSpinner.classList.add('hidden');
            qrContainer.classList.add('hidden');
            statusDisplayWrapper.classList.remove('hidden');

            // Enable forms
            enableAllForms(true);

            // Jika sedang di tab chat, muat daftarnya
            const activeTab = document
                .querySelector('.tab-btn.active')
                .getAttribute('data-tab');
            if (activeTab === 'chat-tab') {
                loadChatList();
            }
        } else if (status === 'QR_READY') {
            statusDisplayWrapper.classList.add('hidden');
            qrContainer.classList.remove('hidden');

            // Render QR Code
            qrcodeDiv.innerHTML = '';
            new QRCode(qrcodeDiv, {
                text: qrCode,
                width: 200,
                height: 200,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H,
            });

            enableAllForms(false);
        } else {
            qrContainer.classList.add('hidden');
            statusDisplayWrapper.classList.remove('hidden');
            statusSpinner.classList.remove('hidden');

            if (status === 'LOADING') {
                statusDescription.innerText =
                    'Menyiapkan browser Puppeteer WhatsApp Web...';
            } else if (status === 'AUTHENTICATING') {
                statusDescription.innerText =
                    'Otentikasi berhasil! Sedang mensinkronisasikan chat...';
            } else {
                statusDescription.innerText =
                    'WhatsApp terputus. Menunggu inisialisasi ulang server...';
            }

            enableAllForms(false);
        }
    });

    socket.on('campaign-update', (campaign) => {
        if (typeof updateCampaignRow === 'function') {
            updateCampaignRow(campaign);
        }
        if (typeof updateCampaignBadge === 'function') {
            updateCampaignBadge();
        }
    });

    function enableAllForms(enable) {
        const state = !enable;
        singleSubmitBtn.disabled = state;
        mediaSubmitBtn.disabled = state;
        broadcastSubmitBtn.disabled = state;
        addRuleSubmit.disabled = state;
        groupSubmitBtn.disabled = state;
        campaignSubmitBtn.disabled = state;

        if (!enable) {
            chatListContainer.innerHTML =
                '<p class="list-empty-msg">WhatsApp belum siap. Pastikan status READY.</p>';
            chatWindow.classList.add('hidden');
            chatWindowEmpty.classList.remove('hidden');
            activeChatId = null;
        }
    }

    // ==========================================
    // 3. LIVE CONSOLE LOGS
    // ==========================================
    function appendLog(timestamp, type, message) {
        const logLine = document.createElement('div');
        logLine.className = `log-line ${type.toLowerCase()}`;
        logLine.innerHTML = `[${type}] [${timestamp}] ${escapeHtml(message)}`;
        consoleOutput.appendChild(logLine);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.innerText = text;
        return div.innerHTML;
    }

    clearConsoleBtn.addEventListener('click', () => {
        consoleOutput.innerHTML =
            '<div class="log-line system">[SYSTEM] Konsol dibersihkan. Menunggu log baru...</div>';
    });

    socket.on('bot-log', (data) => {
        appendLog(data.timestamp, data.type, data.message);
    });

    // ==========================================
    // 4. LIVE CHATS TAB LOGIC
    // ==========================================
    async function loadChatList() {
        chatListContainer.innerHTML =
            '<div class="list-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> Memuat chat...</div>';
        try {
            const response = await fetch('/api/chats');
            const data = await response.json();

            if (!data.success) {
                chatListContainer.innerHTML = `<p class="list-empty-msg" style="color: var(--color-error)">Gagal: ${data.error}</p>`;
                return;
            }

            if (data.chats.length === 0) {
                chatListContainer.innerHTML =
                    '<p class="list-empty-msg">Tidak ada chat ditemukan.</p>';
                return;
            }

            chatListContainer.innerHTML = '';
            data.chats.forEach((chat) => {
                const item = document.createElement('div');
                item.className = 'chat-item';
                if (chat.id === activeChatId) {
                    item.classList.add('active');
                }
                item.setAttribute('data-id', chat.id);

                const initials = chat.name
                    ? chat.name.slice(0, 2).toUpperCase()
                    : 'WA';

                item.innerHTML = `
                    <div class="chat-avatar">${initials}</div>
                    <div class="chat-info">
                        <div class="chat-meta">
                            <span class="chat-name">${escapeHtml(chat.name || chat.id.split('@')[0])}</span>
                            <span class="chat-time">${formatTime(chat.timestamp)}</span>
                        </div>
                        <div class="chat-meta">
                            <span class="chat-last-msg" id="last-msg-${chat.id}">Pilih chat untuk membaca...</span>
                            ${chat.unreadCount > 0 ? `<span class="chat-unread-badge">${chat.unreadCount}</span>` : ''}
                        </div>
                    </div>
                `;

                item.addEventListener('click', () => {
                    document
                        .querySelectorAll('.chat-item')
                        .forEach((i) => i.classList.remove('active'));
                    item.classList.add('active');
                    openChat(chat.id, chat.name);
                });

                chatListContainer.appendChild(item);
            });
        } catch (error) {
            chatListContainer.innerHTML = `<p class="list-empty-msg" style="color: var(--color-error)">Error jaringan: ${error.message}</p>`;
        }
    }

    refreshChatsBtn.addEventListener('click', loadChatList);

    viewMembersBtn.addEventListener('click', async () => {
        if (!activeChatId) return;

        const isHidden = groupMembersListWrapper.classList.toggle('hidden');
        if (!isHidden) {
            groupMembersList.innerHTML =
                '<div class="list-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> Memuat anggota...</div>';
            try {
                const response = await fetch(
                    `/api/groups/${encodeURIComponent(activeChatId)}/participants`,
                );
                const data = await response.json();

                if (!data.success) {
                    groupMembersList.innerHTML = `<p class="list-empty-msg" style="color: var(--color-error)">Gagal: ${data.error}</p>`;
                    return;
                }

                groupMembersList.innerHTML = '';
                data.participants.forEach((p) => {
                    const pill = document.createElement('div');
                    pill.className = `member-pill ${p.isAdmin ? 'admin' : ''}`;
                    pill.innerHTML = `
                        <span>${escapeHtml(p.user)}</span>
                        <span class="member-role ${p.isAdmin ? 'admin' : 'member'}">${
                            p.isAdmin ? 'admin' : 'anggota'
                        }</span>
                    `;
                    groupMembersList.appendChild(pill);
                });
            } catch (error) {
                groupMembersList.innerHTML = `<p class="list-empty-msg" style="color: var(--color-error)">Error: ${error.message}</p>`;
            }
        }
    });

    function formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    async function openChat(jid, name) {
        activeChatId = jid;
        const displayName = name || jid.split('@')[0];

        activeChatName.innerText = displayName;
        activeChatJid.innerText = jid;

        // Reset Group Members UI
        groupMembersListWrapper.classList.add('hidden');
        groupMembersList.innerHTML = '';
        if (jid.endsWith('@g.us')) {
            viewMembersBtn.classList.remove('hidden');
        } else {
            viewMembersBtn.classList.add('hidden');
        }

        chatWindowEmpty.classList.add('hidden');
        chatWindow.classList.remove('hidden');

        chatMessagesContainer.innerHTML =
            '<div class="list-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> Memuat pesan...</div>';

        try {
            const response = await fetch(
                `/api/chats/${encodeURIComponent(jid)}/messages`,
            );
            const data = await response.json();

            if (!data.success) {
                chatMessagesContainer.innerHTML = `<p class="list-empty-msg" style="color: var(--color-error)">Gagal memuat pesan: ${data.error}</p>`;
                return;
            }

            renderMessages(data.messages);
        } catch (error) {
            chatMessagesContainer.innerHTML = `<p class="list-empty-msg" style="color: var(--color-error)">Error jaringan: ${error.message}</p>`;
        }
    }

    function renderMessages(messages) {
        chatMessagesContainer.innerHTML = '';
        if (messages.length === 0) {
            chatMessagesContainer.innerHTML =
                '<p class="list-empty-msg">Tidak ada histori pesan.</p>';
            return;
        }

        messages.forEach((msg) => {
            appendMessageBubble(msg);
        });
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    function appendMessageBubble(msg) {
        // Abaikan tipe pesan system status tertentu yang tidak ada teksnya
        if (!msg.body && msg.type !== 'chat') return;

        const row = document.createElement('div');
        row.className = `chat-msg-row ${msg.fromMe ? 'outgoing' : 'incoming'}`;

        const timeStr = msg.timestamp
            ? new Date(msg.timestamp * 1000).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
              })
            : '';

        // Tampilkan nama sender jika grup
        const isGroup = activeChatId.endsWith('@g.us');
        const senderLabel =
            isGroup && !msg.fromMe && msg.sender
                ? `<span style="font-size: 0.72rem; font-weight: 700; display: block; margin-bottom: 2px; color: var(--color-wa-green);">${escapeHtml(msg.sender.split('@')[0])}</span>`
                : '';

        row.innerHTML = `
            <div class="chat-msg-bubble">
                ${senderLabel}
                <div class="chat-msg-body">${escapeHtml(msg.body || `[Kirim File: ${msg.type}]`)}</div>
                <div class="chat-msg-meta">${timeStr}</div>
            </div>
        `;

        chatMessagesContainer.appendChild(row);
    }

    // Socket: Terima pesan real-time
    socket.on('new-message', (data) => {
        // 1. Update text di sidebar chat list jika ada
        const lastMsgSpan = document.getElementById(`last-msg-${data.chatId}`);
        if (lastMsgSpan) {
            lastMsgSpan.innerText = data.body || `[File: ${data.type}]`;
        }

        // 2. Tambah bubble jika ini chat yang sedang dibuka
        if (activeChatId === data.chatId) {
            // Hilangkan pesan empty jika ada
            const emptyMsg =
                chatMessagesContainer.querySelector('.list-empty-msg');
            if (emptyMsg) {
                emptyMsg.remove();
            }

            appendMessageBubble({
                id: data.id,
                body: data.body,
                fromMe: data.fromMe,
                timestamp: data.timestamp,
                type: data.type,
                sender: data.sender,
            });
            chatMessagesContainer.scrollTop =
                chatMessagesContainer.scrollHeight;
        }
    });

    // Form Submit: Balas pesan langsung di chat room
    chatReplyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatReplyInput.value.trim();
        if (!text || !activeChatId) return;

        chatReplyInput.disabled = true;
        chatReplySubmit.disabled = true;

        try {
            const response = await fetch('/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: activeChatId, message: text }),
            });
            const data = await response.json();

            if (data.success) {
                chatReplyInput.value = '';
            } else {
                alert('Gagal mengirim pesan: ' + data.error);
            }
        } catch (error) {
            alert('Error jaringan: ' + error.message);
        } finally {
            chatReplyInput.disabled = false;
            chatReplySubmit.disabled = false;
            chatReplyInput.focus();
        }
    });

    // ==========================================
    // 5. PESAN & BROADCAST TAB LOGIC
    // ==========================================

    // Form Submit: Kirim Pesan Tunggal (Teks)
    singleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const to = singlePhone.value.trim();
        const message = singleMessage.value.trim();

        if (!to || !message) return;

        singleSubmitBtn.disabled = true;
        singleSubmitBtn.innerHTML =
            '<span>Mengirim...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const response = await fetch('/api/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, message }),
            });
            const data = await response.json();

            if (data.success) {
                alert('Pesan sukses dikirim!');
                singleMessage.value = '';
            } else {
                alert('Gagal mengirim: ' + data.error);
            }
        } catch (error) {
            alert('Error jaringan: ' + error.message);
        } finally {
            singleSubmitBtn.disabled = false;
            singleSubmitBtn.innerHTML =
                '<span>Kirim Pesan</span> <i class="fa-solid fa-circle-chevron-right"></i>';
        }
    });

    // Form Submit: Kirim Media & File (Base64)
    mediaForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const to = mediaPhone.value.trim();
        const file = mediaFile.files[0];
        const caption = mediaCaption.value.trim();

        if (!to || !file) return;

        mediaSubmitBtn.disabled = true;
        mediaSubmitBtn.innerHTML =
            '<span>Mengunggah & Mengirim...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

        // Membaca file sebagai Base64
        const reader = new FileReader();
        reader.onload = async () => {
            const base64Data = reader.result;

            try {
                const response = await fetch('/api/send-media', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to,
                        data: base64Data,
                        filename: file.name,
                        mimetype: file.type,
                        caption,
                    }),
                });
                const data = await response.json();

                if (data.success) {
                    alert('Media sukses dikirim!');
                    mediaFile.value = '';
                    mediaCaption.value = '';
                } else {
                    alert('Gagal mengirim media: ' + data.error);
                }
            } catch (error) {
                alert('Error mengirim data: ' + error.message);
            } finally {
                mediaSubmitBtn.disabled = false;
                mediaSubmitBtn.innerHTML =
                    '<span>Kirim File</span> <i class="fa-solid fa-file-circle-check"></i>';
            }
        };
        reader.onerror = () => {
            alert('Gagal membaca file!');
            mediaSubmitBtn.disabled = false;
            mediaSubmitBtn.innerHTML =
                '<span>Kirim File</span> <i class="fa-solid fa-file-circle-check"></i>';
        };
        reader.readAsDataURL(file);
    });

    // Form Submit: Broadcast
    broadcastForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawNumbers = broadcastPhones.value.split('\n');
        const message = broadcastMessage.value.trim();

        const numbers = rawNumbers
            .map((num) => num.trim())
            .filter((num) => num.length > 0);

        if (numbers.length === 0 || !message) {
            alert('Masukkan minimal satu nomor tujuan dan isi pesan.');
            return;
        }

        if (!confirm(`Mulai broadcast ke ${numbers.length} nomor?`)) return;

        broadcastSubmitBtn.disabled = true;
        broadcastSubmitBtn.innerHTML =
            '<span>Memulai...</span> <i class="fa-solid fa-spinner fa-spin"></i>';
        broadcastProgressContainer.classList.remove('hidden');
        progressBarFill.style.width = '0%';
        progressValue.innerText = `0 / ${numbers.length}`;

        try {
            const response = await fetch('/api/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numbers, message }),
            });
            const data = await response.json();

            if (!data.success) {
                alert('Gagal memulai: ' + data.error);
                broadcastSubmitBtn.disabled = false;
                broadcastSubmitBtn.innerHTML =
                    '<span>Mulai Broadcast</span> <i class="fa-solid fa-bolt"></i>';
                broadcastProgressContainer.classList.add('hidden');
            }
        } catch (error) {
            alert('Error: ' + error.message);
            broadcastSubmitBtn.disabled = false;
            broadcastSubmitBtn.innerHTML =
                '<span>Mulai Broadcast</span> <i class="fa-solid fa-bolt"></i>';
            broadcastProgressContainer.classList.add('hidden');
        }
    });

    // Broadcast Status Socket
    socket.on('broadcast-status', (data) => {
        const { inProgress, total, current } = data;

        if (inProgress) {
            broadcastProgressContainer.classList.remove('hidden');
            broadcastSubmitBtn.disabled = true;
            broadcastSubmitBtn.innerHTML =
                '<span>Mengirim...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

            const percent = total > 0 ? (current / total) * 100 : 0;
            progressBarFill.style.width = `${percent}%`;
            progressValue.innerText = `${current} / ${total}`;
        } else {
            broadcastSubmitBtn.disabled = false;
            broadcastSubmitBtn.innerHTML =
                '<span>Mulai Broadcast</span> <i class="fa-solid fa-bolt"></i>';
            setTimeout(() => {
                if (!broadcastSubmitBtn.disabled) {
                    broadcastProgressContainer.classList.add('hidden');
                    progressBarFill.style.width = '0%';
                }
            }, 6000);
        }
    });

    // ==========================================
    // 6. AUTO-REPLY TAB LOGIC
    // ==========================================

    async function loadRules() {
        try {
            const response = await fetch('/api/rules');
            const data = await response.json();

            // Set Status checkbox
            botStatusCheckbox.checked = data.enabled;
            botToggleStatusText.innerText = data.enabled ? 'ON' : 'OFF';
            botToggleStatusText.style.color = data.enabled
                ? 'var(--color-success)'
                : 'var(--color-error)';

            autoReplyRules = data.rules;
            renderRulesTable();
        } catch (error) {
            console.error('Error load rules:', error.message);
        }
    }

    function renderRulesTable() {
        rulesTableBody.innerHTML = '';
        if (autoReplyRules.length === 0) {
            rulesTableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="table-empty">Belum ada aturan balas otomatis yang dibuat.</td>
                </tr>
            `;
            return;
        }

        autoReplyRules.forEach((rule, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><code style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; font-family: 'JetBrains Mono', monospace;">${escapeHtml(rule.keyword)}</code></td>
                <td>${escapeHtml(rule.reply)}</td>
                <td style="text-align: center;">
                    <button class="rule-delete-btn" data-idx="${idx}" title="Hapus Aturan">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            `;

            // Delete click event listener
            tr.querySelector('.rule-delete-btn').addEventListener(
                'click',
                () => {
                    deleteRule(idx);
                },
            );

            rulesTableBody.appendChild(tr);
        });
    }

    // Toggle status auto reply checkbox
    botStatusCheckbox.addEventListener('change', async () => {
        const isEnabled = botStatusCheckbox.checked;
        botToggleStatusText.innerText = isEnabled ? 'ON' : 'OFF';
        botToggleStatusText.style.color = isEnabled
            ? 'var(--color-success)'
            : 'var(--color-error)';

        try {
            await fetch('/api/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: isEnabled,
                    rules: autoReplyRules,
                }),
            });
        } catch (error) {
            alert('Gagal memperbarui status auto-reply: ' + error.message);
            // Revert state
            botStatusCheckbox.checked = !isEnabled;
            botToggleStatusText.innerText = !isEnabled ? 'ON' : 'OFF';
        }
    });

    // Form Submit: Tambah Aturan Baru
    addRuleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const kw = ruleKeyword.value.trim();
        const rep = ruleReply.value.trim();

        if (!kw || !rep) return;

        // Cek duplikasi keyword
        const exists = autoReplyRules.some(
            (r) => r.keyword.toLowerCase() === kw.toLowerCase(),
        );
        if (exists) {
            alert('Kata kunci tersebut sudah ada!');
            return;
        }

        addRuleSubmit.disabled = true;
        addRuleSubmit.innerHTML =
            '<span>Menambahkan...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

        const updatedRules = [...autoReplyRules, { keyword: kw, reply: rep }];

        try {
            const response = await fetch('/api/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: botStatusCheckbox.checked,
                    rules: updatedRules,
                }),
            });
            const data = await response.json();

            if (data.success) {
                autoReplyRules = data.config.rules;
                renderRulesTable();
                ruleKeyword.value = '';
                ruleReply.value = '';
            } else {
                alert('Gagal menambah aturan: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            addRuleSubmit.disabled = false;
            addRuleSubmit.innerHTML =
                '<span>Tambah Aturan</span> <i class="fa-solid fa-circle-plus"></i>';
        }
    });

    // Hapus Aturan Balas
    async function deleteRule(index) {
        if (
            !confirm(
                'Apakah Anda yakin ingin menghapus aturan balas otomatis ini?',
            )
        )
            return;

        const updatedRules = autoReplyRules.filter((_, idx) => idx !== index);

        try {
            const response = await fetch('/api/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled: botStatusCheckbox.checked,
                    rules: updatedRules,
                }),
            });
            const data = await response.json();

            if (data.success) {
                autoReplyRules = data.config.rules;
                renderRulesTable();
            } else {
                alert('Gagal menghapus aturan: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    }

    // ==========================================
    // 7. GROUP MANAGER TAB LOGIC
    // ==========================================
    createGroupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = groupName.value.trim();
        const rawMembers = groupMembers.value.split('\n');

        const participants = rawMembers
            .map((num) => num.trim())
            .filter((num) => num.length > 0);

        if (!name || participants.length === 0) {
            alert('Nama grup dan minimal satu nomor anggota wajib diisi!');
            return;
        }

        groupSubmitBtn.disabled = true;
        groupSubmitBtn.innerHTML =
            '<span>Membuat Grup...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const response = await fetch('/api/groups/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, participants }),
            });
            const data = await response.json();

            if (data.success) {
                alert(`Grup "${name}" berhasil dibuat!`);
                groupName.value = '';
                groupMembers.value = '';
            } else {
                alert('Gagal membuat grup: ' + data.error);
            }
        } catch (error) {
            alert('Error jaringan: ' + error.message);
        } finally {
            groupSubmitBtn.disabled = false;
            groupSubmitBtn.innerHTML =
                '<span>Buat Grup</span> <i class="fa-solid fa-user-group"></i>';
        }
    });

    async function loadGroupsDropdown() {
        groupSelect.innerHTML =
            '<option value="">-- Memuat grup... --</option>';
        groupViewerMembersBox.classList.add('hidden');
        groupViewerMembersList.innerHTML = '';

        try {
            const response = await fetch('/api/groups');
            const data = await response.json();

            if (!data.success) {
                groupSelect.innerHTML = `<option value="">-- Gagal memuat grup: ${data.error} --</option>`;
                return;
            }

            groupSelect.innerHTML =
                '<option value="">-- Pilih Grup WhatsApp --</option>';
            if (data.groups.length === 0) {
                groupSelect.innerHTML =
                    '<option value="">-- Tidak ada grup ditemukan --</option>';
                return;
            }

            data.groups.forEach((g) => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = g.name;
                groupSelect.appendChild(opt);
            });
        } catch (error) {
            groupSelect.innerHTML = `<option value="">-- Error: ${error.message} --</option>`;
        }
    }

    groupSelect.addEventListener('change', async () => {
        const jid = groupSelect.value;
        if (!jid) {
            groupViewerMembersBox.classList.add('hidden');
            groupViewerMembersList.innerHTML = '';
            return;
        }

        groupViewerMembersBox.classList.remove('hidden');
        groupViewerMembersList.innerHTML =
            '<div class="list-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> Memuat anggota...</div>';

        try {
            const response = await fetch(
                `/api/groups/${encodeURIComponent(jid)}/participants`,
            );
            const data = await response.json();

            if (!data.success) {
                groupViewerMembersList.innerHTML = `<p class="list-empty-msg" style="color: var(--color-error)">Gagal: ${data.error}</p>`;
                return;
            }

            groupViewerMembersList.innerHTML = '';
            data.participants.forEach((p) => {
                const pill = document.createElement('div');
                pill.className = `member-pill ${p.isAdmin ? 'admin' : ''}`;
                pill.innerHTML = `
                    <span>${escapeHtml(p.user)}</span>
                    <span class="member-role ${p.isAdmin ? 'admin' : 'member'}">${
                        p.isAdmin ? 'admin' : 'anggota'
                    }</span>
                `;
                groupViewerMembersList.appendChild(pill);
            });
        } catch (error) {
            groupViewerMembersList.innerHTML = `<p class="list-empty-msg" style="color: var(--color-error)">Error: ${error.message}</p>`;
        }
    });

    // ==========================================
    // CAMPAIGN MANAGER CLIENT LOGIC
    // ==========================================
    async function loadCampaigns() {
        campaignsTableBody.innerHTML =
            '<tr><td colspan="4" class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i> Memuat daftar projek...</td></tr>';
        try {
            const response = await fetch('/api/campaigns');
            const data = await response.json();

            if (!data.success) {
                campaignsTableBody.innerHTML = `<tr><td colspan="4" class="table-empty" style="color: var(--color-error)">Gagal: ${data.error}</td></tr>`;
                return;
            }

            if (data.campaigns.length === 0) {
                campaignsTableBody.innerHTML =
                    '<tr><td colspan="4" class="table-empty">Belum ada projek siaran yang dibuat.</td></tr>';
                return;
            }

            campaignsTableBody.innerHTML = '';
            data.campaigns.forEach((camp) => {
                const tr = document.createElement('tr');
                tr.id = `camp-row-${camp.id}`;

                const total = camp.recipients.length;
                const sent = camp.recipients.filter(
                    (r) => r.status === 'SENT',
                ).length;
                const pct = total > 0 ? Math.round((sent / total) * 100) : 0;

                tr.innerHTML = `
                    <td>
                        <div style="font-weight: 600; color: #fff;">${escapeHtml(
                            camp.name,
                        )}</div>
                        <div style="font-size: 0.72rem; color: var(--color-text-secondary); margin-top: 4px;">Dibuat: ${new Date(
                            camp.createdAt,
                        ).toLocaleString()}</div>
                    </td>
                    <td>
                        <div class="campaign-progress-wrapper">
                            <div class="campaign-progress-bar">
                                <div class="campaign-progress-fill" id="progress-fill-${
                                    camp.id
                                }" style="width: ${pct}%;"></div>
                            </div>
                            <div class="campaign-progress-text">
                                <span id="progress-txt-nums-${
                                    camp.id
                                }">${sent} / ${total} Terkirim</span>
                                <span id="progress-txt-pct-${
                                    camp.id
                                }">${pct}%</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="campaign-status-badge ${camp.status.toLowerCase()}" id="status-badge-${
                            camp.id
                        }">${camp.status}</span>
                    </td>
                    <td>
                        <div style="display: flex; gap: 8px; justify-content: center;">
                            <button class="campaign-action-btn play-btn" onclick="controlCampaign('${
                                camp.id
                            }', 'start')" title="Jalankan Projek" aria-label="Jalankan Projek">
                                <i class="fa-solid fa-play"></i>
                            </button>
                            <button class="campaign-action-btn pause-btn" onclick="controlCampaign('${
                                camp.id
                            }', 'pause')" title="Hentikan Sementara" aria-label="Hentikan Sementara">
                                <i class="fa-solid fa-pause"></i>
                            </button>
                            <button class="campaign-action-btn delete-btn" onclick="controlCampaign('${
                                camp.id
                            }', 'delete')" title="Hapus Projek" aria-label="Hapus Projek">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                `;
                tr.addEventListener('click', (e) => {
                    if (
                        e.target.closest('.campaign-action-btn') ||
                        e.target.closest('td:last-child')
                    ) {
                        return;
                    }
                    if (typeof openProjectDetails === 'function') {
                        openProjectDetails(camp.id);
                    }
                });
                tr.style.cursor = 'pointer';
                campaignsTableBody.appendChild(tr);
            });
        } catch (error) {
            campaignsTableBody.innerHTML = `<tr><td colspan="4" class="table-empty" style="color: var(--color-error)">Error: ${error.message}</td></tr>`;
        }
    }

    createCampaignForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = campaignName.value.trim();
        const message = campaignMessage.value.trim();
        const rawRecipients = campaignRecipients.value.trim();

        if (!name || !message || !rawRecipients) {
            alert('Harap isi semua input form!');
            return;
        }

        const lines = rawRecipients.split('\n').filter((l) => l.trim() !== '');
        const recipients = lines
            .map((line) => {
                const parts = line.split(',');
                if (parts.length >= 2) {
                    return { name: parts[0].trim(), phone: parts[1].trim() };
                } else {
                    return { name: 'Pelanggan', phone: parts[0].trim() };
                }
            })
            .filter((r) => r.phone.replace(/\D/g, '').length > 5);

        if (recipients.length === 0) {
            alert('Tidak ada nomor penerima yang valid!');
            return;
        }

        campaignSubmitBtn.disabled = true;
        campaignSubmitBtn.innerHTML =
            '<span>Membuat Projek...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const response = await fetch('/api/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, message, recipients }),
            });
            const data = await response.json();

            if (data.success) {
                alert(`Projek siaran "${name}" berhasil dibuat!`);
                campaignName.value = '';
                campaignMessage.value = '';
                campaignRecipients.value = '';
                loadCampaigns();
            } else {
                alert('Gagal membuat projek: ' + data.error);
            }
        } catch (error) {
            alert('Error jaringan: ' + error.message);
        } finally {
            campaignSubmitBtn.disabled = false;
            campaignSubmitBtn.innerHTML =
                '<span>Buat Projek Siaran</span> <i class="fa-solid fa-plus-circle"></i>';
        }
    });

    window.controlCampaign = async function (id, action) {
        if (action === 'delete') {
            if (
                !confirm('Apakah Anda yakin ingin menghapus projek siaran ini?')
            ) {
                return;
            }
            try {
                const response = await fetch(`/api/campaigns/${id}`, {
                    method: 'DELETE',
                });
                const data = await response.json();
                if (data.success) {
                    loadCampaigns();
                } else {
                    alert('Gagal menghapus: ' + data.error);
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
            return;
        }

        try {
            const response = await fetch(`/api/campaigns/${id}/${action}`, {
                method: 'POST',
            });
            const data = await response.json();
            if (!data.success) {
                alert(`Gagal melakukan aksi ${action}: ` + data.error);
            } else {
                loadCampaigns();
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    function updateCampaignRow(camp) {
        const fill = document.getElementById(`progress-fill-${camp.id}`);
        const nums = document.getElementById(`progress-txt-nums-${camp.id}`);
        const pctTxt = document.getElementById(`progress-txt-pct-${camp.id}`);
        const badge = document.getElementById(`status-badge-${camp.id}`);

        if (!badge) return;

        const total = camp.recipients.length;
        const sent = camp.recipients.filter((r) => r.status === 'SENT').length;
        const pct = total > 0 ? Math.round((sent / total) * 100) : 0;

        if (fill) fill.style.width = `${pct}%`;
        if (nums) nums.innerText = `${sent} / ${total} Terkirim`;
        if (pctTxt) pctTxt.innerText = `${pct}%`;

        badge.className = `campaign-status-badge ${camp.status.toLowerCase()}`;
        badge.innerText = camp.status;

        if (activeModalCampaignId === camp.id) {
            refreshProjectDetailsModal();
        }
    }

    async function updateCampaignBadge() {
        try {
            const response = await fetch('/api/campaigns');
            const data = await response.json();
            if (data.success) {
                const activeCount = data.campaigns.filter(
                    (c) => c.status === 'PROCESSING',
                ).length;
                if (activeCount > 0) {
                    campaignTabBadge.innerText = activeCount;
                    campaignTabBadge.classList.remove('hidden');
                } else {
                    campaignTabBadge.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Error updating campaign badge:', error);
        }
    }

    refreshCampaignsBtn.addEventListener('click', loadCampaigns);

    // ==========================================
    // AI ASSISTANT CLIENT LOGIC
    // ==========================================
    let aiConfigData = {
        enabled: false,
        fallbackToKeyword: true,
        systemPrompt: '',
        defaultProvider: 'gemini',
        providers: {
            gemini: { keys: [] },
            openai: { keys: [] },
            claude: { keys: [] },
        },
    };

    async function loadAIConfig() {
        try {
            const response = await fetch('/api/ai/config');
            const data = await response.json();

            if (!data.success) {
                console.error('Gagal memuat konfigurasi AI:', data.error);
                return;
            }

            aiConfigData = data.config;

            aiStatusCheckbox.checked = aiConfigData.enabled;
            updateToggleLabel(aiStatusCheckbox, aiToggleStatusText);

            aiFallbackCheckbox.checked = aiConfigData.fallbackToKeyword;
            updateToggleLabel(aiFallbackCheckbox, aiFallbackStatusText);

            aiDefaultProvider.value = aiConfigData.defaultProvider || 'gemini';
            aiSystemPrompt.value = aiConfigData.systemPrompt || '';

            renderAPIKeys();
        } catch (error) {
            console.error('Error loading AI configuration:', error);
        }
    }

    function updateToggleLabel(checkbox, label) {
        if (checkbox.checked) {
            label.innerText = 'ON';
            label.style.color = 'var(--color-success)';
        } else {
            label.innerText = 'OFF';
            label.style.color = 'var(--color-text-secondary)';
        }
    }

    aiStatusCheckbox.addEventListener('change', () => {
        updateToggleLabel(aiStatusCheckbox, aiToggleStatusText);
    });

    aiFallbackCheckbox.addEventListener('change', () => {
        updateToggleLabel(aiFallbackCheckbox, aiFallbackStatusText);
    });

    aiConfigForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const enabled = aiStatusCheckbox.checked;
        const fallbackToKeyword = aiFallbackCheckbox.checked;
        const defaultProvider = aiDefaultProvider.value;
        const systemPrompt = aiSystemPrompt.value.trim();

        const submitBtn = document.getElementById('ai-settings-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML =
            '<span>Menyimpan...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const response = await fetch('/api/ai/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled,
                    fallbackToKeyword,
                    defaultProvider,
                    systemPrompt,
                }),
            });
            const data = await response.json();

            if (data.success) {
                alert('Pengaturan AI Assistant berhasil disimpan!');
                loadAIConfig();
            } else {
                alert('Gagal menyimpan: ' + data.error);
            }
        } catch (error) {
            alert('Error jaringan: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML =
                '<span>Simpan Pengaturan AI</span> <i class="fa-solid fa-save"></i>';
        }
    });

    function renderAPIKeys() {
        providerKeysDisplay.innerHTML = '';

        const providers = ['gemini', 'openai', 'claude'];
        providers.forEach((prov) => {
            const provConfig = aiConfigData.providers[prov] || { keys: [] };
            const keys = provConfig.keys || [];

            const card = document.createElement('div');
            card.className = 'provider-keys-card';

            const iconClass =
                prov === 'gemini'
                    ? 'fa-google'
                    : prov === 'openai'
                      ? 'fa-bolt'
                      : 'fa-brain';

            card.innerHTML = `
                <div class="provider-keys-header">
                    <span class="provider-name-badge">
                        <i class="fa-solid ${iconClass}"></i> ${prov}
                    </span>
                    <span style="font-size: 0.72rem; color: var(--color-text-muted);">${keys.length} keys</span>
                </div>
                <div class="provider-keys-list" id="keys-list-${prov}">
                    <!-- Keys mapped here -->
                </div>
            `;

            providerKeysDisplay.appendChild(card);

            const listContainer = document.getElementById(`keys-list-${prov}`);
            if (keys.length === 0) {
                listContainer.innerHTML =
                    '<p style="font-size: 0.75rem; color: var(--color-text-muted); font-style: italic; padding: 4px 0;">Belum ada key ditambahkan.</p>';
                return;
            }

            keys.forEach((key, idx) => {
                const hiddenKey =
                    key.length > 12
                        ? key.substr(0, 6) + '...' + key.substr(key.length - 6)
                        : '••••••••••••';

                const item = document.createElement('div');
                item.className = 'api-key-item';
                item.innerHTML = `
                    <span>Key #${idx + 1}: ${hiddenKey}</span>
                    <button class="delete-key-btn" onclick="deleteAPIKey('${prov}', ${idx})" title="Hapus API Key" aria-label="Hapus API Key">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                `;
                listContainer.appendChild(item);
            });
        });
    }

    addAiKeyForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const provider = aiKeyProviderSelect.value;
        const key = newAiKey.value.trim();

        if (!key) {
            alert('Harap isi API Key!');
            return;
        }

        const provConfig = aiConfigData.providers[provider] || { keys: [] };
        const currentKeys = provConfig.keys || [];

        if (currentKeys.includes(key)) {
            alert('API Key ini sudah ditambahkan sebelumnya!');
            return;
        }

        const updatedKeys = [...currentKeys, key];

        const submitBtn = document.getElementById('add-key-submit-btn');
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/ai/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    providers: {
                        [provider]: {
                            keys: updatedKeys,
                        },
                    },
                }),
            });
            const data = await response.json();

            if (data.success) {
                alert('API Key berhasil ditambahkan!');
                newAiKey.value = '';
                loadAIConfig();
            } else {
                alert('Gagal menambahkan: ' + data.error);
            }
        } catch (error) {
            alert('Error jaringan: ' + error.message);
        } finally {
            submitBtn.disabled = false;
        }
    });

    window.deleteAPIKey = async function (provider, index) {
        if (!confirm('Apakah Anda yakin ingin menghapus API Key ini?')) {
            return;
        }

        const provConfig = aiConfigData.providers[provider] || { keys: [] };
        const currentKeys = provConfig.keys || [];
        const updatedKeys = currentKeys.filter((_, idx) => idx !== index);

        try {
            const response = await fetch('/api/ai/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    providers: {
                        [provider]: {
                            keys: updatedKeys,
                        },
                    },
                }),
            });
            const data = await response.json();

            if (data.success) {
                loadAIConfig();
            } else {
                alert('Gagal menghapus: ' + data.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        }
    };

    // ==========================================
    // PROJECT DETAILS MODAL LOGIC
    // ==========================================
    async function openProjectDetails(campaignId) {
        activeModalCampaignId = campaignId;
        projectDetailsModal.classList.remove('hidden');

        // Reset to first tab
        modalTabBtns.forEach((btn) => btn.classList.remove('active'));
        modalTabBtns[0].classList.add('active');
        modalTabPanes.forEach((pane) => pane.classList.add('hidden'));
        document.getElementById('modal-tab-info').classList.remove('hidden');

        await refreshProjectDetailsModal();
    }
    window.openProjectDetails = openProjectDetails;

    async function refreshProjectDetailsModal() {
        if (!activeModalCampaignId) return;

        try {
            const response = await fetch('/api/campaigns');
            const data = await response.json();
            if (!data.success) return;

            const camp = data.campaigns.find(
                (c) => c.id === activeModalCampaignId,
            );
            if (!camp) {
                closeProjectDetailsModal();
                return;
            }

            // Tab 1: Info & Recipients
            modalProjectTitle.innerText = `Detail Projek: ${camp.name}`;
            modalMessagePreview.innerText = camp.message;

            modalRecipientsBody.innerHTML = '';
            if (camp.recipients.length === 0) {
                modalRecipientsBody.innerHTML =
                    '<tr><td colspan="4" class="table-empty">Belum ada penerima.</td></tr>';
            } else {
                camp.recipients.forEach((r) => {
                    const tr = document.createElement('tr');
                    const badgeClass = r.status.toLowerCase();
                    const timeOrError =
                        r.status === 'SENT'
                            ? new Date(r.sentAt).toLocaleString()
                            : r.status === 'FAILED'
                              ? r.error || 'Gagal mengirim'
                              : '-';

                    tr.innerHTML = `
                        <td>${escapeHtml(r.name)}</td>
                        <td>${escapeHtml(r.phone)}</td>
                        <td><span class="campaign-status-badge ${badgeClass}">${
                            r.status
                        }</span></td>
                        <td>${escapeHtml(timeOrError)}</td>
                    `;
                    modalRecipientsBody.appendChild(tr);
                });
            }

            // Tab 2: Edit Form
            editCampaignName.value = camp.name;
            editCampaignMessage.value = camp.message;

            const recipientLines = camp.recipients.map(
                (r) => `${r.name},${r.phone}`,
            );
            editCampaignRecipients.value = recipientLines.join('\n');

            // Tab 3: AI Config Form
            const aiConf = camp.aiConfig || {
                enabled: false,
                provider: 'gemini',
                systemPrompt: 'Anda adalah asisten AI ramah khusus projek ini.',
            };

            projectAiCheckbox.checked = aiConf.enabled;
            updateToggleLabel(projectAiCheckbox, projectAiStatusText);

            projectAiProvider.value = aiConf.provider || 'gemini';
            projectAiPrompt.value =
                aiConf.systemPrompt ||
                'Anda adalah asisten AI ramah khusus projek ini.';
        } catch (error) {
            console.error('Error refreshing project details modal:', error);
        }
    }

    function closeProjectDetailsModal() {
        projectDetailsModal.classList.add('hidden');
        activeModalCampaignId = null;
    }

    closeProjectModalBtn.addEventListener('click', closeProjectDetailsModal);

    // Modal Tabs Switching
    modalTabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetPaneId = btn.getAttribute('data-modal-tab');

            modalTabBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');

            modalTabPanes.forEach((pane) => {
                if (pane.id === targetPaneId) {
                    pane.classList.remove('hidden');
                } else {
                    pane.classList.add('hidden');
                }
            });
        });
    });

    // Handle Edit Project Submit (CRUD Update)
    editProjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!activeModalCampaignId) return;

        const name = editCampaignName.value.trim();
        const message = editCampaignMessage.value.trim();
        const rawRecipients = editCampaignRecipients.value.trim();

        if (!name || !message || !rawRecipients) {
            alert('Harap isi seluruh input!');
            return;
        }

        const lines = rawRecipients.split('\n').filter((l) => l.trim() !== '');
        const recipients = lines
            .map((line) => {
                const parts = line.split(',');
                if (parts.length >= 2) {
                    return { name: parts[0].trim(), phone: parts[1].trim() };
                } else {
                    return { name: 'Pelanggan', phone: parts[0].trim() };
                }
            })
            .filter((r) => r.phone.replace(/\D/g, '').length > 5);

        if (recipients.length === 0) {
            alert('Tidak ada nomor penerima yang valid!');
            return;
        }

        const submitBtn = document.getElementById('edit-project-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML =
            '<span>Menyimpan...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const response = await fetch(
                `/api/campaigns/${activeModalCampaignId}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, message, recipients }),
                },
            );
            const data = await response.json();

            if (data.success) {
                alert('Projek berhasil diperbarui!');
                loadCampaigns();
                await refreshProjectDetailsModal();
            } else {
                alert('Gagal memperbarui projek: ' + data.error);
            }
        } catch (error) {
            alert('Error jaringan: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML =
                '<span>Simpan Perubahan Projek</span> <i class="fa-solid fa-save"></i>';
        }
    });

    // Handle Project AI Toggle Label
    projectAiCheckbox.addEventListener('change', () => {
        updateToggleLabel(projectAiCheckbox, projectAiStatusText);
    });

    // Handle Project AI Submit
    projectAiForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!activeModalCampaignId) return;

        const enabled = projectAiCheckbox.checked;
        const provider = projectAiProvider.value;
        const systemPrompt = projectAiPrompt.value.trim();

        const submitBtn = document.getElementById('project-ai-submit-btn');
        submitBtn.disabled = true;
        submitBtn.innerHTML =
            '<span>Menyimpan...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const response = await fetch(
                `/api/campaigns/${activeModalCampaignId}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        aiConfig: { enabled, provider, systemPrompt },
                    }),
                },
            );
            const data = await response.json();

            if (data.success) {
                alert('Integrasi AI Projek berhasil disimpan!');
                loadCampaigns();
                await refreshProjectDetailsModal();
            } else {
                alert('Gagal menyimpan integrasi AI: ' + data.error);
            }
        } catch (error) {
            alert('Error jaringan: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML =
                '<span>Simpan Integrasi AI Projek</span> <i class="fa-solid fa-save"></i>';
        }
    });

    // ==========================================
    // STATUS SCHEDULER FEATURES
    // ==========================================
    const statusScheduleForm = document.getElementById('status-schedule-form');
    const statusIdInput = document.getElementById('status-id');
    const statusNameInput = document.getElementById('status-name');
    const statusCronInput = document.getElementById('status-cron');
    const statusTypeSelect = document.getElementById('status-type');
    const statusMediaGroup = document.getElementById('status-media-group');
    const statusMediaPathInput = document.getElementById('status-media-path');
    const statusContentInput = document.getElementById('status-content');
    const statusEnabledCheckbox = document.getElementById('status-enabled');
    const statusSubmitBtn = document.getElementById('status-submit-btn');
    const statusCancelBtn = document.getElementById('status-cancel-btn');
    const statusScheduleTableBody = document.getElementById(
        'status-schedule-table-body',
    );

    // Toggle media path visibility
    statusTypeSelect.addEventListener('change', () => {
        if (statusTypeSelect.value === 'text') {
            statusMediaGroup.style.display = 'none';
            statusMediaPathInput.removeAttribute('required');
        } else {
            statusMediaGroup.style.display = 'block';
            statusMediaPathInput.setAttribute('required', 'required');
        }
    });

    // Load and render status schedules
    async function loadStatusSchedules() {
        try {
            const response = await fetch('/api/statuses/schedule');
            const data = await response.json();

            if (data.success) {
                renderStatusSchedules(data.schedules);
            } else {
                console.error('Gagal mengambil jadwal status:', data.error);
            }
        } catch (error) {
            console.error('Error fetching schedules:', error);
        }
    }

    function renderStatusSchedules(schedules) {
        statusScheduleTableBody.innerHTML = '';

        if (schedules.length === 0) {
            statusScheduleTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 20px; color: var(--color-text-muted);">
                        Belum ada jadwal status otomatis yang dibuat.
                    </td>
                </tr>
            `;
            return;
        }

        schedules.forEach((schedule) => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';

            const badgeClass = schedule.enabled ? 'success' : 'muted';
            const badgeText = schedule.enabled ? 'AKTIF' : 'NON-AKTIF';

            const truncatedContent = schedule.content
                ? schedule.content.length > 30
                    ? schedule.content.substring(0, 30) + '...'
                    : schedule.content
                : '<span style="color: var(--color-text-muted)">Tanpa caption</span>';

            tr.innerHTML = `
                <td style="padding: 12px 8px;">
                    <div style="font-weight: 600;">${schedule.name}</div>
                    <div style="font-size: 0.75rem; color: var(--color-text-secondary); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${truncatedContent}
                    </div>
                </td>
                <td style="padding: 12px 8px;"><code style="color: var(--color-wa-green); background: rgba(37, 211, 102, 0.05); padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace;">${schedule.cronExpression}</code></td>
                <td style="padding: 12px 8px;">
                    <span style="font-size: 0.8rem; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-color); padding: 2px 8px; border-radius: 50px;">
                        ${schedule.type.toUpperCase()}
                    </span>
                </td>
                <td style="padding: 12px 8px;">
                    <span class="status-badge ${badgeClass}" style="font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
                        ${badgeText}
                    </span>
                </td>
                <td style="padding: 12px 8px; text-align: right; white-space: nowrap;">
                    <button class="action-btn trigger-status-btn" data-id="${schedule.id}" title="Kirim Sekarang (Instan)" style="background: rgba(37, 211, 102, 0.1); color: var(--color-wa-green); border: 1px solid rgba(37, 211, 102, 0.2); padding: 4px 8px; border-radius: 4px; margin-right: 4px; cursor: pointer;">
                        <i class="fa-solid fa-paper-plane"></i>
                    </button>
                    <button class="action-btn edit-status-btn" data-id="${schedule.id}" title="Edit" style="background: rgba(255, 255, 255, 0.05); color: var(--color-text-primary); border: 1px solid var(--border-color); padding: 4px 8px; border-radius: 4px; margin-right: 4px; cursor: pointer;">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="action-btn delete-status-btn" data-id="${schedule.id}" title="Hapus" style="background: rgba(239, 68, 68, 0.1); color: var(--color-error); border: 1px solid rgba(239, 68, 68, 0.2); padding: 4px 8px; border-radius: 4px; cursor: pointer;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;

            // Event Listeners for actions
            tr.querySelector('.trigger-status-btn').addEventListener(
                'click',
                () => triggerStatusInstantly(schedule.id),
            );
            tr.querySelector('.edit-status-btn').addEventListener('click', () =>
                editStatusSchedule(schedule),
            );
            tr.querySelector('.delete-status-btn').addEventListener(
                'click',
                () => deleteStatusSchedule(schedule.id),
            );

            statusScheduleTableBody.appendChild(tr);
        });
    }

    // Submit form (Create / Update)
    statusScheduleForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = statusIdInput.value;
        const name = statusNameInput.value.trim();
        const cronExpression = statusCronInput.value.trim();
        const type = statusTypeSelect.value;
        const mediaPath = statusMediaPathInput.value.trim();
        const content = statusContentInput.value.trim();
        const enabled = statusEnabledCheckbox.checked;

        const isEdit = !!id;
        const url = isEdit
            ? `/api/statuses/schedule/${id}`
            : '/api/statuses/schedule';
        const method = isEdit ? 'PUT' : 'POST';

        statusSubmitBtn.disabled = true;
        statusSubmitBtn.innerHTML =
            '<span>Menyimpan...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    cronExpression,
                    type,
                    mediaPath,
                    content,
                    enabled,
                }),
            });
            const data = await response.json();

            if (data.success) {
                alert(
                    isEdit
                        ? 'Jadwal status berhasil diperbarui!'
                        : 'Jadwal status baru berhasil dibuat!',
                );
                resetStatusForm();
                loadStatusSchedules();
            } else {
                alert('Gagal menyimpan jadwal status: ' + data.error);
            }
        } catch (error) {
            alert('Error jaringan: ' + error.message);
        } finally {
            statusSubmitBtn.disabled = false;
            statusSubmitBtn.innerHTML =
                '<span>Simpan Jadwal</span> <i class="fa-solid fa-save"></i>';
        }
    });

    // Populate form for editing
    function editStatusSchedule(schedule) {
        statusIdInput.value = schedule.id;
        statusNameInput.value = schedule.name;
        statusCronInput.value = schedule.cronExpression;
        statusTypeSelect.value = schedule.type;
        statusMediaPathInput.value = schedule.mediaPath || '';
        statusContentInput.value = schedule.content || '';
        statusEnabledCheckbox.checked = schedule.enabled;

        // Trigger change to update media source field visibility
        statusTypeSelect.dispatchEvent(new Event('change'));

        statusSubmitBtn.innerHTML =
            '<span>Perbarui Jadwal</span> <i class="fa-solid fa-save"></i>';
        statusCancelBtn.style.display = 'inline-block';
    }

    // Cancel edit
    statusCancelBtn.addEventListener('click', resetStatusForm);

    function resetStatusForm() {
        statusIdInput.value = '';
        statusScheduleForm.reset();
        statusTypeSelect.dispatchEvent(new Event('change'));
        statusSubmitBtn.innerHTML =
            '<span>Simpan Jadwal</span> <i class="fa-solid fa-save"></i>';
        statusCancelBtn.style.display = 'none';
    }

    // Delete schedule
    async function deleteStatusSchedule(id) {
        if (!confirm('Apakah Anda yakin ingin menghapus jadwal status ini?'))
            return;

        try {
            const response = await fetch(`/api/statuses/schedule/${id}`, {
                method: 'DELETE',
            });
            const data = await response.json();

            if (data.success) {
                alert('Jadwal status berhasil dihapus!');
                loadStatusSchedules();
            } else {
                alert('Gagal menghapus: ' + data.error);
            }
        } catch (error) {
            alert('Error jaringan: ' + error.message);
        }
    }

    // Trigger instantly (test posting)
    async function triggerStatusInstantly(id) {
        try {
            const response = await fetch(
                `/api/statuses/schedule/${id}/trigger`,
                {
                    method: 'POST',
                },
            );
            const data = await response.json();

            if (data.success) {
                alert(
                    'Status berhasil dikirim ke antrean posting instan! (Periksa konsol aktivitas untuk log lengkap)',
                );
            } else {
                alert('Gagal memicu status: ' + data.error);
            }
        } catch (error) {
            alert('Error jaringan: ' + error.message);
        }
    }

    refreshGroupsBtn.addEventListener('click', loadGroupsDropdown);
    updateCampaignBadge();
});
