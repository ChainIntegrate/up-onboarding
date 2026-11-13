// The privacy notice of the ChainIntegrate Account extension and of the account service (privacy.html).
// Modelled on Cross_Chain's UP Wallet notice (up-wallet-app-privacy.html): same controller, contacts, log retention
// and rights. Static text only: every string below is written in this file, none comes from outside.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let LANG = SiteUI.initialLang();
  const TG = `<a href="https://t.me/Simone_1977_2" target="_blank" rel="noopener">Telegram</a>`;
  const I18N = {
    it: {
      pageTitle: "Informativa sulla privacy — ChainIntegrate Account",
      h1: "Informativa sulla privacy",
      subtitle: "Ultimo aggiornamento: 12 novembre 2026 (estensione 0.5.0). Riguarda l'estensione ChainIntegrate Account e il servizio di creazione degli account su account.chainintegrate.it.",
      langToggleBtn: "English",
      s1t: "1 · In breve",
      s1: `<ul>
        <li><b>La tua chiave resta sul tuo computer.</b> L'estensione crea la chiave del tuo accesso sul computer e la conserva solo cifrata. ChainIntegrate non la vede e non ne ha una copia. La copia di backup è un file che salvi tu, protetto da una password che scegli tu.</li>
        <li><b>Nessuna password viene mandata a nessuno</b>, nemmeno a ChainIntegrate.</li>
        <li><b>Il profilo è pubblico e permanente.</b> Nome, descrizione, immagine e nome del computer vengono scritti in un registro pubblico (la blockchain LUKSO e il sistema di archiviazione IPFS): chiunque può leggerli, e anche dopo una modifica le versioni precedenti restano consultabili.</li>
        <li>Nessuna pubblicità, nessun tracciamento, nessuna statistica d'uso.</li>
      </ul>`,
      s2t: "2 · Chi è il titolare",
      s2: `ChainIntegrate, che sviluppa l'estensione e gestisce il sito account.chainintegrate.it e il servizio di creazione degli account. Contatti: e-mail info@chainintegrate.it, ${TG} oppure una segnalazione su GitHub.`,
      s3t: "3 · Cosa resta sul tuo computer",
      s3: `Nella memoria dell'estensione, sul computer:<ul>
        <li>la chiave del tuo accesso, solo cifrata (con il blocco del computer o con la password che hai scelto), e il suo indirizzo pubblico (il "codice del dispositivo");</li>
        <li>l'indirizzo del tuo account, il nome del profilo, una miniatura dell'immagine, il nome del computer e la data dell'ultimo controllo della copia di backup;</li>
        <li>i siti dei progetti ChainIntegrate a cui hai collegato l'account (si scollegano dalla pagina dell'estensione);</li>
        <li>la lingua e il tema scelti.</li>
      </ul>Questi dati non vengono inviati a ChainIntegrate e si cancellano con "Togli l'accesso da questo computer" o disinstallando l'estensione. La copia di backup è un file che salvi dove vuoi tu: non passa da ChainIntegrate.`,
      s4t: "4 · Cosa riceve ChainIntegrate",
      s4: `<ul>
        <li><b>Quando crei l'account</b>, l'estensione manda al servizio di account.chainintegrate.it: il codice di invito, il nome, la descrizione e l'immagine del profilo, il nome del computer, il codice del dispositivo e la firma della richiesta. Il servizio li usa solo per creare l'account e li scrive nel registro pubblico (punto 5).</li>
        <li><b>Quando ripristini l'accesso</b> su un altro computer, l'estensione chiede al servizio quale account corrisponde al codice del dispositivo, e poi il nome, la descrizione e l'immagine del profilo e il nome del computer scritti nell'account (dati già pubblici).</li>
        <li><b>Quando autorizzi o revochi un computer</b>, l'estensione manda al servizio il codice di quel computer, il nome che gli dai e il tipo di accesso, con la tua conferma firmata; il servizio la invia come le altre modifiche (punto seguente). Per mostrarti i computer del tuo account, l'estensione li chiede al servizio, che li legge dall'account (dati già pubblici).</li>
        <li><b>Quando modifichi l'account</b> (profilo, nome del computer) <b>o confermi un'operazione</b> su un sito di un progetto ChainIntegrate, l'estensione manda al servizio l'indirizzo dell'account, il codice del dispositivo, l'operazione firmata e, per il profilo, il nuovo profilo da salvare. Il servizio la controlla, la invia pagandone il costo e annota account, codice del dispositivo, tipo di operazione, riferimento e data, per i limiti giornalieri e per poter rispondere a una tua segnalazione. Le operazioni restano comunque visibili nel registro pubblico (punto 5).</li>
        <li><b>A ogni apertura</b>, l'estensione chiede al sito qual è l'ultima versione disponibile e l'elenco delle impronte dei suoi file, per controllare di non essere stata modificata.</li>
        <li><b>L'indirizzo IP</b>: il servizio lo usa per limitare le richieste ripetute, in memoria per al massimo un minuto, senza salvarlo; il server web lo registra come per ogni sito (punto 6).</li>
      </ul>`,
      s5t: "5 · Cosa diventa pubblico",
      s5: `Creando l'account, il servizio scrive nel registro pubblico LUKSO, e archivia su IPFS (sul nodo di ChainIntegrate, ipfs.chainintegrate.it):<ul>
        <li>il nome, la descrizione e l'immagine del profilo;</li>
        <li>il codice del dispositivo e il nome del computer, con i suoi permessi sull'account.</li>
      </ul>Questi dati sono pubblici e permanenti: non si possono cancellare, nemmeno da ChainIntegrate. Possono essere letti e mostrati da chiunque, per esempio da Universal Everything (il visualizzatore di profili di LUKSO) o dal suo indice dei profili. Non inserire dati che vuoi tenere riservati (indirizzo di casa, telefono personale, documenti).`,
      s6t: "6 · Cosa conserva ChainIntegrate",
      s6: `<ul>
        <li>Per ogni codice di invito: un'impronta del codice (non il codice stesso), le date, una nota scritta da ChainIntegrate per riconoscerlo e l'indirizzo dell'account creato.</li>
        <li>Per ogni account creato: data e ora, indirizzo dell'account, identificativo della transazione e codici dei dispositivi. Servono al funzionamento del servizio e a ritrovare l'account dopo un ripristino, e restano finché il servizio è attivo.</li>
        <li>Il server web registra l'indirizzo IP di chi apre il sito; questi registri servono alla sicurezza e sono conservati al massimo 30 giorni.</li>
      </ul>Il nome, la descrizione e l'immagine non vengono conservati dal servizio oltre la creazione: restano solo nel registro pubblico (punto 5).`,
      s7t: "7 · Con chi parlano l'estensione e il servizio",
      s7: `<ul>
        <li><b>L'estensione</b> si collega ad account.chainintegrate.it. Sulle pagine dei progetti ChainIntegrate (per esempio traceability.chainintegrate.it) si fa trovare dalla pagina; il sito vede l'indirizzo del tuo account solo dopo che lo hai collegato, e riceve solo le firme che confermi tu nella finestra dell'estensione. Per quelle pagine legge la rete pubblica tramite il servizio di account.chainintegrate.it, dal nodo di ChainIntegrate (queste letture non vengono registrate); solo se non risponde, dal nodo pubblico di LUKSO (rpc.mainnet.lukso.network), che in quel caso vede l'indirizzo IP. Su ogni altro sito l'estensione non fa nulla. Il link "Vedi il tuo profilo pubblico" apre Universal Everything nel browser, solo se lo premi.</li>
        <li><b>GitHub</b> (GitHub, Inc.), da cui scarichi l'estensione: vede l'indirizzo IP di chi scarica.</li>
        <li><b>Il servizio</b> usa i nodi pubblici della rete LUKSO per leggere e scrivere il registro, e il nodo IPFS di ChainIntegrate per archiviare profilo e immagine. Questi vedono l'indirizzo IP del server di ChainIntegrate, non il tuo.</li>
        <li><b>La posta elettronica</b> del servizio manda avvisi tecnici solo a ChainIntegrate (servizio fermo, saldo basso): non contiene i tuoi dati.</li>
      </ul>`,
      s8t: "8 · I tuoi diritti",
      s8: `Secondo il Regolamento UE 2016/679 (GDPR) puoi chiedere l'accesso ai dati che ti riguardano conservati da ChainIntegrate (punto 6), la loro rettifica o cancellazione, o opporti al trattamento, scrivendo ai contatti del punto 2. I dati scritti nel registro pubblico (punto 5) non si possono cancellare né modificare, da nessuno: per questo ti chiediamo di non inserirvi dati riservati. Puoi anche presentare reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).`,
      s9t: "9 · Minori e modifiche",
      s9: `Il servizio non è pensato per chi ha meno di 18 anni. Se questa informativa cambia, cambia la data in alto; le versioni precedenti restano nella cronologia del repository.`,
      footerHtml: `ChainIntegrate · <a href="index.html">Crea il tuo account</a> · Assistenza su ${TG} · <a href="https://github.com/ChainIntegrate/up-onboarding" target="_blank" rel="noopener">Codice sorgente</a>`,
    },
    en: {
      pageTitle: "Privacy policy — ChainIntegrate Account",
      h1: "Privacy policy",
      subtitle: "Last updated: 12 November 2026 (extension 0.5.0). Covers the ChainIntegrate Account extension and the account creation service at account.chainintegrate.it.",
      langToggleBtn: "Italiano",
      s1t: "1 · In short",
      s1: `<ul>
        <li><b>Your key stays on your computer.</b> The extension creates the key of your access on the computer and keeps it only encrypted. ChainIntegrate does not see it and has no copy. The backup copy is a file you save, protected by a password you choose.</li>
        <li><b>No password is sent to anyone</b>, not even to ChainIntegrate.</li>
        <li><b>The profile is public and permanent.</b> Name, description, picture and the computer's name are written in a public record (the LUKSO blockchain and the IPFS storage system): anyone can read them, and after a change earlier versions remain viewable.</li>
        <li>No ads, no tracking, no usage statistics.</li>
      </ul>`,
      s2t: "2 · Who is responsible",
      s2: `ChainIntegrate, which develops the extension and runs the site account.chainintegrate.it and the account creation service. Contact: e-mail info@chainintegrate.it, ${TG} or an issue on GitHub.`,
      s3t: "3 · What stays on your computer",
      s3: `In the extension's storage, on the computer:<ul>
        <li>the key of your access, only encrypted (with the computer's lock or the password you chose), and its public address (the "device code");</li>
        <li>your account's address, the profile name, a thumbnail of the picture, the computer's name and the date of the last check of the backup copy;</li>
        <li>the sites of ChainIntegrate's projects you connected the account to (disconnected from the extension's page);</li>
        <li>the language and theme you chose.</li>
      </ul>This data is not sent to ChainIntegrate and is deleted with "Remove the access from this computer" or by uninstalling the extension. The backup copy is a file you save where you like: it does not go through ChainIntegrate.`,
      s4t: "4 · What ChainIntegrate receives",
      s4: `<ul>
        <li><b>When you create the account</b>, the extension sends the service at account.chainintegrate.it: the invitation code, the profile's name, description and picture, the computer's name, the device code and the request's signature. The service uses them only to create the account and writes them in the public record (section 5).</li>
        <li><b>When you restore the access</b> on another computer, the extension asks the service which account matches the device code, then the profile's name, description and picture and the computer's name written in the account (public data already).</li>
        <li><b>When you authorize or revoke a computer</b>, the extension sends the service that computer's code, the name you give it and the kind of access, with your signed confirmation; the service sends it as the other changes (next item). To show you your account's computers, the extension asks the service, which reads them from the account (public data already).</li>
        <li><b>When you change the account</b> (profile, computer's name) <b>or confirm an operation</b> on a site of a ChainIntegrate project, the extension sends the service the account's address, the device code, the signed operation and, for the profile, the new profile to store. The service checks it, sends it paying its cost and notes account, device code, kind of operation, reference and date, for the daily limits and to answer a report of yours. The operations are anyway visible in the public record (section 5).</li>
        <li><b>Each time it opens</b>, the extension asks the site for the latest version and the list of its files' fingerprints, to check it has not been modified.</li>
        <li><b>The IP address</b>: the service uses it to limit repeated requests, in memory for at most one minute, without saving it; the web server logs it as every site does (section 6).</li>
      </ul>`,
      s5t: "5 · What becomes public",
      s5: `When creating the account, the service writes in the public LUKSO record, and stores on IPFS (on ChainIntegrate's node, ipfs.chainintegrate.it):<ul>
        <li>the profile's name, description and picture;</li>
        <li>the device code and the computer's name, with its permissions on the account.</li>
      </ul>This data is public and permanent: it cannot be deleted, not even by ChainIntegrate. Anyone can read and show it, for example Universal Everything (LUKSO's profile viewer) or its profile index. Do not enter anything you want to keep private (home address, personal phone, documents).`,
      s6t: "6 · What ChainIntegrate keeps",
      s6: `<ul>
        <li>For each invitation code: a fingerprint of the code (not the code itself), the dates, a note written by ChainIntegrate to recognise it, and the address of the account created.</li>
        <li>For each account created: date and time, the account's address, the transaction identifier and the device codes. They serve the service and finding the account again after a restore, and are kept while the service runs.</li>
        <li>The web server records the IP address of whoever opens the site; these logs serve security and are kept for at most 30 days.</li>
      </ul>The name, description and picture are not kept by the service after the creation: they stay only in the public record (section 5).`,
      s7t: "7 · Who the extension and the service talk to",
      s7: `<ul>
        <li><b>The extension</b> connects to account.chainintegrate.it. On the pages of ChainIntegrate's projects (for example traceability.chainintegrate.it) the page can find it; the site sees your account's address only after you connected it, and receives only the signatures you confirm in the extension's window. For those pages it reads the public network through the service at account.chainintegrate.it, from ChainIntegrate's node (these reads are not logged); only when it does not answer, from LUKSO's public node (rpc.mainnet.lukso.network), which then sees the IP address. On any other site the extension does nothing. The "See your public profile" link opens Universal Everything in the browser, only if you press it.</li>
        <li><b>GitHub</b> (GitHub, Inc.), where you download the extension: it sees the IP address of whoever downloads.</li>
        <li><b>The service</b> uses public nodes of the LUKSO network to read and write the record, and ChainIntegrate's IPFS node to store the profile and picture. They see the IP address of ChainIntegrate's server, not yours.</li>
        <li><b>The service's e-mail</b> sends technical alerts only to ChainIntegrate (service down, low balance): they hold none of your data.</li>
      </ul>`,
      s8t: "8 · Your rights",
      s8: `Under Regulation (EU) 2016/679 (GDPR) you can ask for access to the data about you kept by ChainIntegrate (section 6), for its correction or deletion, or object to its processing, through the contacts in section 2. Data written in the public record (section 5) cannot be deleted or changed, by anyone: that is why we ask you not to put private data in it. You can also lodge a complaint with the Italian data protection authority, the Garante per la protezione dei dati personali (garanteprivacy.it).`,
      s9t: "9 · Minors and changes",
      s9: `The service is not meant for people under 18. If this policy changes, the date at the top changes; earlier versions stay in the repository's history.`,
      footerHtml: `ChainIntegrate · <a href="index.html">Create your account</a> · Support on ${TG} · <a href="https://github.com/ChainIntegrate/up-onboarding" target="_blank" rel="noopener">Source code</a>`,
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
