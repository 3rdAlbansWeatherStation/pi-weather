/**
 * Ecowitt cloud history for Pi History tab.
 * Live current stays on the hub; this is charts only (~15 min cache).
 *
 * TODO(max-min): richer daily max/min summaries later — for now chart
 * side labels use simple high/low from the returned series.
 * TODO(sd): hub microSD CSV as offline backup / later option.
 */

const HISTORY_CACHE_MS = 15 * 60 * 1000;
const CALL_BACK = "outdoor,indoor,pressure,wind,solar_and_uvi,rainfall";

const cache = new Map();

function cloudCredentials() {
  const applicationKey = process.env.ECOWITT_APPLICATION_KEY;
  const apiKey = process.env.ECOWITT_API_KEY;
  const mac = process.env.ECOWITT_DEVICE_MAC;
  if (!applicationKey || !apiKey || !mac) {
    throw new Error("Ecowitt cloud keys not set (APPLICATION_KEY, API_KEY, DEVICE_MAC)");
  }
  return { applicationKey, apiKey, mac };
}

/** Ecowitt history dates must be in the device timezone (Europe/London). */
function formatEcowittDate(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const g = (type) => parts.find((p) => p.type === type)?.value;
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}:${g("second")}`;
}

function normalizeRange(range) {
  const key = String(range || "week").toLowerCase();
  if (key === "year") return "year";
  if (key === "month") return "month";
  return "week";
}

function rangeWindow(normalized) {
  const end = new Date();
  const days = normalized === "year" ? 365 : normalized === "month" ? 30 : 7;
  const start = new Date(end.getTime() - days * 24 * 3600 * 1000);
  const cycleType =
    normalized === "year" ? "4hour" : normalized === "month" ? "30min" : "5min";
  return { start, end, cycleType };
}

function listMap(leaf) {
  if (!leaf) return {};
  if (leaf.list && typeof leaf.list === "object") return leaf.list;
  if (typeof leaf === "object" && !Array.isArray(leaf)) return leaf;
  return {};
}

function num(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function emptyPayload(normalized, extra = {}) {
  return {
    source: "cloud",
    range: normalized,
    updatedAt: new Date().toISOString(),
    summary: {
      temp: { high: null, low: null, avg: null },
      humidity: { high: null, low: null, avg: null },
      rainTotalMm: null,
      wind: { high: null, avg: null },
    },
    points: [],
    ...extra,
  };
}

function summarize(points) {
  if (!points.length) {
    return emptyPayload("week").summary;
  }
  const temps = points.map((p) => p.tempC).filter((n) => n != null);
  const hum = points.map((p) => p.humidity).filter((n) => n != null);
  const wind = points.map((p) => p.windMs).filter((n) => n != null);
  const rain = points.map((p) => p.rainMm).filter((n) => n != null);
  const avg = (arr) =>
    arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;
  return {
    // Basic series stats for chart labels — TODO(max-min): proper daily extremes later
    temp: {
      high: temps.length ? Math.max(...temps) : null,
      low: temps.length ? Math.min(...temps) : null,
      avg: avg(temps),
    },
    humidity: {
      high: hum.length ? Math.max(...hum) : null,
      low: hum.length ? Math.min(...hum) : null,
      avg: hum.length ? Math.round(avg(hum)) : null,
    },
    rainTotalMm: rain.length ? Number(Math.max(...rain).toFixed(1)) : null,
    wind: {
      high: wind.length ? Math.max(...wind) : null,
      avg: avg(wind),
    },
  };
}

function downsample(points, maxPoints = 180) {
  if (points.length <= maxPoints) return points;
  const out = [];
  const step = points.length / maxPoints;
  for (let i = 0; i < maxPoints; i += 1) {
    out.push(points[Math.min(points.length - 1, Math.floor(i * step))]);
  }
  return out;
}

function normalizeCloudHistory(data, normalized) {
  const outdoor = data.outdoor || {};
  const wind = data.wind || {};
  const pressure = data.pressure || {};
  const rainfall = data.rainfall || {};

  const tempList = listMap(outdoor.temperature);
  const humList = listMap(outdoor.humidity);
  const windList = listMap(wind.wind_speed);
  const dirList = listMap(wind.wind_direction);
  const pressList = listMap(pressure.relative);
  const rainList = listMap(rainfall.rain_rate);

  // Use outdoor temperature timestamps as the master timeline so a newer
  // wind/pressure-only sample cannot create a fake humidity/temp of 0 on charts.
  const stamps = Object.keys(tempList).length
    ? Object.keys(tempList)
    : Object.keys(humList);

  const points = stamps
    .map((ts) => Number(ts))
    .filter((ts) => Number.isFinite(ts))
    .sort((a, b) => a - b)
    .map((ts) => {
      const key = String(ts);
      return {
        t: new Date(ts * 1000).toISOString(),
        tempC: num(tempList[key]),
        humidity: num(humList[key]),
        pressureHpa: num(pressList[key]),
        rainMm: num(rainList[key]),
        windMs: num(windList[key]),
        windDirDeg: num(dirList[key]),
      };
    })
    .filter((p) => p.tempC != null || p.humidity != null);

  const sampled = downsample(points);
  return {
    source: "cloud",
    range: normalized,
    updatedAt: new Date().toISOString(),
    summary: summarize(sampled),
    points: sampled,
    note: points.length
      ? undefined
      : "Cloud history is empty for this range (station may be newly online).",
  };
}

async function requestHistoryBody(start, end, cycleType) {
  const { applicationKey, apiKey, mac } = cloudCredentials();
  const params = new URLSearchParams({
    application_key: applicationKey,
    api_key: apiKey,
    mac,
    start_date: formatEcowittDate(start),
    end_date: formatEcowittDate(end),
    cycle_type: cycleType,
    call_back: CALL_BACK,
    temp_unitid: "1",
    pressure_unitid: "3",
    wind_speed_unitid: "6",
    rainfall_unitid: "12",
    solar_irradiance_unitid: "16",
  });

  const url = `https://api.ecowitt.net/api/v3/device/history?${params}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!res.ok) {
    const err = new Error(`Cloud history HTTP ${res.status}`);
    err.offline = true;
    throw err;
  }
  const body = await res.json();
  if (body.code !== 0) {
    const err = new Error(body.msg || `Ecowitt code ${body.code}`);
    err.offline = true;
    throw err;
  }
  return body.data || {};
}

async function fetchCloudHistoryUncached(normalized) {
  const { start, end, cycleType } = rangeWindow(normalized);

  try {
    let data = await requestHistoryBody(start, end, cycleType);
    let payload = normalizeCloudHistory(data, normalized);

    // Ecowitt often returns a single aggregate when a long 5‑min window is mostly
    // empty (new station). Retry last 24h at 5‑min so temp/humidity charts work.
    if (payload.points.length < 5) {
      const endRecent = new Date();
      const startRecent = new Date(endRecent.getTime() - 24 * 3600 * 1000);
      data = await requestHistoryBody(startRecent, endRecent, "5min");
      payload = normalizeCloudHistory(data, normalized);
      if (payload.points.length) {
        payload.note =
          "Showing available cloud history (archive still filling — full week/month later).";
      }
    }

    return payload;
  } catch (err) {
    return emptyPayload(normalized, {
      offline: true,
      error: "No Internet - Check the system",
      cause: err.message,
    });
  }
}

async function fetchCloudHistory(range) {
  const normalized = normalizeRange(range);
  const hit = cache.get(normalized);
  if (hit && Date.now() - hit.at < HISTORY_CACHE_MS) {
    return { ...hit.data, cached: true };
  }

  const data = await fetchCloudHistoryUncached(normalized);
  if (!data.offline) {
    cache.set(normalized, { at: Date.now(), data });
  }
  return data;
}

module.exports = {
  fetchCloudHistory,
  HISTORY_CACHE_MS,
};
