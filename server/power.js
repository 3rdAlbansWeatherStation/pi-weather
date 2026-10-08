const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

function canControlPower() {
  return String(process.env.ALLOW_POWER_CONTROL || "").toLowerCase() === "true";
}

async function shutdown() {
  await execFileAsync("sudo", ["systemctl", "poweroff"]);
}

async function reboot() {
  await execFileAsync("sudo", ["systemctl", "reboot"]);
}

module.exports = { canControlPower, shutdown, reboot };
