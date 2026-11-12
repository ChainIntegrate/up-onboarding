#!/usr/bin/env node
// Packs extension/ into dist/chainintegrate-account-<version>.zip, for the Chrome Web Store or for loading by
// hand. Checks first that the copies of the shared files are up to date. Uses the system's `zip`.
"use strict";
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
execFileSync(process.execPath, [path.join(__dirname, "sync-shared.js"), "--check"], { stdio: "inherit" });
const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, "extension", "manifest.json")));
fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
const out = path.join(ROOT, "dist", `chainintegrate-account-${version}.zip`);
if (fs.existsSync(out)) fs.unlinkSync(out);
execFileSync("zip", ["-r", "-X", "-q", out, ".", "-x", "README.md"], { cwd: path.join(ROOT, "extension"), stdio: "inherit" });
// The license and the notices travel with the extension.
execFileSync("zip", ["-j", "-X", "-q", out, "LICENSE", "THIRD_PARTY_NOTICES.md"], { cwd: ROOT, stdio: "inherit" });
console.log(out);
