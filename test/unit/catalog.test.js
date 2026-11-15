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

const GT = "https://gastrace.chainintegrate.it", GT_FACTORY = "0xA128e7162fa8Dc779bf31EF569F06B53a499A50e", GT_REG = "0xEae1a8B84977694e5c9925028a23599bc345b801";
const DOMAIN_TYPE = [{ name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }];
const TYPES = {
  SetOperator: [{ name: "operator", type: "address" }, { name: "enabled", type: "bool" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }],
  SetData: [{ name: "dataKeys", type: "bytes32[]" }, { name: "dataValuesHash", type: "bytes32" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }],
  TransferOwnership: [{ name: "newOwner", type: "address" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }],
  AcceptOwnership: [{ name: "newOwner", type: "address" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }],
};
const deadline = () => Math.floor(Date.now() / 1000) + 600;
const typedOf = (primaryType, message, extra = {}) => ({ domain: { name: "GasCylinderRegistry", version: "1", chainId: 42, verifyingContract: GT_REG },
  types: { EIP712Domain: DOMAIN_TYPE, [primaryType]: TYPES[primaryType] }, primaryType, message, ...extra });
const phone = ethers.Wallet.createRandom().address;

test("GasTrace: its site, and the four owner requests described, with the registry checked on its factory", () => {
  const p = C.projectForOrigin(GT);
  assert.strictEqual(p.id, "gas-cylinders");
  assert.strictEqual(C.projectForOrigin("https://gastrace.chainintegrate.it:444"), null);
  const ctx = { account, chainId: 42 };
  const cases = [
    ["SetOperator", { operator: phone, enabled: true, nonce: 0, deadline: deadline() }, /Authorize the phone/],
    ["SetOperator", { operator: phone, enabled: false, nonce: 1, deadline: deadline() }, /Revoke the phone/],
    ["SetData", { dataKeys: [C.GCR.COUNTERPARTY + "11".repeat(20), C.GCR.COUNTERPARTY + "22".repeat(20)], dataValuesHash: ethers.id("v"), nonce: 2, deadline: deadline() }, /Add or change 2 customers or refill centres/],
    ["TransferOwnership", { newOwner: phone, nonce: 3, deadline: deadline() }, /Hand the registry over/],
    ["AcceptOwnership", { newOwner: account, nonce: 0, deadline: deadline() }, /Accept the ownership/],
  ];
  for (const [type, msg, re] of cases) {
    const t = typedOf(type, msg);
    const r = C.typedData(p, t, ctx);
    assert.strictEqual(r.ok, true, type);
    assert.match(r.lines[0].en, re);
    assert.deepStrictEqual(r.needs, [{ factory: GT_FACTORY, check: "isRegistry(address)", address: GT_REG }]);
    // The digest is the EIP-712 hash the registry checks (ERC-1271 through the account).
    assert.strictEqual(r.digest, ethers.TypedDataEncoder.hash(t.domain, { [type]: TYPES[type] }, msg));
    // The same as a JSON string, as pages send it.
    assert.strictEqual(C.typedData(p, JSON.stringify(t), ctx).digest, r.digest);
  }
});

test("GasTrace: requests outside the catalog are refused", () => {
  const p = C.projectById("gas-cylinders"), ctx = { account, chainId: 42 };
  const op = { operator: phone, enabled: true, nonce: 0, deadline: deadline() };
  const typed = typedOf("SetOperator", op);
  // the drivers' request, signed by their phones, never by the extension
  const rec = { domain: typed.domain, types: { RecordDocument: [{ name: "signer", type: "address" }, { name: "payloadHash", type: "bytes32" }, { name: "nonce", type: "uint256" }, { name: "deadline", type: "uint256" }] },
    primaryType: "RecordDocument", message: { signer: account, payloadHash: ethers.ZeroHash, nonce: 0, deadline: deadline() } };
  assert.strictEqual(C.typedData(p, rec, ctx).error, "not_in_catalog");
  assert.strictEqual(C.typedData(p, { ...typed, types: { ...typed.types, Extra: [{ name: "a", type: "uint256" }] } }, ctx).error, "not_in_catalog");
  assert.strictEqual(C.typedData(p, { ...typed, types: { EIP712Domain: DOMAIN_TYPE, SetOperator: TYPES.SetOperator.slice(0, 3) } }, ctx).error, "not_in_catalog");
  assert.strictEqual(C.typedData(p, { ...typed, domain: { ...typed.domain, name: "OtherRegistry" } }, ctx).error, "not_in_catalog");
  assert.strictEqual(C.typedData(p, { ...typed, domain: { ...typed.domain, version: "2" } }, ctx).error, "not_in_catalog");
  assert.strictEqual(C.typedData(p, { ...typed, domain: { ...typed.domain, salt: ethers.ZeroHash } }, ctx).error, "not_in_catalog");
  assert.strictEqual(C.typedData(p, typed, { account, chainId: 4201 }).error, "other_network");
  assert.strictEqual(C.typedData(p, typedOf("SetOperator", { ...op, deadline: 1000 }), ctx).error, "expired");
  // another project's site cannot ask for it
  assert.strictEqual(C.typedData(C.projectById("traceability"), typed, ctx).error, "not_in_catalog");
  // and GasTrace's site asks for no transaction or sign-in message
  assert.strictEqual(C.message(p, "gastrace.chainintegrate.it wants you to sign in with your Ethereum account:\n" + account + "\n\nx\n\nURI: " + GT + "\nVersion: 1\nNonce: 1\nIssued At: " + new Date().toISOString(), { origin: GT, account, chainId: 42 }).error, "not_in_catalog");
  assert.strictEqual(C.call({ chainId: 42, to: GT_REG, data: "0x12345678" }, p).error, "not_in_catalog");
});

// The client does not use crypto and need not learn it (test/extension.js checks the extension's pages the same way);
// nor is the window to talk about costs or payments.
const BANNED = /\b(blockchain|block chain|cripto\w*|crypto\w*|wallet|token\w*|gas|lyx\w*|lukso|ethereum|ether|eth|bitcoin|btc|nft\w*|ipfs|universal profile|up|web3|smart contract|chiav[ei] privat[ae]|private key|seed|mining|minare|transazion[ei]|transactions?|on-?chain|dapp|ledger|metamask|cost[oai]?|costs?|pagament[oi]|payments?|paga|pays?|gratis|free|fee)\b/i;
const sample = (p) => {
  if (p.baseType === "array") return [sample(p.arrayChildren), sample(p.arrayChildren)];
  if (p.type === "address") return ethers.Wallet.createRandom().address;
  if (p.type === "bool") return true;
  if (p.type === "string") return "Registro 2026";
  if (/^u?int/.test(p.type)) return 3n;
  if (p.type === "bytes32") return ethers.ZeroHash;
  if (p.type === "bytes") return "0x12";
  throw new Error(p.type);
};
test("no crypto term, cost or payment in any description of the catalog, in both languages", () => {
  const texts = [];
  for (const p of C.PROJECTS) {
    for (const c of p.contracts) for (const [sig, describe] of Object.entries(c.functions)) {
      const args = c.iface.getFunction(sig).inputs.map(sample);
      texts.push(describe(args));
      if (sig.startsWith("addEvaluation")) texts.push(describe([ethers.ZeroHash, 1n, 1n, ethers.ZeroHash, "x", true, 0n]));
    }
    if (p.typed) {
      for (const [type, k] of Object.entries(p.typed.types)) {
        if (k.setData) continue;
        const msg = { operator: account, enabled: true, newOwner: account, nonce: 0n, deadline: 1n };
        texts.push(k.describe(msg));
        if (type === "SetOperator") texts.push(k.describe({ ...msg, enabled: false }));
      }
      texts.push(p.typed.note);
      for (const c of SETDATA_CASES()) { const r = C.typedData(p, c.typed, { account, chainId: 42, current: c.current }); if (r.ok) texts.push(r.title, ...r.lines); }
    }
  }
  const p = C.projectForOrigin(TRACE);
  for (const op of ["Caricamento documento / Upload document", "Consultazione delle librerie, valida 1 ora / Library access, valid 1 hour"]) {
    const r = C.message(p, traceSiwe({ op, expiresAt: Date.now() + 3600000 }), { origin: TRACE, account, chainId: 42 });
    texts.push(r.title, ...r.lines);
  }
  const s = C.message(C.projectForOrigin(SUPPLIER), supplierChallenge(), { origin: SUPPLIER, account, chainId: 42 });
  texts.push(s.title, ...s.lines);
  assert.ok(texts.length > 25);
  for (const t of texts) for (const lang of ["it", "en"]) {
    const hit = String(t[lang]).match(BANNED);
    assert.strictEqual(hit, null, `${lang}: "${t[lang]}"`);
  }
});

// ---- GasTrace's SetData: each data key classified, the values checked, the registry's current values used
const G = C.GCR;
const cpKey = (n) => G.COUNTERPARTY + n.toString(16).padStart(40, "0");
function setDataTyped(entries, { values = true, hash = null } = {}) {
  const keys = entries.map((e) => e[0]), vals = entries.map((e) => e[1]);
  const h = hash || ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["bytes[]"], [vals]));
  const t = typedOf("SetData", { dataKeys: keys, dataValuesHash: h, nonce: 5, deadline: deadline() });
  if (values) t.dataValues = vals;
  return t;
}
const enc = "0x" + "ab".repeat(48);
function SETDATA_CASES() {
  return [
    { name: "new customer", typed: setDataTyped([[cpKey(1), enc]]), current: { [cpKey(1)]: "0x" }, re: /^Add 1 customer or refill centre$/ },
    { name: "changed customer", typed: setDataTyped([[cpKey(1), enc]]), current: { [cpKey(1)]: enc }, re: /^Change 1 customer or refill centre$/ },
    { name: "removed customer", typed: setDataTyped([[cpKey(1), "0x"]]), current: { [cpKey(1)]: enc }, re: /^Remove 1 customer or refill centre$/ },
    { name: "settings", typed: setDataTyped([[G.SETTINGS, enc]]), current: {}, re: /^The company's settings \(name and e-mail\)$/ },
    { name: "public description", typed: setDataTyped([[G.LSP4_METADATA, "0x1234"]]), current: {}, re: /public description \(visible to everyone\)/ },
    { name: "first setup", typed: setDataTyped([[G.WRAP_PASSWORD, enc], [G.WRAP_RECOVERY, enc], [G.SETTINGS, enc]]), current: { [G.WRAP_PASSWORD]: "0x", [G.WRAP_RECOVERY]: "0x" }, re: /^Prepare the encryption of the registry's data: password and recovery code \(first time\)$/, sensitive: true },
    { name: "password change", typed: setDataTyped([[G.WRAP_PASSWORD, enc]]), current: { [G.WRAP_PASSWORD]: enc, [G.WRAP_RECOVERY]: enc }, re: /^Change the data password$/, sensitive: true },
    { name: "recovery change", typed: setDataTyped([[G.WRAP_RECOVERY, enc]]), current: { [G.WRAP_PASSWORD]: enc, [G.WRAP_RECOVERY]: enc }, re: /^Change the recovery code$/, sensitive: true },
  ];
}

test("GasTrace SetData: what changes, from the request's values and the registry's current ones (IT/EN)", () => {
  const p = C.projectById("gas-cylinders");
  for (const c of SETDATA_CASES()) {
    const r = C.typedData(p, c.typed, { account, chainId: 42, current: c.current });
    assert.strictEqual(r.ok, true, c.name);
    assert.match(r.lines[0].en, c.re, c.name);
    assert.ok(r.lines[0].it.length > 5, c.name);
    assert.strictEqual(!!r.lines[0].sensitive, !!c.sensitive, c.name + ": highlighted");
    assert.ok(r.lines.some((l) => /The values are encrypted: this shows the kind of change, not its content\./.test(l.en)), c.name + ": the fixed line");
    assert.ok(!r.lines.some((l) => /not verifiable/.test(l.en)), c.name + ": no warning with the values");
    assert.match(r.note.it, /^Con questa conferma autorizzi questa modifica del registro; la registra il servizio GasTrace\.$/);
    assert.match(r.note.en, /authorize this change of the registry/);
    assert.deepStrictEqual(r.reads, [], c.name + ": nothing more to read");
    assert.ok(r.lines.some((l) => /^Valid until /.test(l.en)), c.name + ": the validity shown");
  }
});

test("GasTrace SetData: refused", () => {
  const p = C.projectById("gas-cylinders"), ctx = (current) => ({ account, chainId: 42, current });
  const full = { [G.WRAP_PASSWORD]: enc, [G.WRAP_RECOVERY]: enc };
  assert.strictEqual(C.typedData(p, setDataTyped([[G.WRAP_PASSWORD, enc], [G.WRAP_RECOVERY, enc]]), ctx(full)).error, "wraps_both", "password and recovery code together when already there");
  assert.strictEqual(C.typedData(p, setDataTyped([[G.WRAP_PASSWORD, "0x"]]), ctx(full)).error, "wrap_deleted", "a wrap deleted");
  assert.strictEqual(C.typedData(p, setDataTyped([[G.WRAP_RECOVERY, "0x"]]), ctx(full)).error, "wrap_deleted");
  assert.strictEqual(C.typedData(p, setDataTyped([[G.WRAP_PASSWORD, enc], [G.WRAP_RECOVERY, "0x"]]), ctx({})).error, "wrap_deleted");
  assert.strictEqual(C.typedData(p, setDataTyped([[G.WRAP_PASSWORD, enc]]), ctx({ [G.WRAP_PASSWORD]: "0x", [G.WRAP_RECOVERY]: "0x" })).error, "wrap_setup_incomplete", "one wrap alone before the first setup");
  assert.strictEqual(C.typedData(p, setDataTyped([[ethers.id("SomethingElse"), enc]]), ctx({})).error, "unknown_data_key", "an unknown key");
  assert.strictEqual(C.typedData(p, setDataTyped([[G.COUNTERPARTY + "11".repeat(19), enc]]), ctx({})).error, "typed_data", "a key that is not 32 bytes");
  assert.strictEqual(C.typedData(p, setDataTyped([[cpKey(1), enc]], { hash: ethers.id("other") }), ctx({})).error, "data_values_mismatch", "values that do not match the signed hash");
  const t = setDataTyped([[cpKey(1), enc], [cpKey(2), enc]]); t.dataValues = [enc];
  assert.strictEqual(C.typedData(p, t, ctx({})).error, "data_values", "values of another length");
  const far = typedOf("SetOperator", { operator: phone, enabled: true, nonce: 0, deadline: Math.floor(Date.now() / 1000) + 8 * 86400 });
  assert.strictEqual(C.typedData(p, far, ctx({})).error, "deadline_too_far", "valid for more than 7 days");
});

test("GasTrace SetData: without the values (pages not updated yet), accepted with a warning; the window reads the registry", () => {
  const p = C.projectById("gas-cylinders");
  const t = setDataTyped([[cpKey(1), enc], [G.SETTINGS, enc]], { values: false });
  const r = C.typedData(p, t, { account, chainId: 42 });
  assert.strictEqual(r.ok, true);
  const warn = r.lines.find((l) => /not verifiable/.test(l.en));
  assert.ok(warn && warn.sensitive && /non verificabile/.test(warn.it), "the warning, highlighted");
  assert.deepStrictEqual(r.reads, [{ address: GT_REG, keys: [cpKey(1)] }], "what the window reads before describing it");
  // the GasTrace admin page's own test calls typedData without `current`: still accepted, with what can be said
  const wr = C.typedData(p, setDataTyped([[G.WRAP_PASSWORD, enc], [G.WRAP_RECOVERY, enc]]), { account, chainId: 42 });
  assert.strictEqual(wr.ok, true);
  assert.deepStrictEqual(wr.reads[0].keys.sort(), [G.WRAP_PASSWORD, G.WRAP_RECOVERY].sort());
});

test("GasTrace: handing the registry over is highlighted; accepting it is not", () => {
  const p = C.projectById("gas-cylinders");
  const r = C.typedData(p, typedOf("TransferOwnership", { newOwner: phone, nonce: 3, deadline: deadline() }), { account, chainId: 42 });
  assert.ok(r.lines[0].sensitive && /You will no longer control it/.test(r.lines[0].en) && /Non lo controllerai più/.test(r.lines[0].it));
  const a = C.typedData(p, typedOf("AcceptOwnership", { newOwner: account, nonce: 0, deadline: deadline() }), { account, chainId: 42 });
  assert.ok(!a.lines[0].sensitive);
});

test("readCurrent: the registry's values, lowercase, from getDataBatch", async () => {
  const k1 = cpKey(1), k2 = G.WRAP_PASSWORD;
  const provider = { call: async (tx) => {
    const iface = new ethers.Interface(["function getDataBatch(bytes32[]) view returns (bytes[])"]);
    const [keys] = iface.decodeFunctionData("getDataBatch", tx.data);
    return iface.encodeFunctionResult("getDataBatch", [keys.map((k) => (k === k1 ? "0xABCD" : "0x"))]);
  } };
  const out = await C.readCurrent(provider, [{ address: GT_REG, keys: [k1, k2] }]);
  assert.deepStrictEqual(out, { [k1]: "0xabcd", [k2]: "0x" });
});

test("an access key's allowed calls: every function of the catalog, CALL only, value 0, nothing else", () => {
  const v = C.allowedCalls(42);
  const b = ethers.getBytes(v), entries = [];
  for (let i = 0; i < b.length;) { assert.strictEqual((b[i] << 8) | b[i + 1], 32); entries.push(ethers.hexlify(b.slice(i + 2, i + 34))); i += 34; }
  const fns = C.PROJECTS.flatMap((p) => p.contracts.flatMap((c) => Object.keys(c.functions).map((f) => ({ c, sel: ethers.id(f).slice(0, 10) }))));
  assert.strictEqual(entries.length, fns.length);
  for (const { c, sel } of fns) {
    const want = ("0x00000002" + (c.address || "0xffffffffffffffffffffffffffffffffffffffff").slice(2) + "ffffffff" + sel.slice(2)).toLowerCase();
    assert.ok(entries.includes(want), `${sel} on ${c.address || "the registries made by " + c.madeBy.factory}`);
  }
  // CALL only (0x02): no value (0x01), no static or delegate call; never a call to any function of any contract.
  for (const e of entries) { assert.strictEqual(e.slice(0, 10), "0x00000002"); assert.notStrictEqual(e.slice(-8), "ffffffff"); }
  assert.strictEqual(C.allowedCalls(4201), "0x", "no project on another network");
});

test("GasTrace: its requests are signed from an administrator's computer only (audit A01 / X-01)", () => {
  const p = C.projectById("gas-cylinders");
  const account = ethers.Wallet.createRandom().address;
  const r = C.typedData(p, typedOf("AcceptOwnership", { newOwner: account, nonce: 0, deadline: Math.floor(Date.now() / 1000) + 3600 }), { account, chainId: 42 });
  assert.strictEqual(r.ok, true); assert.strictEqual(r.signer, "admin");
});
