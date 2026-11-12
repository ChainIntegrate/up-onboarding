#!/usr/bin/env node
// Checks an installed copy of the extension from outside it (Cross_Chain audit EXT-06): every file of the
// folder against the SHA-256 that ChainIntegrate's site publishes for its version. Run it on the client's computer
// (or on a copy of the folder) with Node.js:
//   node verify-extension.js <folder>                       the list from https://account.chainintegrate.it/extension/<v>/SHA256SUMS
//   node verify-extension.js <folder> --sums SHA256SUMS     a list at hand (e.g. from the GitHub release)
// Exit code 0 when every file matches and none is missing; 1 otherwise, with the files that differ.
"use strict";
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

(async () => {
  const [folder, ...rest] = process.argv.slice(2);
  if (!folder) { console.error("usage: verify-extension.js <folder> [--sums file]"); process.exit(2); }
  const { version } = JSON.parse(fs.readFileSync(path.join(folder, "manifest.json"), "utf8"));
  const i = rest.indexOf("--sums");
  const url = `https://account.chainintegrate.it/extension/${version}/SHA256SUMS`;
  const text = i >= 0 ? fs.readFileSync(rest[i + 1], "utf8") : await (await fetch(url)).text();
  const listed = new Map();
  for (const line of text.split("\n")) {
    const m = line.match(/^([0-9a-f]{64}) {2}chainintegrate-account\/(.+)$/);
    if (m) listed.set(m[2], m[1]);
  }
  if (!listed.size) { console.error(`no file list for version ${version} (${i >= 0 ? rest[i + 1] : url})`); process.exit(1); }
  const walk = (d, b = "") => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name), b + e.name + "/") : [b + e.name]));
  const present = walk(folder).filter((f) => f !== "README.md");
  const problems = [];
  for (const [rel, want] of listed) {
    const p = path.join(folder, rel);
    if (!fs.existsSync(p)) { problems.push(`missing   ${rel}`); continue; }
    if (crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex") !== want) problems.push(`MODIFIED  ${rel}`);
  }
  for (const rel of present) if (!listed.has(rel)) problems.push(`EXTRA     ${rel}`);
  console.log(`ChainIntegrate Account ${version}: ${listed.size} files listed, ${present.length} in the folder`);
  if (problems.length) { console.log(problems.join("\n")); console.log("NOT the published version: remove it and install it again from account.chainintegrate.it"); process.exit(1); }
  console.log("OK: every file is the published one");
})().catch((e) => { console.error(e.message); process.exit(1); });
