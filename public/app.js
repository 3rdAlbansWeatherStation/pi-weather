const REFRESH_MS = 30_000;
let historyRange = "week";
let currentView = "live";
let refreshTimer;
let lastHistory = null;

const $ = (id) => document.getElementById(id);

const CHARTS = [
  { id: "chart-temp", key: "tempC", color: "#7ec8e3", fill: "rgba(126,200,227,0.18)", summaryId: "sum-temp", unit: "°C" },
  { id: "chart-humidity", key: "humidity", color: "#9ad0c2", fill: "rgba(154,208,194,0.18)", summaryId: "sum-humidity", unit: "%" },
  { id: "chart-pressure", key: "pressureHpa", color: "#f0c27b", fill: "rgba(240,194,123,0.16)", summaryId: "sum-pressure", unit: "hPa" },
  { id: "chart-rain", key: "rainMm", color: "#8bb8e8", fill: "rgba(139,184,232,0.2)", summaryId: "sum-rain", unit: "mm" },
  { id: "chart-wind", key: "windMs", color: "#d4b483", fill: "rgba(212,180,131,0.16)", summaryId: "sum-wind", unit: "m/s" },
];

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function windDir(deg) {
  if (deg == null || Number.isNaN(Number(deg))) return "—";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(Number(deg) / 45) % 8];
}

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

function setView(view) {
  currentView = view;
  $("view-live").hidden = view !== "live";
  $("view-historic").hidden = view !== "historic";
  document.querySelectorAll(".view-btn").forEach((btn) => {
    const active = btn.dataset.view === view;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  if (view === "historic") {
    requestAnimationFrame(() => {
      if (lastHistory) renderHistory(lastHistory);
      else refresh();
    });
  }
}

function renderCurrent(data) {
  const deg = data.wind?.directionDeg;
  const speed = data.wind?.speedMs;

  $("temp").textContent =
    data.outdoor?.tempC == null ? "--" : Number(data.outdoor.tempC).toFixed(1);
  $("feels").textContent =
    data.outdoor?.feelsLikeC == null ? "--" : Number(data.outdoor.feelsLikeC).toFixed(1);
  $("humidity").textContent =
    data.outdoor?.humidity == null ? "--" : String(data.outdoor.humidity);
  $("rain").textContent =
    data.rain?.dailyMm == null ? "--" : Number(data.rain.dailyMm).toFixed(1);
  $("pressure").textContent =
    data.pressure?.relHpa == null ? "--" : Number(data.pressure.relHpa).toFixed(0);
  $("gust").textContent =
    data.wind?.gustMs == null ? "--" : Number(data.wind.gustMs).toFixed(1);
  $("indoor").textContent =
    data.indoor?.tempC == null
      ? "--"
      : `${Number(data.indoor.tempC).toFixed(1)}° / ${data.indoor.humidity ?? "—"}%`;
  $("uvi").textContent = data.solar?.uvi == null ? "--" : String(data.solar.uvi);

  $("wind-speed").textContent = speed == null ? "--" : Number(speed).toFixed(1);
  $("wind-label").textContent = deg == null ? "Wind" : windDir(deg);
  $("wind-needle").style.transform = `rotate(${Number(deg) || 0}deg)`;
  $("wind-blurb").textContent =
    deg == null
      ? "Which way the wind is blowing, and how fast"
      : `Wind from the ${windDir(deg)} · ${speed == null ? "—" : Number(speed).toFixed(1)} m/s`;

  $("updated").textContent = `Updated ${fmtTime(data.updatedAt)} · ${data.station || "station"} · ${data.source || "mock"}`;
}

function prepareCanvas(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssW = Math.max(canvas.clientWidth || 320, 40);
  const cssH = Math.max(canvas.clientHeight || 120, 40);
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  return { ctx, cssW, cssH };
}

function drawLineChart(canvasId, points, key, color, fill) {
  const canvas = $(canvasId);
  if (!canvas || $("view-historic").hidden) return;
  const prepared = prepareCanvas(canvas);
  if (!prepared || !points?.length) return;
  const { ctx, cssW, cssH } = prepared;

  const values = points.map((p) => Number(p[key]) || 0);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const padX = 8;
  const padY = 10;
  const span = max - min;

  ctx.strokeStyle = "rgba(232,238,245,0.1)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i += 1) {
    const y = padY + ((cssH - padY * 2) * i) / 2;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(cssW - padX, y);
    ctx.stroke();
  }

  const coords = values.map((v, i) => {
    const x = padX + (i / Math.max(values.length - 1, 1)) * (cssW - padX * 2);
    const y = padY + (1 - (v - min) / span) * (cssH - padY * 2);
    return { x, y };
  });

  ctx.beginPath();
  coords.forEach((c, i) => {
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  ctx.lineTo(coords[coords.length - 1].x, cssH - padY);
  ctx.lineTo(coords[0].x, cssH - padY);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  coords.forEach((c, i) => {
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

function windRoseBins(points) {
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const bins = labels.map(() => ({ count: 0, speedSum: 0 }));
  points.forEach((p) => {
    if (p.windDirDeg == null) return;
    const idx = Math.round(Number(p.windDirDeg) / 45) % 8;
    bins[idx].count += 1;
    bins[idx].speedSum += Number(p.windMs) || 0;
  });
  return { labels, bins };
}

function drawWindRose(points) {
  const canvas = $("wind-rose");
  if (!canvas || $("view-historic").hidden) return;
  const prepared = prepareCanvas(canvas);
  if (!prepared) return;
  const { ctx, cssW, cssH } = prepared;
  const { labels, bins } = windRoseBins(points);
  const cx = cssW / 2;
  const cy = cssH / 2;
  const radius = Math.min(cssW, cssH) * 0.38;
  const maxCount = Math.max(...bins.map((b) => b.count), 1);

  // rings
  ctx.strokeStyle = "rgba(232,238,245,0.14)";
  ctx.lineWidth = 1;
  for (let r = 1; r <= 3; r += 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, (radius * r) / 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // axes
  labels.forEach((label, i) => {
    const ang = ((i * 45 - 90) * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius);
    ctx.strokeStyle = "rgba(232,238,245,0.12)";
    ctx.stroke();
    ctx.fillStyle = i === 0 ? "#7ec8e3" : "#9fb0c3";
    ctx.font = "600 12px Figtree, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      label,
      cx + Math.cos(ang) * (radius + 16),
      cy + Math.sin(ang) * (radius + 16)
    );
  });

  // petals (speed-weighted length)
  bins.forEach((bin, i) => {
    if (!bin.count) return;
    const ang = ((i * 45 - 90) * Math.PI) / 180;
    const len = (bin.count / maxCount) * radius;
    const half = (Math.PI / 8) * 0.85;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, len, ang - half, ang + half);
    ctx.closePath();
    ctx.fillStyle = "rgba(240, 194, 123, 0.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(240, 194, 123, 0.95)";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#102032";
  ctx.fill();
  ctx.strokeStyle = "rgba(126,200,227,0.5)";
  ctx.stroke();
}

function renderHistory(data) {
  lastHistory = data;
  const s = data.summary;
  const label = data.range === "month" ? "This month" : "This week";
  $("rose-title").textContent = `Wind rose · ${label.toLowerCase()}`;
  $("rose-blurb").textContent = "Bigger petal = wind blew that way more often";

  $("h-wind-avg").textContent = `${s.wind.avg.toFixed(1)} m/s`;
  $("h-wind-high").textContent = `${s.wind.high.toFixed(1)} m/s`;

  $("sum-temp").textContent = `High ${s.temp.high.toFixed(1)}° · Low ${s.temp.low.toFixed(1)}° · Avg ${s.temp.avg.toFixed(1)}°`;
  $("sum-humidity").textContent = `High ${s.humidity.high}% · Low ${s.humidity.low}% · Avg ${s.humidity.avg}%`;
  const pressures = data.points.map((p) => p.pressureHpa);
  $("sum-pressure").textContent = `High ${Math.max(...pressures).toFixed(0)} · Low ${Math.min(...pressures).toFixed(0)} hPa`;
  $("sum-rain").textContent = `Total ${s.rainTotalMm.toFixed(1)} mm`;
  $("sum-wind").textContent = `Avg ${s.wind.avg.toFixed(1)} · Max ${s.wind.high.toFixed(1)} m/s`;

  drawWindRose(data.points);
  CHARTS.forEach((c) => drawLineChart(c.id, data.points, c.key, c.color, c.fill));
}

async function refresh() {
  try {
    const [current, history] = await Promise.all([
      getJson("/api/current"),
      getJson(`/api/history?range=${historyRange}`),
    ]);
    renderCurrent(current);
    renderHistory(history);
  } catch (err) {
    console.error(err);
    $("updated").textContent = "Unable to load weather data";
  }
}

function scheduleRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(refresh, REFRESH_MS);
}

let pendingPowerAction = null;

function resetPowerDialog() {
  pendingPowerAction = null;
  $("power-step-menu").hidden = false;
  $("power-step-confirm").hidden = true;
  $("power-hint").hidden = true;
  $("power-hint").textContent = "";
  $("btn-power-confirm").disabled = false;
}

function showPowerConfirm(action) {
  pendingPowerAction = action;
  $("power-step-menu").hidden = true;
  $("power-step-confirm").hidden = false;
  $("power-hint").hidden = true;
  if (action === "shutdown") {
    $("power-confirm-title").textContent = "Shut down the station?";
    $("power-confirm-text").textContent =
      "This turns the display off. Only leaders should do this — it protects the SD card.";
    $("btn-power-confirm").textContent = "Yes, shut down";
  } else {
    $("power-confirm-title").textContent = "Reboot the station?";
    $("power-confirm-text").textContent =
      "This restarts the display. Only do this if something looks stuck.";
    $("btn-power-confirm").textContent = "Yes, reboot";
  }
}

async function powerAction(action) {
  const hint = $("power-hint");
  hint.hidden = false;
  hint.textContent = action === "shutdown" ? "Shutting down…" : "Rebooting…";
  $("btn-power-confirm").disabled = true;
  try {
    const res = await fetch(`/api/power/${action}`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      hint.textContent = body.error || "Power action blocked.";
      $("btn-power-confirm").disabled = false;
      return;
    }
    hint.textContent =
      action === "shutdown"
        ? "Shutdown requested. Screen will go dark shortly."
        : "Reboot requested.";
  } catch {
    hint.textContent = "Could not reach power API.";
    $("btn-power-confirm").disabled = false;
  }
}

function wireUi() {
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
  });

  document.querySelectorAll(".seg").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      historyRange = btn.dataset.range;
      refresh();
    });
  });

  const dialog = $("power-dialog");
  $("btn-power").addEventListener("click", () => {
    resetPowerDialog();
    dialog.showModal();
  });
  $("btn-power-cancel").addEventListener("click", () => dialog.close());
  $("btn-power-back").addEventListener("click", () => resetPowerDialog());
  $("btn-shutdown").addEventListener("click", () => showPowerConfirm("shutdown"));
  $("btn-reboot").addEventListener("click", () => showPowerConfirm("reboot"));
  $("btn-power-confirm").addEventListener("click", () => {
    if (pendingPowerAction) powerAction(pendingPowerAction);
  });
}

wireUi();
setView("live");
refresh();
scheduleRefresh();
window.addEventListener("resize", () => {
  if (currentView === "historic" && lastHistory) renderHistory(lastHistory);
});
