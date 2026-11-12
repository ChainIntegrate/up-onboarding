"use strict";
// On the server ethers is installed in tools/creator only (npm ci there), not at the repository's root: the
// service must start that way. A copy of shared/ and tools/creator in a folder with no node_modules above it,
// ethers only in tools/creator/node_modules.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

test("the service starts with ethers in tools/creator only", () => {
  const root = path.join(__dirname, "..", "..");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "creator-layout-"));
  fs.cpSync(path.join(root, "shared"), path.join(dir, "shared"), { recursive: true });
  fs.mkdirSync(path.join(dir, "tools", "creator", "node_modules"), { recursive: true });
  fs.copyFileSync(path.join(root, "tools", "creator", "creator.js"), path.join(dir, "tools", "creator", "creator.js"));
  // ethers' own folder: the one holding the file require("ethers") loads.
  const main = require.resolve("ethers", { paths: [root] });
  const ethersDir = main.slice(0, main.lastIndexOf(path.sep + "node_modules" + path.sep + "ethers" + path.sep)) + path.sep + "node_modules" + path.sep + "ethers";
  fs.symlinkSync(fs.realpathSync(ethersDir), path.join(dir, "tools", "creator", "node_modules", "ethers"), "dir");
  const { ethers } = require("ethers");
  fs.writeFileSync(path.join(dir, "k"), ethers.Wallet.createRandom().privateKey);
  fs.writeFileSync(path.join(dir, "c.json"), JSON.stringify({ network: "lukso-testnet", rpc: "http://127.0.0.1:1", chainId: 4201, gasKeyFile: "k", ipfsApi: "http://127.0.0.1:2", dataDir: "d" }));
  const env = { ...process.env, CREATOR_CONFIG: path.join(dir, "c.json") };
  delete env.NODE_PATH;
  const out = execFileSync(process.execPath, [path.join(dir, "tools", "creator", "creator.js"), "invite"], { env, cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.match(out.trim(), /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
});
