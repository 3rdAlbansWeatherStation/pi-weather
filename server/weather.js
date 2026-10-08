const { mockCurrent, mockHistory } = require("./mockData");

function source() {
  return (process.env.DATA_SOURCE || "mock").toLowerCase();
}

async function getCurrent() {
  switch (source()) {
    case "hub":
      return fetchFromHub();
    case "cloud":
      throw new Error("Ecowitt cloud source not wired yet");
    case "mock":
    default:
      return mockCurrent();
  }
}

async function getHistory(range) {
  switch (source()) {
    case "hub":
      // Hub live endpoint has no long history — return mock until SQLite logging exists
      return mockHistory(range);
    case "cloud":
      throw new Error("Ecowitt cloud history not wired yet");
    case "mock":
    default:
      return mockHistory(range);
  }
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
  return {
    source: "hub",
    updatedAt: new Date().toISOString(),
    raw,
    // Normalized fields filled in once we see real hub payloads
    outdoor: {
      tempC: null,
      humidity: null,
      feelsLikeC: null,
    },
    indoor: {
      tempC: null,
      humidity: null,
    },
    wind: {
      speedMs: null,
      gustMs: null,
      directionDeg: null,
    },
    rain: {
      rateMm: null,
      dailyMm: null,
    },
    pressure: {
      relHpa: null,
    },
    placeholder: true,
    note: "Hub JSON received; field mapping will be finalized with your station.",
  };
}

module.exports = { getCurrent, getHistory };
