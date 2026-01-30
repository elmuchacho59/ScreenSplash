#!/bin/bash
# ============================================
# ScreenSplash Installation Script
# Pour Raspberry Pi OS Lite
# ============================================

set -e

echo "======================================="
echo "  ScreenSplash Installer"
echo "  Digital Signage pour Raspberry Pi"
echo "======================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Erreur: Ce script doit être exécuté avec sudo${NC}"
    echo "Usage: sudo ./install.sh"
    exit 1
fi

# Get actual user and detect install dir
ACTUAL_USER="${SUDO_USER:-$USER}"
HOME_DIR=$(eval echo ~$ACTUAL_USER)

# Detect if we are running inside the project folder
SCRIPT_PATH=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT_PATH")
DETECTED_INSTALL_DIR=$(dirname "$SCRIPT_DIR")

# Fallback to home/screensplash only if not detected
INSTALL_DIR="${DETECTED_INSTALL_DIR}"

echo -e "${YELLOW}Utilisateur: $ACTUAL_USER${NC}"
echo -e "${YELLOW}Répertoire détecté: $INSTALL_DIR${NC}"
echo ""

# ============================================
# Update System
# ============================================
echo -e "${GREEN}[1/8] Mise à jour du système...${NC}"
apt-get update -qq
apt-get upgrade -y -qq

# ============================================
# Install Dependencies
# ============================================
echo -e "${GREEN}[2/8] Installation des dépendances...${NC}"
apt-get install -y -qq \
    python3 \
    python3-pip \
    python3-venv \
    chromium-browser \
    unclutter \
    xdotool \
    x11-xserver-utils \
    xinit \
    xserver-xorg \
    xserver-xorg-legacy \
    openbox \
    fonts-noto \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2


# ============================================
# Install Node.js (for building frontend)
# ============================================
echo -e "${GREEN}[3/8] Installation de Node.js...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi

# ============================================
# Create directories
# ============================================
echo -e "${GREEN}[4/8] Création des répertoires...${NC}"
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/assets/images"
mkdir -p "$INSTALL_DIR/assets/videos"
mkdir -p "$INSTALL_DIR/assets/thumbnails"
mkdir -p "$INSTALL_DIR/database"
mkdir -p "$INSTALL_DIR/logs"

# ============================================
# Setup Python virtual environment
# ============================================
echo -e "${GREEN}[5/8] Configuration de l'environnement Python...${NC}"
cd "$INSTALL_DIR"

if [ -d "backend" ]; then
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip -q
    pip install -r requirements.txt -q
    deactivate
fi

# ============================================
# Build Frontend
# ============================================
echo -e "${GREEN}[6/8] Construction du frontend...${NC}"
if [ -d "$INSTALL_DIR/frontend" ]; then
    cd "$INSTALL_DIR/frontend"
    npm install --silent
    npm run build --silent
    
    # Copy build to backend static folder
    mkdir -p "$INSTALL_DIR/backend/static"
    cp -r dist/* "$INSTALL_DIR/backend/static/"
fi

# ============================================
# Setup Systemd Services
# ============================================
echo -e "${GREEN}[7/8] Configuration des services systemd...${NC}"

# Backend service
cat > /etc/systemd/system/screensplash.service << EOF
[Unit]
Description=ScreenSplash Backend Server
After=network.target

[Service]
Type=simple
User=$ACTUAL_USER
WorkingDirectory=$INSTALL_DIR/backend
Environment=PATH=$INSTALL_DIR/backend/venv/bin
ExecStart=$INSTALL_DIR/backend/venv/bin/python run.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Kiosk service
cat > /etc/systemd/system/screensplash-kiosk.service << EOF
[Unit]
Description=ScreenSplash Kiosk Display
Wants=graphical.target
After=graphical.target

[Service]
Type=simple
User=$ACTUAL_USER
Environment=DISPLAY=:0
Environment=XAUTHORITY=$HOME_DIR/.Xauthority
ExecStartPre=/bin/sleep 20
ExecStart=/usr/bin/chromium-browser \\
    --kiosk \\
    --noerrdialogs \\
    --disable-infobars \\
    --disable-session-crashed-bubble \\
    --disable-restore-session-state \\
    --no-first-run \\
    --start-fullscreen \\
    --disable-translate \\
    --disable-features=TranslateUI \\
    --disable-component-update \\
    --autoplay-policy=no-user-gesture-required \\
    --check-for-update-interval=31536000 \\
    --disable-gpu-compositing \\
    --disable-software-rasterizer \\
    http://localhost:5000/player
Restart=always
RestartSec=10

[Install]
WantedBy=graphical.target
EOF
# Note: On désactive le service kiosk séparé car on va le lancer via .xinitrc pour plus de stabilité.
systemctl disable screensplash-kiosk.service 2>/dev/null || true


# X11 wrapper config for root
cat > /etc/X11/Xwrapper.config << EOF
allowed_users=anybody
needs_root_rights=yes
EOF

# Enable services
systemctl daemon-reload
systemctl enable screensplash.service
# systemctl enable screensplash-kiosk.service


# ============================================
# Configure Auto-login and X11
# ============================================
echo -e "${GREEN}[8/8] Configuration du démarrage automatique...${NC}"

# Auto-login on tty1
mkdir -p /etc/systemd/system/getty@tty1.service.d/
cat > /etc/systemd/system/getty@tty1.service.d/override.conf << EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $ACTUAL_USER --noclear %I \$TERM
EOF

# .xinitrc
cat > "$HOME_DIR/.xinitrc" << EOF
#!/bin/bash
xset s off
xset -dpms
xset s noblank
unclutter -idle 0.5 -root &

# Lancement de Chromium avec réglages optimisés pour Pi 3B
exec chromium-browser \\
    --kiosk \\
    --noerrdialogs \\
    --disable-infobars \\
    --disable-session-crashed-bubble \\
    --disable-restore-session-state \\
    --no-first-run \\
    --start-fullscreen \\
    --window-size=1920,1080 \\
    --window-position=0,0 \\
    --disable-translate \\
    --disable-features=TranslateUI,Translate \\
    --no-default-browser-check \\
    --test-type \\
    --disable-component-update \\
    --autoplay-policy=no-user-gesture-required \\

    --check-for-update-interval=31536000 \\
    --disable-gpu \\
    --no-sandbox \\
    --disable-dev-shm-usage \\
    http://localhost:5000/player
EOF


chown $ACTUAL_USER:$ACTUAL_USER "$HOME_DIR/.xinitrc"
chmod +x "$HOME_DIR/.xinitrc"

# .bash_profile for X autostart
if ! grep -q "startx" "$HOME_DIR/.bash_profile" 2>/dev/null; then
    cat >> "$HOME_DIR/.bash_profile" << EOF

# Start X on login (only on tty1)
if [ -z "\$DISPLAY" ] && [ "\$(tty)" = "/dev/tty1" ]; then
    startx
fi
EOF
fi

# Set permissions
chown -R $ACTUAL_USER:$ACTUAL_USER "$INSTALL_DIR"

# ============================================
# Done
# ============================================
echo ""
echo "======================================="
echo -e "${GREEN}Installation terminée !${NC}"
echo "======================================="
echo ""
echo "Pour démarrer manuellement:"
echo "  sudo systemctl start screensplash"
echo "  sudo systemctl start screensplash-kiosk"
echo ""
echo "Accédez à l'interface d'administration:"
echo "  http://$(hostname -I | awk '{print $1}'):5000"
echo ""
echo "Redémarrez pour activer l'affichage automatique:"
echo "  sudo reboot"
echo ""
