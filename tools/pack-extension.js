#!/usr/bin/env node
// Packs extension/ for the GitHub release (and the Chrome Web Store), reproducibly: the same sources always give
// the same zip, byte for byte, so anyone can rebuild a release from its tag and compare (Cross_Chain audit EXT-06).
//
//   node tools/pack-extension.js           builds dist/ and writes web/extension/<version>/SHA256SUMS
//   node tools/pack-extension.js --check   builds dist/ and fails if it differs from the committed SHA256SUMS
//
//   dist/chainintegrate-account.zip        the release asset (a stable name: releases/latest/download/…), with one
//                                          folder, chainintegrate-account/, to unzip and load in Chrome
//   dist/chainintegrate-account-<v>.zip    the same, named with the version
//   dist/SHA256SUMS                        SHA-256 of the zip and of every file in it (sha256sum format)
// web/extension/<version>/SHA256SUMS is the same file, committed and served by account.chainintegrate.it: a second
// channel, independent of GitHub, against which the release, an installed copy (tools/verify-extension.js) and the
// extension itself check the files. Once a version is released its SHA256SUMS never changes: a change to the
// extension needs a new version.
//
// Reproducible: files in sorted order, one fixed date (2026-01-01 00:00 UTC), fixed permissions, no extra
// attributes, `zip` with TZ=UTC. Checks first that the copies of the shared files are up to date.
"use strict";
const { execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const NAME = "chainintegrate-account";
const FIXED = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
const check = process.argv.includes("--check");

execFileSync(process.execPath, [path.join(__dirname, "sync-shared.js"), "--check"], { stdio: "inherit" });
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, "extension", "manifest.json")));

// The files of the package: extension/ without its README, plus the license and the notices.
function listFiles(dir, base = "") {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listFiles(path.join(dir, e.name), rel));
    else if (e.isFile() && rel !== "README.md") out.push(rel);
  }
  return out;
}
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "ext-"));
const folder = path.join(stage, NAME);
const files = listFiles(path.join(ROOT, "extension")).map((rel) => [path.join(ROOT, "extension", rel), rel]);
files.push([path.join(ROOT, "LICENSE"), "LICENSE"], [path.join(ROOT, "THIRD_PARTY_NOTICES.md"), "THIRD_PARTY_NOTICES.md"]);
files.sort((a, b) => (a[1] < b[1] ? -1 : 1));
for (const [src, rel] of files) {
  const dst = path.join(folder, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  // Line endings as committed: the files are copied byte for byte.
  fs.copyFileSync(src, dst);
  fs.chmodSync(dst, 0o644);
}
const dirs = [...new Set(files.map(([, rel]) => path.posix.dirname(rel)).filter((d) => d !== ".").flatMap((d) => d.split("/").map((_, i, a) => a.slice(0, i + 1).join("/"))))].sort();
for (const d of [...dirs.map((d) => path.join(folder, d)), folder]) fs.chmodSync(d, 0o755);
for (const p of [...files.map(([, rel]) => path.join(folder, rel)), ...dirs.map((d) => path.join(folder, d)), folder]) fs.utimesSync(p, FIXED, FIXED);

fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
const zipPath = path.join(ROOT, "dist", `${NAME}.zip`);
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
const entries = [NAME + "/", ...dirs.map((d) => `${NAME}/${d}/`), ...files.map(([, rel]) => `${NAME}/${rel}`)].sort();
execFileSync("zip", ["-X", "-q", "-D", zipPath, "-@"], { cwd: stage, input: entries.filter((e) => !e.endsWith("/")).join("\n"), env: { ...process.env, TZ: "UTC" }, stdio: ["pipe", "inherit", "inherit"] });
fs.rmSync(stage, { recursive: true, force: true });
fs.copyFileSync(zipPath, path.join(ROOT, "dist", `${NAME}-${version}.zip`));

const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const lines = [`${sha(fs.readFileSync(zipPath))}  ${NAME}.zip`, ...files.map(([src, rel]) => `${sha(fs.readFileSync(src))}  ${NAME}/${rel}`)];
const sums = lines.join("\n") + "\n";
fs.writeFileSync(path.join(ROOT, "dist", "SHA256SUMS"), sums);

const committed = path.join(ROOT, "web", "extension", version, "SHA256SUMS");
if (check) {
  if (!fs.existsSync(committed)) { console.error(`web/extension/${version}/SHA256SUMS is missing: run node tools/pack-extension.js and commit it`); process.exit(1); }
  if (fs.readFileSync(committed, "utf8") !== sums) { console.error(`the package differs from web/extension/${version}/SHA256SUMS: a released version never changes (new version), an unreleased one needs node tools/pack-extension.js`); process.exit(1); }
  console.log(`dist/ matches web/extension/${version}/SHA256SUMS`);
} else {
  fs.mkdirSync(path.dirname(committed), { recursive: true });
  fs.writeFileSync(committed, sums);
  console.log(`${zipPath}\nweb/extension/${version}/SHA256SUMS written`);
}
console.log(lines[0]);
