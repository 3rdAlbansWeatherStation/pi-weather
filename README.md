# 3rd Albans Weather (Pi kiosk)

Raspberry Pi weather display for an Ecowitt station. Fullscreen Chromium kiosk on a touchscreen; local Node app serves the kiosk UI on the LAN.

A separate static public site lives in `site/` and is published to GitHub Pages.

## Stack

- Node + Express (Pi API and static UI)
- Ecowitt hub for live readings; cloud history where configured
- Touch UI with confirmed shutdown / reboot on the Pi
- labwc + Chromium kiosk on Raspberry Pi OS Lite (Bookworm, 64-bit)

## Develop on Windows

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Power controls stay disabled unless `ALLOW_POWER_CONTROL=true` (Pi only).

## Config

Copy `.env.example` → `.env` (local / Pi only; not committed). See `.env.example` for variable names.

## Two frontends

| | Pi kiosk | Public site |
|--|----------|-------------|
| Folder | `public/` | `site/` |
| Runtime | Express on the Pi | Static GitHub Pages |
| Notes | Power controls | Welcome / Privacy — no Power |

Do not deploy `site/` to the Pi or `public/` to GitHub Pages.

## Repo layout

```
server/     Pi API
public/     Pi kiosk UI
site/       Public Pages UI source
scripts/    Setup and deploy helpers
docs/       Hardware and architecture notes
systemd/    pi-weather.service
```

## Hardware

Kit: Ecowitt GW3002 (GW3000 hub + WS69 outdoor array).  
Field reference: [`docs/ecowitt-gw3002-ws69-data.md`](docs/ecowitt-gw3002-ws69-data.md).

Architecture overview: [`docs/architecture.md`](docs/architecture.md).
