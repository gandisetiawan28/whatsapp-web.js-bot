const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const mime = require('mime');
const { MessageMedia } = require('../index');

const SCHEDULE_FILE = path.join(__dirname, '../status_schedule.json');
let activeJobs = new Map(); // id -> cronJob
let whatsappClient = null;
let logFn = null;

// Helper to log both to console and frontend dashboard
function logMessage(type, message) {
    if (logFn) {
        logFn(type, message);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

// Convert media source (base64 data URI, HTTP url, or local path) to MessageMedia
async function getMediaObject(mediaSource) {
    if (!mediaSource) return null;

    try {
        if (mediaSource.startsWith('data:')) {
            const regex = new RegExp('^data:([A-Za-z0-9\\-+/]+);base64,(.+)$');
            const matches = mediaSource.match(regex);
            if (matches && matches.length === 3) {
                return new MessageMedia(matches[1], matches[2]);
            }
            throw new Error('Format Base64 data URI tidak valid.');
        }

        // Case 2: Remote URL (HTTP/HTTPS)
        if (
            mediaSource.startsWith('http://') ||
            mediaSource.startsWith('https://')
        ) {
            const res = await fetch(mediaSource);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const buffer = await res.buffer();
            const contentType = res.headers.get('content-type') || 'image/jpeg';
            return new MessageMedia(contentType, buffer.toString('base64'));
        }

        // Case 3: Local file path
        const absolutePath = path.resolve(mediaSource);
        if (fs.existsSync(absolutePath)) {
            const fileMime = mime.getType(absolutePath) || 'image/jpeg';
            const fileData = fs.readFileSync(absolutePath).toString('base64');
            return new MessageMedia(fileMime, fileData);
        }

        throw new Error(`File lokal tidak ditemukan di path: ${mediaSource}`);
    } catch (error) {
        throw new Error(`Gagal memuat media: ${error.message}`);
    }
}

// Read status schedules from JSON file
function getSchedules() {
    try {
        if (fs.existsSync(SCHEDULE_FILE)) {
            const data = fs.readFileSync(SCHEDULE_FILE, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error('Gagal membaca status_schedule.json:', error);
        return [];
    }
}

// Save status schedules to JSON file
function saveSchedules(schedules) {
    try {
        fs.writeFileSync(
            SCHEDULE_FILE,
            JSON.stringify(schedules, null, 2),
            'utf8',
        );
    } catch (error) {
        console.error('Gagal menyimpan status_schedule.json:', error);
    }
}

// Post a status now
async function postStatus(schedule) {
    if (!whatsappClient) {
        logMessage(
            'ERROR',
            `[Scheduler] WhatsApp Client belum siap untuk status: "${schedule.name}"`,
        );
        return;
    }

    logMessage(
        'SYSTEM',
        `[Scheduler] Menjalankan posting status terjadwal: "${schedule.name}"...`,
    );

    try {
        if (schedule.type === 'text') {
            await whatsappClient.sendMessage(
                'status@broadcast',
                schedule.content,
            );
            logMessage(
                'STATUS',
                `Status teks berhasil diposting otomatis: "${schedule.content.substring(0, 30)}..."`,
            );
        } else {
            const media = await getMediaObject(schedule.mediaPath);
            if (!media) {
                throw new Error('Media tidak dapat dimuat.');
            }
            await whatsappClient.sendMessage('status@broadcast', media, {
                caption: schedule.content || undefined,
            });
            logMessage(
                'STATUS',
                `Status media (${schedule.type}) berhasil diposting otomatis: "${schedule.name}"`,
            );
        }
    } catch (error) {
        logMessage(
            'ERROR',
            `[Scheduler] Gagal memposting status "${schedule.name}": ${error.message}`,
        );
    }
}

// Stop a cron job
function stopJob(id) {
    if (activeJobs.has(id)) {
        activeJobs.get(id).stop();
        activeJobs.delete(id);
    }
}

// Start a cron job for a schedule
function startJob(schedule) {
    stopJob(schedule.id); // Stop existing first to avoid duplication

    if (!schedule.enabled) return;

    if (!cron.validate(schedule.cronExpression)) {
        logMessage(
            'ERROR',
            `[Scheduler] Ekspresi cron tidak valid untuk "${schedule.name}": "${schedule.cronExpression}"`,
        );
        return;
    }

    const job = cron.schedule(schedule.cronExpression, () => {
        postStatus(schedule).catch((err) => {
            console.error('Terjadi kesalahan saat memposting status:', err);
        });
    });

    activeJobs.set(schedule.id, job);
}

// Initialize the scheduler and start all enabled jobs
function initStatusScheduler(client, logToFrontend) {
    whatsappClient = client;
    logFn = logToFrontend;

    logMessage(
        'SYSTEM',
        '[Scheduler] Menginisialisasi Penjadwal Status WhatsApp...',
    );

    // Stop all running jobs to prevent duplicates if re-initialized
    for (const job of activeJobs.values()) {
        job.stop();
    }
    activeJobs.clear();

    const schedules = getSchedules();
    schedules.forEach((schedule) => {
        if (schedule.enabled) {
            startJob(schedule);
        }
    });

    logMessage(
        'SYSTEM',
        `[Scheduler] Berhasil mengaktifkan ${activeJobs.size} jadwal status otomatis.`,
    );
}

module.exports = {
    initStatusScheduler,
    getSchedules,
    saveSchedules,
    addSchedule: (schedule) => {
        const schedules = getSchedules();
        schedules.push(schedule);
        saveSchedules(schedules);
        if (schedule.enabled) {
            startJob(schedule);
        }
    },
    updateSchedule: (updatedSchedule) => {
        let schedules = getSchedules();
        schedules = schedules.map((s) =>
            s.id === updatedSchedule.id ? updatedSchedule : s,
        );
        saveSchedules(schedules);

        // Restart/update cron job
        if (updatedSchedule.enabled) {
            startJob(updatedSchedule);
        } else {
            stopJob(updatedSchedule.id);
        }
    },
    deleteSchedule: (id) => {
        let schedules = getSchedules();
        schedules = schedules.filter((s) => s.id !== id);
        saveSchedules(schedules);
        stopJob(id);
    },
    triggerStatusNow: async (id) => {
        const schedules = getSchedules();
        const schedule = schedules.find((s) => s.id === id);
        if (!schedule) {
            throw new Error(`Jadwal status dengan ID "${id}" tidak ditemukan.`);
        }
        await postStatus(schedule);
    },
};
