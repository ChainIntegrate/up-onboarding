"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { ethers } = require("ethers");
const C = require("../../shared/catalog.js");
const R = require("../../shared/relay.js");

const account = ethers.Wallet.createRandom().address;
const TRACE = "https://traceability.chainintegrate.it", SUPPLIER = "https://supplier-trust-registry.chainintegrate.it";
const SUPPLIER_REGISTRY = "0xFa143308D85b81Ed57547049F4A7718c3117A064", TRACE_FACTORY = "0x54C3A7C31C4eCA1f1997f5E6f19197f3A82b88a3";
const STATEMENT = "[IT] Firma di conferma dalla tua Universal Profile: non si tratta di un pagamento, non costa nulla " +
  "e non scrive niente sulla blockchain. Serve solo a dimostrare che sei davvero tu a chiedere questa operazione. " +
  "[EN] Confirmation signature from your Universal Profile: it is not a payment, costs nothing " +
  "and writes nothing on the blockchain. It only proves it's really you asking for this.";

// As traceability-registry/frontend/traceability-siwe.js writes it.
function traceSiwe({ host = "traceability.chainintegrate.it", uri = TRACE, address = account, chainId = 42, op = "Caricamento documento / Upload document", expiresAt = null } = {}) {
  return host + " wants you to sign in with your Ethereum account:\n" + address + "\n\n" + STATEMENT + " [Operazione / Operation: " + op + "]\n\n" +
    "URI: " + uri + "\nVersion: 1\nChain ID: " + chainId + "\nNonce: " + "ab".repeat(32) + "\nIssued At: " + new Date().toISOString() + "\n" +
    (expiresAt ? "Expiration Time: " + new Date(expiresAt).toISOString() + "\n" : "") +
    "Resources:\n- " + uri + "/how-it-works.html\n- " + uri + "/explorer.html?registry=" + TRACE_FACTORY;
}
// As supplier-trust-registry/backend/auth.js writes it.
const supplierChallenge = ({ domain = "supplier-trust-registry.chainintegrate.it", address = account, text = "You authorize uploading a file to IPFS for your Supplier Trust Registry." } = {}) =>
  [`${domain} wants you to sign in with your Universal Profile:`, "", address, "", text, "", `URI: https://${domain}`, "Version: 1", "Nonce: n0nce", `Issued At: ${new Date().toISOString()}`].join("\n");

test("pages: only the projects' https hosts", () => {
  assert.strictEqual(C.projectForOrigin(TRACE).id, "traceability");
  assert.strictEqual(C.projectForOrigin(SUPPLIER).id, "supplier-trust");
  for (const o of ["http://traceability.chainintegrate.it", "https://traceability.chainintegrate.it:8443", "https://evil.traceability.chainintegrate.it", "https://chainintegrate.it", "https://example.com", "nonsense"])
    assert.strictEqual(C.projectForOrigin(o), null, o);
});

test("sign-in messages of both projects", () => {
  const p = C.projectForOrigin(TRACE);
  const r = C.message(p, traceSiwe(), { origin: TRACE, account, chainId: 42 });
  assert.strictEqual(r.ok, true);
  assert.match(r.lines[0].en, /upload a document/);
  assert.match(r.digest, /^0x[0-9a-f]{64}$/);
  const lib = C.message(p, traceSiwe({ op: "Consultazione delle librerie, valida 1 ora / Library access, valid 1 hour", expiresAt: Date.now() + 3600000 }), { origin: TRACE, account, chainId: 42 });
  assert.strictEqual(lib.lines.length, 2);
  const s = C.message(C.projectForOrigin(SUPPLIER), supplierChallenge(), { origin: SUPPLIER, account, chainId: 42 });
  assert.strictEqual(s.ok, true);
  assert.strictEqual(C.message(C.projectForOrigin(SUPPLIER), supplierChallenge({ text: "Autorizzi il caricamento di un file su IPFS per il tuo Supplier Trust Registry." }), { origin: SUPPLIER, account, chainId: 42 }).ok, true);
});

test("sign-in messages refused", () => {
  const p = C.projectForOrigin(TRACE), ctx = { origin: TRACE, account, chainId: 42 };
  assert.strictEqual(C.message(p, traceSiwe({ host: "evil.example" }), ctx).error, "other_site");
  assert.strictEqual(C.message(p, traceSiwe({ uri: "https://evil.example" }), ctx).error, "other_site");
  assert.strictEqual(C.message(p, traceSiwe({ address: ethers.Wallet.createRandom().address }), ctx).error, "other_account");
  assert.strictEqual(C.message(p, traceSiwe({ chainId: 4201 }), ctx).error, "other_network");
  assert.strictEqual(C.message(p, traceSiwe({ op: "Transfer everything" }), ctx).error, "not_in_catalog");
  assert.strictEqual(C.message(p, traceSiwe({ expiresAt: Date.now() - 1000 }), ctx).error, "expired");
  assert.strictEqual(C.message(p, "Please sign this: 0xdeadbeef", ctx).error, "not_sign_in");
  assert.strictEqual(C.message(p, traceSiwe() + "\n- " + TRACE + "/x‮", ctx).error, "not_sign_in");
  // A Supplier Trust message on the Traceability site, and the reverse.
  assert.strictEqual(C.message(p, supplierChallenge({ domain: "traceability.chainintegrate.it" }), ctx).error, "not_sign_in");
  assert.strictEqual(C.message(C.projectForOrigin(SUPPLIER), supplierChallenge({ text: "Something else." }), { origin: SUPPLIER, account, chainId: 42 }).error, "not_in_catalog");
});

test("transactions: catalogued calls with their descriptions and on-chain checks", () => {
  const supplier = new ethers.Interface(["function mintRegistry(string)", "function addEvaluation(bytes32,uint256,uint256,bytes32,string,bool,uint256)", "function setTierLimits(address,uint8,uint256,uint256,bool,uint256,bool)"]);
  const r = C.call({ chainId: 42, to: SUPPLIER_REGISTRY, data: supplier.encodeFunctionData("mintRegistry", ["Fornitori 2026"]) });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.project, "supplier-trust");
  assert.match(r.lines[0].it, /Fornitori 2026/);
  assert.deepStrictEqual(r.needs, []);
  const e = C.call({ chainId: 42, to: SUPPLIER_REGISTRY, data: supplier.encodeFunctionData("addEvaluation", [ethers.ZeroHash, 3, 1, ethers.ZeroHash, "ipfs://x", false, 2]) });
  assert.match(e.lines[0].en, /private evaluation of supplier no\. 3 \(replacing no\. 2\)/);
  // ChainIntegrate's administration is not in the catalog.
  assert.strictEqual(C.call({ chainId: 42, to: SUPPLIER_REGISTRY, data: supplier.encodeFunctionData("setTierLimits", [account, 1, 1, 1, true, 1, true]) }).error, "not_in_catalog");
  // Another network, value, trailing bytes, another contract.
  assert.strictEqual(C.call({ chainId: 4201, to: SUPPLIER_REGISTRY, data: supplier.encodeFunctionData("mintRegistry", ["x"]) }).error, "not_in_catalog");
  assert.strictEqual(C.call({ chainId: 42, to: SUPPLIER_REGISTRY, value: 1n, data: supplier.encodeFunctionData("mintRegistry", ["x"]) }).error, "value");
  assert.strictEqual(C.call({ chainId: 42, to: SUPPLIER_REGISTRY, data: supplier.encodeFunctionData("mintRegistry", ["x"]) + "00" }).error, "payload");

  const trace = new ethers.Interface(["function deployRegistry(string,string)", "function mintRawMaterialLotBatch(bytes32[],bytes[],uint256[])", "function setRegistryAdmin(address)"]);
  const reg = ethers.Wallet.createRandom().address;
  const m = C.call({ chainId: 42, to: reg, data: trace.encodeFunctionData("mintRawMaterialLotBatch", [[ethers.ZeroHash, ethers.ZeroHash], ["0x", "0x"], [1, 2]]) });
  assert.strictEqual(m.ok, true);
  assert.match(m.lines[0].en, /2 raw material lots/);
  assert.deepStrictEqual(m.needs, [{ factory: TRACE_FACTORY, check: "isRegistry(address)", address: reg }]);
  assert.strictEqual(C.call({ chainId: 42, to: TRACE_FACTORY, data: trace.encodeFunctionData("deployRegistry", ["Malto", "MLT"]) }).needs.length, 0);
  assert.strictEqual(C.call({ chainId: 42, to: reg, data: trace.encodeFunctionData("setRegistryAdmin", [account]) }).error, "not_in_catalog");
  // A page's call only within its own project.
  assert.strictEqual(C.call({ chainId: 42, to: SUPPLIER_REGISTRY, data: supplier.encodeFunctionData("mintRegistry", ["x"]) }, C.projectForOrigin(TRACE)).error, "not_in_catalog");
});

test("the relay accepts a catalogued execute, nothing else", () => {
  const supplier = new ethers.Interface(["function mintRegistry(string)"]);
  const data = supplier.encodeFunctionData("mintRegistry", ["Fornitori"]);
  const ok = R.check(R.projectCall(SUPPLIER_REGISTRY, data), { signer: account, chainId: 42 });
  assert.strictEqual(ok.ok, true);
  assert.deepStrictEqual(ok.items[0], { op: "project", project: "supplier-trust", fn: "mintRegistry(string)", target: SUPPLIER_REGISTRY });
  assert.strictEqual(R.check(R.UP.encodeFunctionData("execute", [1, SUPPLIER_REGISTRY, 0, data]), { signer: account, chainId: 42 }).error, "not_in_catalog");
  assert.strictEqual(R.check(R.projectCall(SUPPLIER_REGISTRY, data), { signer: account, chainId: 4201 }).error, "not_in_catalog");
});

test("typed data of the gas cylinder registry: refused until its site and factory are set", () => {
  const p = C.projectById("gas-cylinders");
  assert.deepStrictEqual(p.sites, []);
  const typed = { domain: { name: "GasCylinderRegistry", version: "1", chainId: 42, verifyingContract: account },
    types: { EIP712Domain: [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }],
      SetOperator: [{ name: "operator", type: "address" }, { name: "enabled", type: "bool" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }] },
    primaryType: "SetOperator", message: { operator: account, enabled: true, nonce: 0, deadline: Math.floor(Date.now() / 1000) + 600 } };
  assert.strictEqual(C.typedData(p, typed, { account, chainId: 42 }).error, "not_configured");
  // The checks that come before still hold.
  assert.strictEqual(C.typedData(p, { ...typed, primaryType: "RecordDocument" }, { account, chainId: 42 }).error, "not_in_catalog");
  assert.strictEqual(C.typedData(p, { ...typed, types: { ...typed.types, Extra: [{ name: "a", type: "uint256" }] } }, { account, chainId: 42 }).error, "not_in_catalog");
  assert.strictEqual(C.typedData(p, typed, { account, chainId: 4201 }).error, "other_network");
  assert.strictEqual(C.typedData(C.projectById("traceability"), typed, { account, chainId: 42 }).error, "not_in_catalog");
});
