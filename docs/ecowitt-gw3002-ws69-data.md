# Ecowitt GW3002 + WS69 — data we can display

Reference for the **3rd Albans** weather station kit and both UIs:

| Surface | Role |
|---------|------|
| **Pi kiosk** (`pi-weather` on the LAN) | Always-on hut display — current conditions first, short history |
| **Public GitHub site** (`site/`) | Shareable Pages UI — mock JSON for now; Ecowitt cloud later (keys in Actions secrets only) |

**Hardware note:** “GW3002” is Ecowitt’s **bundle**: **GW3000** Ethernet/Wi‑Fi gateway (with SD slot) + **WS69** 7‑in‑1 outdoor array. Your guess is correct: the **gateway** provides **indoor temp/humidity** (external probe) and **barometric pressure** (internal).

Sources used: [GW3002 product page](https://shop.ecowitt.com/products/gw3002), [GW3000 manual](https://oss.ecowitt.net/uploads/20241204/GW3000Manual.pdf), [WS69 manual](https://oss.ecowitt.net/uploads/20260224/WS69Manual.pdf), Ecowitt [HTTP API protocol](https://oss.ecowitt.net/uploads/20260114/HTTP%20API%20interface%20Protocol%20(Generic)-(V1.0.6-2026-1-14)%20.pdf), cloud API `api.ecowitt.net` v3.

---

## 1. What this kit measures (stock, no add-ons)

### A. GW3000 gateway (indoor + pressure)

| Measurement | Typical unit | Range (gateway) | Notes |
|-------------|--------------|-----------------|--------|
| Indoor temperature | °C | −9.9 … 60 °C | External ~0.85 m probe |
| Indoor humidity | % RH | 1 … 99 % | |
| Absolute pressure | hPa | 300 … 1100 | Sensor inside gateway |
| Relative (sea-level) pressure | hPa | same | Calibrated / station altitude |

Gateway live update interval is about **1 minute** for its own readings. Outdoor array reports faster (~**16 s**).

### B. WS69 outdoor 7‑in‑1 array

| Measurement | Typical unit | Range | Notes |
|-------------|--------------|-------|--------|
| Outdoor temperature | °C | −40 … 60 | |
| Outdoor humidity | % RH | 1 … 99 | |
| Wind speed | m/s | 0 … 50 | Average; 0.1 m/s resolution |
| Wind gust | m/s | — | Max over last ~16 s |
| Wind direction | ° | 0 … 359 | |
| Rainfall (tipping bucket) | mm | 0 … 9999 | Totals + rate (see below) |
| Light / solar | lux or W/m² | 0 … 200 kLux | API may show lux or irradiance |
| UV index (UVI) | index | 0/1 … 15 | |
| UV intensity | µW/m² | — | Raw UV; usually show **UVI** on UI |

Power: built-in solar + **2× AA** backup. RF open-field range ~100 m.

### C. Calculated / derived (gateway or cloud — not a separate sensor)

These appear in live JSON / Ecowitt app even though WS69 does not “measure” them directly:

| Value | Unit | Basis |
|-------|------|--------|
| Dew point | °C | Outdoor T + RH |
| Wind chill | °C | Outdoor T + wind |
| Heat index | °C | Outdoor T + RH |
| Feels like | °C | Combines chill / heat / etc. |
| Day max wind | m/s | Daily peak |
| VPD (vapour pressure deficit) | kPa | Newer firmware / API — agriculture-oriented; optional on UI |

---

## 2. Rainfall breakdown (important for UI)

Traditional rain from the WS69 (not piezo — piezo is WS85/WS90 only):

| Period / type | Meaning | Good for |
|---------------|---------|----------|
| Rain rate | mm/h now | “Is it raining hard?” |
| Rain event | mm this event | Current shower total |
| Rain hour | mm last hour | Short-term |
| Rain day | mm today | Hut daily total |
| Rain week | mm this week | Week panel |
| Rain month | mm this month | Month panel |
| Rain year | mm this year | Annual |
| Rain totals | mm since reset / lifetime | Optional |

---

## 3. Status / health (worth showing small)

| Item | Source | Why |
|------|--------|-----|
| Outdoor array battery / signal | Live API `battery` on some fields | Kids/leaders can see “sensor dying” |
| Last update time | Hub / our poll timestamp | Stale-data warning |
| Data source | `hub` / `cloud` / `mock` | Already on Pi UI |
| SD card present (GW3000) | Hub WebUI / `get_sdmmc_info` | History backup health |

---

## 4. Local hub API (primary for the Pi)

**Endpoint:** `http://<GW3000-IP>/get_livedata_info?`

### Outdoor + derived — `common_list` / `rain` IDs

| ID | Field |
|----|--------|
| `0x02` | Outdoor temperature |
| `0x07` | Outdoor humidity |
| `0x03` | Dew point |
| `0x04` | Wind chill |
| `0x05` | Heat index |
| `3` | Feels like (often appears as decimal id `"3"`) |
| `0x0A` | Wind direction |
| `0x0B` | Wind speed |
| `0x0C` | Gust speed |
| `0x19` | Day max wind |
| `0x15` | Light / solar |
| `0x16` | UV (µW/m²) |
| `0x17` | UVI |
| `0x18` | Device date/time |
| `0x0D` | Rain event |
| `0x0E` | Rain rate |
| `0x0F` | Rain hour (“rain gain”) |
| `0x10` | Rain day |
| `0x11` | Rain week |
| `0x12` | Rain month |
| `0x13` | Rain year |
| `0x14` | Rain totals |

### Indoor + pressure — `wh25`

| JSON key | Field |
|----------|--------|
| `intemp` | Indoor temperature |
| `inhumi` | Indoor humidity |
| `abs` | Absolute pressure |
| `rel` | Relative pressure |

Also useful: `get_rain_totals?`, `get_sensors_info?`, `get_device_info?`, SD listing via `get_sdmmc_info` and CSV download on port **81**.

Units in JSON may be **°C/°F**, **m/s or mph**, **mm or in**, **hPa or inHg** depending on hub settings — **normalize to metric in our API** for the hut.

---

## 5. History — week / month / highs / lows / averages

The live hub endpoint is **current + rain totals**, not a full multi-week series. For charts we use one or more of:

| Method | Pros | Cons |
|--------|------|------|
| **A. Poll hub every 1–5 min → SQLite on Pi** | Local, works offline, full control | Need writable storage (plan before OverlayFS) |
| **B. GW3000 microSD CSV** | Minute-level on-device archive | Card not in box; parse CSV headers carefully |
| **C. Ecowitt.net cloud API** `/v3/device/history` | Easy week/month | Needs internet + API keys; coarse retention (fine 5‑min only ~1 day, then coarser) |

**Recommended for 3rd Albans:** **A as primary** (Pi owns history), optional **C** as backup / public site, **B** if you add an SD card later.

### Metrics to store each sample (for highs / lows / averages)

| Metric | Derive for week/month |
|--------|------------------------|
| Outdoor temp | high / low / avg |
| Outdoor humidity | high / low / avg |
| Indoor temp | high / low / avg |
| Indoor humidity | high / low / avg |
| Relative pressure | high / low / avg / trend |
| Wind speed | avg / max; gust max |
| Wind direction | optional rose later |
| Rain | rate samples + period totals (day/week/month from hub or sum of deltas) |
| UVI | daily max |
| Solar / light | daily max / avg daytime |

---

## 6. Cloud API (optional — public site / backup)

- Real-time: `https://api.ecowitt.net/api/v3/device/real_time`
- History: `https://api.ecowitt.net/api/v3/device/history`
- Auth: `application_key`, `api_key`, device `mac` (from Ecowitt app / User Center)
- History `call_back` must list channels explicitly (e.g. `outdoor,indoor,pressure,wind,solar_and_uvi,rainfall`) — `all` is rejected on history

**Do not commit API keys.** Store only in Pi `.env` (gitignored).

---

## 7. Display plan by surface

### Pi kiosk (1024×600) — priority

**Always visible**
- Outdoor temp (hero), condition / feels like
- Outdoor humidity, wind + direction, rain today, relative pressure
- Indoor temp/humidity (strip)
- Gust, UVI, last updated, source
- **Windy radar block** (compact panel, St Albans coords — not fullscreen)

**History panel**
- Week / month: outdoor temp high · low · avg
- Rain week / month totals
- Simple temp sparkline (already started)

**Power / admin**
- Custom confirm dialog only (no PIN)

### Public GitHub website (future)

Same live fields as Pi, plus:

- Multi-chart history (temp, humidity, pressure, rain, wind)
- Week / month / year rain
- **Same Windy embed** as a page block (can use larger ~650×450 there)
- Wind rose (optional)
- Station “about” (Scout hut, no secrets)
- Mobile-friendly layout (not locked to 1024×600)

Windy embed (St Albans):

```html
<iframe width="450" height="450" src="https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=°C&metricWind=mph&zoom=5&overlay=wind&product=ecmwf&level=surface&lat=51.762&lon=-0.345&pressure=true&message=true" frameborder="0"></iframe>
```

Share **read-only** data; never expose shutdown APIs publicly without auth.

---

## 8. Not in this kit (ignore unless you buy later)

Lightning, soil, PM2.5/CO₂, leak, leaf wetness, extra T/H channels, piezo rain, laser distance, IoT plugs — all supported by GW3000 **hardware**, but **not** included with GW3002+WS69.

---

## 9. Implementation checklist (when hardware arrives)

1. Put GW3000 on same Wi‑Fi/LAN as Pi; note IP (DHCP reservation recommended).
2. Confirm WS69 paired (RF LED / Live Data in hub WebUI).
3. Prefer **metric** units on the hub.
4. Set `DATA_SOURCE=hub` and `ECOWITT_HUB_IP=…` in Pi `.env` (not in git).
5. Map `get_livedata_info` → our normalized `/api/current`.
6. Start SQLite sampler for `/api/history` highs/lows/averages.
7. Optional: Ecowitt.net keys for public site / cloud backup.
8. Optional: microSD in GW3000 for Ecowitt’s own CSV archive.

---

## 10. Normalized JSON shape (target for our Node API)

Align Pi + future public site on one schema (mock already close):

```json
{
  "source": "hub",
  "station": "3rd Albans Weather",
  "updatedAt": "ISO-8601",
  "outdoor": {
    "tempC": 0,
    "humidity": 0,
    "feelsLikeC": 0,
    "dewPointC": 0,
    "windChillC": null,
    "heatIndexC": null
  },
  "indoor": { "tempC": 0, "humidity": 0 },
  "wind": {
    "speedMs": 0,
    "gustMs": 0,
    "directionDeg": 0,
    "dayMaxMs": null
  },
  "rain": {
    "rateMm": 0,
    "eventMm": 0,
    "hourMm": 0,
    "dailyMm": 0,
    "weekMm": 0,
    "monthMm": 0,
    "yearMm": 0,
    "totalMm": null
  },
  "pressure": { "absHpa": 0, "relHpa": 0 },
  "solar": { "uvi": 0, "lightLux": null, "wm2": null },
  "status": { "outdoorBattery": null, "stale": false }
}
```

History endpoint should expose period `summary` (high/low/avg/rain total) plus optional `points[]` for charts.
