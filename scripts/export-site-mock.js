/**
 * Regenerate demo JSON for the public GitHub Pages site (no API keys).
 * Usage: node scripts/export-site-mock.js
 */
const fs = require("fs");
const path = require("path");
const { mockCurrent, mockHistory } = require("../server/mockData");

const dir = path.join(__dirname, "..", "site", "data");
fs.mkdirSync(dir, { recursive: true });

const note =
  "Demo data — not live station readings. No API keys or credentials in this site.";

const current = mockCurrent();
current.source = "mock";
current.note = note;
fs.writeFileSync(path.join(dir, "current.json"), JSON.stringify(current, null, 2));

for (const range of ["week", "month", "year"]) {
  const history = mockHistory(range);
  history.note = note;
  fs.writeFileSync(
    path.join(dir, `history-${range}.json`),
    JSON.stringify(history, null, 2)
  );
}

console.log("Wrote mock JSON to site/data/");
