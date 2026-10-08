#!/usr/bin/env bash
# Started by labwc autostart — full-screen Chromium to local weather UI.
set -euo pipefail

URL="${KIOSK_URL:-http://127.0.0.1:3000}"

# Wait until the Node app answers
for _ in $(seq 1 60); do
  if curl -fsS "$URL/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Hide cursor if available
if command -v unclutter-xfixes >/dev/null 2>&1; then
  unclutter-xfixes --timeout 0 --hide-on-touch &
elif command -v unclutter >/dev/null 2>&1; then
  unclutter -idle 0.1 -root &
fi

exec chromium-browser \
  --kiosk \
  --app="$URL" \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --disable-session-crashed-bubble \
  --disable-translate \
  --disable-features=TranslateUI \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  --touch-events=enabled \
  --enable-features=OverlayScrollbar
