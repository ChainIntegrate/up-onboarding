"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { ethers } = require("ethers");
const R = require("../../shared/relay.js");
const C = require("../../shared/catalog.js");

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
  assert.strictEqual(R.check(R.UP.encodeFunctionData("execute", [0, other, 1, "0x"]), { signer }).error, "payload");
  assert.strictEqual(R.check(R.UP.encodeFunctionData("execute", [0, other, 0, "0x12345678"]), { signer, chainId: 42 }).error, "not_in_catalog");
  assert.strictEqual(R.check("0x12345678", { signer }).error, "payload");
});

test("validity packs two uint128", () => {
  const v = R.validity(10, 20);
  assert.deepStrictEqual(R.splitValidity(v), { start: 10n, end: 20n });
  assert.throws(() => R.validity(-1, 2));
});

test("devices: an authorization and a removal are recognized, nothing else in the same batch", () => {
  const a = ethers.Wallet.createRandom().address, admin = ethers.Wallet.createRandom().address, urd = "0x7870C5B8BC9572A8001C3f96f7ff59961B23500D";
  const add = R.addDevice({ length: 2, address: a, role: "access", name: "Computer ufficio", chainId: 42 });
  assert.deepStrictEqual(R.check(add, { signer: admin, chainId: 42 }), { ok: true, items: [{ op: "addDevice", address: a, role: "access", name: "Computer ufficio", length: 2 }] });
  const d = R.UP.decodeFunctionData("setDataBatch", add);
  assert.strictEqual(BigInt(d[1][2]), R.ACCESS_PERMS);
  assert.strictEqual(d[1][3], ethers.concat(["0x0020", R.nameKey(a)]).toLowerCase(), "an access key may write only its own name");
  assert.strictEqual(d[0][4], R.allowedCallsKey(a)); assert.strictEqual(d[1][4], C.allowedCalls(42), "an access key may call only the catalog's functions");
  assert.throws(() => R.addDevice({ length: 2, address: a, role: "access", name: "PC" }), /chainId/, "an access needs the network's catalog");
  assert.strictEqual(R.check(add, { signer: admin, chainId: 4201 }).error, "device_change", "allowed calls of another network");
  assert.strictEqual(R.check(R.addDevice({ length: 2, address: a, role: "admin", name: "PC" }), { signer: admin, chainId: 42 }).items[0].role, "admin");
  assert.throws(() => R.addDevice({ length: 2, address: a, role: "owner", name: "PC" }));
  // anything more, other permissions (SUPER_CALL, as 0.5.x), other allowed calls, no name
  assert.strictEqual(R.check(R.UP.encodeFunctionData("setDataBatch", [[...d[0], R.LSP3_KEY], [...d[1], "0x12"]]), { signer: admin, chainId: 42 }).error, "device_change");
  assert.strictEqual(R.check(R.UP.encodeFunctionData("setDataBatch", [d[0], [d[1][0], d[1][1], ethers.zeroPadValue("0x7f3f07", 32), ...d[1].slice(3)]]), { signer: admin, chainId: 42 }).error, "device_change");
  assert.strictEqual(R.check(R.UP.encodeFunctionData("setDataBatch", [d[0], [d[1][0], d[1][1], ethers.zeroPadValue(ethers.toBeHex(R.OLD_ACCESS_PERMS), 32), ...d[1].slice(3)]]), { signer: admin, chainId: 42 }).error, "device_change");
  const anyCall = ethers.concat(["0x0020", "0x00000003", "0xffffffffffffffffffffffffffffffffffffffff", "0xffffffff", "0xa9059cbb"]);
  assert.strictEqual(R.check(R.UP.encodeFunctionData("setDataBatch", [d[0], [...d[1].slice(0, 4), anyCall, d[1][5]]]), { signer: admin, chainId: 42 }).error, "device_change");
  assert.strictEqual(R.check(R.UP.encodeFunctionData("setDataBatch", [d[0].slice(0, 4), d[1].slice(0, 4)]), { signer: admin, chainId: 42 }).error, "device_change");
  // removal: the last one takes the place of the one removed; its allowed calls cleared too
  const rm = R.removeDevice({ list: [urd, admin, a, ethers.Wallet.createRandom().address], address: a });
  assert.deepStrictEqual(R.check(rm, { signer: admin }), { ok: true, items: [{ op: "removeDevice", address: a, length: 4 }] });
  const rd = R.UP.decodeFunctionData("setDataBatch", rm);
  assert.strictEqual(rd[0][0], R.indexKey(2)); assert.strictEqual(rd[0].length, 7); assert.ok(rd[0].includes(R.allowedCallsKey(a)));
  assert.strictEqual(R.UP.decodeFunctionData("setDataBatch", R.removeDevice({ list: [urd, admin, a], address: a }))[0].length, 6, "the last one: no move");
  assert.strictEqual(R.UP.decodeFunctionData("setDataBatch", R.removeDevice({ list: [urd, admin, a], address: a, legacy: true }))[0].length, 5, "as 0.5.x built it");
  assert.strictEqual(R.check(R.removeDevice({ list: [urd, admin, a], address: admin }), { signer: admin }).error, "own_key");
});

test("devices: an access brought up to date (permissions and allowed calls), nothing else", () => {
  const a = ethers.Wallet.createRandom().address, admin = ethers.Wallet.createRandom().address;
  const up = R.updateDevice({ address: a, chainId: 42 });
  assert.deepStrictEqual(R.check(up, { signer: admin, chainId: 42 }), { ok: true, items: [{ op: "updateDevice", address: a }] });
  const d = R.UP.decodeFunctionData("setDataBatch", up);
  assert.deepStrictEqual([...d[0]], [R.permKey(a), R.allowedCallsKey(a)]);
  assert.strictEqual(BigInt(d[1][0]), R.ACCESS_PERMS); assert.strictEqual(d[1][1], C.allowedCalls(42));
  assert.strictEqual(R.check(R.UP.encodeFunctionData("setDataBatch", [d[0], [ethers.zeroPadValue("0x7f3f06", 32), d[1][1]]]), { signer: admin, chainId: 42 }).error, "device_change", "not to administrator");
  assert.strictEqual(R.check(R.UP.encodeFunctionData("setDataBatch", [d[0], [d[1][0], "0x"]]), { signer: admin, chainId: 42 }).error, "device_change");
  assert.strictEqual(R.check(R.UP.encodeFunctionData("setDataBatch", [[R.permKey(a)], [d[1][0]]]), { signer: admin, chainId: 42 }).error, "device_change");
  assert.strictEqual(R.check(R.UP.encodeFunctionData("setDataBatch", [[R.permKey(a), R.dataKeysKey(a)], [d[1][0], "0x"]]), { signer: admin, chainId: 42 }).error, "device_change");
  assert.strictEqual(R.accessUpToDate({ perms: R.ACCESS_PERMS, calls: C.allowedCalls(42) }, 42), true);
  assert.strictEqual(R.accessUpToDate({ perms: R.OLD_ACCESS_PERMS, calls: "0x" }, 42), false, "an access of 0.5.x");
  assert.strictEqual(R.accessUpToDate({ perms: R.ACCESS_PERMS, calls: C.allowedCalls(42).slice(0, -68) }, 42), false, "a new operation in the catalog");
});
