# Public website (`site/`)

Static GitHub Pages copy of the Pi weather UI. Same Scouts look; **no Power controls**.

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
