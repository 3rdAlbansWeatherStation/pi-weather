"""
Deploy the Pi kiosk (public/ + server/) to the Raspberry Pi.

Does not touch site/ or github.io.
Reads SSH details from docs/pi-connect.local.md and env from .env (both gitignored).
"""
import re
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
LOCAL_DOC = ROOT / "docs" / "pi-connect.local.md"
LOCAL_ENV = ROOT / ".env"
REMOTE = "/home/wilksy/pi-weather"
# Pi kiosk only — never site/
FILES = [
    "public/index.html",
    "public/styles.css",
    "public/app.js",
    "server/index.js",
    "server/weather.js",
    "server/cloudHistory.js",
    "server/power.js",
]

ENV_KEYS = (
    "DATA_SOURCE",
    "ECOWITT_HUB_IP",
    "ECOWITT_APPLICATION_KEY",
    "ECOWITT_API_KEY",
    "ECOWITT_DEVICE_MAC",
    "PORT",
    "HOST",
)
# Never copy PC ALLOW_POWER_CONTROL=false onto the Pi kiosk.


def load_password() -> str:
    text = LOCAL_DOC.read_text(encoding="utf-8")
    m = re.search(r"\|\s*SSH password\s*\|\s*`([^`]+)`\s*\|", text)
    if not m:
        sys.exit("Could not parse SSH password from docs/pi-connect.local.md")
    return m.group(1)


def load_local_env() -> dict[str, str]:
    if not LOCAL_ENV.exists():
        return {}
    out: dict[str, str] = {}
    for line in LOCAL_ENV.read_text(encoding="utf-8").splitlines():
        t = line.strip()
        if not t or t.startswith("#") or "=" not in t:
            continue
        k, v = t.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def main() -> None:
    host = "192.168.1.223"
    user = "wilksy"
    password = load_password()
    local_env = load_local_env()

    print("Deploying PI KIOSK (public/ + server/) ->", host)
    print("Not deploying site/ or github.io.")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password, timeout=25)
    sftp = ssh.open_sftp()
    for f in FILES:
        local = ROOT.joinpath(*f.split("/"))
        if not local.exists():
            print("skip missing", f)
            continue
        sftp.put(str(local), f"{REMOTE}/{f}")
        print("put", f)
    sftp.close()

    # Build remote .env patch script without printing secret values
    exports = []
    for key in ENV_KEYS:
        if key in local_env and local_env[key] != "":
            exports.append(f"{key}={local_env[key]}")
            print("env sync", key, "(set)" if local_env[key] else "(empty)")
    # Prefer hub live on Pi; keep power control if already intended for Pi
    if "DATA_SOURCE" not in local_env:
        exports.append("DATA_SOURCE=hub")
    exports.append("ALLOW_POWER_CONTROL=true")

    env_blob = "\n".join(exports) + "\n"
    # Write via sftp temp then merge on Pi
    sftp = ssh.open_sftp()
    with sftp.file(f"{REMOTE}/.env.deploy", "w") as remote:
        remote.write(env_blob)
    sftp.close()

    merge_cmd = f"""
set -e
cd {REMOTE}
touch .env
# drop keys we are replacing
grep -vE '^({'|'.join(ENV_KEYS)})=' .env > .env.tmp || true
mv .env.tmp .env
cat .env.deploy >> .env
rm -f .env.deploy
sudo systemctl restart pi-weather
sleep 2
systemctl is-active pi-weather
curl -sS http://127.0.0.1:3000/api/health
echo
curl -sS 'http://127.0.0.1:3000/api/history?range=week' | head -c 280
echo
"""
    _, stdout, stderr = ssh.exec_command(merge_cmd)
    print(stdout.read().decode(errors="replace"))
    err = stderr.read().decode(errors="replace")
    if err.strip():
        print("stderr:", err)
    ssh.close()
    print("done (Pi kiosk only)")


if __name__ == "__main__":
    main()
