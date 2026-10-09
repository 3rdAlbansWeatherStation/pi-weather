# 3rd Albans Weather (Pi kiosk)

Raspberry Pi 4 weather display for an Ecowitt station. Boots into a fullscreen Chromium kiosk on a **1024×600** touchscreen, serves the **Pi kiosk UI** (`public/`) on the LAN, and will pull live data from the hub (mock data until the station arrives). There is a **separate** public GitHub site under `site/` — see below.

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
   - hostname e.g. `PiWeatherStation`
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

4. From any device on the same Wi‑Fi: `http://PiWeatherStation.local:3000` (or the Pi’s IP).

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

## Hardware data reference

Kit: **Ecowitt GW3002** = **GW3000** hub + **WS69** outdoor array.  
Full field list (live + history + Pi vs public site): [`docs/ecowitt-gw3002-ws69-data.md`](docs/ecowitt-gw3002-ws69-data.md).

## Two websites (keep separate)

| | Pi kiosk | GitHub public site |
|--|----------|-------------------|
| Folder | **`public/`** | **`site/`** |
| URL | `http://192.168.1.223:3000` (LAN) | [3rdalbansweatherstation.github.io](https://3rdalbansweatherstation.github.io/) |
| Data | Express `/api/*` | Static `site/data/*.json` |
| Extras | Power controls | Welcome / Privacy / Info — **no** Power |

They share Scouts branding but are **different apps**. Do not deploy `public/` to github.io or `site/` to the Pi.  
Pi deploy: [`docs/pi-connect.md`](docs/pi-connect.md) or `python scripts/deploy-pi-kiosk.py`.  
GitHub source: [`site/README.md`](site/README.md).

**Never commit API keys or hut credentials** into `site/` or the Pages repo.

## Repo layout

```
server/           Node API (Pi)
public/           Pi kiosk UI only
site/             GitHub Pages UI only (separate site)
scripts/pi/       Kiosk + one-shot setup
scripts/deploy-pi-kiosk.py   Upload public/ → Pi (not site/)
systemd/          pi-weather.service
docs/             Hardware + pi-connect guides
```
