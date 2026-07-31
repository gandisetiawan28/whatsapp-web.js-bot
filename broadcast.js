const { Client, LocalAuth } = require('./index');
const fs = require('fs');

// Auto-detect local Chrome/Edge
function getLocalBrowserPath() {
    const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return undefined;
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false,
        executablePath: getLocalBrowserPath(),
    },
});

// Helper function untuk memberikan delay (jeda)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ================= PENGATURAN BROADCAST =================
// Daftar nomor tujuan (Gunakan kode negara di depan, misal 62 untuk Indonesia)
// HANYA angka saja, jangan ada karakter '+', spasi, atau tanda hubung '-'
const targetNumbers = [
    '6281234567890', // Ganti dengan nomor tujuan asli
    '6281298765432', // Ganti dengan nomor tujuan asli kedua
];

// Isi pesan yang ingin dikirim
const messageToSend =
    'Halo! Ini adalah pesan broadcast otomatis dari sistem kami. Semoga hari Anda menyenangkan!';
// ========================================================

client.on('ready', async () => {
    console.log('Client is ready! Memulai proses broadcast...\n');

    for (let i = 0; i < targetNumbers.length; i++) {
        let number = targetNumbers[i].trim();

        // Membersihkan karakter non-angka jika tidak sengaja terinput
        number = number.replace(/\D/g, '');

        if (!number) continue;

        // Tambahkan akhiran JID whatsapp @c.us jika belum ada
        const formattedNumber = `${number}@c.us`;

        try {
            console.log(
                `[${i + 1}/${targetNumbers.length}] Mengirim ke ${number}...`,
            );
            await client.sendMessage(formattedNumber, messageToSend);
            console.log(`✅ Sukses mengirim ke ${number}`);
        } catch (error) {
            console.error(`❌ Gagal mengirim ke ${number}:`, error.message);
        }

        // Berikan jeda waktu acak (misal 5 s/d 10 detik) agar tidak dinilai sebagai Spam oleh WhatsApp
        if (i < targetNumbers.length - 1) {
            const delayTime = Math.floor(Math.random() * 5000) + 5000; // 5000ms s/d 10000ms
            console.log(
                `Menunggu jeda selama ${delayTime / 1000} detik sebelum mengirim pesan berikutnya...\n`,
            );
            await sleep(delayTime);
        }
    }

    console.log('🎉 Semua proses broadcast selesai!');
});

const browserPath = getLocalBrowserPath();
console.log('Initializing client...');
if (browserPath) {
    console.log(`Using local browser at: ${browserPath}`);
}
client.initialize();
