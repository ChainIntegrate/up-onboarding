// The client's page (index.html): how to create a ChainIntegrate account. The account is created in the
// extension (extension/), with an invitation code; this page only explains the steps and links the extension.
// An invitation link (creator.js invite) carries the code after "#": #invito=XXXX-XXXX-XXXX (or #invite=). The
// part after "#" is never sent to the server, so the code is in no server log; the page shows it with "Copy".
// Wording: no crypto term, in either language (test/e2e.js checks it).
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  // The extension's page on the Chrome Web Store, once published; until then the page says ChainIntegrate sends
  // the link.
  const INSTALL_URL = "https://github.com/ChainIntegrate/up-onboarding/releases/latest/download/chainintegrate-account.zip";

  let LANG = SiteUI.initialLang();
  const I18N = {
    it: {
      pageTitle: "Crea il tuo account ChainIntegrate",
      h1: "Crea il tuo account ChainIntegrate",
      subtitle: "Il tuo account per usare i servizi di ChainIntegrate, pronto in pochi minuti.",
      langToggleBtn: "English",
      howTitle: "Come si fa",
      s1: "Installa l'estensione ChainIntegrate Account",
      s1p: "Sul computer, in Chrome, Edge o Brave. È il tuo accesso all'account: non servono altri programmi né altre registrazioni.",
      s2: "Proteggi l'accesso e crea la copia di backup",
      s2p: "Scegli se sbloccare l'accesso con il blocco del computer (impronta, volto o PIN) o con una password. Poi l'estensione ti fa scaricare e controllare la <b>copia di backup</b>: senza, non si va avanti.",
      s3: "Scrivi il codice di invito",
      s3p: "Con il codice che ti ha dato ChainIntegrate, il nome e, se vuoi, una descrizione e un'immagine. L'account è pronto in circa un minuto.",
      installBtn: "Installa l'estensione",
      installSoon: "Il link per installare l'estensione te lo manda ChainIntegrate, insieme al codice di invito.",
      installHow: "<ol class=\"steps\"><li>Scarica il file e scompattalo in una cartella dove resterà e che <b>non</b> viene sincronizzata con OneDrive, iCloud o Dropbox: su Windows <b>%LOCALAPPDATA%\\ChainIntegrate</b> (scrivilo nella barra degli indirizzi di Esplora file), su Mac <b>Libreria / Application Support / ChainIntegrate</b>. Ne esce la cartella <b>chainintegrate-account</b>.</li><li>In Chrome apri <b>chrome://extensions</b> e attiva <b>Modalità sviluppatore</b> (in alto a destra).</li><li>Premi <b>Carica estensione non pacchettizzata</b> e scegli la cartella chainintegrate-account.</li></ol>Gli aggiornamenti te li segnala l'estensione stessa, che controlla anche, ogni volta che si apre, che i suoi file siano quelli pubblicati da ChainIntegrate.",
      faqTitle: "Da sapere",
      q1: "Il profilo è pubblico?",
      a1: "Sì: nome, descrizione e immagine sono visibili a chiunque. Non inserire dati che vuoi tenere riservati (indirizzo di casa, telefono personale, documenti). Potrai modificarli in seguito, ma le versioni precedenti restano consultabili.",
      q2: "Cos'è la copia di backup?",
      a2: "Un file, protetto da una password che scegli tu, che contiene il tuo accesso. Salvalo fuori dal computer (una chiavetta USB, l'archivio documenti dell'azienda) e tieni la password in un posto separato. <b>Non mandarli mai a nessuno</b>, nemmeno a ChainIntegrate: chi ha il file e la password può usare il tuo account.",
      q3: "Se perdo il computer?",
      a3: "Installi l'estensione sul computer nuovo, scegli \"ripristina dalla copia di backup\" e ritrovi il tuo account. Per usare l'account da due computer insieme, invece, aggiungi il secondo con \"Aggiungi questo computer a un account esistente\" (vedi la guida). Il tuo account è solo tuo: <b>senza la copia di backup nessuno può recuperarlo, nemmeno ChainIntegrate</b>.",
      guideBtn: "Leggi la guida completa",
      inviteTitle: "Il tuo codice di invito",
      inviteCopy: "Copia il codice",
      inviteCopied: "✅ Copiato",
      inviteNote: "Ti servirà al passo 3, nell'estensione. Vale per <b>un solo account</b> e scade dopo qualche settimana: non condividerlo.",
      q4: "Dove trovo il codice di invito?",
      a4: "Te lo dà ChainIntegrate. Vale per un solo account e scade dopo qualche settimana: se è scaduto, chiedine uno nuovo.",
      footerHtml: `ChainIntegrate · Servizi di integrazione dati per le aziende · <a href="https://t.me/Simone_1977_2" target="_blank" rel="noopener">Assistenza su Telegram</a> · <a href="guida.html">Guida</a> · <a href="privacy.html">Privacy</a> · <a href="https://github.com/ChainIntegrate/up-onboarding" target="_blank" rel="noopener">Codice sorgente</a>`,
    },
    en: {
      pageTitle: "Create your ChainIntegrate account",
      h1: "Create your ChainIntegrate account",
      subtitle: "Your account for ChainIntegrate's services, ready in a few minutes.",
      langToggleBtn: "Italiano",
      howTitle: "How it works",
      s1: "Install the ChainIntegrate Account extension",
      s1p: "On your computer, in Chrome, Edge or Brave. It is your access to the account: no other programs or sign-ups needed.",
      s2: "Protect the access and create the backup copy",
      s2p: "Choose whether to unlock the access with the computer's lock (fingerprint, face or PIN) or with a password. Then the extension has you download and check the <b>backup copy</b>: without it, you cannot go on.",
      s3: "Type the invitation code",
      s3p: "With the code ChainIntegrate gave you, the name and, if you like, a description and a picture. The account is ready in about a minute.",
      installBtn: "Install the extension",
      installSoon: "ChainIntegrate sends you the link to install the extension, together with the invitation code.",
      installHow: "<ol class=\"steps\"><li>Download the file and unzip it into a folder where it will stay and that is <b>not</b> synced with OneDrive, iCloud or Dropbox: on Windows <b>%LOCALAPPDATA%\\ChainIntegrate</b> (type it in File Explorer's address bar), on Mac <b>Library / Application Support / ChainIntegrate</b>. It gives the <b>chainintegrate-account</b> folder.</li><li>In Chrome open <b>chrome://extensions</b> and turn on <b>Developer mode</b> (top right).</li><li>Press <b>Load unpacked</b> and choose the chainintegrate-account folder.</li></ol>The extension itself tells you about updates, and each time it opens it checks that its files are the ones ChainIntegrate published.",
      faqTitle: "Good to know",
      q1: "Is the profile public?",
      a1: "Yes: name, description and picture can be seen by anyone. Do not enter anything you want to keep private (home address, personal phone, documents). You can change them later, but earlier versions remain viewable.",
      q2: "What is the backup copy?",
      a2: "A file, protected by a password you choose, holding your access. Save it outside the computer (a USB stick, the company's document archive) and keep the password somewhere else. <b>Never send them to anyone</b>, not even to ChainIntegrate: whoever has the file and the password can use your account.",
      q3: "What if I lose my computer?",
      a3: "Install the extension on the new computer, choose \"restore from the backup copy\" and you get your account back. To use the account from two computers at the same time, instead, add the second one with \"Add this computer to an existing account\" (see the guide). Your account is yours alone: <b>without the backup copy no one can recover it, not even ChainIntegrate</b>.",
      guideBtn: "Read the full guide",
      inviteTitle: "Your invitation code",
      inviteCopy: "Copy the code",
      inviteCopied: "✅ Copied",
      inviteNote: "You will need it at step 3, in the extension. It is good for <b>one account</b> and expires after a few weeks: do not share it.",
      q4: "Where do I get the invitation code?",
      a4: "ChainIntegrate gives it to you. It is good for one account and expires after a few weeks: if it has expired, ask for a new one.",
      footerHtml: `ChainIntegrate · Data integration services for companies · <a href="https://t.me/Simone_1977_2" target="_blank" rel="noopener">Support on Telegram</a> · <a href="guida.html">Guide</a> · <a href="privacy.html">Privacy</a> · <a href="https://github.com/ChainIntegrate/up-onboarding" target="_blank" rel="noopener">Source code</a>`,
    },
  };
  const t = (k) => I18N[LANG][k] ?? I18N.it[k];

  function applyI18n() {
    document.documentElement.lang = LANG;
    document.title = t("pageTitle");
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    $("langToggle").textContent = t("langToggleBtn");
  }
  $("langToggle").addEventListener("click", () => { LANG = LANG === "it" ? "en" : "it"; SiteUI.saveLang(LANG); applyI18n(); });
  // The invitation code from the link, shown as XXXX-XXXX-XXXX; anything else is ignored.
  const inviteFromLink = () => {
    const m = /(?:^|[#&])invit[oe]=([^&]*)/i.exec(location.hash || "");
    if (!m) return null;
    let raw = "";
    try { raw = decodeURIComponent(m[1]); } catch (e) { return null; }
    const c = raw.toUpperCase().replace(/[\s-]/g, "");
    return /^[0-9A-Z]{12}$/.test(c) ? `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}` : null;
  };
  const invite = inviteFromLink();
  if (invite) {
    $("inviteCode").textContent = invite; $("invitePanel").hidden = false;
    $("inviteCopy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(invite); $("inviteCopy").textContent = t("inviteCopied"); setTimeout(() => { $("inviteCopy").textContent = t("inviteCopy"); }, 2000); } catch (e) { /* select by hand */ }
    });
  }
  if (INSTALL_URL) { $("installLink").href = INSTALL_URL; $("installLink").hidden = false; $("installSoon").hidden = true; $("installHow").hidden = false; }
  applyI18n();
})();
