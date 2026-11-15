"use strict";
// The extension's integrity check needs each of its code files in the published list (audit U-14 / A19): the list
// it requires is the package's code files, no more, no less.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
test("integrity: the files the extension requires in the published list are exactly its code files", () => {
  const EXT = path.join(__dirname, "..", "..", "extension");
  const walk = (d, b = "") => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name), b + e.name + "/") : [b + e.name]));
  const code = walk(EXT).filter((f) => /\.(js|html|json)$/.test(f)).sort();
  const src = fs.readFileSync(path.join(EXT, "lib", "integrity.js"), "utf8");
  const listed = JSON.parse(src.match(/const FILES = (\[[\s\S]*?\]);/)[1].replace(/"/g, '"')).sort();
  assert.deepStrictEqual(listed, code);
});
