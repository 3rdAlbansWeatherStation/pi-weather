const REFRESH_MS = 30_000;
let historyRange = "week";
let refreshTimer;

const $ = (id) => document.getElementById(id);

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
  if (deg == null || Number.isNaN(deg)) return "";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

async function getJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

function renderCurrent(data) {
  $("condition").textContent = data.condition || "Current";
  $("temp").textContent =
    data.outdoor?.tempC == null ? "--" : Number(data.outdoor.tempC).toFixed(1);
  $("feels").textContent =
    data.outdoor?.feelsLikeC == null
      ? "Feels like —"
      : `Feels like ${Number(data.outdoor.feelsLikeC).toFixed(1)}°`;
  $("humidity").textContent =
    data.outdoor?.humidity == null ? "—" : `${data.outdoor.humidity}%`;
  $("wind").textContent =
    data.wind?.speedMs == null
      ? "—"
      : `${Number(data.wind.speedMs).toFixed(1)} m/s ${windDir(data.wind.directionDeg)}`;
  $("rain").textContent =
    data.rain?.dailyMm == null ? "—" : `${Number(data.rain.dailyMm).toFixed(1)} mm`;
  $("pressure").textContent =
    data.pressure?.relHpa == null ? "—" : `${Number(data.pressure.relHpa).toFixed(0)} hPa`;
  $("indoor").textContent =
    data.indoor?.tempC == null
      ? "—"
      : `${Number(data.indoor.tempC).toFixed(1)}° / ${data.indoor.humidity ?? "—"}%`;
  $("gust").textContent =
    data.wind?.gustMs == null ? "—" : `${Number(data.wind.gustMs).toFixed(1)} m/s`;
  $("uvi").textContent = data.solar?.uvi == null ? "—" : String(data.solar.uvi);
  $("source").textContent = data.source || "—";
  $("updated").textContent = `Updated ${fmtTime(data.updatedAt)} · ${data.station || "station"}`;
}

function renderHistory(data) {
  const s = data.summary;
  $("h-high").textContent = `${s.temp.high.toFixed(1)}°`;
  $("h-low").textContent = `${s.temp.low.toFixed(1)}°`;
  $("h-avg").textContent = `${s.temp.avg.toFixed(1)}°`;
  $("h-rain").textContent = `${s.rainTotalMm.toFixed(1)} mm`;
  drawChart(data.points);
}

function drawChart(points) {
  const canvas = $("chart");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 480;
  const cssH = canvas.clientHeight || 150;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  if (!points?.length) return;

  const temps = points.map((p) => p.tempC);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const pad = 12;
  const span = Math.max(max - min, 1);

  ctx.strokeStyle = "rgba(232,238,245,0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i += 1) {
    const y = pad + ((cssH - pad * 2) * i) / 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(cssW, y);
    ctx.stroke();
  }

  const grad = ctx.createLinearGradient(0, 0, cssW, 0);
  grad.addColorStop(0, "#7ec8e3");
  grad.addColorStop(1, "#f0c27b");
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.beginPath();

  points.forEach((p, i) => {
    const x = (i / (points.length - 1)) * cssW;
    const y = pad + (1 - (p.tempC - min) / span) * (cssH - pad * 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
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
  $("btn-refresh").addEventListener("click", () => {
    refresh();
    scheduleRefresh();
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
refresh();
scheduleRefresh();
window.addEventListener("resize", () => refresh());
