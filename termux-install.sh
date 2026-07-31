#!/bin/bash

# ANSI Color Codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== WhatsApp Bot Manager: Termux Installer ===${NC}"

# 1. Verifikasi lingkungan Termux
if [ -z "$PREFIX" ] || [[ ! "$PREFIX" =~ "com.termux" ]]; then
    echo -e "${RED}Error: Script ini hanya dapat dijalankan di dalam lingkungan Termux Android!${NC}"
    exit 1
fi

# Fungsi cek keberadaan perintah
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 2. Update sistem paket Termux
echo -e "${YELLOW}Memperbarui daftar paket Termux...${NC}"
pkg update -y && pkg upgrade -y

# 3. Cek & Pasang repositori X11 dan TUR
echo -e "${YELLOW}Memeriksa kebutuhan repositori tambahan...${NC}"

if [ ! -f "$PREFIX/etc/apt/sources.list.d/x11.list" ]; then
    echo -e "${YELLOW}Memasang x11-repo...${NC}"
    pkg install x11-repo -y
else
    echo -e "${GREEN}[OK] x11-repo sudah terpasang.${NC}"
fi

if [ ! -f "$PREFIX/etc/apt/sources.list.d/tur.list" ]; then
    echo -e "${YELLOW}Memasang tur-repo...${NC}"
    pkg install tur-repo -y
else
    echo -e "${GREEN}[OK] tur-repo sudah terpasang.${NC}"
fi

# 4. Cek & Pasang Node.js
if ! command_exists node; then
    echo -e "${YELLOW}Memasang Node.js...${NC}"
    pkg install nodejs -y
else
    echo -e "${GREEN}[OK] Node.js sudah terpasang ($(node -v)).${NC}"
fi

# 5. Cek & Pasang Chromium (untuk Puppeteer ARM64)
if ! command_exists chromium; then
    echo -e "${YELLOW}Memasang Chromium (Browser)...${NC}"
    pkg install chromium -y
else
    echo -e "${GREEN}[OK] Chromium sudah terpasang.${NC}"
fi

# 6. Konfigurasi Env Variables di ~/.bashrc
echo -e "${YELLOW}Mengonfigurasi Environment Variables untuk Puppeteer...${NC}"
CONFIG_ADDED=false

if ! grep -q "PUPPETEER_SKIP_CHROMIUM_DOWNLOAD" ~/.bashrc; then
    echo 'export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true' >> ~/.bashrc
    CONFIG_ADDED=true
fi

if ! grep -q "PUPPETEER_EXECUTABLE_PATH" ~/.bashrc; then
    echo 'export PUPPETEER_EXECUTABLE_PATH=$PREFIX/bin/chromium' >> ~/.bashrc
    CONFIG_ADDED=true
fi

# Ekspor untuk sesi installer saat ini
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export PUPPETEER_EXECUTABLE_PATH=$PREFIX/bin/chromium

if [ "$CONFIG_ADDED" = true ]; then
    echo -e "${GREEN}[OK] Variabel lingkungan ditambahkan ke ~/.bashrc.${NC}"
else
    echo -e "${GREEN}[OK] Variabel lingkungan sudah siap di ~/.bashrc.${NC}"
fi

# 7. Memasang dependensi Node.js proyek
echo -e "${YELLOW}Memasang dependensi proyek melalui npm...${NC}"
npm install

echo -e "${GREEN}=== INSTALASI SELESAI! ===${NC}"
echo -e "Mulai bot dengan perintah:"
echo -e "${YELLOW}node server.js${NC}"
echo -e "Lalu buka dashboard bot melalui browser HP di alamat: ${GREEN}http://localhost:3000${NC}"
