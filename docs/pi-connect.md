# Connecting to the Pi weather station

Guide for agents and humans deploying or diagnosing **pi-weather** on the hut Raspberry Pi.

**Scope:** this guide is for the **Pi kiosk** (`public/` + Node server) only.  
The **GitHub public site** lives in `site/` / `*.github.io` and is deployed separately — never mix the two.

**Credentials** (password, etc.) live in the gitignored file:

→ [`docs/pi-connect.local.md`](pi-connect.local.md)

Never commit that file. Never put the password in git, chat that gets logged publicly, or GitHub.

---

## Quick facts

| Item | Value |
|------|--------|
| Hostname | `PiWeatherStation` |
| LAN IP | `192.168.1.223` |
| SSH user | `wilksy` |
| App path on Pi | `/home/wilksy/pi-weather` |
| Website | http://192.168.1.223:3000/ |
| systemd unit | `pi-weather` |
| Node entry | `/home/wilksy/pi-weather/server/index.js` |
| Listens on | `0.0.0.0:3000` |

Ping may fail on the LAN even when HTTP/SSH work. Prefer TCP checks on ports **22** and **3000**.

---

## Before you deploy

1. Read `docs/pi-connect.local.md` for the SSH password.
2. On Windows, **do not** use a huge multiline `python -c "..."` string in PowerShell — it often breaks. Write a temp `.py` file, then run `python thatfile.py`.
3. Cursor Auto-review may **block** SSH that embeds a plaintext password. If blocked, retry with the approval card (`request_smart_mode_approval`) using the exact block reason, or ask the user to approve.
4. Editing files only on the PC **does not** update the Pi. You must **SFTP upload + restart** `pi-weather` (or `python scripts/deploy-pi-kiosk.py`).
5. Deploy **`public/`** (and `server/` if needed) only — **never** upload `site/` to the Pi.
6. After deploy, tell the user to **hard-refresh** (`Ctrl+F5`) or reload the kiosk — Chromium can keep old JS/CSS.

---

## Check the site is up (from the PC)

PowerShell:

```powershell
try {
  $r = Invoke-WebRequest -Uri "http://192.168.1.223:3000/" -UseBasicParsing -TimeoutSec 8
  "HTTP=$($r.StatusCode)"
} catch { "FAIL: $($_.Exception.Message)" }

Test-NetConnection -ComputerName 192.168.1.223 -Port 3000
Test-NetConnection -ComputerName 192.168.1.223 -Port 22
```

---

## SSH + status (paramiko)

Write a script (example), load password from `docs/pi-connect.local.md` or hardcode only in that local-only workflow:

```python
import paramiko

host = "192.168.1.223"
user = "wilksy"
password = "<from pi-connect.local.md>"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username=user, password=password, timeout=25)

cmds = [
    "systemctl is-active pi-weather",
    "systemctl status pi-weather --no-pager -l | head -30",
    "journalctl -u pi-weather -n 30 --no-pager",
    "curl -sS -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:3000/",
    "hostname -I; date",
]
for c in cmds:
    print("====", c)
    _, stdout, stderr = ssh.exec_command(c)
    print(stdout.read().decode(errors="replace"))
    err = stderr.read().decode(errors="replace")
    if err.strip():
        print("ERR", err)

ssh.close()
```

Useful on-Pi commands:

```bash
sudo systemctl status pi-weather
sudo systemctl restart pi-weather
sudo journalctl -u pi-weather -n 50 --no-pager
ls -la ~/pi-weather/public/
```

---

## Deploy UI / server files from this PC

Repo root on PC: `c:\Users\wilksy\Desktop\PI_WEATHER`  
Remote root: `/home/wilksy/pi-weather`

**Quick path:** `python scripts/deploy-pi-kiosk.py` (uploads `public/` only).

Pi kiosk files only:

- `public/index.html`
- `public/styles.css`
- `public/app.js`

Also deploy server files when changed, e.g. `server/mockData.js`, `server/index.js`.  
Do **not** deploy anything from `site/`.

```python
import paramiko
from pathlib import Path

host = "192.168.1.223"
user = "wilksy"
password = "<from pi-connect.local.md>"
local = Path(r"c:\Users\wilksy\Desktop\PI_WEATHER")
remote = "/home/wilksy/pi-weather"
files = [
    "public/index.html",
    "public/styles.css",
    "public/app.js",
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username=user, password=password, timeout=25)
sftp = ssh.open_sftp()
for f in files:
    sftp.put(str(local.joinpath(*f.split("/"))), f"{remote}/{f}")
    print("put", f)
sftp.close()

_, stdout, _ = ssh.exec_command("sudo systemctl restart pi-weather")
stdout.channel.recv_exit_status()

# Give Node a moment, then check
_, stdout, _ = ssh.exec_command(
    "sleep 1; systemctl is-active pi-weather; "
    "curl -sS -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:3000/"
)
print(stdout.read().decode())
ssh.close()
```

After restart, `curl` may briefly return `000` — wait 1–2 seconds and retry.

---

## Verify deploy actually landed

Compare sizes/times:

**On PC**

```powershell
Get-Item c:\Users\wilksy\Desktop\PI_WEATHER\public\* |
  Select-Object Name, Length, LastWriteTime
```

**On Pi** (via SSH)

```bash
ls -la /home/wilksy/pi-weather/public/
```

If PC `LastWriteTime` is newer than the Pi file times, deploy did **not** succeed.

---

## Common failures

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Other agent “updated” but UI unchanged | Deploy blocked / never ran | Re-run SFTP + restart; hard-refresh |
| SSH timeout | Wrong Wi‑Fi / Pi asleep / IP changed | `Test-NetConnection` port 22; check IP on Pi |
| HTTP fails, SSH works | `pi-weather` down | `sudo systemctl restart pi-weather` |
| Auto-review blocks paramiko | Password in command | Approve the card, or use key auth later |
| PowerShell `python -c` errors | Quoting | Use a `.py` file instead |
| Ping fails | Normal on some LANs | Ignore ping; use ports 22/3000 |

---

## What not to commit

- `docs/pi-connect.local.md`
- `.env` with real secrets
- `*Scout Hut Weather Station*` credentials document
- Any Wi‑Fi / Ecowitt / API passwords

Safe to commit: this file (`docs/pi-connect.md`), `.env.example` (names only).
