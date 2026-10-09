# Architecture — 3rd St Albans Weather

How the pieces fit together. Read this before changing or deploying anything.

**Hard rule:** the Pi kiosk and the public GitHub site are designed to *look* similar. They are **not the same code** and must not be deployed as if they were.

See also: [`.cursor/rules/two-sites-pi-and-github.mdc`](../.cursor/rules/two-sites-pi-and-github.mdc).

---

## Big picture

```text
┌─────────────────────────────────────────────────────────────┐
│  PC — this folder (PI_WEATHER)                                │
│  Source of truth while developing                             │
│                                                               │
│   public/     Pi kiosk UI                                     │
│   server/     Pi Node API                                     │
│   site/       Public website UI (source for github.io)        │
│   docs/       Architecture, Pi connect, Ecowitt notes         │
└───────────────┬─────────────────────────────┬─────────────────┘
                │                             │
                │ git push                    │ publish site/
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────────┐
│ GitHub: pi-weather        │   │ GitHub: *.github.io             │
│ Full project history      │   │ Public site only (root of URL)  │
│ (public + server + site + │   │ https://3rdalbansweatherstation │
│  docs + scripts)          │   │   .github.io/                   │
└─────────────┬─────────────┘   └─────────────────────────────────┘
              │
              │ git pull / deploy-pi-kiosk.py
              ▼
┌───────────────────────────┐
│ Raspberry Pi              │
│ Serves public/ + server/  │
│ http://192.168.1.223:3000 │
│ Later: Ecowitt hub on LAN │
└───────────────────────────┘
```

---

## The four places people confuse

| Place | What it is | Not |
|--------|------------|-----|
| **Local PC files** | Where you edit | Automatically on the Pi or live github.io |
| **Pi website** | Kiosk + LAN UI from `public/` + Express | The public internet site |
| **Repo `pi-weather`** | GitHub backup of the whole project | The live github.io host |
| **Repo `*.github.io`** | What visitors get at the public URL | The Pi app |

You need **two GitHub repos** for the public URL:

1. **`pi-weather`** — project (Pi + `site/` source + docs).
2. **`3rdAlbansWeatherStation.github.io`** — published Pages site at the **root** URL (no `/pi-weather/`). GitHub only serves that root from a repo named `{user}.github.io`.

`site/` lives **inside** `pi-weather` so one project holds both UIs’ sources. Publishing copies (or later Actions) update the `.github.io` repo.

---

## Two frontends (look alike ≠ same code)

| | **Pi kiosk** | **Public GitHub site** |
|--|--------------|-------------------------|
| Folder | `public/` | `site/` |
| Runtime | Node + Express on the Pi | Static files on GitHub Pages |
| URL | `http://192.168.1.223:3000` (LAN) | https://3rdalbansweatherstation.github.io/ |
| Data today | `GET /api/current`, `/api/history` (mock → hub later) | `./data/*.json` (mock → Ecowitt cloud Actions later) |
| Special UI | Power (shutdown / reboot) | Welcome + cookie/privacy consent, Privacy dialog, Info link |
| Secrets | Pi `.env` only | None in the site; future keys in **GitHub Actions secrets** |

### Deploy rules

- Change the **Pi** → edit **`public/`** (and `server/` if needed) → deploy with [`pi-connect.md`](pi-connect.md) / `python scripts/deploy-pi-kiosk.py`. **Never** upload `site/` as the Pi UI.
- Change the **public site** → edit **`site/`** → publish to the `*.github.io` repo. **Never** push `public/` there.
- Do **not** bulk-sync `public/` ↔ `site/`. Port a visual change only when asked, and adapt paths, Power vs Privacy, and API vs JSON.

---

## Data flow

### Now (mock)

```text
Pi:     mockData.js  →  Express /api/*  →  public/app.js
Public: site/data/*.json  →  site/app.js
```

### Later (planned)

```text
Pi:     Ecowitt hub (LAN)  →  server/weather.js  →  /api/*
        Optional: SQLite history on the Pi

Public: Ecowitt cloud API (Actions + secrets)  →  overwrite site/data/*.json
        → publish to github.io
        Keys never in site/ or the Pages repo
```

Hardware / field reference: [`ecowitt-gw3002-ws69-data.md`](ecowitt-gw3002-ws69-data.md).

---

## Secrets map

| Secret | Where it may live | Never |
|--------|-------------------|--------|
| Pi SSH password | `docs/pi-connect.local.md` (gitignored) | Git, `site/`, chat that publishes |
| Pi `.env` (hub IP, power flag, later keys) | On the Pi / local gitignored `.env` | Committed repo |
| Ecowitt cloud keys (later) | GitHub Actions secrets / Pi `.env` | `site/`, `.github.io`, README |
| Scout Hut credentials document | Local only | Anywhere in git |

---

## Why two UIs (and why that felt messy)

**Why separate**

- Public internet must not expose Power or hub credentials.
- Pi needs a live API and LAN hub; Pages is static.
- Privacy / analytics consent belongs on the public site only.

**Why it got messy in practice**

- Editing on the PC does not update the Pi until deploy.
- The two UIs look alike, so agents (and humans) mixed folders.
- Pi git fell behind while SFTP still worked → “git dirty” vs “UI fine”.
- Browser cache hid CSS updates until `?v=` cache-busting.

Process fixes: this doc, the two-sites Cursor rule, `deploy-pi-kiosk.py`, and cache-bust `?v=` on asset URLs.

---

## Optional later improvements

1. **GitHub Action** on `pi-weather`: when `site/` changes → publish to `*.github.io` (stops manual copy drift).
2. Shared **brand tokens** (colours/fonts only) if porting styles gets tedious — still not one shared app.
3. Ecowitt cloud pipeline for public JSON; hub path for Pi live data.

Do **not** merge into a single HTML app.

---

## Quick links

| Doc | Purpose |
|-----|---------|
| [`pi-connect.md`](pi-connect.md) | SSH / deploy Pi kiosk (`public/` only) |
| [`pi-connect.local.md`](pi-connect.local.md) | Local secrets (gitignored) |
| [`../site/README.md`](../site/README.md) | Public site folder |
| [`ecowitt-gw3002-ws69-data.md`](ecowitt-gw3002-ws69-data.md) | Sensors / API fields |
| [`../README.md`](../README.md) | Project overview |
