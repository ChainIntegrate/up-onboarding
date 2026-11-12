"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { ethers } = require("ethers");
const R = require("../../shared/relay.js");

const signer = ethers.Wallet.createRandom().address, other = ethers.Wallet.createRandom().address;
const name = (a, n) => R.UP.encodeFunctionData("setData", [R.nameKey(a), ethers.hexlify(ethers.toUtf8Bytes(n))]);
const profile = (url) => R.UP.encodeFunctionData("setData", [R.LSP3_KEY, ethers.concat(["0x00006f357c6a0020", ethers.keccak256("0x12"), ethers.toUtf8Bytes(url)])]);
const CID = "ipfs://bafkreigdyrztktx5b5m2y4sogf2hf5uq3k5knv5c5k2pvx7aq5ekhtest01";

test("allowed: the profile, the signer's own name, both together", () => {
  assert.deepStrictEqual(R.check(name(signer, "Portatile"), { signer }), { ok: true, items: [{ op: "deviceName", name: "Portatile" }] });
  assert.strictEqual(R.check(profile(CID), { signer }).ok, true);
  const batch = R.UP.encodeFunctionData("setDataBatch", [[R.LSP3_KEY, R.nameKey(signer)], [ethers.concat(["0x00006f357c6a0020", ethers.keccak256("0x12"), ethers.toUtf8Bytes(CID)]), ethers.hexlify(ethers.toUtf8Bytes("PC"))]]);
  assert.strictEqual(R.check(batch, { signer }).items.length, 2);
});

test("refused", () => {
  assert.strictEqual(R.check(name(other, "x"), { signer }).error, "not_allowed");
  assert.strictEqual(R.check(name(signer, ""), { signer }).error, "name_value");
  assert.strictEqual(R.check(name(signer, " spazi "), { signer }).error, "name_value");
  assert.strictEqual(R.check(profile("https://example.com/x.json"), { signer }).error, "profile_value");
  assert.strictEqual(R.check(R.UP.encodeFunctionData("execute", [0, other, 1, "0x"]), { signer }).error, "not_in_catalog");
  assert.strictEqual(R.check("0x12345678", { signer }).error, "payload");
});

test("validity packs two uint128", () => {
  const v = R.validity(10, 20);
  assert.deepStrictEqual(R.splitValidity(v), { start: 10n, end: 20n });
  assert.throws(() => R.validity(-1, 2));
});
