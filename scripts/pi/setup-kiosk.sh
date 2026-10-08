#!/usr/bin/env bash
# Run once on the Pi after cloning the repo (Raspberry Pi OS Lite Bookworm 64-bit).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
USER_NAME="$(id -un)"
HOME_DIR="$(eval echo "~$USER_NAME")"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run as the normal Pi user (not root)."
  exit 1
fi

echo "==> Installing packages"
sudo apt-get update
sudo apt-get install -y \
  chromium \
  chromium-browser \
  labwc \
  seatd \
  wl-clipboard \
  unclutter \
  curl \
  git

if ! command -v node >/dev/null 2>&1; then
  echo "==> Installing Node.js 20.x"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> App dependencies"
cd "$REPO_DIR"
npm install --omit=dev

if [[ ! -f "$REPO_DIR/.env" ]]; then
  cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
  # Enable shutdown/reboot only on the Pi install
  sed -i 's/^ALLOW_POWER_CONTROL=.*/ALLOW_POWER_CONTROL=true/' "$REPO_DIR/.env"
fi

echo "==> systemd service"
SERVICE_SRC="$REPO_DIR/systemd/pi-weather.service"
TMP_SERVICE="$(mktemp)"
sed \
  -e "s|/home/pi/pi-weather|$REPO_DIR|g" \
  -e "s|^User=pi|User=$USER_NAME|" \
  "$SERVICE_SRC" >"$TMP_SERVICE"
sudo cp "$TMP_SERVICE" /etc/systemd/system/pi-weather.service
rm -f "$TMP_SERVICE"
sudo systemctl daemon-reload
sudo systemctl enable --now pi-weather.service

echo "==> Passwordless power control for kiosk UI"
sudo tee /etc/sudoers.d/pi-weather-power >/dev/null <<EOF
$USER_NAME ALL=NOPASSWD: /bin/systemctl poweroff, /bin/systemctl reboot
EOF
sudo chmod 440 /etc/sudoers.d/pi-weather-power

echo "==> Autologin on console (raspi-config B2)"
if command -v raspi-config >/dev/null 2>&1; then
  sudo raspi-config nonint do_boot_behaviour B2 || true
fi

echo "==> labwc autostart for kiosk"
mkdir -p "$HOME_DIR/.config/labwc"
cat >"$HOME_DIR/.config/labwc/autostart" <<EOF
$REPO_DIR/scripts/pi/kiosk.sh &
EOF
chmod +x "$REPO_DIR/scripts/pi/kiosk.sh"

# Start labwc on login
if ! grep -q 'labwc' "$HOME_DIR/.bash_profile" 2>/dev/null; then
  cat >>"$HOME_DIR/.bash_profile" <<'EOF'

# Start Wayland kiosk session on tty1
if [ -z "$WAYLAND_DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  exec labwc
fi
EOF
fi

echo "==> Quieter boot (best-effort)"
CMDLINE="/boot/firmware/cmdline.txt"
if [[ -f "$CMDLINE" ]]; then
  if ! grep -q 'quiet' "$CMDLINE"; then
    sudo sed -i 's/$/ quiet splash logo.nologo/' "$CMDLINE"
  fi
fi
if [[ -f /boot/firmware/config.txt ]]; then
  if ! grep -q '^disable_splash=' /boot/firmware/config.txt; then
    echo 'disable_splash=1' | sudo tee -a /boot/firmware/config.txt >/dev/null
  fi
fi

echo ""
echo "Setup complete."
echo "  App:     http://$(hostname -I | awk '{print $1}'):3000"
echo "  Service: sudo systemctl status pi-weather"
echo "Reboot to enter kiosk mode:"
echo "  sudo reboot"
echo ""
echo "After everything is stable, enable OverlayFS via:"
echo "  sudo raspi-config  →  Performance Options  →  Overlay File System"
