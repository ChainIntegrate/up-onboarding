// The catalog: what ChainIntegrate's projects may ask of a client's account, and how to say it in plain words.
//
// Read by the extension (which pages it serves, what it shows in its confirmation window, what it refuses) and by
// the account service (which calls it relays, paying the gas): one file, so the two never disagree
// (docs/integration.md, section 5). No browser or Node specific code: ethers 6 only.
//
//   UPCatalog.projectForOrigin(origin)                       the project serving that page, or null
//   UPCatalog.message(project, text, { origin, account, chainId })
//                                                            a sign-in message (personal_sign)
//   UPCatalog.typedData(project, typed, { account, chainId, current }) EIP-712 data (eth_signTypedData_v4); its
//                                                            `reads` name registry values for a precise description:
//   UPCatalog.readCurrent(provider, reads)                   read them, then typedData again with ctx.current
//   UPCatalog.call({ chainId, to, data, value }, project?)   a transaction from the account (eth_sendTransaction)
//   UPCatalog.verifyNeeds(provider, needs)                   the on-chain checks the three above ask for
//   UPCatalog.allowedCalls(chainId)                          the LSP6 AllowedCalls of an "access" key: the catalog's
//                                                            calls, the only ones the account lets that key make
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

  // GasTrace, the gas cylinder registry (gas-cylinder-registry): each supplier owns a registry, made by the
  // project's factory; as its owner the client signs EIP-712 requests that the project's own relayer sends.
  const CYLINDER_FACTORY = "0xA128e7162fa8Dc779bf31EF569F06B53a499A50e"; // GasCylinderRegistryFactory, LUKSO

  // GasTrace's registry data (ERC725Y keys written by SetData): the only keys an owner's SetData may write.
  const GCR = {
    WRAP_PASSWORD: "0xa75f4246186888da9c1e7e7e4264ec0efee6ca0ac1d7d25e7747653fc89884a1", // id("GCRKeyWrap:0"): the data password
    WRAP_RECOVERY: "0x70ad5f9434f4b7959e8544a0a3c1f02c8d6cc3cf9bf7d50f991b39849ef1d9e9", // id("GCRKeyWrap:1"): the recovery code
    SETTINGS: "0x7360ff3fd3307b001f63e23a6ceb3a235f0fc21dfbe6c1051df93ee2e08a16f2",      // id("GCRSettings")
    COUNTERPARTY: "0xb94f78e3e7196a6c35f70000",                                            // LSP2 Mapping "GCRCounterparty" + bytes20
    LSP4_METADATA: "0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e",   // the collection's public description
  };
  const empty = (v) => v === undefined || v === null || v === "0x" || v === "";
  // SetData: each key classified, the values checked against the signed hash (when the page sends them, as the
  // top-level "dataValues" of the request), the current values read from the registry (ctx.current, when given)
  // to tell a first setup from a change. { lines } or { error }.
  function describeSetData(m, typed, current) {
    const keys = m.dataKeys.map((k) => String(k).toLowerCase());
    if (!keys.length || new Set(keys).size !== keys.length) return { error: "typed_data" };
    let values = null;
    if (typed.dataValues !== undefined) {
      const v = typed.dataValues;
      if (!Array.isArray(v) || v.length !== keys.length || !v.every((x) => typeof x === "string" && ethers.isHexString(x))) return { error: "data_values" };
      let h;
      try { h = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["bytes[]"], [v])); } catch (e) { return { error: "data_values" }; }
      if (h.toLowerCase() !== String(m.dataValuesHash).toLowerCase()) return { error: "data_values_mismatch" };
      values = v.map((x) => x.toLowerCase());
    }
    const cur = (k) => (current ? current[k] : undefined);
    const known = current !== undefined && current !== null;
    const lines = [];
    let pw = null, rc = null, settings = null, meta = null;
    const cp = { added: 0, changed: 0, removed: 0, some: 0 };
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i], val = values ? values[i] : undefined;
      if (k === GCR.WRAP_PASSWORD) pw = { val };
      else if (k === GCR.WRAP_RECOVERY) rc = { val };
      else if (k === GCR.SETTINGS) settings = { val };
      else if (k === GCR.LSP4_METADATA) meta = { val };
      else if (k.startsWith(GCR.COUNTERPARTY) && k.length === 66) {
        if (!values) cp.some++;
        else if (empty(val)) cp.removed++;
        else if (known && !empty(cur(k))) cp.changed++;
        else if (known) cp.added++;
        else cp.some++;
      } else return { error: "unknown_data_key" };
    }
    // The data key's wraps: never deleted; both at once only the first time.
    if ((pw && values && empty(pw.val)) || (rc && values && empty(rc.val))) return { error: "wrap_deleted" };
    if (pw && rc) {
      if (known && (!empty(cur(GCR.WRAP_PASSWORD)) || !empty(cur(GCR.WRAP_RECOVERY)))) return { error: "wraps_both" };
      lines.push(Object.assign(T("Preparare la cifratura dei dati del registro: password e codice di recupero (prima volta)", "Prepare the encryption of the registry's data: password and recovery code (first time)"), { sensitive: true }));
    } else if (pw || rc) {
      const which = pw ? GCR.WRAP_PASSWORD : GCR.WRAP_RECOVERY;
      if (known && empty(cur(which))) return { error: "wrap_setup_incomplete" };
      lines.push(Object.assign(pw ? T("Cambiare la password dei dati", "Change the data password") : T("Cambiare il codice di recupero", "Change the recovery code"), { sensitive: true }));
    }
    if (settings) lines.push(values && empty(settings.val) ? T("Cancellare le impostazioni dell'azienda (nome e mail)", "Delete the company's settings (name and e-mail)") : T("Impostazioni dell'azienda (nome e mail)", "The company's settings (name and e-mail)"));
    const n = (x, one, many) => count(x, one, many);
    if (cp.added) lines.push(T(`Aggiungere ${n(cp.added, "cliente o centro di ricarica", "clienti o centri di ricarica")}`, `Add ${n(cp.added, "customer or refill centre", "customers or refill centres")}`));
    if (cp.changed) lines.push(T(`Modificare ${n(cp.changed, "cliente o centro di ricarica", "clienti o centri di ricarica")}`, `Change ${n(cp.changed, "customer or refill centre", "customers or refill centres")}`));
    if (cp.removed) lines.push(T(`Togliere ${n(cp.removed, "cliente o centro di ricarica", "clienti o centri di ricarica")}`, `Remove ${n(cp.removed, "customer or refill centre", "customers or refill centres")}`));
    if (cp.some) lines.push(T(`Aggiungere o modificare ${n(cp.some, "cliente o centro di ricarica", "clienti o centri di ricarica")}`, `Add or change ${n(cp.some, "customer or refill centre", "customers or refill centres")}`));
    if (meta) lines.push(values && empty(meta.val) ? T("Cancellare la descrizione pubblica della collezione", "Delete the collection's public description") : T("Descrizione pubblica della collezione (visibile a tutti)", "The collection's public description (visible to everyone)"));
    lines.push(T("I valori sono cifrati: qui si vede il tipo di modifica, non il contenuto.", "The values are encrypted: this shows the kind of change, not its content."));
    if (!values) lines.push(Object.assign(T("Contenuto non verificabile: la pagina non ha mandato i valori della modifica.", "Content not verifiable: the page did not send the change's values."), { sensitive: true }));
    // What to read from the registry for a precise description (a caller with a provider passes it back as ctx.current).
    const reads = keys.filter((k) => k === GCR.WRAP_PASSWORD || k === GCR.WRAP_RECOVERY || k.startsWith(GCR.COUNTERPARTY));
    if (pw || rc) for (const w of [GCR.WRAP_PASSWORD, GCR.WRAP_RECOVERY]) if (!reads.includes(w)) reads.push(w);
    return { lines, reads };
  }

  const PROJECTS = [
    {
      id: "traceability",
      name: "TraceabilityRegistry",
      sites: ["traceability.chainintegrate.it"],
      signIn: { header: "Ethereum account", statement: (s) => {
        const m = /^(.*) \[Operazione \/ Operation: ([^\]]+)\]$/.exec(s);
        if (!m || m[1] !== TRACE_STATEMENT || !TRACE_OPERATIONS[m[2]]) return null;
        const op = TRACE_OPERATIONS[m[2]];
        return T(`Conferma di essere tu, per ${op.it}.`, `Confirm it is you, to ${op.en}.`);
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
        return op ? T(`Conferma di essere tu, per ${op.it}.`, `Confirm it is you, to ${op.en}.`) : null;
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
      name: "GasTrace",
      sites: ["gastrace.chainintegrate.it"],
      typed: {
        domain: { name: "GasCylinderRegistry", version: "1" },
        // What the signature does, under the request (the window's note), and the longest validity accepted.
        note: T("Con questa conferma autorizzi questa modifica del registro; la registra il servizio GasTrace.", "With this confirmation you authorize this change of the registry; GasTrace's service records it."),
        maxValidity: 7 * 24 * 3600,
        // The registry accepts any signature its owner account accepts (ERC-1271), so any key of the account with
        // SIGN, an "access" one included (audit A01 / X-01): the extension asks for an administrator's computer.
        // GasTrace's own guard is for its next factory (decision of the maintainer, 2026-11-15).
        signer: "admin",
        madeBy: CYLINDER_FACTORY ? { factory: CYLINDER_FACTORY, check: "isRegistry(address)" } : null,
        chainIds: [MAINNET],
        types: {
          SetOperator: { fields: "address operator,bool enabled,uint256 nonce,uint256 deadline",
            describe: (m) => m.enabled ? T(`Autorizzare il telefono ${short(m.operator)} a registrare per te`, `Authorize the phone ${short(m.operator)} to record for you`)
              : T(`Togliere l'autorizzazione al telefono ${short(m.operator)}`, `Revoke the phone ${short(m.operator)}`) },
          SetData: { fields: "bytes32[] dataKeys,bytes32 dataValuesHash,uint256 nonce,uint256 deadline", setData: true },
          TransferOwnership: { fields: "address newOwner,uint256 nonce,uint256 deadline",
            describe: (m) => Object.assign(T(`Cedere il registro all'account ${short(m.newOwner)}. Non lo controllerai più.`, `Hand the registry over to the account ${short(m.newOwner)}. You will no longer control it.`), { sensitive: true }) },
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

  function typedData(project, typed, { account, chainId, current } = {}) {
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
    const now = Date.now() / 1000;
    if (msg.deadline !== undefined && Number(msg.deadline) < now) return fail("expired");
    if (msg.deadline !== undefined && spec.maxValidity && Number(msg.deadline) > now + spec.maxValidity) return fail("deadline_too_far");
    if (!spec.madeBy) return fail("not_configured");
    void account; // the registry checks (ERC-1271) that the account is its owner
    const registry = ethers.getAddress(d.verifyingContract);
    let what, reads = [];
    if (kind.setData) {
      const r = describeSetData(msg, t, current);
      if (r.error) return fail(r.error);
      what = r.lines; reads = r.reads;
    } else what = [kind.describe(msg)];
    const lines = [...what, T(`Registro ${short(registry)}.`, `Registry ${short(registry)}.`)];
    if (msg.deadline !== undefined) {
      const at = new Date(Number(msg.deadline) * 1000);
      const f = (loc) => at.toLocaleString(loc, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
      lines.push(T(`Valida fino al ${f("it-IT")}.`, `Valid until ${f("en-GB")}.`));
    }
    return {
      ok: true, project: project.id, kind: "typedData", digest,
      title: T(`${project.name}: richiesta da firmare`, `${project.name}: a request to sign`),
      lines, note: spec.note || null, signer: spec.signer || null,
      needs: [{ factory: spec.madeBy.factory, check: spec.madeBy.check, address: registry }],
      // Values to read from the registry for the precise description, when the caller has not given them yet
      // (UPCatalog.readCurrent, then typedData again with ctx.current).
      reads: current === undefined || current === null ? (reads.length ? [{ address: registry, keys: reads }] : []) : [],
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

  // The current values a description needs (typedData's `reads`), from the registry: { key: value } (lowercase), to
  // pass back as ctx.current. Throws when the network cannot be read.
  async function readCurrent(provider, reads) {
    const out = {};
    for (const r of reads || []) {
      const c = new ethers.Contract(r.address, ["function getDataBatch(bytes32[]) view returns (bytes[])"], provider);
      const vals = await c.getDataBatch(r.keys);
      r.keys.forEach((k, i) => { out[String(k).toLowerCase()] = String(vals[i] || "0x").toLowerCase(); });
    }
    return out;
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

  // The LSP6 AllowedCalls of an "access" key (shared/relay.js ACCESS_PERMS: CALL, not SUPER_CALL): one entry per
  // function of the catalog, call type CALL (value 0), the contract's address or, for the contracts made by a
  // project's factory (one per client), any address; any interface; the function's selector. CompactBytesArray of
  // 32-byte entries; "0x" when the network has none. The account refuses any other call from that key, whoever
  // sends it (audit A01 / X-01).
  const ANY_ADDRESS = "0xffffffffffffffffffffffffffffffffffffffff";
  function allowedCalls(chainId) {
    const out = [];
    for (const p of PROJECTS) for (const c of p.contracts) {
      if (c.chainId !== Number(chainId)) continue;
      for (const f of Object.keys(c.functions)) {
        const e = ethers.concat(["0x00000002", c.address || ANY_ADDRESS, "0xffffffff", c.iface.getFunction(f).selector]).toLowerCase();
        if (!out.includes(e)) out.push(e);
      }
    }
    return out.length ? ethers.concat(out.flatMap((e) => ["0x0020", e])).toLowerCase() : "0x";
  }

  return { MAINNET, PROJECTS, GCR, allowedCalls, projectForOrigin, projectById, parseSignIn, message, typedData, call, verifyNeeds, readCurrent };
});
