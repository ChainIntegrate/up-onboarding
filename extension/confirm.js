// The confirmation window: one request of a ChainIntegrate project's page (opened by background.js).
//
// It checks the request again against the catalog (shared/catalog.js), from the request itself and the page's
// origin as Chrome gave it, never from the page's words; it says in plain words what will happen, for which project,
// on which account; "Cancel" has the focus. On "Confirm" the key is unlocked (computer's lock or password), used once
// and wiped: a signature, or an operation that ChainIntegrate's service sends and pays for (LSP25, shared/relay.js).
// The answer goes to the page's tab; closing the window cancels.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const K = window.UPKeystore;
  const rid = new URLSearchParams(location.search).get("r") || "";
  let LANG = SiteUI.initialLang();
  const I18N = {
    it: {
      lang: "English", cancel: "Annulla", ok: "Conferma", okConnect: "Collega",
      connectTitle: "Collegare il tuo account a questo sito?",
      connectWhat: "Il sito vedrà l'indirizzo del tuo account. Non potrà fare nulla senza chiedertelo qui, ogni volta.",
      site: "Richiesto da", account: "Account",
      noteSign: "È una conferma: il tuo account non cambia.",
      noteCall: "L'operazione viene registrata a nome del tuo account.",
      pwLabel: "Password di questo computer",
      unlocking: "Sblocco l'accesso…", sending: "Invio in corso: può richiedere qualche secondo…",
      done: "✅ Fatto. Puoi tornare al sito.",
      gone: "Questa richiesta non è più valida. Torna al sito e riprova.",
      wrongAccount: "❌ Il sito chiede un account diverso da quello di questo computer.",
      notAllowed: "❌ Questa richiesta non è tra le operazioni previste per questo sito: non la confermare. ({r})",
      notProject: "❌ Il registro indicato non risulta creato da questo progetto: richiesta rifiutata.",
      adminOnly: "❌ Le richieste di {p} si confermano solo da un computer amministratore del tuo account. Questo computer ha un accesso.",
      integrity: "❌ L'estensione su questo computer è stata modificata: per sicurezza non sblocca l'accesso. Apri la pagina dell'estensione per le istruzioni.",
      WRONG_SECRET: "❌ Password sbagliata.", CANCELLED: "Sblocco annullato.", failed: "❌ Non è andata a buon fine: {e}",
      err_network: "ChainIntegrate non è raggiungibile.", err_refused: "l'operazione è stata rifiutata", err_daily_limit: "troppe operazioni oggi, riprova domani",
    },
    en: {
      lang: "Italiano", cancel: "Cancel", ok: "Confirm", okConnect: "Connect",
      connectTitle: "Connect your account to this site?",
      connectWhat: "The site will see your account's address. It cannot do anything without asking you here, each time.",
      site: "Asked by", account: "Account",
      noteSign: "It is a confirmation: your account does not change.",
      noteCall: "The operation is recorded in your account's name.",
      pwLabel: "This computer's password",
      unlocking: "Unlocking the access…", sending: "Sending: it may take a few seconds…",
      done: "✅ Done. You can go back to the site.",
      gone: "This request is no longer valid. Go back to the site and try again.",
      wrongAccount: "❌ The site asks for an account other than this computer's.",
      notAllowed: "❌ This request is not among the operations foreseen for this site: do not confirm it. ({r})",
      notProject: "❌ The registry given was not created by this project: request refused.",
      adminOnly: "❌ {p}'s requests are confirmed only from an administrator computer of your account. This computer has an access.",
      integrity: "❌ The extension on this computer has been modified: for safety it does not unlock the access. Open the extension's page for instructions.",
      WRONG_SECRET: "❌ Wrong password.", CANCELLED: "Unlock cancelled.", failed: "❌ It did not work: {e}",
      err_network: "ChainIntegrate cannot be reached.", err_refused: "the operation was refused", err_daily_limit: "too many operations today, try again tomorrow",
    },
  };
  const t = (k, v = {}) => String(I18N[LANG][k] || k).replace(/\{(\w+)\}/g, (_, x) => (x in v ? v[x] : ""));
  const say = (text, cls) => { $("msg").textContent = text; $("msg").className = "msg " + (cls || ""); };

  let req = null, account = null, said = null, answered = false;

  async function answer(payload) {
    if (answered) return;
    answered = true;
    await chrome.storage.session.remove("req:" + rid);
    try { await chrome.tabs.sendMessage(req.tabId, { kind: "response", id: req.id, ...payload }, { frameId: req.frameId }); } catch (e) { /* the tab is gone */ }
  }
  const cancel = async () => { if (req) await answer({ error: { code: 4001, message: "The request was cancelled." } }); window.close(); };

  // What the request is, from the catalog: { title, lines, kind, digest, needs, call }.
  function describe(current) {
    const project = UPCatalog.projectForOrigin(req.origin);
    if (!project || project.id !== req.project) return { error: "site" };
    const ctx = { origin: req.origin, account: req.account, chainId: req.chainId };
    const p = req.params || [];
    if (req.method === "eth_requestAccounts") return { ok: true, kind: "connect", title: { it: t("connectTitle"), en: t("connectTitle") }, lines: [], project };
    const same = (a) => typeof a === "string" && ethers.isAddress(a) && ethers.getAddress(a) === req.account;
    if (req.method === "personal_sign") {
      if (!same(p[1])) return { error: "other_account" };
      let text;
      try { text = ethers.isHexString(p[0]) ? ethers.toUtf8String(p[0]) : String(p[0]); } catch (e) { return { error: "not_text" }; }
      return { ...UPCatalog.message(project, text, ctx), projectName: project.name };
    }
    if (req.method === "eth_signTypedData_v4") {
      if (!same(p[0])) return { error: "other_account" };
      return { ...UPCatalog.typedData(project, p[1], { ...ctx, current }), projectName: project.name };
    }
    if (req.method === "eth_sendTransaction") {
      const tx = p[0] || {};
      if (!same(tx.from)) return { error: "other_account" };
      const data = tx.data !== undefined ? tx.data : tx.input;
      let value;
      try { value = BigInt(tx.value || 0); } catch (e) { return { error: "value" }; }
      const r = UPCatalog.call({ chainId: req.chainId, to: tx.to, data, value }, project);
      return r.ok ? { ...r, call: { to: ethers.getAddress(tx.to), data } } : r;
    }
    return { error: "method" };
  }

  function render() {
    document.documentElement.lang = LANG;
    $("langToggle").textContent = t("lang");
    $("cancel").textContent = t("cancel");
    if (!req) return;
    $("acct").textContent = `${t("account")} ${req.account.slice(0, 6)}…${req.account.slice(-4)}`;
    $("site").innerHTML = "";
    $("site").append(document.createTextNode(t("site") + " "), Object.assign(document.createElement("b"), { textContent: new URL(req.origin).host }));
    if (!said || !said.ok) return;
    $("title").textContent = said.kind === "connect" ? t("connectTitle") : said.title[LANG];
    const ul = $("what"); ul.innerHTML = "";
    const lines = said.kind === "connect" ? [{ it: t("connectWhat"), en: t("connectWhat") }] : said.lines;
    for (const l of lines) ul.appendChild(Object.assign(document.createElement("li"), { textContent: l[LANG], className: l.sensitive ? "sensitive" : "" }));
    // The project's own note when it has one (what its signature authorizes), else the kind's.
    $("note").textContent = said.note ? said.note[LANG] : said.kind === "call" ? t("noteCall") : said.kind === "connect" ? "" : t("noteSign");
    $("ok").textContent = said.kind === "connect" ? t("okConnect") : t("ok");
    $("pwLabel").textContent = t("pwLabel");
  }
  $("langToggle").addEventListener("click", () => { LANG = LANG === "it" ? "en" : "it"; SiteUI.saveLang(LANG); render(); });

  // A reading of the network: ChainIntegrate's node through the service, LUKSO's public node when it does not answer.
  async function onNetwork(fn) {
    const net = CONFIG.networks[req.network];
    const at = (url) => fn(new ethers.JsonRpcProvider(url, req.chainId, { staticNetwork: true, batchMaxCount: 1 }));
    try { return await at(net.rpc); } catch (e) { if (!net.fallback) throw e; return at(net.fallback); }
  }

  const postJson = async (url, body) => {
    let res, b;
    try { res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); b = await res.json().catch(() => ({})); }
    catch (e) { throw Object.assign(new Error(t("err_network")), { shown: true }); }
    if (!res.ok) throw Object.assign(new Error(I18N[LANG]["err_" + b.error] || b.reason || b.error || String(res.status)), { shown: true });
    return b;
  };
  // The operation through ChainIntegrate's service (as the extension's page does for the account's own changes).
  async function relaySend(sk, payload) {
    const signer = account.record.address;
    const n = await postJson(CONFIG.relayNonce, { account: req.account, signer });
    if (Number(n.chainId) !== Number(req.chainId)) throw Object.assign(new Error(t("err_refused")), { shown: true });
    // Valid from the start (0) until ten minutes after the network's time as the service reads it: the computer's
    // clock does not count (the Key Manager compares with the block's time).
    const base = Number.isInteger(n.time) && n.time > 0 ? n.time : Math.floor(Date.now() / 1000);
    const validity = UPRelay.validity(0, base + 600);
    const digest = UPRelay.digest({ chainId: n.chainId, keyManager: n.keyManager, nonce: BigInt(n.nonce), validity, payload });
    return postJson(CONFIG.relay, { account: req.account, nonce: n.nonce, validity: validity.toString(), payload, signature: sk.sign(digest).serialized });
  }

  $("ok").addEventListener("click", async () => {
    if (!said || !said.ok || answered) return;
    $("ok").disabled = true; $("cancel").disabled = true;
    let secret = null;
    try {
      if (said.kind === "connect") {
        const sites = (await chrome.storage.local.get("sites")).sites || {};
        sites[req.origin] = { account: req.account, at: new Date().toISOString() };
        await chrome.storage.local.set({ sites });
        await answer({ result: [req.account] });
        window.close();
        return;
      }
      if ((await Integrity.check()).state === "bad") { say(t("integrity"), "line-err"); return; }
      if (said.needs && said.needs.length) {
        const isProject = await onNetwork((pr) => UPCatalog.verifyNeeds(pr, said.needs));
        if (!isProject) { say(t("notProject"), "line-err"); await answer({ error: { code: 4100, message: "Not allowed by ChainIntegrate Account (not_a_project_contract)." } }); return; }
      }
      say(t("unlocking"), "line-dim");
      const unlock = account.record.method === "secret" ? { secret: (secret = await Passkey.secret(account.record.meta)) } : { password: $("pw").value };
      const result = await K.withKey(account.record, unlock, async (sk) => {
        if (said.kind !== "call") return sk.sign(said.digest).serialized;
        say(t("sending"), "line-dim");
        return (await relaySend(sk, UPRelay.projectCall(said.call.to, said.call.data))).tx;
      });
      $("pw").value = "";
      await answer({ result });
      say(t("done"), "line-ok");
      setTimeout(() => window.close(), 1200);
    } catch (e) {
      say(e && e.shown ? t("failed", { e: e.message }) : I18N[LANG][e && e.code] ? t(e.code) : t("failed", { e: String(e && e.message || e).slice(0, 120) }), "line-err");
      if (e && (e.code === "WRONG_SECRET" || e.code === "CANCELLED")) { $("ok").disabled = false; }
      else if (!answered) await answer({ error: { code: -32603, message: "The operation did not complete." } });
    } finally {
      if (secret) K.wipe(secret);
      $("cancel").disabled = false;
    }
  });
  $("cancel").addEventListener("click", cancel);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cancel(); });

  (async () => {
    render();
    req = (await chrome.storage.session.get("req:" + rid))["req:" + rid] || null;
    account = (await chrome.storage.local.get("account")).account || null;
    if (!req) { $("title").textContent = t("gone"); $("ok").hidden = true; return; }
    if (!account || !account.up || !account.record || ethers.getAddress(account.up) !== req.account) {
      said = null; render(); $("title").textContent = t("wrongAccount"); $("ok").hidden = true; await answer({ error: { code: 4100, message: "Not allowed by ChainIntegrate Account (other_account)." } }); return;
    }
    said = describe();
    // A request whose description depends on the registry's current values (GasTrace's SetData): read them, then
    // describe it again with them (a first setup, a change, a refusal).
    if (said.ok && said.reads && said.reads.length) {
      try { said = describe(await onNetwork((pr) => UPCatalog.readCurrent(pr, said.reads))); }
      catch (e) { said = { ok: false, error: "network_unreadable" }; }
    }
    // A project whose requests only an administrator's computer may sign (GasTrace: its registry accepts any key of the
    // account with SIGN, audit A01 / X-01): this computer's permissions read from the account.
    if (said.ok && said.signer === "admin") {
      try {
        const perms = await onNetwork((pr) => new ethers.Contract(req.account, ["function getData(bytes32) view returns (bytes)"], pr).getData(UPRelay.permKey(ethers.getAddress(account.record.address))));
        // An administrator can change the keys' permissions (EDITPERMISSIONS); an access cannot.
        if (!perms || perms === "0x" || (BigInt(perms) & 0x4n) === 0n) said = { ok: false, error: "admin_only", projectName: said.projectName };
      } catch (e) { said = { ok: false, error: "network_unreadable" }; }
    }
    if (said.error === "admin_only") {
      render(); $("box").classList.add("warn"); $("title").textContent = t("adminOnly", { p: said.projectName }); $("ok").hidden = true;
      await answer({ error: { code: 4100, message: "Not allowed by ChainIntegrate Account (admin_only)." } });
      return;
    }
    if (!said.ok) {
      render(); $("box").classList.add("warn"); $("title").textContent = t("notAllowed", { r: said.error }); $("ok").hidden = true;
      await answer({ error: { code: 4100, message: `Not allowed by ChainIntegrate Account (${said.error}).` } });
      return;
    }
    $("pwBox").hidden = said.kind === "connect" || account.record.method !== "password";
    render();
    // "Confirm" only once the request is described (a SetData waits for the registry's values).
    $("ok").hidden = false;
    $("cancel").focus();
  })();
})();
