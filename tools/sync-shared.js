#!/usr/bin/env node
// The web pages are served from web/ only and the extension is packaged from extension/ only, so each carries
// copies of the files they share. The sources and their copies are listed here; the copies are never edited.
//   node tools/sync-shared.js           updates the copies
//   node tools/sync-shared.js --check   fails (exit code 1) when a copy differs from its source
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const shared = fs.readdirSync(path.join(ROOT, "shared")).filter((f) => f.endsWith(".js")).sort();
const COPIES = [
  ...shared.map((f) => [`shared/${f}`, `web/lib/shared/${f}`]),
  ...shared.map((f) => [`shared/${f}`, `extension/shared/${f}`]),
  ["web/lib/ui.js", "extension/lib/ui.js"],
  ["web/lib/theme.js", "extension/lib/theme.js"],
  ["web/logo.png", "extension/img/logo.png"],
];
// Folders that hold only copies: a file there with no source is removed (or reported).
const COPY_DIRS = ["web/lib/shared", "extension/shared"];

const check = process.argv.includes("--check");
let stale = 0;
const report = (msg) => { stale++; console.log(msg); };
for (const [src, dst] of COPIES) {
  const a = fs.readFileSync(path.join(ROOT, src));
  const d = path.join(ROOT, dst);
  if (fs.existsSync(d) && fs.readFileSync(d).equals(a)) continue;
  if (check) report(`${dst}: differs from ${src}`);
  else { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, a); report(`${dst}: updated`); }
}
const wanted = new Set(COPIES.map(([, d]) => d));
for (const dir of COPY_DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs)) {
    const rel = `${dir}/${f}`;
    if (wanted.has(rel)) continue;
    if (check) report(`${rel}: no source`);
    else { fs.unlinkSync(path.join(abs, f)); report(`${rel}: removed`); }
  }
}
if (check && stale) { console.log("Run: node tools/sync-shared.js"); process.exit(1); }
if (!stale) console.log("All copies are up to date.");
