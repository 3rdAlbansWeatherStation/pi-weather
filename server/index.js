const path = require("path");
const express = require("express");
const { getCurrent, getHistory } = require("./weather");
const { canControlPower, shutdown, reboot } = require("./power");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    source: process.env.DATA_SOURCE || "mock",
    powerControl: canControlPower(),
  });
});

app.get("/api/current", async (_req, res) => {
  try {
    const data = await getCurrent();
    res.json(data);
  } catch (err) {
    console.error("current failed:", err);
    res.status(502).json({ error: "Failed to load current weather" });
  }
});

app.get("/api/history", async (req, res) => {
  try {
    const range = String(req.query.range || "week");
    const data = await getHistory(range);
    res.json(data);
  } catch (err) {
    console.error("history failed:", err);
    res.status(502).json({ error: "Failed to load history" });
  }
});

app.post("/api/power/shutdown", async (_req, res) => {
  if (!canControlPower()) {
    return res.status(403).json({
      error: "Power control disabled. Set ALLOW_POWER_CONTROL=true on the Pi.",
    });
  }
  res.json({ ok: true, action: "shutdown" });
  setTimeout(() => {
    shutdown().catch((err) => console.error("shutdown failed:", err));
  }, 400);
});

app.post("/api/power/reboot", async (_req, res) => {
  if (!canControlPower()) {
    return res.status(403).json({
      error: "Power control disabled. Set ALLOW_POWER_CONTROL=true on the Pi.",
    });
  }
  res.json({ ok: true, action: "reboot" });
  setTimeout(() => {
    reboot().catch((err) => console.error("reboot failed:", err));
  }, 400);
});

app.listen(PORT, HOST, () => {
  console.log(`pi-weather listening on http://${HOST}:${PORT}`);
});
