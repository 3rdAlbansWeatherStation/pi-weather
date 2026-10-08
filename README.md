# 3rd Albans Weather (Pi kiosk)

Raspberry Pi 4 weather display for an Ecowitt station. Boots into a fullscreen Chromium kiosk on a **1024×600** touchscreen, serves the same UI on the LAN, and will pull live data from the hub (mock data until the station arrives).

## Stack

- **Node + Express** local API and static UI
- **Mock weather** now; Ecowitt hub (`/get_livedata_info`) next
- **Touch UI** with confirmed shutdown / reboot
- **labwc + Chromium** kiosk on Raspberry Pi OS Lite Bookworm 64-bit

## Develop on Windows

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Power buttons stay disabled until `ALLOW_POWER_CONTROL=true` (Pi only).

## Pi first boot (checklist)

1. Flash **Raspberry Pi OS Lite (64-bit, Bookworm)** with Imager:
   - hostname e.g. `weather-pi`
   - user / password
   - Wi‑Fi
   - **SSH enabled**
2. Boot with the GeeekPi panel on **HDMI0**, USB touch connected.
3. SSH in, then:

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/3rdAlbansWeatherStation/pi-weather.git ~/pi-weather
cd ~/pi-weather
bash scripts/pi/setup-kiosk.sh
sudo reboot
```

4. From any device on the same Wi‑Fi: `http://weather-pi.local:3000` (or the Pi’s IP).

## Deploy updates

On your PC:

```bash
git push
```

On the Pi:

```bash
cd ~/pi-weather
git pull
npm install --omit=dev
sudo systemctl restart pi-weather
```

## Config

Copy `.env.example` → `.env`:

| Variable | Purpose |
|----------|---------|
| `DATA_SOURCE` | `mock` (default) or `hub` |
| `ECOWITT_HUB_IP` | Hub LAN IP when using `hub` |
| `ALLOW_POWER_CONTROL` | `true` on Pi to enable shutdown/reboot API |
| `PORT` / `HOST` | Default `3000` / `0.0.0.0` |

## SD card protection

Use the on-screen **Power → Shut down** control. After the kiosk is stable, enable **Overlay File System** in `raspi-config` (Performance Options). Do this last — updates then require disabling the overlay first.

## Repo layout

```
server/           Node API
public/           Touch UI (1024×600 first)
scripts/pi/       Kiosk + one-shot setup
systemd/          pi-weather.service
```
