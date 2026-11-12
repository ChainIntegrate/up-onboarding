// The catalog: what ChainIntegrate's projects may ask of a client's account, and how to say it in plain words.
//
// Read by the extension (which pages it serves, what it shows in its confirmation window, what it refuses) and by
// the account service (which calls it relays, paying the gas): one file, so the two never disagree
// (docs/integration.md, section 5). No browser or Node specific code: ethers 6 only.
//
//   UPCatalog.projectForOrigin(origin)                       the project serving that page, or null
//   UPCatalog.message(project, text, { origin, account, chainId })
//                                                            a sign-in message (personal_sign)
//   UPCatalog.typedData(project, typed, { account, chainId }) EIP-712 data (eth_signTypedData_v4)
//   UPCatalog.call({ chainId, to, data, value }, project?)   a transaction from the account (eth_sendTransaction)
//   UPCatalog.verifyNeeds(provider, needs)                   the on-chain checks the three above ask for
// Each returns { ok: true, project, title, lines, needs, digest } (digest: what the key signs, for the first two) or { ok: false, error }: `title` and `lines` are
// { it, en } texts for the confirmation window; `needs` are on-chain checks to pass before signing or sending
// (e.g. "this address is a registry made by the project's factory").
//
// Only the operations of a project's clients: ChainIntegrate's own administration (tiers, memberships, sectors,
// registry admins) is never in here, so no page can have a client sign it.
(function (root, factory) {
  const api = factory(root.ethers || (typeof require === "function" ? require("ethers").ethers : null));
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UPCatalog = api;
})(typeof self !== "undefined" ? self : globalThis, function (ethers) {
  "use strict";
  const MAINNET = 42;
  const T = (it, en) => ({ it, en });
  const short = (a) => { const s = ethers.getAddress(a); return s.slice(0, 6) + "…" + s.slice(-4); };
  const clip = (s, n = 60) => { s = String(s).replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const fail = (error) => ({ ok: false, error });

  // ---------------------------------------------------------------------------------------------------------
  // The projects.
  // ---------------------------------------------------------------------------------------------------------

  // TraceabilityRegistry (traceability-registry): a factory deploys each client's registry; clients record lots,
  // productions and documents. Sign-in messages are SIWE, built by frontend/traceability-siwe.js.
  const TRACE_STATEMENT =
    "[IT] Firma di conferma dalla tua Universal Profile: non si tratta di un pagamento, non costa nulla " +
    "e non scrive niente sulla blockchain. Serve solo a dimostrare che sei davvero tu a chiedere questa operazione. " +
    "[EN] Confirmation signature from your Universal Profile: it is not a payment, costs nothing " +
    "and writes nothing on the blockchain. It only proves it's really you asking for this.";
  const TRACE_OPERATIONS = {
    "Caricamento documento / Upload document": T("caricare un documento", "upload a document"),
    "Elenco documenti / List documents": T("vedere l'elenco dei documenti", "list the documents"),
    "Nascondi documento / Hide document": T("nascondere un documento", "hide a document"),
    "Scarica documento / Download document": T("scaricare un documento", "download a document"),
    "Caricamento foto / Upload photo": T("caricare una foto", "upload a photo"),
    "Elenco foto / List photos": T("vedere l'elenco delle foto", "list the photos"),
    "Nascondi foto / Hide photo": T("nascondere una foto", "hide a photo"),
    "Salvataggio dati / Save data": T("salvare i dati di una registrazione", "save the data of a record"),
    "Consultazione delle librerie, valida 1 ora / Library access, valid 1 hour": T("consultare foto e documenti per un'ora", "look at photos and documents for one hour"),
  };
  const TRACE_FACTORY = "0x54C3A7C31C4eCA1f1997f5E6f19197f3A82b88a3";

  // Supplier Trust Registry (supplier-trust-registry): one contract (V3); each client mints its registries in it.
  // Sign-in: backend/auth.js buildChallengeMessage.
  const SUPPLIER_STATEMENTS = {
    "Autorizzi il caricamento di un file su IPFS per il tuo Supplier Trust Registry.": T("caricare un file per il tuo registro", "upload a file for your registry"),
    "You authorize uploading a file to IPFS for your Supplier Trust Registry.": T("caricare un file per il tuo registro", "upload a file for your registry"),
  };
  const SUPPLIER_REGISTRY = "0xFa143308D85b81Ed57547049F4A7718c3117A064";

  // The gas cylinder registry (gas-cylinder-registry): each supplier owns a registry; as its owner the client
  // signs EIP-712 requests that the project's own relayer sends. Its site and factory are not public yet:
  // until they are set here, the project is not served.
  const CYLINDER_FACTORY = null;

  const PROJECTS = [
    {
      id: "traceability",
      name: "TraceabilityRegistry",
      sites: ["traceability.chainintegrate.it"],
      signIn: { header: "Ethereum account", statement: (s) => {
        const m = /^(.*) \[Operazione \/ Operation: ([^\]]+)\]$/.exec(s);
        if (!m || m[1] !== TRACE_STATEMENT || !TRACE_OPERATIONS[m[2]]) return null;
        const op = TRACE_OPERATIONS[m[2]];
        return T(`Conferma di essere tu, per ${op.it}. Non è un pagamento e non scrive nulla.`, `Confirm it is you, to ${op.en}. It is not a payment and writes nothing.`);
      } },
      contracts: [
        { chainId: MAINNET, address: TRACE_FACTORY, kind: "factory", functions: {
          "deployRegistry(string,string)": (a) => T(`Creare il registro «${clip(a[0])}»`, `Create the registry “${clip(a[0])}”`),
        } },
        { chainId: MAINNET, madeBy: { factory: TRACE_FACTORY, check: "isRegistry(address)" }, kind: "registry", functions: {
          "addDelegate(address)": (a) => T(`Autorizzare ${short(a[0])} a registrare nel registro`, `Allow ${short(a[0])} to record in the registry`),
          "removeDelegate(address)": (a) => T(`Togliere a ${short(a[0])} l'autorizzazione a registrare`, `Withdraw ${short(a[0])}'s permission to record`),
          "setRegistryMetadata(bytes)": () => T("Cambiare la descrizione del registro", "Change the registry's description"),
          "mintRawMaterialLot(bytes32,bytes,uint256)": () => T("Registrare un lotto di materia prima", "Record a raw material lot"),
          "mintRawMaterialLotBatch(bytes32[],bytes[],uint256[])": (a) => T(`Registrare ${count(a[0].length, "lotto", "lotti")} di materia prima`, `Record ${count(a[0].length, "raw material lot", "raw material lots")}`),
          "mintProductionBatch(bytes32,bytes,bytes32[],uint256)": (a) => T(`Registrare una produzione (${count(a[2].length, "lotto usato", "lotti usati")})`, `Record a production (${count(a[2].length, "lot used", "lots used")})`),
          "invalidateEntry(bytes32,string)": (a) => T(`Annullare una registrazione: «${clip(a[1])}»`, `Cancel a record: “${clip(a[1])}”`),
          "setDocumentHash(bytes32,bytes32)": () => T("Collegare un documento a una registrazione", "Link a document to a record"),
          "setDocumentHashBatch(bytes32[],bytes32)": (a) => T(`Collegare un documento a ${count(a[0].length, "registrazione", "registrazioni")}`, `Link a document to ${count(a[0].length, "record", "records")}`),
          "correctDocumentHash(bytes32,bytes32,string)": (a) => T(`Correggere il documento di una registrazione: «${clip(a[2])}»`, `Correct the document of a record: “${clip(a[2])}”`),
        } },
      ],
    },
    {
      id: "supplier-trust",
      name: "Supplier Trust Registry",
      sites: ["supplier-trust-registry.chainintegrate.it"],
      signIn: { header: "Universal Profile", statement: (s) => {
        const op = SUPPLIER_STATEMENTS[s];
        return op ? T(`Conferma di essere tu, per ${op.it}. Non è un pagamento e non scrive nulla.`, `Confirm it is you, to ${op.en}. It is not a payment and writes nothing.`) : null;
      } },
      contracts: [
        { chainId: MAINNET, address: SUPPLIER_REGISTRY, kind: "registry", functions: {
          "mintRegistry(string)": (a) => T(`Creare il registro dei fornitori «${clip(a[0])}»`, `Create the supplier registry “${clip(a[0])}”`),
          "defineSchema(bytes32,string[],int256,int256)": (a) => T(`Definire i criteri di valutazione (${count(a[1].length, "criterio", "criteri")}, da ${a[2]} a ${a[3]})`, `Set the evaluation criteria (${count(a[1].length, "criterion", "criteria")}, from ${a[2]} to ${a[3]})`),
          "addSupplier(bytes32,bytes32,string,bool)": (a) => T(`Aggiungere un fornitore (nome ${a[3] ? "pubblico" : "riservato"})`, `Add a supplier (name ${a[3] ? "public" : "private"})`),
          "addEvaluation(bytes32,uint256,uint256,bytes32,string,bool,uint256)": (a) => T(`Registrare una valutazione ${a[5] ? "pubblica" : "riservata"} del fornitore n. ${a[1]}${a[6] > 0n ? ` (sostituisce la n. ${a[6]})` : ""}`, `Record a ${a[5] ? "public" : "private"} evaluation of supplier no. ${a[1]}${a[6] > 0n ? ` (replacing no. ${a[6]})` : ""}`),
          "discloseEvaluation(bytes32,uint256,uint256,string,bytes32)": (a) => T(`Rendere visibile la valutazione n. ${a[2]} del fornitore n. ${a[1]}`, `Disclose evaluation no. ${a[2]} of supplier no. ${a[1]}`),
          "setRegistryImage(bytes32,string,bytes32)": () => T("Cambiare l'immagine del registro", "Change the registry's picture"),
        } },
      ],
    },
    {
      id: "gas-cylinders",
      name: "Gas cylinder registry",
      sites: [],
      typed: {
        domain: { name: "GasCylinderRegistry", version: "1" },
        madeBy: CYLINDER_FACTORY ? { factory: CYLINDER_FACTORY, check: "isRegistry(address)" } : null,
        chainIds: [MAINNET],
        types: {
          SetOperator: { fields: "address operator,bool enabled,uint256 nonce,uint256 deadline",
            describe: (m) => m.enabled ? T(`Autorizzare il telefono ${short(m.operator)} a registrare per te`, `Authorize the phone ${short(m.operator)} to record for you`)
              : T(`Togliere l'autorizzazione al telefono ${short(m.operator)}`, `Revoke the phone ${short(m.operator)}`) },
          SetData: { fields: "bytes32[] dataKeys,bytes32 dataValuesHash,uint256 nonce,uint256 deadline",
            describe: (m) => T(`Cambiare i dati del registro (${count(m.dataKeys.length, "voce", "voci")}: controparti e impostazioni, cifrate)`, `Change the registry's data (${count(m.dataKeys.length, "item", "items")}: counterparties and settings, encrypted)`) },
          TransferOwnership: { fields: "address newOwner,uint256 nonce,uint256 deadline",
            describe: (m) => T(`Cedere il registro all'account ${short(m.newOwner)}. Non lo controllerai più.`, `Hand the registry over to the account ${short(m.newOwner)}. You will no longer control it.`) },
          AcceptOwnership: { fields: "address newOwner,uint256 nonce,uint256 deadline",
            describe: () => T("Accettare la proprietà del registro", "Accept the ownership of the registry") },
        },
      },
      contracts: [],
    },
  ];

  // Selectors of each contract's functions, computed once.
  for (const p of PROJECTS) for (const c of p.contracts) {
    c.iface = new ethers.Interface(Object.keys(c.functions).map((s) => `function ${s}`));
    if (c.address) c.address = ethers.getAddress(c.address);
    if (c.madeBy) c.madeBy.factory = ethers.getAddress(c.madeBy.factory);
  }

  // ---------------------------------------------------------------------------------------------------------
  // Pages.
  // ---------------------------------------------------------------------------------------------------------

  // Only https pages on the project's own host (no port, no other subdomain).
  function projectForOrigin(origin) {
    let u;
    try { u = new URL(String(origin)); } catch (e) { return null; }
    if (u.protocol !== "https:" || u.port || u.origin !== String(origin)) return null;
    return PROJECTS.find((p) => p.sites.includes(u.hostname)) || null;
  }
  const projectById = (id) => PROJECTS.find((p) => p.id === id) || null;

  // ---------------------------------------------------------------------------------------------------------
  // Sign-in messages (EIP-4361 as the projects write them).
  // ---------------------------------------------------------------------------------------------------------

  const FIELDS = ["URI", "Version", "Chain ID", "Nonce", "Issued At", "Expiration Time", "Not Before", "Request ID"];

  function parseSignIn(text) {
    if (typeof text !== "string" || text.length > 4000 || /[\u0000-\u0009\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/.test(text)) return null;
    const lines = text.split("\n");
    const h = /^([a-z0-9.-]+(?::[0-9]+)?) wants you to sign in with your (Ethereum account|Universal Profile):$/.exec(lines[0] || "");
    if (!h) return null;
    let i = 1;
    while (lines[i] === "") i++;
    const address = lines[i++];
    if (!ethers.isAddress(address || "")) return null;
    if (lines[i++] !== "") return null;
    const statement = [];
    while (i < lines.length && lines[i] !== "") statement.push(lines[i++]);
    if (lines[i++] !== "") return null;
    const fields = {}, resources = [];
    for (; i < lines.length; i++) {
      if (lines[i] === "Resources:") {
        for (i++; i < lines.length; i++) { if (!lines[i].startsWith("- ")) return null; resources.push(lines[i].slice(2)); }
        break;
      }
      const m = /^([A-Za-z ]+): (.+)$/.exec(lines[i]);
      if (!m || !FIELDS.includes(m[1]) || m[1] in fields) return null;
      fields[m[1]] = m[2];
    }
    return { domain: h[1], header: h[2], address, statement: statement.join("\n"), fields, resources };
  }

  function message(project, text, { origin, account, chainId }) {
    if (!project || !project.signIn) return fail("not_in_catalog");
    const m = parseSignIn(text);
    if (!m) return fail("not_sign_in");
    const page = new URL(origin);
    const sameOrigin = (u) => { try { return new URL(u).origin === page.origin; } catch (e) { return false; } };
    if (m.header !== project.signIn.header) return fail("not_sign_in");
    if (m.domain !== page.host) return fail("other_site");
    if (ethers.getAddress(m.address) !== ethers.getAddress(account)) return fail("other_account");
    if (m.fields.URI && !sameOrigin(m.fields.URI)) return fail("other_site");
    if (!m.fields.URI || m.fields.Version !== "1" || !m.fields.Nonce || !m.fields["Issued At"]) return fail("not_sign_in");
    if ("Chain ID" in m.fields && Number(m.fields["Chain ID"]) !== Number(chainId)) return fail("other_network");
    if (!m.resources.every(sameOrigin)) return fail("other_site");
    const exp = m.fields["Expiration Time"] ? Date.parse(m.fields["Expiration Time"]) : null;
    if (exp !== null && (isNaN(exp) || exp < Date.now())) return fail("expired");
    const said = project.signIn.statement(m.statement);
    if (!said) return fail("not_in_catalog");
    const lines = [said];
    if (exp) {
      const d = new Date(exp);
      const hm = (loc) => d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
      lines.push(T(`Valida fino alle ${hm("it-IT")}.`, `Valid until ${hm("en-GB")}.`));
    }
    return { ok: true, project: project.id, kind: "signIn", digest: ethers.hashMessage(text), title: T(`Accesso a ${project.name}`, `Sign in to ${project.name}`), lines, needs: [] };
  }

  // ---------------------------------------------------------------------------------------------------------
  // EIP-712 typed data.
  // ---------------------------------------------------------------------------------------------------------

  const DOMAIN_FIELDS = "string name,string version,uint256 chainId,address verifyingContract";
  const fieldsOf = (list) => (Array.isArray(list) ? list.map((f) => `${f.type} ${f.name}`).join(",") : null);

  function typedData(project, typed, { account, chainId }) {
    const spec = project && project.typed;
    if (!spec) return fail("not_in_catalog");
    let t = typed;
    if (typeof t === "string") { try { t = JSON.parse(t); } catch (e) { return fail("typed_data"); } }
    if (!t || typeof t !== "object" || !t.domain || !t.types || !t.message || typeof t.primaryType !== "string") return fail("typed_data");
    const d = t.domain;
    if (d.name !== spec.domain.name || d.version !== spec.domain.version || d.salt !== undefined) return fail("not_in_catalog");
    if (Number(d.chainId) !== Number(chainId) || !spec.chainIds.includes(Number(chainId))) return fail("other_network");
    if (!ethers.isAddress(d.verifyingContract || "")) return fail("typed_data");
    if (Object.keys(d).sort().join() !== "chainId,name,verifyingContract,version") return fail("not_in_catalog");
    if (t.types.EIP712Domain !== undefined && fieldsOf(t.types.EIP712Domain) !== DOMAIN_FIELDS) return fail("not_in_catalog");
    const kind = spec.types[t.primaryType];
    if (!kind) return fail("not_in_catalog");
    // Only the domain and the one declared type: no hidden struct can change what is signed.
    const names = Object.keys(t.types).filter((k) => k !== "EIP712Domain");
    if (names.length !== 1 || names[0] !== t.primaryType || fieldsOf(t.types[t.primaryType]) !== kind.fields) return fail("not_in_catalog");
    let msg, digest;
    try {
      const types = { [t.primaryType]: t.types[t.primaryType] };
      digest = ethers.TypedDataEncoder.hash({ name: d.name, version: d.version, chainId: d.chainId, verifyingContract: d.verifyingContract }, types, t.message);
      msg = ethers.TypedDataEncoder.from(types).visit(t.message, (type, v) => (/^(u?int)/.test(type) ? BigInt(v) : v));
    } catch (e) { return fail("typed_data"); }
    if (msg.deadline !== undefined && Number(msg.deadline) < Date.now() / 1000) return fail("expired");
    if (!spec.madeBy) return fail("not_configured");
    void account; // the registry checks (ERC-1271) that the account is its owner
    return {
      ok: true, project: project.id, kind: "typedData", digest,
      title: T(`${project.name}: richiesta da firmare`, `${project.name}: a request to sign`),
      lines: [kind.describe(msg), T(`Registro ${short(d.verifyingContract)}.`, `Registry ${short(d.verifyingContract)}.`)],
      needs: [{ factory: spec.madeBy.factory, check: spec.madeBy.check, address: ethers.getAddress(d.verifyingContract) }],
    };
  }

  // ---------------------------------------------------------------------------------------------------------
  // Transactions (the account calls a project's contract; value always 0).
  // ---------------------------------------------------------------------------------------------------------

  function call({ chainId, to, data, value = 0n }, project = null) {
    if (!ethers.isAddress(to || "") || !ethers.isHexString(data) || data.length < 10) return fail("payload");
    if (BigInt(value || 0) !== 0n) return fail("value");
    const target = ethers.getAddress(to);
    const selector = data.slice(0, 10).toLowerCase();
    const list = project ? [project] : PROJECTS;
    for (const p of list) for (const c of p.contracts) {
      if (c.chainId !== Number(chainId)) continue;
      if (c.address && c.address !== target) continue;
      const fn = c.iface.getFunction(selector);
      if (!fn) continue;
      let args;
      try { args = c.iface.decodeFunctionData(fn, data); } catch (e) { return fail("payload"); }
      // The call must be exactly the encoding of its arguments (no trailing bytes).
      if (c.iface.encodeFunctionData(fn, args).toLowerCase() !== data.toLowerCase()) return fail("payload");
      const needs = c.madeBy ? [{ factory: c.madeBy.factory, check: c.madeBy.check, address: target }] : [];
      return {
        ok: true, project: p.id, kind: "call", fn: fn.format("sighash"),
        title: T(`${p.name}: operazione`, `${p.name}: operation`),
        lines: [c.functions[fn.format("sighash")](args), T(c.kind === "factory" ? "Contratto del progetto." : `Registro ${short(target)}.`, c.kind === "factory" ? "The project's contract." : `Registry ${short(target)}.`)],
        needs,
      };
    }
    return fail("not_in_catalog");
  }

  // The on-chain checks: each { factory, check: "isRegistry(address)", address } must answer true. false when one
  // answers no (or the contract refuses the question); throws when the network cannot be read, so the caller can
  // try another node or say so.
  async function verifyNeeds(provider, needs) {
    for (const n of needs || []) {
      const f = new ethers.Contract(n.factory, [`function ${n.check} view returns (bool)`], provider);
      let ok = false;
      try { ok = await f.getFunction(n.check)(n.address); }
      catch (e) { if (e && (e.code === "CALL_EXCEPTION" || e.code === "BAD_DATA")) ok = false; else throw e; }
      if (ok !== true) return false;
    }
    return true;
  }

  return { MAINNET, PROJECTS, projectForOrigin, projectById, parseSignIn, message, typedData, call, verifyNeeds };
});
