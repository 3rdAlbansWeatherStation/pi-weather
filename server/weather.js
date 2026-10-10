const { fetchCloudHistory } = require("./cloudHistory");

function source() {
  return (process.env.DATA_SOURCE || "hub").toLowerCase();
}

async function getCurrent() {
  switch (source()) {
    case "hub":
      return fetchFromHub();
    case "cloud":
      throw new Error("Ecowitt cloud live source not wired yet — use hub for Pi");
    case "mock":
      throw new Error(
        "Mock data disabled — set DATA_SOURCE=hub (or cloud when wired)"
      );
    default:
      throw new Error(`Unknown DATA_SOURCE: ${source()}`);
  }
}

async function getHistory(range) {
  // Pi: live = hub; history = Ecowitt cloud (15 min cache). SD / SQLite later.
  switch (source()) {
    case "hub":
    case "cloud":
      return fetchCloudHistory(range);
    case "mock":
      throw new Error(
        "Mock data disabled — set DATA_SOURCE=hub (or cloud when wired)"
      );
    default:
      throw new Error(`Unknown DATA_SOURCE: ${source()}`);
  }
}

function firstNumber(text) {
  if (text == null) return null;
  const m = String(text).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function byId(list, id) {
  if (!Array.isArray(list)) return null;
  const key = String(id).toLowerCase();
  return list.find((row) => String(row.id).toLowerCase() === key) || null;
}

function valOf(list, id) {
  return byId(list, id)?.val ?? null;
}

/** Normalize temperature to °C. */
function toTempC(raw, unitHint) {
  const n = firstNumber(raw);
  if (n == null) return null;
  const u = String(unitHint || raw || "").toLowerCase();
  if (u.includes("f")) return Number((((n - 32) * 5) / 9).toFixed(1));
  return Number(n.toFixed(1));
}

/** Normalize wind to m/s. */
function toMs(raw) {
  const n = firstNumber(raw);
  if (n == null) return null;
  const u = String(raw).toLowerCase();
  if (u.includes("mph") || u.includes("mi/h")) return Number((n * 0.44704).toFixed(1));
  if (u.includes("km") || u.includes("kph")) return Number((n / 3.6).toFixed(1));
  if (u.includes("knot")) return Number((n * 0.514444).toFixed(1));
  return Number(n.toFixed(1));
}

/** Normalize rain to mm. */
function toMm(raw) {
  const n = firstNumber(raw);
  if (n == null) return null;
  const u = String(raw).toLowerCase();
  if (u.includes("in")) return Number((n * 25.4).toFixed(1));
  return Number(n.toFixed(1));
}

/** Normalize pressure to hPa. */
function toHpa(raw) {
  const n = firstNumber(raw);
  if (n == null) return null;
  const u = String(raw).toLowerCase();
  if (u.includes("in")) return Number((n * 33.8639).toFixed(1));
  if (u.includes("mm")) return Number((n * 1.33322).toFixed(1));
  return Number(n.toFixed(1));
}

/** Solar radiation → klux approx (full sun ~1000 W/m² ≈ 100 klux). */
function toKlux(raw) {
  const n = firstNumber(raw);
  if (n == null) return null;
  const u = String(raw).toLowerCase();
  if (u.includes("klux")) return Math.round(n);
  if (u.includes("lux") && !u.includes("w")) return Math.round(n / 1000);
  // W/m² (default from GW3000 when metric light unit is irradiance)
  return Math.round(n * 0.1);
}

function toWm2(raw) {
  const n = firstNumber(raw);
  if (n == null) return null;
  const u = String(raw).toLowerCase();
  if (u.includes("w")) return Number(n.toFixed(2));
  if (u.includes("klux")) return Number((n * 10).toFixed(2));
  if (u.includes("lux")) return Number(((n / 1000) * 10).toFixed(2));
  return Number(n.toFixed(2));
}

function humidityPct(raw) {
  const n = firstNumber(raw);
  return n == null ? null : Math.round(n);
}

/** Simple OK / Bad for kiosk — enough for leaders to spot a problem. */
function mapBattery(code) {
  if (code == null || code === "") return null;
  const n = Number(code);
  // Ecowitt capacitor codes: 0–1 typically OK on WS69 rain channel
  if (!Number.isNaN(n)) return n <= 1 ? "OK" : "Bad";
  const s = String(code).toLowerCase();
  if (s.includes("low") || s.includes("fail")) return "Bad";
  return "OK";
}

// TODO(sky): Replace this crude heuristic with a better Sky label
// (pressure trend, rain rate, solar/UVI, maybe short forecast) — not hub “condition”.
function conditionFrom(outdoor, rainRate) {
  if (outdoor?.tempC == null) return "—";
  if (rainRate != null && rainRate > 0.2) return "Rain";
  if (outdoor.tempC < 8) return "Cool";
  if (outdoor.humidity != null && outdoor.humidity > 85) return "Damp";
  return "Fair";
}

function normalizeHub(raw) {
  const common = raw.common_list || [];
  const rain = raw.rain || [];
  const wh25 = Array.isArray(raw.wh25) ? raw.wh25[0] : raw.wh25;

  const tempRow = byId(common, "0x02");
  // id "3" = feels like; 0x03 = dew point
  const dewRow = byId(common, "0x03");
  const feelsLikeRow = byId(common, "3");

  const outdoor = {
    tempC: toTempC(tempRow?.val, tempRow?.unit),
    humidity: humidityPct(valOf(common, "0x07")),
    feelsLikeC: toTempC(feelsLikeRow?.val, feelsLikeRow?.unit),
    dewPointC: toTempC(dewRow?.val, dewRow?.unit),
  };

  const wind = {
    speedMs: toMs(valOf(common, "0x0B")),
    gustMs: toMs(valOf(common, "0x0C")),
    directionDeg: firstNumber(valOf(common, "0x0A")),
    dayMaxMs: toMs(valOf(common, "0x19")),
  };

  const rainOut = {
    rateMm: toMm(valOf(rain, "0x0E")) ?? 0,
    eventMm: toMm(valOf(rain, "0x0D")) ?? 0,
    // Hub often omits hour rain (0x0F) when dry — treat missing as 0
    hourMm: toMm(valOf(rain, "0x0F")) ?? 0,
    dailyMm: toMm(valOf(rain, "0x10")) ?? 0,
    weekMm: toMm(valOf(rain, "0x11")) ?? 0,
    monthMm: toMm(valOf(rain, "0x12")) ?? 0,
    yearMm: toMm(valOf(rain, "0x13")) ?? 0,
    totalMm: toMm(valOf(rain, "0x14")),
  };

  const indoor = {
    tempC: wh25 ? toTempC(wh25.intemp, wh25.unit) : null,
    humidity: wh25 ? humidityPct(wh25.inhumi) : null,
  };

  const pressure = {
    absHpa: wh25 ? toHpa(wh25.abs) : null,
    relHpa: wh25 ? toHpa(wh25.rel) : null,
  };

  const lightRaw = valOf(common, "0x15");
  const solar = {
    uvi: firstNumber(valOf(common, "0x17")),
    lightKlux: toKlux(lightRaw),
    wm2: toWm2(lightRaw),
  };

  const rainBatt = byId(rain, "0x13")?.battery;
  const batt = mapBattery(rainBatt);
  const linked = outdoor.tempC != null;
  const sensor = {
    status: !linked || batt === "Bad" ? "Bad" : "OK",
  };

  return {
    source: "hub",
    station: "3rd Albans Weather",
    updatedAt: new Date().toISOString(),
    outdoor,
    indoor,
    wind,
    rain: rainOut,
    pressure,
    solar,
    sensor,
    condition: conditionFrom(outdoor, rainOut.rateMm),
  };
}

async function fetchFromHub() {
  const ip = process.env.ECOWITT_HUB_IP;
  if (!ip) {
    throw new Error("ECOWITT_HUB_IP is not set");
  }

  const url = `http://${ip}/get_livedata_info?`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    throw new Error(`Hub responded ${res.status}`);
  }

  const raw = await res.json();
  return normalizeHub(raw);
}

module.exports = { getCurrent, getHistory, normalizeHub };
