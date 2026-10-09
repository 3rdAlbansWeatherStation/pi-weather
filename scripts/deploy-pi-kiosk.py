"""
Deploy the PI KIOSK UI (public/) to the Raspberry Pi only.

This does NOT touch site/ or github.io — that is a different website.
See docs/pi-connect.md and .cursor/rules/two-sites-pi-and-github.mdc.

Password is read from gitignored docs/pi-connect.local.md.
"""
import re
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
LOCAL_DOC = ROOT / "docs" / "pi-connect.local.md"
REMOTE = "/home/wilksy/pi-weather"
# Pi kiosk only — never site/
FILES = ["public/index.html", "public/styles.css", "public/app.js"]


def load_password() -> str:
    text = LOCAL_DOC.read_text(encoding="utf-8")
    m = re.search(r"\|\s*SSH password\s*\|\s*`([^`]+)`\s*\|", text)
    if not m:
        sys.exit("Could not parse SSH password from docs/pi-connect.local.md")
    return m.group(1)


def main() -> None:
    host = "192.168.1.223"
    user = "wilksy"
    password = load_password()

    print("Deploying PI KIOSK (public/) →", host)
    print("Not deploying site/ or github.io.")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password, timeout=25)
    sftp = ssh.open_sftp()
    for f in FILES:
        sftp.put(str(ROOT.joinpath(*f.split("/"))), f"{REMOTE}/{f}")
        print("put", f)
    sftp.close()

    _, stdout, stderr = ssh.exec_command(
        "sudo systemctl restart pi-weather; "
        "sleep 1; systemctl is-active pi-weather; "
        "grep -n 'styles.css' /home/wilksy/pi-weather/public/index.html; "
        "curl -sS -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:3000/"
    )
    print(stdout.read().decode(errors="replace"))
    err = stderr.read().decode(errors="replace")
    if err.strip():
        print("stderr:", err)
    ssh.close()
    print("done (Pi kiosk only)")


if __name__ == "__main__":
    main()
