function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function seededNoise(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function mockCurrent() {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const base = 11 + 6 * Math.sin(((hour - 7) / 24) * Math.PI * 2);
  const tempC = Number(base.toFixed(1));
  const humidity = Math.round(62 + 10 * Math.sin(hour / 3));

  return {
    source: "mock",
    station: "3rd Albans Weather",
    updatedAt: now.toISOString(),
    outdoor: {
      tempC,
      humidity,
      feelsLikeC: Number((tempC - (100 - humidity) * 0.02).toFixed(1)),
      dewPointC: Number((tempC - ((100 - humidity) / 5)).toFixed(1)),
    },
    indoor: {
      tempC: Number((19.5 + seededNoise(hour) * 1.2).toFixed(1)),
      humidity: Math.round(48 + seededNoise(hour + 2) * 8),
    },
    wind: {
      speedMs: Number((1.2 + seededNoise(hour + 4) * 3.5).toFixed(1)),
      gustMs: Number((2.5 + seededNoise(hour + 5) * 5).toFixed(1)),
      directionDeg: Math.round(seededNoise(hour + 6) * 360),
      dayMaxMs: Number((3.5 + seededNoise(now.getDate() + 11) * 6).toFixed(1)),
    },
    rain: {
      rateMm: Number((seededNoise(hour + 7) > 0.82 ? seededNoise(hour + 8) * 2.4 : 0).toFixed(1)),
      dailyMm: Number((seededNoise(now.getDate()) * 4.2).toFixed(1)),
      hourMm: Number((seededNoise(hour + 12) > 0.7 ? seededNoise(hour + 13) * 1.6 : 0).toFixed(1)),
      weekMm: Number((seededNoise(now.getDate() + 3) * 18 + 2).toFixed(1)),
    },
    pressure: {
      relHpa: Number((1012 + (seededNoise(hour + 9) - 0.5) * 12).toFixed(1)),
    },
    solar: {
      uvi: Number((clamp(Math.sin(((hour - 6) / 12) * Math.PI) * 6, 0, 8)).toFixed(1)),
      lightKlux: Number((clamp(Math.sin(((hour - 6) / 12) * Math.PI) * 80, 0, 95)).toFixed(0)),
    },
    sensor: {
      battery: seededNoise(now.getDate() + 20) > 0.15 ? "Good" : "Low",
      signal: seededNoise(hour + 21) > 0.2 ? "Strong" : "Weak",
    },
    condition: tempC < 8 ? "Cool" : humidity > 75 ? "Damp" : "Fair",
  };
}

function buildSeries(days, pointsPerDay = 24) {
  const points = [];
  const now = Date.now();
  const stepMs = (24 * 60 * 60 * 1000) / pointsPerDay;
  const total = days * pointsPerDay;

  for (let i = total - 1; i >= 0; i -= 1) {
    const t = new Date(now - i * stepMs);
    const hour = t.getHours();
    const n = seededNoise(i + days * 17);
    const tempC = Number((9 + 7 * Math.sin(((hour - 6) / 24) * Math.PI * 2) + (n - 0.5) * 3).toFixed(1));
    // Bias mock wind toward SW/W for a readable rose (typical UK weather feel)
    const dirNoise = seededNoise(i + days * 31);
    const windDirDeg = Math.round((220 + (dirNoise - 0.5) * 140 + seededNoise(i * 3) * 40) % 360);
    points.push({
      t: t.toISOString(),
      tempC,
      humidity: Math.round(55 + n * 25),
      pressureHpa: Number((1010 + (n - 0.5) * 14).toFixed(1)),
      rainMm: Number((n > 0.78 ? n * 1.8 : 0).toFixed(1)),
      windMs: Number((0.8 + n * 4.5).toFixed(1)),
      windDirDeg,
    });
  }
  return points;
}

function summarize(points) {
  const temps = points.map((p) => p.tempC);
  const hum = points.map((p) => p.humidity);
  const rain = points.reduce((sum, p) => sum + p.rainMm, 0);
  const wind = points.map((p) => p.windMs);

  return {
    temp: {
      high: Math.max(...temps),
      low: Math.min(...temps),
      avg: Number((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)),
    },
    humidity: {
      high: Math.max(...hum),
      low: Math.min(...hum),
      avg: Math.round(hum.reduce((a, b) => a + b, 0) / hum.length),
    },
    rainTotalMm: Number(rain.toFixed(1)),
    wind: {
      high: Math.max(...wind),
      avg: Number((wind.reduce((a, b) => a + b, 0) / wind.length).toFixed(1)),
    },
  };
}

function mockHistory(range) {
  const key = String(range || "week").toLowerCase();
  const days = key === "year" ? 365 : key === "month" ? 30 : 7;
  const pointsPerDay = key === "year" ? 1 : key === "month" ? 8 : 24;
  const points = buildSeries(days, pointsPerDay);
  return {
    source: "mock",
    range: key === "year" ? "year" : key === "month" ? "month" : "week",
    updatedAt: new Date().toISOString(),
    summary: summarize(points),
    points,
  };
}

module.exports = { mockCurrent, mockHistory };
