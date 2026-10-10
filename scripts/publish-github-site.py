"""
Publish site/ to 3rdAlbansWeatherStation.github.io (Pages root).
Does not touch the Pi. Never copies secrets from .env.
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
REPO = "https://github.com/3rdAlbansWeatherStation/3rdAlbansWeatherStation.github.io.git"


def run(cmd, cwd=None):
    print("+", " ".join(cmd))
    subprocess.check_call(cmd, cwd=cwd)


def main() -> None:
    if not SITE.is_dir():
        sys.exit("site/ missing")

    with tempfile.TemporaryDirectory(prefix="gio-") as tmp:
        dest = Path(tmp) / "github.io"
        run(["git", "clone", "--depth", "1", REPO, str(dest)])

        # Remove tracked content except .git
        for child in dest.iterdir():
            if child.name == ".git":
                continue
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()

        # Copy site/ → repo root. Workflows need `workflow` OAuth scope to push;
        # always copy scripts; workflows optional via INCLUDE_WORKFLOWS=1.
        include_workflows = True  # try; if push fails, re-run without workflows
        for child in SITE.iterdir():
            if child.name == ".github":
                gh_dest = dest / ".github"
                gh_dest.mkdir(exist_ok=True)
                scripts = child / "scripts"
                if scripts.exists():
                    shutil.copytree(scripts, gh_dest / "scripts")
                workflows = child / "workflows"
                if include_workflows and workflows.exists():
                    shutil.copytree(workflows, gh_dest / "workflows")
                continue
            target = dest / child.name
            if child.is_dir():
                shutil.copytree(child, target)
            else:
                shutil.copy2(child, target)

        run(["git", "add", "-A"], cwd=dest)
        status = subprocess.check_output(
            ["git", "status", "--porcelain"], cwd=dest, text=True
        )
        if not status.strip():
            print("No changes to publish")
            return

        run(
            [
                "git",
                "commit",
                "-m",
                "Publish public site with Ecowitt cloud data Action",
            ],
            cwd=dest,
        )
        run(["git", "push", "origin", "HEAD"], cwd=dest)
        print("Published to", REPO)


if __name__ == "__main__":
    main()
