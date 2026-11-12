"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { ethers } = require("ethers");
const K = require("../../shared/keystore.js");

const PW = "correct horse battery";

test("password: seal, open, sign", async () => {
  const k = K.generate();
  const rec = await K.sealWithPassword(k.privateKey, PW);
  assert.strictEqual(rec.address, k.address);
  assert.strictEqual(rec.kdf.rounds, 600000);
  assert.ok(!JSON.stringify(rec).includes(ethers.hexlify(k.privateKey).slice(2)));
  const raw = await K.open(rec, { password: PW });
  assert.deepStrictEqual(raw, k.privateKey);
  const digest = ethers.hashMessage("hello");
  const sig = await K.withKey(rec, { password: PW }, (sk) => sk.sign(digest).serialized);
  assert.strictEqual(ethers.recoverAddress(digest, sig), k.address);
});

test("wrong password, short password", async () => {
  const k = K.generate();
  await assert.rejects(K.sealWithPassword(k.privateKey, "short"), { code: "WEAK_PASSWORD" });
  const rec = await K.sealWithPassword(k.privateKey, PW);
  await assert.rejects(K.open(rec, { password: PW + "x" }), { code: "WRONG_SECRET" });
});

test("a record with another address does not open", async () => {
  const k = K.generate();
  const rec = await K.sealWithPassword(k.privateKey, PW);
  const other = { ...rec, address: K.generate().address };
  await assert.rejects(K.open(other, { password: PW }), { code: "WRONG_SECRET" });
  const flipped = { ...rec, ct: ethers.encodeBase64(Uint8Array.from(ethers.getBytes(ethers.decodeBase64(rec.ct)), (b, i) => (i === 0 ? b ^ 1 : b))) };
  await assert.rejects(K.open(flipped, { password: PW }), { code: "WRONG_SECRET" });
});

test("device secret", async () => {
  const k = K.generate();
  const secret = Uint8Array.from({ length: 32 }, (_, i) => i);
  await assert.rejects(K.sealWithSecret(k.privateKey, secret.slice(0, 16)), { code: "BAD_SECRET" });
  const rec = await K.sealWithSecret(k.privateKey, secret, { credId: "abc" });
  assert.deepStrictEqual(await K.open(rec, { secret }), k.privateKey);
  await assert.rejects(K.open(rec, { secret: secret.map((b) => b ^ 1) }), { code: "WRONG_SECRET" });
  assert.throws(() => K.backupFile(rec), { code: "NOT_PORTABLE" });
});

test("backup file round trip", async () => {
  const k = K.generate();
  const rec = await K.sealWithPassword(k.privateKey, PW);
  const file = JSON.parse(JSON.stringify(K.backupFile(rec, { name: "Backup, Rossi Srl" })));
  assert.strictEqual(file.kind, K.BACKUP_KIND);
  const back = K.readBackup(file);
  assert.deepStrictEqual(await K.open(back, { password: PW }), k.privateKey);
  assert.throws(() => K.readBackup({ ...file, kind: "x" }), { code: "BAD_BACKUP" });
  assert.throws(() => K.readBackup({ ...file, key: { ...rec, kdf: { ...rec.kdf, rounds: 1000 } } }), { code: "BAD_RECORD" });
});
