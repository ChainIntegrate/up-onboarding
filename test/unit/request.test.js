"use strict";
const test = require("node:test");
const assert = require("node:assert");
const R = require("../../shared/request.js");

const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";
const base = () => ({
  kind: R.KIND, version: 1, network: "lukso-testnet",
  profile: { name: "  Rossi   Srl ", description: "Vino\r\n\r\n\r\n\r\ntoscano", tags: ["vino", "vino", " Toscana "], links: [{ title: "", url: "https://www.esempio.it" }] },
  images: { avatar: null, cover: null },
  controllers: [{ address: A.toLowerCase(), name: "PC\u202eufficio", role: "admin" }, { address: B, name: "", role: "device" }],
});

test("a good request is cleaned", () => {
  const { request, errors } = R.parse(base());
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(request.profile.name, "Rossi Srl");
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
