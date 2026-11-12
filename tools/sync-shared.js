#!/usr/bin/env node
// The web pages are served from web/ only, so they load copies of shared/ in web/lib/shared/.
//   node tools/sync-shared.js           copies shared/*.js to web/lib/shared/
//   node tools/sync-shared.js --check   fails (exit code 1) when a copy differs from its source
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "shared");
const DST = path.join(ROOT, "web", "lib", "shared");
const check = process.argv.includes("--check");
const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".js")).sort();
let stale = 0;
fs.mkdirSync(DST, { recursive: true });
for (const f of files) {
  const src = fs.readFileSync(path.join(SRC, f));
  const dst = path.join(DST, f);
  if (fs.existsSync(dst) && fs.readFileSync(dst).equals(src)) continue;
  stale++;
  if (check) console.log(`web/lib/shared/${f}: differs from shared/${f}`);
  else { fs.writeFileSync(dst, src); console.log(`web/lib/shared/${f}: updated`); }
}
for (const f of fs.readdirSync(DST)) if (!files.includes(f)) { stale++; if (check) console.log(`web/lib/shared/${f}: no source`); else { fs.unlinkSync(path.join(DST, f)); console.log(`web/lib/shared/${f}: removed`); } }
if (check && stale) { console.log("Run: node tools/sync-shared.js"); process.exit(1); }
if (!stale) console.log("web/lib/shared is up to date.");
