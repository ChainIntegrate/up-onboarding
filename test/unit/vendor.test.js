"use strict";
const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// The extension carries ethers itself (an extension may not load code from a server): the same file the web
// pages load from cdnjs, checked against the integrity hash the pages use.
test("the extension's ethers is the pages' ethers", () => {
  const html = fs.readFileSync(path.join(__dirname, "../../web/operator.html"), "utf8");
  const sri = html.match(/ethers\.umd\.min\.js" integrity="(sha384-[^"]+)"/)[1];
  const file = fs.readFileSync(path.join(__dirname, "../../extension/vendor/ethers-6.13.4.umd.min.js"));
  assert.strictEqual("sha384-" + crypto.createHash("sha384").update(file).digest("base64"), sri);
});
