# Architecture — 3rd St Albans Weather

The Pi kiosk and the public GitHub site look similar but are **separate apps**. Do not deploy one as the other.

## Big picture

```text
PC (this repo)
  public/ + server/  →  Raspberry Pi (LAN kiosk)
  site/              →  GitHub Pages (public URL)
```

| Place | Role |
|--------|------|
| Local PC | Edit source |
| Pi | Kiosk + LAN UI (`public/` + Express) |
| `pi-weather` repo | Full project source |
| `*.github.io` repo | Published public site only |

## Two frontends

| | Pi kiosk | Public site |
|--|----------|-------------|
| Folder | `public/` | `site/` |
| Runtime | Node + Express | Static files on Pages |
| Data | `/api/current`, `/api/history` | `./data/*.json` |
| Special UI | Power | Welcome / Privacy / Info |

### Deploy

- Pi: edit `public/` / `server/` → `python scripts/deploy-pi-kiosk.py` (or git pull on the Pi).
- Public site: edit `site/` → `python scripts/publish-github-site.py`.
- Do not bulk-sync `public/` ↔ `site/`.

## Data flow

```text
Pi:     Ecowitt hub (LAN) → server → /api/* → public/app.js
        Cloud history for charts when configured

Public: Scheduled fetch → data/*.json → site/app.js
```

Hardware / fields: [`ecowitt-gw3002-ws69-data.md`](ecowitt-gw3002-ws69-data.md).

## Related

- [`pi-connect.md`](pi-connect.md) — Pi connectivity notes
