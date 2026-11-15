// The privacy notice of the ChainIntegrate Account extension and of the account service (privacy.html).
// Modelled on Cross_Chain's UP Wallet notice (up-wallet-app-privacy.html): same controller, contacts, log retention
// and rights. Static text only: every string below is written in this file, none comes from outside.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let LANG = SiteUI.initialLang();
  const TG = `<a href="https://t.me/Simone_1977_2" target="_blank" rel="noopener">Telegram</a>`;
  const LI = `<a href="https://www.linkedin.com/company/chainintegrate" target="_blank" rel="noopener">LinkedIn</a>`;
  const ME = `<a href="https://www.linkedin.com/in/simone-cavalletti" target="_blank" rel="noopener">Simone Cavalletti</a>`;
  const I18N = {
    it: {
      pageTitle: "Informativa sulla privacy — ChainIntegrate Account",
      h1: "Informativa sulla privacy",
      subtitle: "Ultimo aggiornamento: 15 novembre 2026 (estensione 0.6.0). Riguarda l'estensione ChainIntegrate Account e il servizio degli account su account.chainintegrate.it. Le condizioni d'uso sono nei <a href=\"termini.html\">termini di servizio</a>.",
      langToggleBtn: "English",
      s1t: "1 · In breve",
      s1: `<ul>
        <li><b>La tua chiave resta sul tuo computer.</b> L'estensione crea la chiave del tuo accesso sul computer e la conserva solo cifrata. ChainIntegrate non la riceve e non ne ha una copia. La copia di backup è un file che salvi tu, protetto da una password che scegli tu.</li>
        <li><b>Nessuna password viene mandata a nessuno</b>, nemmeno a ChainIntegrate.</li>
        <li><b>Il profilo è pubblico e permanente.</b> Nome, descrizione, immagine e nomi dei computer vengono scritti in un registro pubblico (la blockchain LUKSO e il sistema di archiviazione IPFS): chiunque può leggerli, e anche dopo una modifica le versioni precedenti restano consultabili. È pubblico anche che l'account è stato creato tramite ChainIntegrate.</li>
        <li>Nessuna pubblicità, nessun tracciamento, nessuna statistica d'uso.</li>
      </ul>`,
      s2t: "2 · Chi è il titolare",
      s2: `Il titolare del trattamento è <b>${ME}</b>, che offre servizi di integrazione dati e blockchain con il nome <b>ChainIntegrate</b>: sviluppa l'estensione e gestisce il sito account.chainintegrate.it e il servizio degli account. Contatti per la privacy e per ogni richiesta: e-mail <b>info@chainintegrate.it</b>; anche ${TG} e la pagina ${LI} di ChainIntegrate. Non è stato nominato un responsabile della protezione dei dati (non è obbligatorio per questa attività).`,
      s3t: "3 · Cosa resta sul tuo computer",
      s3: `Nella memoria dell'estensione, sul computer:<ul>
        <li>la chiave del tuo accesso, solo cifrata (con il blocco del computer o con la password che hai scelto), e il suo indirizzo pubblico (il "codice del dispositivo");</li>
        <li>l'indirizzo del tuo account, il nome del profilo, una miniatura dell'immagine, il nome del computer, la data dell'ultimo controllo della copia di backup e l'elenco dei computer dell'account visto l'ultima volta (per avvisarti dei cambiamenti);</li>
        <li>i siti dei progetti ChainIntegrate a cui hai collegato l'account (si scollegano dalla pagina dell'estensione);</li>
        <li>la lingua e il tema scelti.</li>
      </ul>Restano sul computer: si cancellano con "Togli l'accesso da questo computer" o disinstallando l'estensione. Alcuni di questi dati (indirizzo dell'account, codice del dispositivo, nomi) passano anche dal servizio, nei casi del punto 4. La copia di backup è un file che salvi dove vuoi tu: non passa da ChainIntegrate. Meglio non tenerla in una cartella sincronizzata o sullo stesso computer.`,
      s4t: "4 · Cosa riceve ChainIntegrate, e perché",
      s4: `<ul>
        <li><b>Quando crei l'account</b>: il codice di invito, il nome, la descrizione e l'immagine del profilo, il nome del computer, il codice del dispositivo, la data dei termini di servizio che hai accettato e la firma della richiesta. Servono a creare l'account, che hai chiesto (base giuridica: esecuzione del servizio richiesto, art. 6.1.b GDPR). Il profilo e il nome del computer vengono scritti nel registro pubblico (punto 5).</li>
        <li><b>Quando ripristini l'accesso o aggiungi un computer</b>: il codice del dispositivo, per trovare l'account a cui appartiene, e poi i dati pubblici dell'account (profilo, computer e loro nomi). Base: esecuzione del servizio.</li>
        <li><b>Quando modifichi l'account</b> (profilo, nome del computer, computer autorizzati o revocati) <b>o confermi un'operazione</b> su un sito di un progetto ChainIntegrate: l'indirizzo dell'account, il codice del dispositivo, l'operazione firmata e, per il profilo, il nuovo profilo da salvare. Il servizio la controlla e la invia, e annota account, codice del dispositivo, tipo di operazione, riferimento e data: servono ai limiti d'uso, a non ripetere due volte la stessa richiesta e a rispondere a una tua segnalazione. Base: esecuzione del servizio e legittimo interesse alla sicurezza del servizio (art. 6.1.f).</li>
        <li><b>A ogni apertura</b>: l'estensione chiede al sito l'ultima versione disponibile e l'elenco delle impronte dei suoi file, per controllare di non essere stata modificata. Base: legittimo interesse alla sicurezza.</li>
        <li><b>L'indirizzo IP</b>: il servizio lo usa per limitare le richieste ripetute, solo in memoria, per al massimo due minuti, senza salvarlo; il server web lo registra come per ogni sito (punto 6). Base: legittimo interesse alla sicurezza.</li>
      </ul>Non usiamo i dati per altri scopi, non li vendiamo e non facciamo profilazione.`,
      s5t: "5 · Cosa diventa pubblico",
      s5: `Il servizio scrive nel registro pubblico LUKSO, e archivia su IPFS (sul nodo di ChainIntegrate, ipfs.chainintegrate.it):<ul>
        <li>il nome, la descrizione e l'immagine del profilo, a ogni creazione o modifica;</li>
        <li>il codice di ogni dispositivo e il nome del computer, con i suoi permessi sull'account.</li>
      </ul>Questi dati sono pubblici e permanenti: non si possono cancellare dal registro, nemmeno da ChainIntegrate. Possono essere letti e mostrati da chiunque, per esempio da Universal Everything (il visualizzatore di profili di LUKSO) o dal suo indice dei profili, e copiati da altri nodi IPFS. Su richiesta ChainIntegrate smette di conservare sul proprio nodo IPFS le versioni precedenti del profilo, ma non può farle sparire dalle copie altrui.<br><br>
      È pubblico anche <b>che l'account è stato creato tramite ChainIntegrate</b>: chiunque, dal registro, può ricostruire l'elenco degli account creati dal servizio e vedere quanto vengono usati. Se preferisci discrezione, scegli un nome di profilo neutro e nessuna immagine.<br><br>
      Non inserire dati che vuoi tenere riservati: niente indirizzo di casa, telefono personale o documenti, e nei <b>nomi dei computer</b> niente nomi di persone (meglio «Computer ufficio» che «Portatile di Mario Rossi»).`,
      s6t: "6 · Cosa conserva ChainIntegrate, e per quanto",
      s6: `<ul>
        <li>Per ogni codice di invito: un'impronta del codice (non il codice stesso), le date, una nota scritta da ChainIntegrate per riconoscerlo e l'indirizzo dell'account creato.</li>
        <li>Per ogni account creato: data e ora, indirizzo dell'account, identificativo della transazione, codici dei dispositivi e data dei termini accettati. Servono a ritrovare l'account dopo un ripristino o da un nuovo computer.</li>
        <li>Il registro delle operazioni inviate (punto 4) e le impronte delle richieste di profilo già servite.</li>
      </ul>Questi dati restano finché il servizio è attivo; se il servizio chiude, vengono cancellati entro 12 mesi. Una copia di sicurezza notturna, sullo stesso server, è conservata 30 giorni.
      <ul>
        <li>I registri tecnici del server (eventi del servizio, che possono contenere l'indirizzo e il nome di un profilo) e quelli del server web (indirizzo IP di chi apre il sito) servono alla sicurezza e sono conservati al massimo 30 giorni.</li>
      </ul>Il nome, la descrizione e l'immagine non vengono conservati dal servizio fuori dal registro pubblico e dal nodo IPFS (punto 5).`,
      s7t: "7 · Con chi parlano l'estensione e il servizio",
      s7: `<ul>
        <li><b>L'estensione</b> si collega ad account.chainintegrate.it. Sulle pagine dei progetti ChainIntegrate (per esempio gastrace.chainintegrate.it) si fa trovare dalla pagina; il sito vede l'indirizzo del tuo account solo dopo che lo hai collegato, e riceve solo ciò che confermi tu nella finestra dell'estensione. Per quelle pagine legge la rete pubblica tramite il servizio, dal nodo di ChainIntegrate (queste letture non vengono registrate); solo se non risponde, dal nodo pubblico di LUKSO (rpc.mainnet.lukso.network), che in quel caso vede l'indirizzo IP. Su ogni altro sito l'estensione non fa nulla.</li>
        <li><b>L'immagine del profilo</b> viene mostrata dall'estensione scaricandola da api.universalprofile.cloud, il punto di accesso a IPFS usato da Universal Everything: vede l'indirizzo IP. Il link "Vedi il tuo profilo pubblico" apre Universal Everything nel browser, solo se lo premi.</li>
        <li><b>GitHub</b> (GitHub, Inc., USA), da cui scarichi l'estensione: vede l'indirizzo IP di chi scarica, secondo la sua informativa.</li>
        <li><b>Telegram</b> (Telegram Messenger Inc.), solo se scrivi all'assistenza su Telegram: vede quello che scrivi e il tuo profilo Telegram, secondo la sua informativa. Puoi sempre usare l'e-mail.</li>
        <li><b>Il servizio</b> gira su un server in affitto presso un fornitore di hosting, che lo custodisce per conto di ChainIntegrate senza accedere ai dati. Usa il nodo LUKSO e il nodo IPFS di ChainIntegrate, e il punto di accesso IPFS di LUKSO per rendere visibile subito un nuovo profilo: questi vedono l'indirizzo IP del server, non il tuo.</li>
        <li><b>La posta elettronica</b> del servizio manda avvisi tecnici solo a ChainIntegrate (servizio fermo, saldo basso, accessi alla pagina degli inviti): non contiene i tuoi dati.</li>
      </ul>`,
      s8t: "8 · Cosa garantisce il codice, e cosa no",
      s8: `Il codice dell'estensione e del servizio è pubblico (link qui sotto). Le garanzie di questa informativa (la chiave non lascia il computer, nessuna password viene inviata) valgono per l'estensione pubblicata: a ogni apertura controlla che i suoi file siano quelli di cui ChainIntegrate pubblica le impronte, e se non lo sono non sblocca l'accesso. Un'estensione installata da altre fonti o modificata non ha queste garanzie: scaricala solo dalla pagina di ChainIntegrate. Il servizio non riceve mai chiavi né password: invia soltanto le operazioni che hai firmato tu, e non può crearne di nuove a tuo nome. ChainIntegrate non ha nessun permesso sul tuo account e non può recuperarlo: per questo la copia di backup è importante.`,
      s9t: "9 · I tuoi diritti",
      s9: `Secondo il Regolamento UE 2016/679 (GDPR) puoi chiedere l'accesso ai dati che ti riguardano conservati da ChainIntegrate (punto 6), la loro rettifica o cancellazione, la limitazione del trattamento, o opporti al trattamento basato sul legittimo interesse, scrivendo a info@chainintegrate.it (indica l'indirizzo del tuo account, così possiamo trovarli). Rispondiamo entro un mese. I dati scritti nel registro pubblico (punto 5) non si possono cancellare né modificare, da nessuno: per questo ti chiediamo di non inserirvi dati riservati. Puoi anche presentare reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).`,
      s10t: "10 · Minori e modifiche",
      s10: `Il servizio è pensato per aziende e professionisti, non per chi ha meno di 18 anni. Se questa informativa cambia, cambia la data in alto e l'estensione lo segnala; le versioni precedenti restano nella cronologia del repository.`,
      footerHtml: `ChainIntegrate · <a href="index.html">Crea il tuo account</a> · <a href="termini.html">Termini di servizio</a> · Assistenza: info@chainintegrate.it, ${TG} · <a href="https://github.com/ChainIntegrate/up-onboarding" target="_blank" rel="noopener">Codice sorgente</a>`,
    },
    en: {
      pageTitle: "Privacy policy — ChainIntegrate Account",
      h1: "Privacy policy",
      subtitle: "Last updated: 15 November 2026 (extension 0.6.0). Covers the ChainIntegrate Account extension and the account service at account.chainintegrate.it. The conditions of use are in the <a href=\"termini.html\">terms of service</a>.",
      langToggleBtn: "Italiano",
      s1t: "1 · In short",
      s1: `<ul>
        <li><b>Your key stays on your computer.</b> The extension creates your access's key on the computer and keeps it only encrypted. ChainIntegrate never receives it and has no copy. The backup copy is a file you save, protected by a password you choose.</li>
        <li><b>No password is sent to anyone</b>, ChainIntegrate included.</li>
        <li><b>The profile is public and permanent.</b> Name, description, picture and the computers' names are written to a public record (the LUKSO blockchain and the IPFS storage system): anyone can read them, and after a change the earlier versions can still be read. It is also public that the account was created through ChainIntegrate.</li>
        <li>No ads, no tracking, no usage statistics.</li>
      </ul>`,
      s2t: "2 · Who is responsible",
      s2: `The controller is <b>${ME}</b>, who offers data and blockchain integration services as <b>ChainIntegrate</b>: he develops the extension and runs the site account.chainintegrate.it and the account service. Contact for privacy and any request: e-mail <b>info@chainintegrate.it</b>; also ${TG} and ChainIntegrate's ${LI} page. No data protection officer has been appointed (not required for this activity).`,
      s3t: "3 · What stays on your computer",
      s3: `In the extension's storage, on the computer:<ul>
        <li>your access's key, only encrypted (with the computer's lock or the password you chose), and its public address (the "device code");</li>
        <li>your account's address, the profile's name, a thumbnail of the picture, the computer's name, the date the backup copy was last checked and the list of the account's computers as last seen (to tell you about changes);</li>
        <li>the ChainIntegrate project sites you connected the account to (disconnected from the extension's page);</li>
        <li>the language and theme you chose.</li>
      </ul>They stay on the computer: they are deleted with "Remove the access from this computer" or by uninstalling the extension. Some of them (the account's address, the device code, names) also go through the service, in the cases of section 4. The backup copy is a file you save wherever you like: it does not go through ChainIntegrate. Better not to keep it in a synced folder or on the same computer.`,
      s4t: "4 · What ChainIntegrate receives, and why",
      s4: `<ul>
        <li><b>When you create the account</b>: the invitation code, the profile's name, description and picture, the computer's name, the device code, the date of the terms of service you accepted and the request's signature. They are used to create the account you asked for (legal basis: performing the service requested, Art. 6.1.b GDPR). The profile and the computer's name are written to the public record (section 5).</li>
        <li><b>When you restore the access or add a computer</b>: the device code, to find the account it belongs to, then the account's public data (profile, computers and their names). Basis: performing the service.</li>
        <li><b>When you change the account</b> (profile, computer's name, computers authorized or revoked) <b>or confirm an operation</b> on a ChainIntegrate project's site: the account's address, the device code, the signed operation and, for the profile, the new profile to store. The service checks and sends it, and notes account, device code, kind of operation, reference and date: for the usage limits, to never serve the same request twice and to answer a report of yours. Basis: performing the service and the legitimate interest in its security (Art. 6.1.f).</li>
        <li><b>Each time it opens</b>: the extension asks the site for the latest version and the list of its files' fingerprints, to check it has not been modified. Basis: legitimate interest in security.</li>
        <li><b>The IP address</b>: the service uses it to limit repeated requests, in memory only, for at most two minutes, without storing it; the web server logs it as for any site (section 6). Basis: legitimate interest in security.</li>
      </ul>The data is used for nothing else, never sold, and there is no profiling.`,
      s5t: "5 · What becomes public",
      s5: `The service writes to LUKSO's public record, and stores on IPFS (on ChainIntegrate's node, ipfs.chainintegrate.it):<ul>
        <li>the profile's name, description and picture, at each creation or change;</li>
        <li>each device's code and the computer's name, with its permissions on the account.</li>
      </ul>This data is public and permanent: it cannot be deleted from the record, by ChainIntegrate either. Anyone can read and show it, for example Universal Everything (LUKSO's profile viewer) or its profile index, and other IPFS nodes can copy it. On request ChainIntegrate stops keeping the profile's earlier versions on its own IPFS node, but cannot remove other people's copies.<br><br>
      It is also public <b>that the account was created through ChainIntegrate</b>: from the record anyone can rebuild the list of the accounts the service created and see how much they are used. If you prefer discretion, choose a neutral profile name and no picture.<br><br>
      Do not enter data you want to keep private: no home address, personal phone or documents, and no people's names in the <b>computers' names</b> (“Office computer” rather than “Mario Rossi's laptop”).`,
      s6t: "6 · What ChainIntegrate keeps, and for how long",
      s6: `<ul>
        <li>For each invitation code: a fingerprint of the code (not the code itself), the dates, a note written by ChainIntegrate to recognise it and the address of the account created.</li>
        <li>For each account created: date and time, the account's address, the transaction identifier, the device codes and the date of the terms accepted. They are used to find the account again after a restore or from a new computer.</li>
        <li>The log of the operations sent (section 4) and the fingerprints of the profile requests already served.</li>
      </ul>This data is kept while the service runs; if the service closes, it is deleted within 12 months. A nightly safety copy, on the same server, is kept for 30 days.
      <ul>
        <li>The server's technical logs (the service's events, which may contain a profile's address and name) and the web server's logs (the IP address of whoever opens the site) serve security and are kept for at most 30 days.</li>
      </ul>The name, description and picture are not kept by the service outside the public record and the IPFS node (section 5).`,
      s7t: "7 · Who the extension and the service talk to",
      s7: `<ul>
        <li><b>The extension</b> connects to account.chainintegrate.it. On ChainIntegrate's project pages (for example gastrace.chainintegrate.it) it lets the page find it; the site sees your account's address only after you connect it, and receives only what you confirm in the extension's window. For those pages it reads the public network through the service, from ChainIntegrate's node (these readings are not logged); only when that does not answer, from LUKSO's public node (rpc.mainnet.lukso.network), which then sees the IP address. On any other site the extension does nothing.</li>
        <li><b>The profile's picture</b> is shown by the extension by downloading it from api.universalprofile.cloud, the IPFS access point Universal Everything uses: it sees the IP address. The "See your public profile" link opens Universal Everything in the browser, only if you press it.</li>
        <li><b>GitHub</b> (GitHub, Inc., USA), where you download the extension: it sees the IP address of whoever downloads, under its own policy.</li>
        <li><b>Telegram</b> (Telegram Messenger Inc.), only if you write to support on Telegram: it sees what you write and your Telegram profile, under its own policy. You can always use e-mail.</li>
        <li><b>The service</b> runs on a server rented from a hosting provider, which keeps it on ChainIntegrate's behalf without accessing the data. It uses ChainIntegrate's LUKSO node and IPFS node, and LUKSO's IPFS access point to make a new profile visible at once: these see the server's IP address, not yours.</li>
        <li><b>The service's e-mail</b> sends technical alerts to ChainIntegrate only (service down, low balance, sign-ins to the invitations page): it holds none of your data.</li>
      </ul>`,
      s8t: "8 · What the code guarantees, and what it does not",
      s8: `The code of the extension and of the service is public (link below). The guarantees of this policy (the key never leaves the computer, no password is sent) hold for the published extension: each time it opens it checks that its files are the ones whose fingerprints ChainIntegrate publishes, and if they are not it does not unlock the access. An extension installed from elsewhere or modified has none of these guarantees: download it only from ChainIntegrate's page. The service never receives keys or passwords: it only sends the operations you signed, and cannot make new ones in your name. ChainIntegrate has no permission on your account and cannot recover it: that is why the backup copy matters.`,
      s9t: "9 · Your rights",
      s9: `Under EU Regulation 2016/679 (GDPR) you can ask for access to the data about you kept by ChainIntegrate (section 6), its correction or deletion, the restriction of its processing, or object to processing based on legitimate interest, by writing to info@chainintegrate.it (give your account's address, so we can find it). We answer within one month. Data written to the public record (section 5) cannot be deleted or changed, by anyone: that is why we ask you not to put private data there. You can also lodge a complaint with the Italian data protection authority (Garante per la protezione dei dati personali, garanteprivacy.it).`,
      s10t: "10 · Minors and changes",
      s10: `The service is meant for companies and professionals, not for people under 18. If this policy changes, the date at the top changes and the extension tells you; earlier versions stay in the repository's history.`,
      footerHtml: `ChainIntegrate · <a href="index.html">Create your account</a> · <a href="termini.html">Terms of service</a> · Support: info@chainintegrate.it, ${TG} · <a href="https://github.com/ChainIntegrate/up-onboarding" target="_blank" rel="noopener">Source code</a>`,
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
  applyI18n();
})();
