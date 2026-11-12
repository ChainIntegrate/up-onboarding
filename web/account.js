// The client's page (index.html): "Create your ChainIntegrate account".
//
// The client fills in the public profile and the codes of their access devices (the addresses of the keys
// created by ChainIntegrate's app or extension), then downloads the request file and sends it to ChainIntegrate,
// which creates the account with operator.html. The page writes the file with shared/request.js, the same
// format the operator's page reads. Nothing leaves the browser: the file is downloaded, never uploaded.
//
// Wording: this page is for people who do not use crypto and need not learn it. It speaks of an account,
// a profile, access devices and their codes; test/e2e.js checks that no crypto term appears in either language.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);

  let LANG = SiteUI.initialLang();
  const I18N = {
    it: {
      pageTitle: "Crea il tuo account ChainIntegrate",
      h1: "Crea il tuo account ChainIntegrate",
      subtitle: "Il tuo account per usare i servizi di ChainIntegrate: lo prepari qui, al resto pensiamo noi.",
      langToggleBtn: "English",
      panel0Title: "Come funziona",
      howHtml: "<ol class=\"steps\"><li><b>Compili il profilo</b>: la scheda con cui ti presenti nei servizi di ChainIntegrate (nome, descrizione, immagine, link).</li><li><b>Aggiungi i dispositivi</b> con cui accederai: il computer, il telefono.</li><li><b>Scarichi la richiesta</b> e la mandi a ChainIntegrate. Creiamo l'account e ti avvisiamo quando è pronto.</li></ol>Non ti servono altri account o registrazioni, e nessuna password viene mandata a nessuno: la richiesta contiene solo il profilo e i codici dei dispositivi.",
      publicNote: "<b>Il profilo è pubblico</b>: chiunque può vederlo. Non inserire dati che vuoi tenere riservati (indirizzo di casa, telefono personale, documenti). Potrai modificarlo in seguito, ma le versioni precedenti restano consultabili.",
      panel1Title: "1 · Il tuo profilo",
      nameLabel: "Nome (persona o azienda)",
      descLabel: "Descrizione",
      descPh: "Chi sei, cosa fai",
      tagsLabel: "Parole chiave, separate da virgole",
      tagsPh: "es. vino, agricoltura, Toscana",
      linksLabel: "Link, uno per riga: titolo | indirizzo",
      linksPh: "Sito | https://www.esempio.it\nLinkedIn | https://www.linkedin.com/company/esempio",
      avatarLabel: "Immagine o logo (facoltativo)",
      coverLabel: "Immagine di copertina (facoltativa)",
      imgRemove: "Togli",
      imgBad: "❌ Questa immagine non si riesce a leggere: prova con un file JPG o PNG.",
      panel2Title: "2 · I tuoi dispositivi di accesso",
      devNote: "Ogni dispositivo con cui accedi all'account ha un <b>codice</b>, che trovi nell'app o nell'estensione ChainIntegrate alla voce \"Codice del dispositivo\" (inizia con <b>0x</b>). Il codice non è segreto: puoi copiarlo e mandarlo tranquillamente.<ul style=\"margin:8px 0 0; padding-left:20px;\"><li><b>Principale</b>: accede e può aggiungere o togliere altri dispositivi.</li><li><b>Solo accesso</b>: usa l'account, ma non può gestire i dispositivi.</li></ul><div style=\"margin-top:8px;\">Il tuo account è solo tuo: <b>nessuno, nemmeno ChainIntegrate, può recuperarlo al posto tuo</b>. L'estensione ChainIntegrate ti fa creare una <b>copia di backup</b> del tuo accesso: con quella rientri anche se perdi il computer. Per più sicurezza puoi avere <b>due dispositivi principali</b>, tenuti in posti diversi. Se non hai ancora l'app o l'estensione, lascia vuoto: ti aiutiamo noi.</div>",
      addCtrlBtn: "+ Aggiungi un dispositivo",
      codePh: "Codice del dispositivo (0x…)",
      devNamePh: "Nome (es. PC ufficio, telefono)",
      roleAdmin: "Principale",
      roleDevice: "Solo accesso",
      removeBtn: "Togli",
      devNone: "Nessun dispositivo: ChainIntegrate ti aiuterà ad aggiungerli.",
      devBad: (v) => `❌ Dispositivo ${v.n}: il codice non è valido. Copialo di nuovo dall'app o dall'estensione.`,
      devDup: (v) => `❌ Dispositivo ${v.n}: questo codice c'è già.`,
      devNoMain: "❌ Serve almeno un dispositivo principale.",
      devOneMain: "⚠️ Un solo dispositivo principale: tieni con cura la sua copia di backup. Se perdi sia il dispositivo sia la copia, non potrai più gestire l'account.",
      devOk: (v) => `✅ ${v.n} dispositiv${v.n === 1 ? "o" : "i"}: ${v.a} principal${v.a === 1 ? "e" : "i"}, ${v.d} solo accesso.`,
      panel3Title: "3 · Manda la richiesta a ChainIntegrate",
      sendNote: "Scarica la richiesta (un piccolo file) e mandala a ChainIntegrate all'indirizzo che ti abbiamo indicato, o su Telegram. Puoi anche salvarla e riprenderla più tardi.",
      notChecked: "Compila il profilo per controllare la richiesta.",
      checkOk: "✅ La richiesta è completa.",
      checkName: "❌ Manca il nome.",
      checkLink: (v) => `❌ Il link alla riga ${v.n} non va: scrivilo come "Titolo | https://…".`,
      checkTags: "❌ Troppe parole chiave: al massimo 10.",
      checkDevices: "⚠️ Nessun dispositivo: puoi mandare lo stesso la richiesta, ti aiuteremo noi ad aggiungerli.",
      saveBtn: "Scarica la richiesta",
      saveBlocked: "❌ Correggi prima i punti segnati qui sopra.",
      doneHtml: "<b>✅ Richiesta scaricata.</b> Ora mandala a ChainIntegrate. Ti scriveremo quando l'account è pronto.",
      loadBtn: "Riprendi una richiesta salvata",
      loaded: "✅ Richiesta ripresa.",
      loadBad: "❌ Questo file non è una richiesta di questa pagina.",
      fileName: "richiesta-account-chainintegrate",
      footerHtml: `ChainIntegrate · Servizi di integrazione dati per le aziende · <a href="https://t.me/Simone_1977_2" target="_blank" rel="noopener">Assistenza su Telegram</a> · <a href="https://github.com/ChainIntegrate/up-onboarding" target="_blank" rel="noopener">Codice sorgente</a>`,
    },
    en: {
      pageTitle: "Create your ChainIntegrate account",
      h1: "Create your ChainIntegrate account",
      subtitle: "Your account for ChainIntegrate's services: you prepare it here, we take care of the rest.",
      langToggleBtn: "Italiano",
      panel0Title: "How it works",
      howHtml: "<ol class=\"steps\"><li><b>Fill in your profile</b>: how you present yourself in ChainIntegrate's services (name, description, picture, links).</li><li><b>Add the devices</b> you will sign in with: your computer, your phone.</li><li><b>Download the request</b> and send it to ChainIntegrate. We create the account and let you know when it is ready.</li></ol>You need no other accounts or sign-ups, and no password is sent to anyone: the request holds only the profile and the devices' codes.",
      publicNote: "<b>The profile is public</b>: anyone can see it. Do not enter anything you want to keep private (home address, personal phone, documents). You can change it later, but earlier versions remain viewable.",
      panel1Title: "1 · Your profile",
      nameLabel: "Name (person or company)",
      descLabel: "Description",
      descPh: "Who you are, what you do",
      tagsLabel: "Keywords, separated by commas",
      tagsPh: "e.g. wine, farming, Tuscany",
      linksLabel: "Links, one per line: title | address",
      linksPh: "Website | https://www.example.com\nLinkedIn | https://www.linkedin.com/company/example",
      avatarLabel: "Picture or logo (optional)",
      coverLabel: "Cover picture (optional)",
      imgRemove: "Remove",
      imgBad: "❌ This picture cannot be read: try a JPG or PNG file.",
      panel2Title: "2 · Your access devices",
      devNote: "Each device you sign in with has a <b>code</b>, shown in ChainIntegrate's app or extension under \"Device code\" (it starts with <b>0x</b>). The code is not secret: you can copy it and send it safely.<ul style=\"margin:8px 0 0; padding-left:20px;\"><li><b>Main</b>: signs in and can add or remove other devices.</li><li><b>Access only</b>: uses the account, but cannot manage devices.</li></ul><div style=\"margin-top:8px;\">Your account is yours alone: <b>no one, not even ChainIntegrate, can recover it for you</b>. ChainIntegrate's extension has you create a <b>backup copy</b> of your access: with it you get back in even if you lose the computer. For more safety you can have <b>two main devices</b>, kept in different places. If you do not have the app or the extension yet, leave this empty: we will help you.</div>",
      addCtrlBtn: "+ Add a device",
      codePh: "Device code (0x…)",
      devNamePh: "Name (e.g. Office PC, phone)",
      roleAdmin: "Main",
      roleDevice: "Access only",
      removeBtn: "Remove",
      devNone: "No devices: ChainIntegrate will help you add them.",
      devBad: (v) => `❌ Device ${v.n}: the code is not valid. Copy it again from the app or the extension.`,
      devDup: (v) => `❌ Device ${v.n}: this code is already there.`,
      devNoMain: "❌ At least one main device is needed.",
      devOneMain: "⚠️ Only one main device: keep its backup copy safe. If you lose both the device and the copy, you can no longer manage the account.",
      devOk: (v) => `✅ ${v.n} device${v.n === 1 ? "" : "s"}: ${v.a} main, ${v.d} access only.`,
      panel3Title: "3 · Send the request to ChainIntegrate",
      sendNote: "Download the request (a small file) and send it to ChainIntegrate at the address we gave you, or on Telegram. You can also save it and continue later.",
      notChecked: "Fill in the profile to check the request.",
      checkOk: "✅ The request is complete.",
      checkName: "❌ The name is missing.",
      checkLink: (v) => `❌ The link on line ${v.n} is not right: write it as "Title | https://…".`,
      checkTags: "❌ Too many keywords: at most 10.",
      checkDevices: "⚠️ No devices: you can still send the request, we will help you add them.",
      saveBtn: "Download the request",
      saveBlocked: "❌ First fix the points marked above.",
      doneHtml: "<b>✅ Request downloaded.</b> Now send it to ChainIntegrate. We will write to you when the account is ready.",
      loadBtn: "Continue a saved request",
      loaded: "✅ Request loaded.",
      loadBad: "❌ This file is not a request of this page.",
      fileName: "chainintegrate-account-request",
      footerHtml: `ChainIntegrate · Data integration services for companies · <a href="https://t.me/Simone_1977_2" target="_blank" rel="noopener">Support on Telegram</a> · <a href="https://github.com/ChainIntegrate/up-onboarding" target="_blank" rel="noopener">Source code</a>`,
    },
  };
  const t = (k, v) => { const x = I18N[LANG][k] ?? I18N.it[k]; return typeof x === "function" ? x(v || {}) : x; };

  // ?network=lukso-testnet: a test account (ChainIntegrate's own tests); otherwise the real one.
  const q = new URLSearchParams(location.search);
  const network = q.get("network") === "lukso-testnet" ? "lukso-testnet" : "lukso";

  const images = { avatar: null, cover: null };

  function line(el, text, cls) { const d = document.createElement("div"); d.className = cls || ""; d.style.whiteSpace = "pre-wrap"; d.textContent = text; el.appendChild(d); }
  function log(text, cls) { line($("log"), text, cls); }

  // ---- images: resized here (the request carries them), at most 512 px for the picture, 1200 for the cover
  function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("image")); i.src = src; }); }
  async function resize(src, max) {
    const img = await loadImage(src);
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    let dataUrl = c.toDataURL("image/webp", 0.85);
    if (!dataUrl.startsWith("data:image/webp")) dataUrl = c.toDataURL("image/jpeg", 0.85);
    return { dataUrl, w, h };
  }
  function showImage(kind) {
    const box = $(kind === "avatar" ? "avatarPrev" : "coverPrev");
    box.innerHTML = "";
    if (!images[kind]) return;
    const img = document.createElement("img"); img.src = images[kind].dataUrl; img.alt = "";
    const rm = document.createElement("button"); rm.type = "button"; rm.className = "secondary"; rm.style.cssText = "width:auto; margin:0; padding:6px 10px; font-size:12px;"; rm.textContent = t("imgRemove");
    rm.addEventListener("click", () => { images[kind] = null; $(kind === "avatar" ? "pAvatar" : "pCover").value = ""; showImage(kind); refresh(); });
    box.append(img, rm);
  }
  for (const [kind, max] of [["avatar", 512], ["cover", 1200]]) {
    $(kind === "avatar" ? "pAvatar" : "pCover").addEventListener("change", async (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      try {
        const src = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
        images[kind] = await resize(src, max);
      } catch (e) { images[kind] = null; ev.target.value = ""; log(t("imgBad"), "line-err"); }
      showImage(kind); refresh();
    });
  }

  // ---- devices
  function addRow(c) {
    const row = document.createElement("div"); row.className = "ctrl-row";
    const code = document.createElement("input"); code.type = "text"; code.className = "c-addr"; code.placeholder = t("codePh"); code.value = (c && c.address) || ""; code.autocomplete = "off"; code.spellcheck = false;
    const two = document.createElement("div"); two.className = "two";
    const name = document.createElement("input"); name.type = "text"; name.className = "c-name"; name.maxLength = 64; name.placeholder = t("devNamePh"); name.value = (c && c.name) || ""; name.autocomplete = "off";
    const role = document.createElement("select"); role.className = "c-role";
    [["admin", "roleAdmin"], ["device", "roleDevice"]].forEach(([v, k]) => { const o = document.createElement("option"); o.value = v; o.dataset.i18n = k; o.textContent = t(k); role.appendChild(o); });
    role.value = (c && c.role) || (document.querySelectorAll(".ctrl-row").length < 2 ? "admin" : "device");
    two.append(name, role);
    const rm = document.createElement("button"); rm.type = "button"; rm.className = "secondary"; rm.dataset.i18n = "removeBtn"; rm.textContent = t("removeBtn");
    rm.addEventListener("click", () => { row.remove(); refresh(); });
    [code, name, role].forEach((el) => el.addEventListener("input", refresh));
    row.append(code, two, rm);
    $("ctrlRows").appendChild(row);
  }
  const rows = () => [...document.querySelectorAll(".ctrl-row")].map((r) => ({
    address: r.querySelector(".c-addr").value.trim(), name: r.querySelector(".c-name").value, role: r.querySelector(".c-role").value,
  })).filter((r) => r.address || r.name.trim());
  $("addCtrl").addEventListener("click", () => { addRow(); refresh(); });

  // ---- the request, as shared/request.js builds it, and what to tell the client about it
  function fields() {
    const links = $("pLinks").value.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const cut = l.lastIndexOf("|");
      return cut > 0 ? { title: l.slice(0, cut).trim(), url: l.slice(cut + 1).trim() } : { title: "", url: l };
    });
    return {
      network,
      profile: { name: $("pName").value, description: $("pDesc").value, tags: $("pTags").value.split(","), links },
      images: { avatar: images.avatar, cover: images.cover },
      controllers: rows(),
    };
  }
  // { request, blocking: [text], notes: [[text, cls]] }
  function check() {
    const { request, errors } = UPRequest.create(fields());
    const blocking = [], devs = [];
    const idx = (e) => Number(e.split(".")[1]) + 1;
    for (const e of errors) {
      if (e === "profile.name") blocking.push(t("checkName"));
      else if (/^profile\.links\.\d+$/.test(e)) blocking.push(t("checkLink", { n: idx(e) }));
      else if (e === "profile.tags") blocking.push(t("checkTags"));
      else if (/^controllers\.\d+\.address$/.test(e)) devs.push(t("devBad", { n: idx(e) }));
      else if (/^controllers\.\d+\.duplicate$/.test(e)) devs.push(t("devDup", { n: idx(e) }));
      else if (e === "controllers.noAdmin") devs.push(t("devNoMain"));
    }
    const devNotes = devs.map((m) => [m, "line-err"]);
    const list = request.controllers;
    if (!rows().length) devNotes.push([t("devNone"), "empty"]);
    else if (!devs.length) {
      const a = list.filter((c) => c.role === "admin").length;
      devNotes.push([t("devOk", { n: list.length, a, d: list.length - a }), "line-ok"]);
      if (a === 1) devNotes.push([t("devOneMain"), "line-warn"]);
    }
    return { request, blocking: blocking.concat(devs), devNotes, noDevices: !rows().length };
  }
  function refresh() {
    $("doneBox").hidden = true;
    const c = check();
    $("ctrlStatus").innerHTML = ""; c.devNotes.forEach(([m, cls]) => line($("ctrlStatus"), m, cls));
    $("checkBox").innerHTML = "";
    if (!$("pName").value.trim() && !c.request.profile.description && !rows().length) { line($("checkBox"), t("notChecked"), "empty"); return c; }
    if (c.blocking.length) c.blocking.forEach((m) => line($("checkBox"), m, "line-err"));
    else line($("checkBox"), t("checkOk"), "line-ok");
    if (c.noDevices) line($("checkBox"), t("checkDevices"), "line-warn");
    return c;
  }
  ["pName", "pDesc", "pTags", "pLinks"].forEach((id) => $(id).addEventListener("input", refresh));

  $("saveBtn").addEventListener("click", () => {
    const c = refresh();
    if (c.blocking.length) { log(t("saveBlocked"), "line-err"); return; }
    const blob = new Blob([JSON.stringify(c.request, null, 2)], { type: "application/json" });
    const slug = c.request.profile.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${t("fileName")}${slug ? "-" + slug : ""}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    $("doneBox").hidden = false;
  });

  $("loadBtn").addEventListener("click", () => $("loadFile").click());
  $("loadFile").addEventListener("change", async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!f) return;
    try {
      if (f.size > 8 * 1024 * 1024) throw new Error("size");
      const { request: d, errors } = UPRequest.parse(JSON.parse(await f.text()));
      if (!d || errors.includes("kind") || errors.includes("version")) throw new Error("kind");
      $("pName").value = d.profile.name; $("pDesc").value = d.profile.description;
      $("pTags").value = d.profile.tags.join(", ");
      $("pLinks").value = d.profile.links.map((l) => `${l.title} | ${l.url}`).join("\n");
      for (const kind of ["avatar", "cover"]) {
        images[kind] = null;
        if (d.images[kind]) { try { images[kind] = await resize(d.images[kind].dataUrl, kind === "avatar" ? 512 : 1200); } catch (e) { /* dropped */ } }
        showImage(kind);
      }
      $("ctrlRows").innerHTML = "";
      d.controllers.forEach((c) => addRow(c));
      if (!document.querySelector(".ctrl-row")) addRow();
      refresh();
      log(t("loaded"), "line-ok");
    } catch (e) { log(t("loadBad"), "line-err"); }
  });

  function applyI18n() {
    document.documentElement.lang = LANG;
    document.title = t("pageTitle");
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.getAttribute("data-i18n-placeholder")); });
    document.querySelectorAll(".c-addr").forEach((el) => { el.placeholder = t("codePh"); });
    document.querySelectorAll(".c-name").forEach((el) => { el.placeholder = t("devNamePh"); });
    $("langToggle").textContent = t("langToggleBtn");
    showImage("avatar"); showImage("cover");
    refresh();
  }
  $("langToggle").addEventListener("click", () => { LANG = LANG === "it" ? "en" : "it"; SiteUI.saveLang(LANG); applyI18n(); });

  // ?code=0x…&name=…: a device code from ChainIntegrate's app or extension, filled in.
  const code = q.get("code");
  addRow(code && ethers.isAddress(code) ? { address: ethers.getAddress(code), name: UPRequest.oneLine(q.get("name"), 64), role: "admin" } : null);
  applyI18n();
  SiteUI.clampNotes({ min: 600 });
})();
