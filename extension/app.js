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
      integrityTitle: "Questa estensione è stata modificata",
      integrityHtml: "Alcuni file di questa estensione sul computer <b>non sono quelli pubblicati da ChainIntegrate</b>. Per sicurezza l'estensione non sblocca il tuo accesso. <b>Non scrivere qui nessuna password.</b> Togli l'estensione da chrome://extensions, scarica di nuovo la versione ufficiale da account.chainintegrate.it e, se serve, ripristina l'accesso dalla copia di backup. Avvisa ChainIntegrate.",
      integrityBlocked: "❌ L'estensione sul computer è stata modificata: per sicurezza non sblocca l'accesso. Leggi l'avviso in alto.",
      updateTitle: "È disponibile una nuova versione",
      updateText: (v) => `Hai la versione ${v.mine}, la più recente è la ${v.latest}. Per aggiornare: scarica il file, scompattalo nella stessa cartella di adesso sostituendo i file, poi in chrome://extensions premi "Ricarica" su ChainIntegrate Account. Il tuo accesso resta com'è.`,
      updateLink: "Scarica la nuova versione",
      createTitle: "Crea il tuo account",
      createHtml: "Il tuo accesso è pronto. Ora crea l'account con il <b>codice di invito</b> che ti ha dato ChainIntegrate: ci vuole circa un minuto.",
      inviteLabel: "Codice di invito",
      nameLabel: "Nome del profilo",
      namePh: "es. cantina-rossi",
      nameHint: "Solo lettere minuscole, numeri e trattini, da 3 a 32 caratteri: è il nome con cui ti trovano (@cantina-rossi). Il nome completo dell'azienda scrivilo nella descrizione.",
      nameOk: "✅ Il nome va bene.",
      nameBad: "❌ Solo lettere minuscole (a-z), numeri e trattini, da 3 a 32 caratteri, senza trattino all'inizio o alla fine.",
      noImage: "Nessuna immagine: il profilo sarà senza immagine.",
      descLabel: "Descrizione (facoltativa)",
      descPh: "Chi sei, cosa fai",
      avatarLabel: "Immagine o logo (facoltativo)",
      imgRemove: "Togli",
      imgBad: "❌ Questa immagine non si riesce a leggere: prova con un file JPG o PNG.",
      publicNote: "<b>Il profilo è pubblico</b>: chiunque può vederlo. Non inserire dati che vuoi tenere riservati. Potrai modificarlo in seguito, ma le versioni precedenti restano consultabili.",
      createBtn: "Crea il mio account",
      noInvite: "❌ Scrivi il codice di invito.",
      noName: "❌ Scrivi il nome.",
      creating: "Sto creando il tuo account: ci vuole circa un minuto. Non chiudere questa pagina.",
      err_invite_invalid: "❌ Il codice di invito non è valido. Controllalo, o chiedine uno a ChainIntegrate.",
      err_invite_used: "❌ Questo codice di invito è già stato usato.",
      err_invite_expired: "❌ Il codice di invito è scaduto: chiedine uno nuovo a ChainIntegrate.",
      err_rate_limited: "❌ Troppe richieste in poco tempo: riprova tra un minuto.",
      err_daily_limit: "❌ Oggi sono stati creati molti account: riprova domani, o scrivi a ChainIntegrate.",
      err_unavailable: "❌ Il servizio non è disponibile in questo momento: riprova tra qualche minuto.",
      err_bad_request: "❌ Alcuni dati non vanno bene: controlla il nome, la descrizione e l'immagine.",
      err_failed: (v) => `❌ Qualcosa non è andato a buon fine. Scrivi a ChainIntegrate indicando questo riferimento: ${v.ref || "—"}`,
      err_network: "❌ Non riesco a raggiungere ChainIntegrate: controlla la connessione a internet e riprova.",
      created: "✅ Il tuo account è pronto.",
      accountTitle: "Il tuo account",
      accountReadyHtml: "Puoi usarlo con i servizi di ChainIntegrate. Ricorda: la <b>copia di backup</b> è l'unico modo per rientrare se perdi questo computer.",
      profileLink: "Vedi il tuo profilo pubblico",
      deviceTitle: "Questo computer",
      codeHtml: "Il <b>codice</b> di questo computer. Non è segreto: ti serve solo se ChainIntegrate te lo chiede.",
      copyBtn: "Copia il codice",
      copied: "✅ Codice copiato.",
      cNameLabel: "Nome di questo computer",
      cNameHint: "Viene scritto nel tuo account accanto a questo dispositivo, così lo riconosci (es. PC ufficio, Portatile di Anna).",
      cNameDefault: "Computer",
      noDevName: "❌ Scrivi un nome per questo computer.",
      devNameLine: (v) => `Nel tuo account questo computer si chiama <b>${v.name}</b>.`,
      bkTitle: "Copia di backup",
      bkChecked: (v) => `✅ Copia di backup controllata il ${v.date}.`,
      checkBackupBtn: "Controlla la copia di backup",
      newBackupBtn: "Crea una nuova copia di backup",
      unlockPwLabel: "Password di questo computer",
      removeTitle: "Togli l'accesso da questo computer",
      removeNote: "Usalo se lasci questo computer. L'accesso resta nella copia di backup: potrai ripristinarlo su un altro computer.",
      removeAck: "Ho la copia di backup e la sua password.",
      removeBtn: "Togli l'accesso da questo computer",
      removeConfirm: (v) => `Stai per togliere da questo computer l'accesso${v.name ? ` all'account <b>${v.name}</b>` : ""} (codice ${v.code}). <b>Non si può annullare.</b> Potrai rientrare solo con il file della copia di backup e la sua password: se non li hai, l'account è perso per sempre, e nessuno, nemmeno ChainIntegrate, può recuperarlo.`,
      removeCancel: "Annulla",
      removeYes: "Sì, togli l'accesso",
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
      integrityTitle: "This extension has been modified",
      integrityHtml: "Some files of this extension on the computer <b>are not the ones ChainIntegrate published</b>. For safety the extension does not unlock your access. <b>Do not type any password here.</b> Remove the extension in chrome://extensions, download the official version again from account.chainintegrate.it and, if needed, restore the access from the backup copy. Tell ChainIntegrate.",
      integrityBlocked: "❌ The extension on the computer has been modified: for safety it does not unlock the access. Read the warning at the top.",
      updateTitle: "A new version is available",
      updateText: (v) => `You have version ${v.mine}, the latest is ${v.latest}. To update: download the file, unzip it into the same folder as now, replacing the files, then in chrome://extensions press "Reload" on ChainIntegrate Account. Your access stays as it is.`,
      updateLink: "Download the new version",
      createTitle: "Create your account",
      createHtml: "Your access is ready. Now create the account with the <b>invitation code</b> ChainIntegrate gave you: it takes about a minute.",
      inviteLabel: "Invitation code",
      nameLabel: "Profile name",
      namePh: "e.g. cantina-rossi",
      nameHint: "Lowercase letters, digits and hyphens only, 3 to 32 characters: the name you are found by (@cantina-rossi). Write the company's full name in the description.",
      nameOk: "✅ The name is fine.",
      nameBad: "❌ Lowercase letters (a-z), digits and hyphens only, 3 to 32 characters, no hyphen at the start or the end.",
      noImage: "No picture: the profile will have none.",
      descLabel: "Description (optional)",
      descPh: "Who you are, what you do",
      avatarLabel: "Picture or logo (optional)",
      imgRemove: "Remove",
      imgBad: "❌ This picture cannot be read: try a JPG or PNG file.",
      publicNote: "<b>The profile is public</b>: anyone can see it. Do not enter anything you want to keep private. You can change it later, but earlier versions remain viewable.",
      createBtn: "Create my account",
      noInvite: "❌ Type the invitation code.",
      noName: "❌ Type the name.",
      creating: "Creating your account: it takes about a minute. Do not close this page.",
      err_invite_invalid: "❌ The invitation code is not valid. Check it, or ask ChainIntegrate for one.",
      err_invite_used: "❌ This invitation code has already been used.",
      err_invite_expired: "❌ The invitation code has expired: ask ChainIntegrate for a new one.",
      err_rate_limited: "❌ Too many requests in a short time: try again in a minute.",
      err_daily_limit: "❌ Many accounts were created today: try again tomorrow, or write to ChainIntegrate.",
      err_unavailable: "❌ The service is not available right now: try again in a few minutes.",
      err_bad_request: "❌ Some details are not right: check the name, the description and the picture.",
      err_failed: (v) => `❌ Something went wrong. Write to ChainIntegrate with this reference: ${v.ref || "—"}`,
      err_network: "❌ ChainIntegrate cannot be reached: check the internet connection and try again.",
      created: "✅ Your account is ready.",
      accountTitle: "Your account",
      accountReadyHtml: "You can use it with ChainIntegrate's services. Remember: the <b>backup copy</b> is the only way back in if you lose this computer.",
      profileLink: "See your public profile",
      deviceTitle: "This computer",
      codeHtml: "This computer's <b>code</b>. It is not secret: you need it only if ChainIntegrate asks for it.",
      copyBtn: "Copy the code",
      copied: "✅ Code copied.",
      cNameLabel: "Name of this computer",
      cNameHint: "It is written in your account next to this device, so you recognise it (e.g. Office PC, Anna's laptop).",
      cNameDefault: "Computer",
      noDevName: "❌ Type a name for this computer.",
      devNameLine: (v) => `In your account this computer is called <b>${v.name}</b>.`,
      bkTitle: "Backup copy",
      bkChecked: (v) => `✅ Backup copy checked on ${v.date}.`,
      checkBackupBtn: "Check the backup copy",
      newBackupBtn: "Create a new backup copy",
      unlockPwLabel: "This computer's password",
      removeTitle: "Remove the access from this computer",
      removeNote: "Use it when you leave this computer. The access stays in the backup copy: you can restore it on another computer.",
      removeAck: "I have the backup copy and its password.",
      removeBtn: "Remove the access from this computer",
      removeConfirm: (v) => `You are about to remove from this computer the access${v.name ? ` to the account <b>${v.name}</b>` : ""} (code ${v.code}). <b>It cannot be undone.</b> You can get back in only with the backup file and its password: without them the account is lost for good, and no one, not even ChainIntegrate, can recover it.`,
      removeCancel: "Cancel",
      removeYes: "Yes, remove the access",
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
    if (!on) { $("removeBtn").disabled = !$("removeAck").checked; syncName(); }
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
  $("startNew").addEventListener("click", async () => { if (!(await guard())) return; endPending(); pending = { mode: "new" }; show("sProtect"); });
  $("startRestore").addEventListener("click", async () => { if (!(await guard())) return; endPending(); show("sRestore"); });
  document.querySelectorAll(".back").forEach((b) => b.addEventListener("click", () => { endPending(); show("sWelcome"); }));

  $("restoreBtn").addEventListener("click", async () => {
    if (!(await guard("restoreMsg"))) return;
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
    if (!(await guard("protectMsg"))) return;
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
    if (!(await guard("backupMsg"))) return;
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
    if (!(await guard("verifyMsg"))) return;
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
    // The computer's name as written in the account at its creation (BACKLOG item 7); unknown after a restore.
    const esc = (v) => String(v || "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    $("devNameLine").hidden = !(account.up && account.nameInAccount);
    if (account.up && account.nameInAccount) $("devNameLine").innerHTML = t("devNameLine", { name: esc(account.nameInAccount) });
    $("bkState").textContent = account.backupCheckedAt ? t("bkChecked", { date: fmt(account.backupCheckedAt) }) : "";
    const has = !!account.up;
    $("pCreate").hidden = has; $("pAccount").hidden = !has;
    $("createPwBox").hidden = has || account.record.method !== "password";
    if (has) renderAccount(); else findAccount();
    $("unlockBox").hidden = true;
    $("removeAck").checked = false; $("removeBtn").disabled = true; $("removeConfirm").hidden = true;
    if (!has) resetCreateForm();
  }
  $("copyCode").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(account.record.address); say("mainMsg", t("copied"), "line-ok"); } catch (e) { /* select by hand */ }
  });
  const oneLine = (v) => String(v || "").replace(/\s+/g, " ").trim().slice(0, 64);

  // ---- the account: created by ChainIntegrate's service with an invitation code (tools/creator)
  let avatar = null; // { dataUrl, w, h }, at most 512 px
  function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("image")); i.src = src; }); }
  async function resize(src, max) {
    const img = await loadImage(src);
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    const ctx = c.getContext("2d");
    // PNG when the picture has transparent pixels (a logo), JPEG otherwise (a photo); never WebP, which Universal
    // Everything does not show (BACKLOG item 4).
    const alpha = ctx.getImageData(0, 0, w, h).data;
    let transparent = false;
    for (let i = 3; i < alpha.length; i += 4) if (alpha[i] < 255) { transparent = true; break; }
    const dataUrl = transparent ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", 0.88);
    return { dataUrl, w, h };
  }
  function showAvatar() {
    const box = $("avatarPrev"); box.innerHTML = "";
    if (!avatar) { const n = document.createElement("span"); n.textContent = t("noImage"); box.appendChild(n); return; }
    const img = document.createElement("img"); img.src = avatar.dataUrl; img.alt = "";
    const rm = document.createElement("button"); rm.type = "button"; rm.className = "secondary"; rm.style.cssText = "width:auto; margin:0; padding:6px 10px; font-size:12px;"; rm.textContent = t("imgRemove");
    rm.addEventListener("click", () => { avatar = null; $("pAvatar").value = ""; showAvatar(); });
    box.append(img, rm);
  }
  // The form as new: also the file field, so the same picture chosen again is seen (BACKLOG item 3).
  function resetCreateForm() {
    avatar = null; $("pAvatar").value = ""; showAvatar(); syncName();
    if (!$("cName").value.trim()) $("cName").value = (account && account.name) || t("cNameDefault");
  }
  // The name: lowercase as it is typed; the rule of shared/request.js shown under the field and on the button.
  function syncName() {
    const v = $("pName").value;
    const ok = UPRequest.NAME_RE.test(v);
    $("nameHint").textContent = !v ? t("nameHint") : ok ? t("nameOk") : t("nameBad");
    $("nameHint").className = "note " + (!v ? "" : ok ? "line-ok" : "line-err");
    $("createBtn").disabled = !ok;
  }
  $("pName").addEventListener("input", () => {
    const el = $("pName"), pos = el.selectionStart, low = el.value.toLowerCase();
    if (low !== el.value) { el.value = low; el.setSelectionRange(pos, pos); }
    syncName();
  });
  $("pAvatar").addEventListener("change", async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    try {
      const src = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
      avatar = await resize(src, 512);
    } catch (e) { avatar = null; ev.target.value = ""; say("createMsg", t("imgBad"), "line-err"); }
    showAvatar();
  });

  // After a restore (or if the creation answer was lost), the account this key belongs to is asked to the service.
  let lookedUp = false;
  async function findAccount() {
    if (lookedUp || !CONFIG.lookup) return;
    lookedUp = true;
    try {
      const res = await fetch(CONFIG.lookup, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: account.record.address }) });
      if (!res.ok) return;
      const b = await res.json();
      if (!b.up || !ethers.isAddress(b.up) || account.up) return;
      await save({ ...account, up: ethers.getAddress(b.up), network: b.network || "lukso" });
      await showMain();
    } catch (e) { /* offline: the client can still create or try later */ }
  }

  function renderAccount() {
    const card = $("accountCard"); card.innerHTML = "";
    if (account.picture) { const img = document.createElement("img"); img.src = account.picture; img.alt = ""; card.appendChild(img); }
    const b = document.createElement("b"); b.textContent = account.profileName || ""; card.appendChild(b);
    $("profileLink").href = CONFIG.profileBase + account.up + (account.network === "lukso-testnet" ? "?network=testnet" : "");
  }

  $("createBtn").addEventListener("click", async () => {
    if (!(await guard("createMsg"))) return;
    if (!$("invite").value.trim()) { say("createMsg", t("noInvite"), "line-err"); return; }
    if (!$("pName").value.trim()) { say("createMsg", t("noName"), "line-err"); return; }
    if (!UPRequest.NAME_RE.test($("pName").value)) { say("createMsg", t("nameBad"), "line-err"); return; }
    const devName = oneLine($("cName").value);
    if (!devName) { say("createMsg", t("noDevName"), "line-err"); return; }
    busy(true, "createMsg");
    let network;
    try { network = (await (await fetch(CONFIG.health)).json()).network; } catch (e) { network = null; }
    if (!UPRequest.NETWORKS.includes(network)) { say("createMsg", t("err_network"), "line-err"); busy(false); return; }
    const { request, errors } = UPRequest.create({
      network,
      profile: { name: $("pName").value, description: $("pDesc").value, tags: [], links: [] },
      images: { avatar, cover: null },
      controllers: [{ address: account.record.address, name: devName, role: "admin" }],
    });
    if (errors.length) { say("createMsg", errors.includes("profile.nameRule") ? t("nameBad") : t("err_bad_request"), "line-err"); busy(false); return; }
    let secret = null;
    try {
      // The request is signed with this computer's key, unlocked as usual: the service creates the account only
      // for a key its owner holds.
      const unlock = account.record.method === "secret" ? { secret: (secret = await Passkey.secret(account.record.meta)) } : { password: $("createPw").value };
      const signature = await K.withKey(account.record, unlock, (sk) => sk.sign(ethers.hashMessage(UPRequest.signingMessage(request))).serialized);
      $("createPw").value = "";
      say("createMsg", t("creating"), "line-dim");
      let res, body;
      try {
        const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 300000);
        res = await fetch(CONFIG.service, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ invite: $("invite").value.trim(), request, signature }), signal: ctl.signal });
        clearTimeout(timer);
        body = await res.json().catch(() => ({}));
      } catch (e) { throw Object.assign(new Error(t("err_network")), { shown: true }); }
      if (!res.ok) {
        if (body.error === "bad_request" && Array.isArray(body.problems) && body.problems.includes("profile.nameRule")) throw Object.assign(new Error(t("nameBad")), { shown: true });
        const key = "err_" + (body.error || "unavailable");
        const msg = body.error === "failed" ? t("err_failed", { ref: (body.tx || "").slice(0, 18) }) : I18N[LANG][key] ? t(key) : t("err_unavailable");
        throw Object.assign(new Error(msg), { shown: true });
      }
      await save({ ...account, up: body.up, network: body.network || network, profileName: request.profile.name, name: devName, nameInAccount: devName, picture: avatar ? (await resize(avatar.dataUrl, 128)).dataUrl : null, createdAt: new Date().toISOString() });
      $("invite").value = ""; $("pName").value = ""; $("pDesc").value = ""; resetCreateForm();
      await showMain();
      say("mainMsg", t("created"), "line-ok");
    } catch (e) { say("createMsg", explain(e), "line-err"); } finally { if (secret) K.wipe(secret); busy(false); }
  });

  $("checkBackup").addEventListener("click", () => { endPending(); verifyMode = "check"; show("sVerify"); $("verifyAgain").hidden = true; });

  // A new backup copy needs the key: unlocked with the computer's lock or this computer's password.
  async function startRenew(password) {
    if (!(await guard("mainMsg"))) return;
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
  // Removal in two steps (BACKLOG item 1): the checkbox, then a confirmation that names the account; "Cancel"
  // has the focus.
  $("removeBtn").addEventListener("click", () => {
    if (!$("removeAck").checked) return;
    const esc = (v) => String(v || "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    $("removeConfirmText").innerHTML = t("removeConfirm", { name: esc(account.profileName), code: esc(account.record.address) });
    $("removeConfirm").hidden = false;
    $("removeCancel").focus();
  });
  $("removeCancel").addEventListener("click", () => { $("removeConfirm").hidden = true; $("removeAck").checked = false; $("removeBtn").disabled = true; });
  $("removeYes").addEventListener("click", async () => {
    if (!$("removeAck").checked || $("removeConfirm").hidden) return;
    await store.del(); account = null; endPending();
    $("removeConfirm").hidden = true;
    show("sWelcome");
  });

  // ---- language
  function applyI18n() {
    document.documentElement.lang = LANG;
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.getAttribute("data-i18n-placeholder")); });
    $("langToggle").textContent = t("langToggleBtn");
    if (latest) showUpdate();
    if (account && !account.up) { syncName(); showAvatar(); }
    if (account && !$("sMain").hidden) $("bkState").textContent = account.backupCheckedAt ? t("bkChecked", { date: fmt(account.backupCheckedAt) }) : "";
  }
  $("langToggle").addEventListener("click", () => { LANG = LANG === "it" ? "en" : "it"; SiteUI.saveLang(LANG); applyI18n(); });

  // ---- integrity (Cross_Chain audit EXT-06): Chrome does not check an extension loaded from a folder, so the
  // extension compares its own code (html, js, json) with the SHA-256 that ChainIntegrate's site publishes for this
  // version, and refuses to unlock the key, or to read a backup and its password, when a file differs. It catches a
  // corrupted, half-updated or crudely modified copy; code rewritten on purpose could also rewrite this check, so the
  // complete protection is the Chrome Web Store (Chrome verifies its files) and tools/verify-extension.js from outside.
  // When the list cannot be fetched (offline), the extension works and the check runs again at the next opening.
  const integrity = { state: "pending", bad: [] };
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  async function checkIntegrity() {
    let text;
    try {
      const res = await fetch(CONFIG.sums + chrome.runtime.getManifest().version + "/SHA256SUMS", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      text = await res.text();
    } catch (e) { integrity.state = "unknown"; return; }
    const bad = [];
    for (const line of text.split("\n")) {
      const m = line.match(/^([0-9a-f]{64}) {2}chainintegrate-account\/(.+\.(?:js|html|json))$/);
      if (!m) continue;
      try {
        const got = hex(await crypto.subtle.digest("SHA-256", await (await fetch(chrome.runtime.getURL(m[2]), { cache: "no-store" })).arrayBuffer()));
        if (got !== m[1]) bad.push(m[2]);
      } catch (e) { bad.push(m[2]); }
    }
    integrity.state = bad.length ? "bad" : "ok";
    integrity.bad = bad;
    if (bad.length) { $("integrityBox").hidden = false; $("integrityFiles").textContent = bad.join(", "); }
  }
  const integrityReady = checkIntegrity();
  // true when the key may be used; otherwise says why, in the message box of the screen.
  async function guard(msgId) {
    await integrityReady;
    if (integrity.state !== "bad") return true;
    if (msgId) say(msgId, t("integrityBlocked"), "line-err");
    window.scrollTo(0, 0);
    return false;
  }

  // ---- updates: the service announces the latest version (the one in its clone of the repository)
  const newer = (a, b) => { const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
  let latest = null;
  function showUpdate() {
    const mine = chrome.runtime.getManifest().version;
    const show = !!latest && newer(latest.version, mine) && /^https:\/\/github\.com\/ChainIntegrate\//.test(latest.download);
    $("updateBox").hidden = !show;
    if (show) { $("updateText").textContent = t("updateText", { mine, latest: latest.version }); $("updateLink").href = latest.download; }
  }
  async function checkUpdate() {
    try { const b = await (await fetch(CONFIG.health)).json(); latest = b.extension && /^\d+\.\d+\.\d+$/.test(b.extension.version) ? b.extension : null; } catch (e) { latest = null; }
    showUpdate();
  }

  (async () => {
    applyI18n();
    checkUpdate();
    account = await store.get();
    if (account && account.record) await showMain(); else show("sWelcome");
  })();
})();
