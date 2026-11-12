#!/usr/bin/env node
// Packs extension/ for the GitHub release and the Chrome Web Store. Checks first that the copies of the shared files
// are up to date. Uses the system's `zip`.
//   dist/chainintegrate-account.zip          the release asset (a stable name: releases/latest/download/…), with
//                                            one folder, chainintegrate-account/, to unzip and load in Chrome
//   dist/chainintegrate-account-<v>.zip      the same, named with the version
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
execFileSync(process.execPath, [path.join(__dirname, "sync-shared.js"), "--check"], { stdio: "inherit" });
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, "extension", "manifest.json")));
fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
const stage = fs.mkdtempSync(path.join(require("os").tmpdir(), "ext-"));
const folder = path.join(stage, "chainintegrate-account");
fs.cpSync(path.join(ROOT, "extension"), folder, { recursive: true, filter: (p) => path.basename(p) !== "README.md" });
// The license and the notices travel with the extension.
for (const f of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) fs.copyFileSync(path.join(ROOT, f), path.join(folder, f));
const out = path.join(ROOT, "dist", "chainintegrate-account.zip");
for (const f of [out, path.join(ROOT, "dist", `chainintegrate-account-${version}.zip`)]) if (fs.existsSync(f)) fs.unlinkSync(f);
execFileSync("zip", ["-r", "-X", "-q", out, "chainintegrate-account"], { cwd: stage, stdio: "inherit" });
fs.copyFileSync(out, path.join(ROOT, "dist", `chainintegrate-account-${version}.zip`));
fs.rmSync(stage, { recursive: true, force: true });
console.log(out);
