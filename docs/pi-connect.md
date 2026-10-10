# Connecting to the Pi weather station

Notes for deploying or diagnosing the **Pi kiosk** (`public/` + Node server).  
The public GitHub site (`site/`) is separate — do not deploy it to the Pi.

Local connection details (not in git): `docs/pi-connect.local.md`.

## Quick facts

| Item | Value |
|------|--------|
| Hostname | `PiWeatherStation` |
| Typical LAN URL | `http://PiWeatherStation.local:3000/` |
| App path on Pi | `/home/wilksy/pi-weather` |
| systemd unit | `pi-weather` |

## Deploy from this PC

```bash
python scripts/deploy-pi-kiosk.py
```

Uploads `public/` and `server/` only, then restarts `pi-weather`. Hard-refresh the kiosk browser after deploy.

## On the Pi

```bash
cd ~/pi-weather
git pull
npm install --omit=dev
sudo systemctl restart pi-weather
sudo systemctl status pi-weather --no-pager
```

## Checks

- From the LAN: open the kiosk URL above, or use the Pi’s current IP on port `3000`.
- On the Pi: `curl -sS http://127.0.0.1:3000/api/health`
