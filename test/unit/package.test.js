"use strict";
// The committed SHA256SUMS of the extension's version is what tools/pack-extension.js builds now: the release, the
// site and the extension itself check against it (Cross_Chain audit EXT-06).
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { execFileSync } = require("child_process");

test("the extension package matches web/extension/<version>/SHA256SUMS", () => {
  assert.doesNotThrow(() => execFileSync(process.execPath, [path.join(__dirname, "../../tools/pack-extension.js"), "--check"], { stdio: "pipe" }));
});
