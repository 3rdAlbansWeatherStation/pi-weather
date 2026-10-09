# Public website (`site/`) — GitHub Pages only

**Different site from the Pi kiosk.** The Pi uses `public/` + Express; this folder is only for
[https://3rdalbansweatherstation.github.io/](https://3rdalbansweatherstation.github.io/).

Same Scouts look when we choose to match it; **no Power controls**. Never deploy this folder to the Pi.

## Data (safe by design)

- Loads only `./data/*.json` (weather readings for display).
- **Never** put Ecowitt API keys, hub passwords, Wi‑Fi keys, or the Scout Hut credentials document in this folder.
- Until cloud is wired, files are **mock / demo** (`source: "mock"`). Regenerate with:

```bash
node scripts/export-site-mock.js
```

Later: a GitHub Action can overwrite `data/*.json` using **repository secrets** (keys stay in GitHub Secrets, not in the repo).

## Preview locally

From the repo root (any static server):

```bash
npx --yes serve site
```

Open the URL it prints (usually `http://localhost:3000`).

## Live URL (root, no `/pi-weather/`)

GitHub only serves `https://3rdalbansweatherstation.github.io/` from a repo named
**`3rdAlbansWeatherStation.github.io`** (user/org site). The Pi app stays in `pi-weather`;
this `site/` folder is the source copy, published to that Pages repo at the **root**.

No secrets are required for the mock site. Never put API keys in either repo.

## Cache busting

GitHub Pages caches CSS/JS aggressively. After style or script changes, bump the
`?v=` query on the links in `index.html` (e.g. `styles.css?v=5`) so browsers
fetch the new files instead of an old cached copy.
