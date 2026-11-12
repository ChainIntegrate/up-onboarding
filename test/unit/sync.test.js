"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("child_process");
const path = require("path");

test("web/lib/shared is a copy of shared/", () => {
  assert.doesNotThrow(() => execFileSync(process.execPath, [path.join(__dirname, "../../tools/sync-shared.js"), "--check"], { stdio: "pipe" }));
});
