"use strict";
const test = require("node:test");
const assert = require("node:assert");
const R = require("../../shared/request.js");

const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";
const base = () => ({
  kind: R.KIND, version: 1, network: "lukso-testnet",
  profile: { name: "  rossi-srl ", description: "Vino\r\n\r\n\r\n\r\ntoscano", tags: ["vino", "vino", " Toscana "], links: [{ title: "", url: "https://www.esempio.it" }] },
  images: { avatar: null, cover: null },
  controllers: [{ address: A.toLowerCase(), name: "PC\u202eufficio", role: "admin" }, { address: B, name: "", role: "device" }],
});

test("a good request is cleaned", () => {
  const { request, errors } = R.parse(base());
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(request.profile.name, "rossi-srl");
  assert.strictEqual(request.profile.description, "Vino\n\ntoscano");
  assert.deepStrictEqual(request.profile.tags, ["vino", "Toscana"]);
  assert.deepStrictEqual(request.profile.links, [{ title: "www.esempio.it", url: "https://www.esempio.it/" }]);
  assert.strictEqual(request.controllers[0].address, "0x1111111111111111111111111111111111111111");
  assert.strictEqual(request.controllers[0].name, "PC ufficio");
  assert.deepStrictEqual(R.warnings(request), ["controllers.oneAdmin"]);
});

test("unknown fields are dropped", () => {
  const src = base(); src.extra = "x"; src.profile.html = "<b>"; src.controllers[0].permissions = "0xff";
  const { request } = R.parse(src);
  assert.strictEqual(request.extra, undefined);
  assert.strictEqual(request.profile.html, undefined);
  assert.strictEqual(request.controllers[0].permissions, undefined);
});

test("errors are reported", () => {
  const cases = [
    [(s) => { s.kind = "other"; }, "kind"],
    [(s) => { s.version = 2; }, "version"],
    [(s) => { s.network = "ethereum"; }, "network"],
    [(s) => { s.salt = "0x1234"; }, "salt"],
    [(s) => { s.profile.name = " \u200b "; }, "profile.name"],
    [(s) => { s.profile.name = "Rossi"; }, "profile.nameRule"],
    [(s) => { s.profile.name = "rossi_srl"; }, "profile.nameRule"],
    [(s) => { s.profile.name = "rossi srl"; }, "profile.nameRule"],
    [(s) => { s.profile.name = "-rossi"; }, "profile.nameRule"],
    [(s) => { s.profile.name = "rossi-"; }, "profile.nameRule"],
    [(s) => { s.profile.name = "ro"; }, "profile.nameRule"],
    [(s) => { s.profile.name = "a".repeat(33); }, "profile.nameRule"],
    [(s) => { s.images.avatar = { dataUrl: "data:image/webp;base64,UklGRg==" }; }, "images.avatar"],
    [(s) => { s.profile.links = [{ url: "javascript:alert(1)" }]; }, "profile.links.0"],
    [(s) => { s.images.avatar = { dataUrl: "data:image/svg+xml;base64,PHN2Zz4=" }; }, "images.avatar"],
    [(s) => { s.controllers[1].address = A; }, "controllers.1.duplicate"],
    [(s) => { s.controllers[1].address = "0x0000000000000000000000000000000000000000"; }, "controllers.1.address"],
    [(s) => { s.controllers[1].role = "owner"; }, "controllers.1.role"],
    [(s) => { s.controllers[0].role = "device"; }, "controllers.noAdmin"],
    [(s) => { s.controllers = []; }, "controllers.none"],
  ];
  for (const [change, code] of cases) {
    const s = base(); change(s);
    assert.ok(R.parse(s).errors.includes(code), `${code}: ${JSON.stringify(R.parse(s).errors)}`);
  }
});

test("create does not need kind and version", () => {
  const s = base(); delete s.kind; delete s.version; s.salt = "0x" + "AB".repeat(32);
  const { request, errors } = R.create(s);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(request.kind, R.KIND);
  assert.strictEqual(request.salt, "0x" + "ab".repeat(32));
});

test("unknown fields, such as a recovery choice, are dropped", () => {
  const s = base(); s.chainintegrateRecovery = true;
  assert.strictEqual(R.parse(s).request.chainintegrateRecovery, undefined);
});

test("cleaning is stable, so the signed message is the same on both sides", () => {
  const once = R.parse(base()).request;
  const twice = R.parse(JSON.parse(JSON.stringify(once))).request;
  assert.deepStrictEqual(twice, once);
  assert.strictEqual(R.signingMessage(twice), R.signingMessage(once));
  assert.match(R.signingMessage(once), /^ChainIntegrate account request\n0x[0-9a-f]{64}$/);
  assert.strictEqual(R.signingMessage({ ...once, salt: "0x" + "11".repeat(32) }), R.signingMessage(once));
  assert.notStrictEqual(R.signingMessage({ ...once, profile: { ...once.profile, name: "other" } }), R.signingMessage(once));
});

test("good names", () => {
  for (const name of ["abc", "chaintest2", "cantina-rossi", "a1-b2-c3", "a".repeat(32)]) {
    const s = base(); s.profile.name = name;
    assert.deepStrictEqual(R.parse(s).errors, [], name);
  }
});
