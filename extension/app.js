// The extension's page: the client's access to their ChainIntegrate account on this computer.
//
// The access is a key (shared/keystore.js) created here, kept only encrypted in the extension's storage and
// protected by the computer's lock (a passkey, passkey.js) or by a password. Its address is the "device code"
// the client gives ChainIntegrate (web/index.html), which makes it a main device of the account.
//
// The backup is required: during setup the key is saved on this computer only after the client has downloaded
// the backup file (the same key, encrypted with a password of their choice) and loaded it back with its
// password, so a file that cannot be opened is found at once, not when the computer is lost. The backup can be
// restored on any computer ("I already have an access"), and checked or made again at any time.
//
// Wording: the client does not use crypto and need not learn it; test/extension.js checks that no crypto
// term appears on this page, in either language.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const K = window.UPKeystore;
  const STORE = "account"; // chrome.storage.local: { record, name, created, backupCheckedAt }

  let LANG = SiteUI.initialLang();
  const I18N = {
    it: {
      h1: "Il tuo accesso ChainIntegrate",
      subtitle: "Su questo computer",
      langToggleBtn: "English",
      welcomeTitle: "Benvenuto",
      welcomeHtml: "Questa estensione è il tuo <b>accesso all'account ChainIntegrate</b> da questo computer. In pochi passi:<ol class=\"steps\"><li>scegli come proteggere l'accesso (il blocco del computer o una password);</li><li>crei la <b>copia di backup</b> e la controlli: ti serve se cambi computer o se questo si rompe;</li><li>mandi a ChainIntegrate il <b>codice</b> di questo computer.</li></ol>",
      startNewBtn: "Inizia: crea il tuo accesso",
      startRestoreBtn: "Ho già un accesso: ripristina dalla copia di backup",
      restoreTitle: "Ripristina dalla copia di backup",
      restoreHtml: "Scegli il file della copia di backup e scrivi la sua password. Ritroverai lo stesso accesso, con lo stesso codice.",
      backupFileLabel: "File della copia di backup",
      backupPwLabel: "Password della copia di backup",
      restoreBtn: "Ripristina",
      backBtn: "Indietro",
      protectTitle: "Proteggi l'accesso su questo computer",
      protectHtml: "Ogni volta che userai il tuo account, questo computer ti chiederà di sbloccare l'accesso.",
      howPasskey: "Con il blocco del computer",
      howPasskeyNote: "Impronta, volto o PIN del computer (Windows Hello, Touch ID), oppure il telefono. È il modo più comodo, se il computer lo permette.",
      howPassword: "Con una password",
      howPasswordNote: "Una password di almeno 12 caratteri, da scrivere ogni volta. Va bene su qualsiasi computer.",
      devPwLabel: "Password (almeno 12 caratteri)",
      pwAgainLabel: "Ripeti la password",
      continueBtn: "Continua",
      backupTitle: "Crea la copia di backup",
      backupHtml: "La copia di backup è un <b>file protetto da una password</b> che scegli ora. Con il file e la password puoi rientrare nel tuo account da un altro computer.<ul class=\"steps\"><li>Salva il file <b>fuori da questo computer</b>: una chiavetta USB, l'archivio documenti dell'azienda.</li><li>Annota la password in un posto sicuro, <b>separato dal file</b>.</li><li>Chi ha sia il file sia la password può usare il tuo account: non mandarli a nessuno, nemmeno a ChainIntegrate.</li></ul>",
      bkPwLabel: "Password della copia di backup (almeno 12 caratteri)",
      backupBtn: "Scarica la copia di backup",
      verifyTitle: "Controlla la copia di backup",
      verifyHtml: "Per essere sicuri che la copia funzioni, <b>caricala qui</b> dal posto in cui l'hai salvata e scrivi la sua password.",
      verifyBtn: "Controlla",
      downloadAgainBtn: "Scaricala di nuovo",
      mainTitle: "Il tuo accesso è pronto",
      codeHtml: "Questo è il <b>codice</b> di questo computer. Non è segreto: mandalo a ChainIntegrate, o usa il pulsante qui sotto per completare il tuo account.",
      copyBtn: "Copia il codice",
      copied: "✅ Codice copiato.",
      devNameLabel: "Nome di questo computer (lo vedrai nel tuo account)",
      devNamePh: "es. PC ufficio",
      accountBtn: "Completa il tuo account",
      noPageNote: "Manda il codice a ChainIntegrate, all'indirizzo che ti abbiamo indicato o su Telegram.",
      bkTitle: "Copia di backup",
      bkChecked: (v) => `✅ Copia di backup controllata il ${v.date}.`,
      checkBackupBtn: "Controlla la copia di backup",
      newBackupBtn: "Crea una nuova copia di backup",
      unlockPwLabel: "Password di questo computer",
      removeTitle: "Togli l'accesso da questo computer",
      removeNote: "Usalo se lasci questo computer. L'accesso resta nella copia di backup: potrai ripristinarlo su un altro computer.",
      removeAck: "Ho la copia di backup e la sua password.",
      removeBtn: "Togli l'accesso da questo computer",
      removed: "Accesso tolto da questo computer.",
      // messages
      working: "Un momento…",
      pwShort: "❌ La password deve avere almeno 12 caratteri.",
      pwDiffer: "❌ Le due password non sono uguali.",
      pwWrong: "❌ Password sbagliata.",
      noFile: "❌ Scegli il file della copia di backup.",
      badFile: "❌ Questo file non è una copia di backup ChainIntegrate.",
      otherBackup: "❌ Questa copia di backup è di un altro accesso, non di questo.",
      noPasskey: "Il blocco del computer non è disponibile qui. Usa una password.",
      passkeyCancelled: "Operazione annullata. Riprova, oppure usa una password.",
      failed: (v) => `❌ Non riuscito: ${v.err}`,
      backupSaved: "✅ Copia di backup scaricata. Ora controlliamo che funzioni.",
      verifyOk: "✅ La copia di backup funziona.",
      leaveWarning: "La configurazione non è finita: se chiudi ora, dovrai ricominciare.",
      backupFileName: "chainintegrate-copia-di-backup",
      backupLabel: (v) => `Copia di backup ChainIntegrate, ${v.date}`,
      footerHtml: `ChainIntegrate · <a href="https://t.me/Simone_1977_2" target="_blank" rel="noopener">Assistenza su Telegram</a>`,
    },
    en: {
      h1: "Your ChainIntegrate access",
      subtitle: "On this computer",
      langToggleBtn: "Italiano",
      welcomeTitle: "Welcome",
      welcomeHtml: "This extension is your <b>access to your ChainIntegrate account</b> from this computer. In a few steps:<ol class=\"steps\"><li>choose how to protect the access (the computer's lock or a password);</li><li>create the <b>backup copy</b> and check it: you need it if you change computer or this one breaks;</li><li>send ChainIntegrate this computer's <b>code</b>.</li></ol>",
      startNewBtn: "Start: create your access",
      startRestoreBtn: "I already have an access: restore from the backup copy",
      restoreTitle: "Restore from the backup copy",
      restoreHtml: "Choose the backup file and type its password. You will get the same access back, with the same code.",
      backupFileLabel: "Backup file",
      backupPwLabel: "Backup password",
      restoreBtn: "Restore",
      backBtn: "Back",
      protectTitle: "Protect the access on this computer",
      protectHtml: "Each time you use your account, this computer will ask you to unlock the access.",
      howPasskey: "With the computer's lock",
      howPasskeyNote: "The computer's fingerprint, face or PIN (Windows Hello, Touch ID), or your phone. The easiest way, if the computer allows it.",
      howPassword: "With a password",
      howPasswordNote: "A password of at least 12 characters, typed each time. Works on any computer.",
      devPwLabel: "Password (at least 12 characters)",
      pwAgainLabel: "Repeat the password",
      continueBtn: "Continue",
      backupTitle: "Create the backup copy",
      backupHtml: "The backup copy is a <b>file protected by a password</b> you choose now. With the file and the password you can get back into your account from another computer.<ul class=\"steps\"><li>Save the file <b>outside this computer</b>: a USB stick, the company's document archive.</li><li>Write the password down somewhere safe, <b>apart from the file</b>.</li><li>Whoever has both the file and the password can use your account: do not send them to anyone, not even to ChainIntegrate.</li></ul>",
      bkPwLabel: "Backup password (at least 12 characters)",
      backupBtn: "Download the backup copy",
      verifyTitle: "Check the backup copy",
      verifyHtml: "To be sure the copy works, <b>load it here</b> from where you saved it and type its password.",
      verifyBtn: "Check",
      downloadAgainBtn: "Download it again",
      mainTitle: "Your access is ready",
      codeHtml: "This is this computer's <b>code</b>. It is not secret: send it to ChainIntegrate, or use the button below to complete your account.",
      copyBtn: "Copy the code",
      copied: "✅ Code copied.",
      devNameLabel: "Name of this computer (you will see it in your account)",
      devNamePh: "e.g. Office PC",
      accountBtn: "Complete your account",
      noPageNote: "Send the code to ChainIntegrate, at the address we gave you or on Telegram.",
      bkTitle: "Backup copy",
      bkChecked: (v) => `✅ Backup copy checked on ${v.date}.`,
      checkBackupBtn: "Check the backup copy",
      newBackupBtn: "Create a new backup copy",
      unlockPwLabel: "This computer's password",
      removeTitle: "Remove the access from this computer",
      removeNote: "Use it when you leave this computer. The access stays in the backup copy: you can restore it on another computer.",
      removeAck: "I have the backup copy and its password.",
      removeBtn: "Remove the access from this computer",
      removed: "Access removed from this computer.",
      working: "One moment…",
      pwShort: "❌ The password must have at least 12 characters.",
      pwDiffer: "❌ The two passwords are not the same.",
      pwWrong: "❌ Wrong password.",
      noFile: "❌ Choose the backup file.",
      badFile: "❌ This file is not a ChainIntegrate backup copy.",
      otherBackup: "❌ This backup copy belongs to another access, not this one.",
      noPasskey: "The computer's lock is not available here. Use a password.",
      passkeyCancelled: "Cancelled. Try again, or use a password.",
      failed: (v) => `❌ Failed: ${v.err}`,
      backupSaved: "✅ Backup copy downloaded. Now let us check it works.",
      verifyOk: "✅ The backup copy works.",
      leaveWarning: "Setup is not finished: if you close now, you will have to start again.",
      backupFileName: "chainintegrate-backup-copy",
      backupLabel: (v) => `ChainIntegrate backup copy, ${v.date}`,
      footerHtml: `ChainIntegrate · <a href="https://t.me/Simone_1977_2" target="_blank" rel="noopener">Support on Telegram</a>`,
    },
  };
  const t = (k, v) => { const x = I18N[LANG][k] ?? I18N.it[k]; return typeof x === "function" ? x(v || {}) : x; };

  // ---- state
  let account = null; // what is stored
  // The setup or the backup in progress, in memory only: { mode: "new" | "restore" | "renew", privateKey,
  // address, deviceRecord, backupJson }. The private key is wiped as soon as it is no longer needed.
  let pending = null;
  let verifyMode = null; // "setup" | "check"

  const store = {
    get: async () => (await chrome.storage.local.get(STORE))[STORE] || null,
    set: (v) => chrome.storage.local.set({ [STORE]: v }),
    del: () => chrome.storage.local.remove(STORE),
  };
  const today = () => new Date().toLocaleDateString(LANG === "en" ? "en-GB" : "it-IT", { day: "numeric", month: "long", year: "numeric" });
  const fmt = (iso) => new Date(iso).toLocaleDateString(LANG === "en" ? "en-GB" : "it-IT", { day: "numeric", month: "long", year: "numeric" });

  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => { s.hidden = s.id !== id; });
    document.querySelectorAll(".msg").forEach((m) => { m.textContent = ""; m.className = "msg"; });
    window.scrollTo(0, 0);
  }
  function say(id, text, cls) { const m = $(id); m.textContent = text; m.className = "msg " + (cls || ""); }
  function busy(on, id) {
    document.querySelectorAll("button").forEach((b) => { if (b.id !== "removeBtn") b.disabled = on; });
    if (!on) $("removeBtn").disabled = !$("removeAck").checked;
    if (on && id) say(id, t("working"), "line-dim");
  }
  function endPending() { if (pending && pending.privateKey) K.wipe(pending.privateKey); pending = null; }
  window.addEventListener("beforeunload", (e) => { if (pending && pending.mode !== "renew") { e.preventDefault(); e.returnValue = t("leaveWarning"); } });
  window.addEventListener("pagehide", endPending);

  async function readJsonFile(input) {
    const f = input.files && input.files[0];
    if (!f) throw Object.assign(new Error(t("noFile")), { shown: true });
    if (f.size > 64 * 1024) throw Object.assign(new Error(t("badFile")), { shown: true });
    try { return JSON.parse(await f.text()); } catch (e) { throw Object.assign(new Error(t("badFile")), { shown: true }); }
  }
  // The message for an error of the key store or of a file.
  function explain(e) {
    if (e && e.shown) return e.message;
    if (e && e.code === "WRONG_SECRET") return t("pwWrong");
    if (e && (e.code === "BAD_BACKUP" || e.code === "BAD_RECORD")) return t("badFile");
    if (e && e.code === "WEAK_PASSWORD") return t("pwShort");
    if (e && e.code === "CANCELLED") return t("passkeyCancelled");
    if (e && e.code === "NO_PRF") return t("noPasskey");
    return t("failed", { err: (e && e.message) || String(e) });
  }
  function newPassword(a, b) {
    if ([...$(a).value].length < K.MIN_PASSWORD) return t("pwShort");
    if ($(a).value !== $(b).value) return t("pwDiffer");
    return null;
  }

  function download(json, name) {
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---- first start
  $("startNew").addEventListener("click", () => { endPending(); pending = { mode: "new" }; show("sProtect"); });
  $("startRestore").addEventListener("click", () => { endPending(); show("sRestore"); });
  document.querySelectorAll(".back").forEach((b) => b.addEventListener("click", () => { endPending(); show("sWelcome"); }));

  $("restoreBtn").addEventListener("click", async () => {
    busy(true, "restoreMsg");
    try {
      const rec = K.readBackup(await readJsonFile($("restoreFile")));
      const privateKey = await K.open(rec, { password: $("restorePw").value });
      endPending();
      pending = { mode: "restore", privateKey, address: rec.address };
      $("restorePw").value = ""; $("restoreFile").value = "";
      show("sProtect");
    } catch (e) { say("restoreMsg", explain(e), "line-err"); } finally { busy(false); }
  });

  // ---- protect on this computer
  document.querySelectorAll("input[name=how]").forEach((r) => r.addEventListener("change", () => { $("pwBox").hidden = how() !== "password"; }));
  const how = () => document.querySelector("input[name=how]:checked").value;
  function usePassword() { document.querySelector("input[name=how][value=password]").checked = true; $("pwBox").hidden = false; }

  $("protectBtn").addEventListener("click", async () => {
    if (!pending) { show("sWelcome"); return; }
    if (how() === "password") { const bad = newPassword("devPw", "devPw2"); if (bad) { say("protectMsg", bad, "line-err"); return; } }
    busy(true, "protectMsg");
    let secret = null;
    try {
      if (pending.mode === "new" && !pending.privateKey) { const k = K.generate(); pending.privateKey = k.privateKey; pending.address = k.address; }
      let record;
      if (how() === "passkey") {
        const p = await Passkey.create();
        secret = p.secret;
        record = await K.sealWithSecret(pending.privateKey, secret, p.meta);
      } else {
        record = await K.sealWithPassword(pending.privateKey, $("devPw").value);
      }
      $("devPw").value = ""; $("devPw2").value = "";
      pending.deviceRecord = record;
      if (pending.mode === "restore") {
        // The backup has just been opened: it works.
        await save({ record, name: "", created: new Date().toISOString(), backupCheckedAt: new Date().toISOString() });
        endPending();
        await showMain();
      } else {
        show("sBackup");
      }
    } catch (e) {
      say("protectMsg", explain(e), e.code === "NO_PRF" || e.code === "CANCELLED" ? "line-warn" : "line-err");
      if (e.code === "NO_PRF") usePassword();
    } finally { if (secret) K.wipe(secret); busy(false); }
  });

  async function save(v) { await store.set(v); account = v; }

  // ---- the backup copy
  $("backupBtn").addEventListener("click", async () => {
    if (!pending || !pending.privateKey) { show(account ? "sMain" : "sWelcome"); return; }
    const bad = newPassword("bkPw", "bkPw2");
    if (bad) { say("backupMsg", bad, "line-err"); return; }
    busy(true, "backupMsg");
    try {
      const rec = await K.sealWithPassword(pending.privateKey, $("bkPw").value);
      $("bkPw").value = ""; $("bkPw2").value = "";
      pending.backupJson = JSON.stringify(K.backupFile(rec, { name: t("backupLabel", { date: today() }) }), null, 2);
      download(pending.backupJson, `${t("backupFileName")}-${new Date().toISOString().slice(0, 10)}.json`);
      // The key is no longer needed: the backup is checked from the file, against the address.
      K.wipe(pending.privateKey); pending.privateKey = null;
      verifyMode = "setup";
      show("sVerify");
      $("verifyAgain").hidden = false;
      say("verifyMsg", t("backupSaved"), "line-ok");
    } catch (e) { say("backupMsg", explain(e), "line-err"); } finally { busy(false); }
  });
  $("verifyAgain").addEventListener("click", () => {
    if (pending && pending.backupJson) download(pending.backupJson, `${t("backupFileName")}-${new Date().toISOString().slice(0, 10)}.json`);
  });

  $("verifyBtn").addEventListener("click", async () => {
    busy(true, "verifyMsg");
    try {
      const rec = K.readBackup(await readJsonFile($("verifyFile")));
      const want = verifyMode === "check" || (pending && pending.mode === "renew") ? account.record.address : pending.address;
      if (rec.address !== want) throw Object.assign(new Error(t("otherBackup")), { shown: true });
      K.wipe(await K.open(rec, { password: $("verifyPw").value }));
      $("verifyPw").value = ""; $("verifyFile").value = "";
      const now = new Date().toISOString();
      if (verifyMode === "setup" && pending && pending.mode === "new") {
        await save({ record: pending.deviceRecord, name: "", created: now, backupCheckedAt: now });
      } else {
        await save({ ...account, backupCheckedAt: now });
      }
      endPending();
      await showMain();
      say("mainMsg", t("verifyOk"), "line-ok");
    } catch (e) { say("verifyMsg", explain(e), "line-err"); } finally { busy(false); }
  });

  // ---- ready
  async function showMain() {
    show("sMain");
    $("code").textContent = account.record.address;
    $("devName").value = account.name || "";
    $("bkState").textContent = account.backupCheckedAt ? t("bkChecked", { date: fmt(account.backupCheckedAt) }) : "";
    $("noPage").hidden = !!CONFIG.accountPage;
    $("accountBtn").hidden = !CONFIG.accountPage;
    $("unlockBox").hidden = true;
    $("removeAck").checked = false; $("removeBtn").disabled = true;
  }
  $("copyCode").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(account.record.address); say("mainMsg", t("copied"), "line-ok"); } catch (e) { /* select by hand */ }
  });
  const oneLine = (v) => String(v || "").replace(/\s+/g, " ").trim().slice(0, 64);
  $("devName").addEventListener("change", async () => { await save({ ...account, name: oneLine($("devName").value) }); });
  $("accountBtn").addEventListener("click", () => {
    const u = new URL(CONFIG.accountPage);
    u.searchParams.set("code", account.record.address);
    if (account.name) u.searchParams.set("name", account.name);
    u.searchParams.set("lang", LANG);
    window.open(u.href, "_blank", "noopener");
  });

  $("checkBackup").addEventListener("click", () => { endPending(); verifyMode = "check"; show("sVerify"); $("verifyAgain").hidden = true; });

  // A new backup copy needs the key: unlocked with the computer's lock or this computer's password.
  async function startRenew(password) {
    busy(true, "mainMsg");
    let secret = null;
    try {
      const unlock = account.record.method === "secret" ? { secret: (secret = await Passkey.secret(account.record.meta)) } : { password };
      const privateKey = await K.open(account.record, unlock);
      endPending();
      pending = { mode: "renew", privateKey, address: account.record.address };
      $("unlockPw").value = "";
      verifyMode = "setup";
      show("sBackup");
    } catch (e) { say("mainMsg", explain(e), "line-err"); } finally { if (secret) K.wipe(secret); busy(false); }
  }
  $("newBackup").addEventListener("click", () => {
    if (account.record.method === "secret") startRenew();
    else { $("unlockBox").hidden = false; $("unlockPw").focus(); }
  });
  $("unlockBtn").addEventListener("click", () => startRenew($("unlockPw").value));

  $("removeAck").addEventListener("change", () => { $("removeBtn").disabled = !$("removeAck").checked; });
  $("removeBtn").addEventListener("click", async () => {
    if (!$("removeAck").checked) return;
    await store.del(); account = null; endPending();
    show("sWelcome");
  });

  // ---- language
  function applyI18n() {
    document.documentElement.lang = LANG;
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.getAttribute("data-i18n-placeholder")); });
    $("langToggle").textContent = t("langToggleBtn");
    if (account && !$("sMain").hidden) $("bkState").textContent = account.backupCheckedAt ? t("bkChecked", { date: fmt(account.backupCheckedAt) }) : "";
  }
  $("langToggle").addEventListener("click", () => { LANG = LANG === "it" ? "en" : "it"; SiteUI.saveLang(LANG); applyI18n(); });

  (async () => {
    applyI18n();
    account = await store.get();
    if (account && account.record) await showMain(); else show("sWelcome");
  })();
})();
