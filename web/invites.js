// The invitations page (invites.html), for ChainIntegrate only: makes an invitation code and the message to send the
// client, lists the codes and revokes an open one. The account service (tools/creator, /api/admin/*) accepts it only
// from a key in its configuration (`operators`): the page connects a wallet (EIP-6963), asks a sign-in message for
// its address, has it signed (personal_sign; an account's signature is checked with ERC-1271) and keeps the session
// token in this tab only (sessionStorage), for 8 hours. The code is answered once and stored nowhere but as a hash:
// copy the message before leaving the page. No private key here, no other site contacted.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const API = "/api/admin/";
  const SITE = "account.chainintegrate.it";
  let LANG = SiteUI.initialLang();
  const I18N = {
    it: {
      langToggleBtn: "English",
      h1: "Inviti",
      subtitle: "Riservata a ChainIntegrate: crea i codici di invito e il messaggio da mandare ai clienti.",
      signInTitle: "Accedi",
      signInNote: "Collega il wallet con un account di ChainIntegrate abilitato (<b>operators</b> nella configurazione del servizio) e firma il messaggio di accesso: non è una transazione. L'accesso dura 8 ore, in questa scheda.",
      signInBtn: "Collega il wallet e accedi",
      pickWallet: "Scegli il wallet:",
      noWallet: "❌ Nessun wallet trovato nel browser (estensione LUKSO, UP Wallet o un altro EIP-6963).",
      signing: "Firma il messaggio nel wallet…",
      err_not_an_operator: "❌ Questo account non è abilitato agli inviti (operators nella configurazione del servizio).",
      err_bad_signature: "❌ La firma non corrisponde all'account.",
      err_challenge_expired: "❌ Il messaggio è scaduto: riprova.",
      err_disabled: "❌ Gli inviti dalla pagina non sono attivi sul servizio (operators vuoto).",
      err_signed_out: "Sessione scaduta: accedi di nuovo.",
      err_daily_limit: "❌ Raggiunto il limite di inviti per oggi (maxInvitesPerDay).",
      err_rate_limited: "❌ Troppe richieste: riprova tra un minuto.",
      err_not_open: "❌ Questo codice non è più aperto.",
      err_bad_request: "❌ Controlla i giorni (da 1 a 90).",
      err_other: "❌ Il servizio non risponde: riprova.",
      rejected: "Firma annullata.",
      newTitle: "Nuovo invito",
      noteLabel: "Nota (per te: l'azienda, la persona)",
      daysLabel: "Valido per (giorni)",
      langLabel: "Lingua del messaggio",
      createBtn: "Crea l'invito",
      creating: "Creo l'invito…",
      onceNote: "⚠️ Il codice si vede <b>solo adesso</b>: il servizio ne conserva solo l'impronta. Copia il messaggio prima di uscire.",
      textLabel: "Messaggio da mandare al cliente",
      copyText: "Copia il messaggio",
      copyLink: "Copia solo il link",
      copied: "✅ Copiato",
      listTitle: "Inviti",
      thNote: "Nota", thState: "Stato", thDates: "Creato · scade", thAccount: "Account",
      st_open: "aperto", st_used: "usato", st_revoked: "revocato", st_expired: "scaduto", st_review: "da controllare", st_creating: "in creazione",
      revoke: "Revoca",
      revokeAsk: (v) => `Revocare il codice "${v}"? Non potrà più creare un account.`,
      revoked: "✅ Codice revocato.",
      empty: "Nessun invito.",
      who: (v) => `Accesso come ${v.op}, fino alle ${v.until}.`,
      signOut: "Esci",
      // The message for the client: no crypto term (they do not use crypto).
      text: (v) => `Buongiorno,\n\necco il suo invito per creare l'account ChainIntegrate:\n${v.link}\n\nApra il link dal computer, in Chrome, Edge o Brave, e segua i tre passi: installare l'estensione ChainIntegrate Account, proteggere l'accesso e creare la copia di backup, poi inserire il codice di invito.\n\nCodice di invito: ${v.code}\nVale per un solo account, fino al ${v.date}.\n\nPer qualsiasi dubbio risponda pure a questo messaggio.`,
    },
    en: {
      langToggleBtn: "Italiano",
      h1: "Invitations",
      subtitle: "ChainIntegrate only: makes invitation codes and the message to send clients.",
      signInTitle: "Sign in",
      signInNote: "Connect the wallet with a ChainIntegrate account allowed by the service (<b>operators</b> in its configuration) and sign the sign-in message: it is not a transaction. The session lasts 8 hours, in this tab.",
      signInBtn: "Connect the wallet and sign in",
      pickWallet: "Choose the wallet:",
      noWallet: "❌ No wallet found in the browser (LUKSO's extension, UP Wallet or another EIP-6963 one).",
      signing: "Sign the message in the wallet…",
      err_not_an_operator: "❌ This account may not make invitations (operators in the service's configuration).",
      err_bad_signature: "❌ The signature does not match the account.",
      err_challenge_expired: "❌ The message expired: try again.",
      err_disabled: "❌ Invitations from the page are off on the service (operators empty).",
      err_signed_out: "Session expired: sign in again.",
      err_daily_limit: "❌ Today's limit of invitations reached (maxInvitesPerDay).",
      err_rate_limited: "❌ Too many requests: try again in a minute.",
      err_not_open: "❌ This code is no longer open.",
      err_bad_request: "❌ Check the days (1 to 90).",
      err_other: "❌ The service does not answer: try again.",
      rejected: "Signature cancelled.",
      newTitle: "New invitation",
      noteLabel: "Note (for you: the company, the person)",
      daysLabel: "Valid for (days)",
      langLabel: "Language of the message",
      createBtn: "Make the invitation",
      creating: "Making the invitation…",
      onceNote: "⚠️ The code is shown <b>only now</b>: the service keeps only its fingerprint. Copy the message before leaving.",
      textLabel: "Message to send the client",
      copyText: "Copy the message",
      copyLink: "Copy the link only",
      copied: "✅ Copied",
      listTitle: "Invitations",
      thNote: "Note", thState: "State", thDates: "Made · expires", thAccount: "Account",
      st_open: "open", st_used: "used", st_revoked: "revoked", st_expired: "expired", st_review: "to check", st_creating: "creating",
      revoke: "Revoke",
      revokeAsk: (v) => `Revoke the code "${v}"? It will no longer create an account.`,
      revoked: "✅ Code revoked.",
      empty: "No invitations.",
      who: (v) => `Signed in as ${v.op}, until ${v.until}.`,
      signOut: "Sign out",
      text: (v) => `Hello,\n\nhere is your invitation to create your ChainIntegrate account:\n${v.link}\n\nOpen the link on your computer, in Chrome, Edge or Brave, and follow the three steps: install the ChainIntegrate Account extension, protect the access and create the backup copy, then type the invitation code.\n\nInvitation code: ${v.code}\nGood for one account, until ${v.date}.\n\nIf anything is unclear, just reply to this message.`,
    },
  };
  const t = (k, v) => { const x = I18N[LANG][k]; return typeof x === "function" ? x(v || {}) : x; };
  const say = (id, text, cls) => { $(id).textContent = text; $(id).className = "msg " + (cls || ""); };
  const store = {
    get: () => { try { return JSON.parse(sessionStorage.getItem("ci.invites.session") || "null"); } catch (e) { return null; } },
    set: (v) => { try { if (v) sessionStorage.setItem("ci.invites.session", JSON.stringify(v)); else sessionStorage.removeItem("ci.invites.session"); } catch (e) { /* this page only */ } },
  };
  let session = store.get();
  let last = null; // the invitation just made: { code, link, expires }
  let invites = [];

  function applyI18n() {
    document.documentElement.lang = LANG;
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    $("langToggle").textContent = t("langToggleBtn");
    render();
  }
  $("langToggle").addEventListener("click", () => { LANG = LANG === "it" ? "en" : "it"; SiteUI.saveLang(LANG); applyI18n(); });

  async function api(route, body) {
    let res, b;
    try { res = await fetch(API + route, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); b = await res.json().catch(() => ({})); }
    catch (e) { throw Object.assign(new Error(t("err_other")), { shown: true }); }
    if (!res.ok) {
      if (b.error === "signed_out") { session = null; store.set(null); render(); }
      throw Object.assign(new Error(I18N[LANG]["err_" + b.error] ? t("err_" + b.error) : t("err_other")), { shown: true });
    }
    return b;
  }

  // ---- sign in: a wallet (EIP-6963), a sign-in message for its address, signed, a session
  const announced = new Map();
  window.addEventListener("eip6963:announceProvider", (ev) => { const d = ev.detail; if (d && d.info && d.provider) announced.set(d.info.uuid || d.info.name, d); });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  const hexUtf8 = (s) => "0x" + [...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, "0")).join("");
  async function signIn(eip1193) {
    $("walletPick").innerHTML = "";
    $("signInBtn").disabled = true;
    try {
      const accounts = await eip1193.request({ method: "eth_requestAccounts" });
      const address = accounts && accounts[0];
      if (!address) throw new Error("no account");
      const ch = await api("challenge", { address });
      say("signInMsg", t("signing"), "line-dim");
      const signature = await eip1193.request({ method: "personal_sign", params: [hexUtf8(ch.message), address] });
      const s = await api("session", { nonce: ch.nonce, signature });
      session = { token: s.token, operator: s.operator, until: s.until };
      store.set(session);
      say("signInMsg", "", "");
      render();
      await refresh();
    } catch (e) {
      say("signInMsg", e && e.shown ? e.message : e && (e.code === 4001 || e.code === "ACTION_REJECTED") ? t("rejected") : t("err_other"), "line-err");
    } finally { $("signInBtn").disabled = false; }
  }
  $("signInBtn").addEventListener("click", () => {
    const list = [...announced.values()];
    if (!list.length && window.ethereum) list.push({ info: { name: "Browser wallet" }, provider: window.ethereum });
    if (!list.length) { say("signInMsg", t("noWallet"), "line-err"); return; }
    if (list.length === 1) { signIn(list[0].provider); return; }
    const box = $("walletPick"); box.innerHTML = "";
    const lbl = document.createElement("div"); lbl.className = "note"; lbl.textContent = t("pickWallet"); box.appendChild(lbl);
    for (const d of list) {
      const b = document.createElement("button"); b.type = "button"; b.className = "secondary"; b.textContent = d.info.name;
      b.addEventListener("click", () => signIn(d.provider)); box.appendChild(b);
    }
  });
  $("signOut").addEventListener("click", () => { session = null; store.set(null); last = null; invites = []; render(); });

  // ---- an invitation and its message
  const fmtDate = (iso, lang) => new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "it-IT", { day: "numeric", month: "long", year: "numeric" });
  function message() {
    if (!last) return "";
    const lang = $("lang").value === "en" ? "en" : "it";
    return I18N[lang].text({ link: last.link, code: last.code, date: fmtDate(last.expires, lang) });
  }
  $("lang").addEventListener("change", () => { $("rText").value = message(); });
  $("createBtn").addEventListener("click", async () => {
    $("createBtn").disabled = true; say("createMsg", t("creating"), "line-dim");
    try {
      const b = await api("invites", { token: session && session.token, action: "create", note: $("note").value, days: Number($("days").value) });
      if (!new RegExp(`^https://${SITE.replace(/\./g, "\\.")}/#invito=[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$`).test(b.link)) throw Object.assign(new Error(t("err_other")), { shown: true });
      last = { code: b.code, link: b.link, expires: b.expires };
      invites = b.invites || invites;
      $("note").value = "";
      say("createMsg", "", "");
      render();
    } catch (e) { say("createMsg", e.shown ? e.message : t("err_other"), "line-err"); } finally { $("createBtn").disabled = false; }
  });
  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); const was = btn.textContent; btn.textContent = t("copied"); setTimeout(() => { btn.textContent = was; }, 1500); } catch (e) { /* select by hand */ }
  }
  $("copyText").addEventListener("click", () => copy($("rText").value, $("copyText")));
  $("copyLink").addEventListener("click", () => { if (last) copy(last.link, $("copyLink")); });

  // ---- the list
  async function refresh() {
    try { invites = (await api("invites", { token: session && session.token, action: "list" })).invites || []; say("listMsg", "", ""); }
    catch (e) { say("listMsg", e.shown ? e.message : t("err_other"), "line-err"); }
    render();
  }
  async function revoke(i) {
    if (!window.confirm(t("revokeAsk", i.note || i.id))) return;
    try { invites = (await api("invites", { token: session && session.token, action: "revoke", id: i.id })).invites || invites; say("listMsg", t("revoked"), "line-ok"); }
    catch (e) { say("listMsg", e.shown ? e.message : t("err_other"), "line-err"); }
    render();
  }
  const short = (a) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");
  function render() {
    const on = !!(session && session.token && Date.parse(session.until) > Date.now());
    $("pSignIn").hidden = on; $("pWork").hidden = !on;
    if (!on) return;
    $("who").textContent = t("who", { op: session.operator, until: new Date(session.until).toLocaleTimeString(LANG === "en" ? "en-GB" : "it-IT", { hour: "2-digit", minute: "2-digit" }) });
    $("result").hidden = !last;
    if (last) { $("rCode").textContent = last.code; $("rLink").textContent = last.link; $("rText").value = message(); }
    const body = $("list"); body.innerHTML = "";
    if (!invites.length) { const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = 5; td.className = "note"; td.textContent = t("empty"); tr.appendChild(td); body.appendChild(tr); return; }
    for (const i of invites) {
      const tr = document.createElement("tr");
      const cell = (text, cls) => { const td = document.createElement("td"); td.textContent = text; if (cls) td.className = cls; tr.appendChild(td); return td; };
      cell(i.note || "—");
      cell(t("st_" + i.state) || i.state, "st-" + i.state);
      cell(`${fmtDate(i.created, LANG)} · ${fmtDate(i.expires, LANG)}`);
      const acc = cell("");
      if (i.up) { const a = document.createElement("a"); a.href = "https://universaleverything.io/" + i.up; a.target = "_blank"; a.rel = "noopener"; a.textContent = short(i.up); acc.appendChild(a); }
      const act = cell("");
      if (i.state === "open") { const b = document.createElement("button"); b.type = "button"; b.className = "secondary small"; b.textContent = t("revoke"); b.addEventListener("click", () => revoke(i)); act.appendChild(b); }
      body.appendChild(tr);
    }
  }

  applyI18n();
  if (session) refresh();
})();
