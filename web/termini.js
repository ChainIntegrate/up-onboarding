// The terms of service of the ChainIntegrate Account extension and of the account service (termini.html), accepted
// in the extension before an account is created (the date below is UPRequest.TERMS, sent with the request).
// A draft written for the maintainer's review (audit U-13). Static text only: every string is written here.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let LANG = SiteUI.initialLang();
  const TG = `<a href="https://t.me/Simone_1977_2" target="_blank" rel="noopener">Telegram</a>`;
  const I18N = {
    it: {
      pageTitle: "Termini di servizio — ChainIntegrate Account",
      h1: "Termini di servizio",
      subtitle: "Versione del 15 novembre 2026. Riguardano l'estensione ChainIntegrate Account e il servizio degli account su account.chainintegrate.it. Come trattiamo i dati è scritto nell'<a href=\"privacy.html\">informativa sulla privacy</a>.",
      langToggleBtn: "English",
      s1t: "1 · Chi offre il servizio",
      s1: `Il servizio è offerto da <b>Simone Cavalletti</b>, con il nome <b>ChainIntegrate</b> (di seguito "ChainIntegrate"). Contatti: info@chainintegrate.it, ${TG}. Il servizio è riservato ad aziende e professionisti che hanno ricevuto un codice di invito.`,
      s2t: "2 · Cosa offre",
      s2: `<ul>
        <li>L'estensione per il browser, gratuita, che crea e custodisce sul tuo computer l'accesso al tuo account.</li>
        <li>La creazione dell'account con un codice di invito, e l'invio delle operazioni che confermi (modifiche del profilo, dei computer, operazioni sui siti dei progetti ChainIntegrate), il cui costo tecnico è a carico di ChainIntegrate, entro i limiti del punto 5.</li>
        <li>L'accesso ai progetti ChainIntegrate (per esempio GasTrace). Ogni progetto può avere condizioni o un contratto suoi, che prevalgono per quel progetto.</li>
      </ul>`,
      s3t: "3 · L'account è tuo",
      s3: `L'account appartiene a te (o alla tua azienda): le chiavi che lo controllano sono create sui tuoi computer e ChainIntegrate non ne ha nessuna. Per questo <b>ChainIntegrate non può recuperare l'account</b>, né annullare un'operazione che hai confermato.<br><br>
      Sei responsabile di custodire le copie di backup e le loro password, di autorizzare solo computer tuoi o della tua azienda e di revocare subito un computer perso. Ti consigliamo di avere almeno due computer amministratori, ognuno con la sua copia di backup. Se perdi tutte le chiavi amministratore e le loro copie, l'account non si può più modificare: è una conseguenza del suo funzionamento, non un guasto del servizio.`,
      s4t: "4 · Cosa è pubblico",
      s4: `Il profilo (nome, descrizione, immagine), i computer dell'account e i loro nomi, e il fatto che l'account sia stato creato tramite ChainIntegrate sono pubblici e permanenti (vedi l'informativa, punto 5). Non inserire dati riservati, dati di altre persone o contenuti illeciti o di cui non hai i diritti: ne rispondi tu.`,
      s5t: "5 · Uso corretto e limiti",
      s5: `Il servizio ha limiti d'uso giornalieri, per account e complessivi, per proteggere tutti i clienti. ChainIntegrate può rifiutare o sospendere l'invio delle operazioni di un account in caso di abuso, di uso contrario alla legge o a questi termini, o di rischio per la sicurezza, avvisandoti quando possibile. L'account resta comunque tuo.`,
      s6t: "6 · Disponibilità e fine del servizio",
      s6: `Il servizio è in una fase iniziale ed è offerto così com'è, senza garanzia di disponibilità continua. ChainIntegrate fa il possibile per tenerlo attivo e sicuro, e può aggiornare l'estensione e il servizio. Se il servizio dovesse chiudere, ChainIntegrate lo comunicherà con almeno 60 giorni di anticipo, salvo cause che non dipendono da lei. L'account e i suoi dati pubblici restano anche dopo: il codice è pubblico, e con la copia di backup l'account si può usare con altri strumenti compatibili, pagando da sé i costi delle operazioni.`,
      s7t: "7 · Responsabilità",
      s7: `Nei limiti consentiti dalla legge, e salvo dolo o colpa grave, ChainIntegrate non risponde di danni dovuti a: perdita delle copie di backup o delle password, uso delle chiavi da parte di chi ha accesso ai tuoi computer, operazioni che hai confermato, interruzioni o malfunzionamenti di reti e servizi di terzi (la rete LUKSO, IPFS, i fornitori di hosting), dati che hai reso pubblici.`,
      s8t: "8 · Modifiche dei termini",
      s8: `Se questi termini cambiano, cambia la data in alto e l'estensione te lo segnala. Le modifiche valgono dal momento in cui le leggi; se non le accetti puoi smettere di usare il servizio, e l'account resta tuo. Le versioni precedenti restano nella cronologia del repository.`,
      s9t: "9 · Legge applicabile",
      s9: `Questi termini sono regolati dalla legge italiana. Per ogni controversia è competente il foro previsto dalla legge.`,
      footerHtml: `ChainIntegrate · <a href="index.html">Crea il tuo account</a> · <a href="privacy.html">Privacy</a> · Assistenza: info@chainintegrate.it, ${TG} · <a href="https://github.com/ChainIntegrate/up-onboarding" target="_blank" rel="noopener">Codice sorgente</a>`,
    },
    en: {
      pageTitle: "Terms of service — ChainIntegrate Account",
      h1: "Terms of service",
      subtitle: "Version of 15 November 2026. They cover the ChainIntegrate Account extension and the account service at account.chainintegrate.it. How data is handled is in the <a href=\"privacy.html\">privacy policy</a>. The Italian text prevails.",
      langToggleBtn: "Italiano",
      s1t: "1 · Who offers the service",
      s1: `The service is offered by <b>Simone Cavalletti</b>, as <b>ChainIntegrate</b> (below "ChainIntegrate"). Contact: info@chainintegrate.it, ${TG}. The service is for companies and professionals who received an invitation code.`,
      s2t: "2 · What it offers",
      s2: `<ul>
        <li>The browser extension, free of charge, which creates and keeps on your computer the access to your account.</li>
        <li>The account's creation with an invitation code, and the sending of the operations you confirm (changes to the profile, to the computers, operations on ChainIntegrate's project sites), whose technical cost ChainIntegrate bears, within the limits of section 5.</li>
        <li>The access to ChainIntegrate's projects (for example GasTrace). Each project may have its own conditions or contract, which prevail for that project.</li>
      </ul>`,
      s3t: "3 · The account is yours",
      s3: `The account belongs to you (or your company): the keys that control it are created on your computers and ChainIntegrate holds none. That is why <b>ChainIntegrate cannot recover the account</b>, nor undo an operation you confirmed.<br><br>
      You are responsible for keeping the backup copies and their passwords, for authorizing only your own or your company's computers, and for revoking a lost computer at once. We advise at least two administrator computers, each with its own backup copy. If you lose every administrator key and its copies, the account can no longer be changed: that follows from how it works, it is not a fault of the service.`,
      s4t: "4 · What is public",
      s4: `The profile (name, description, picture), the account's computers and their names, and the fact that the account was created through ChainIntegrate are public and permanent (see the privacy policy, section 5). Do not enter private data, other people's data, or content that is unlawful or that you have no rights to: you answer for it.`,
      s5t: "5 · Fair use and limits",
      s5: `The service has daily usage limits, per account and overall, to protect every client. ChainIntegrate may refuse or suspend sending an account's operations in case of abuse, of use against the law or these terms, or of a security risk, telling you when it can. The account stays yours anyway.`,
      s6t: "6 · Availability and end of the service",
      s6: `The service is at an early stage and offered as it is, with no guarantee of continuous availability. ChainIntegrate does its best to keep it running and safe, and may update the extension and the service. Should the service close, ChainIntegrate will announce it at least 60 days in advance, save for causes beyond its control. The account and its public data remain afterwards: the code is public, and with the backup copy the account can be used with other compatible tools, paying the operations' costs yourself.`,
      s7t: "7 · Liability",
      s7: `To the extent allowed by law, and save for wilful misconduct or gross negligence, ChainIntegrate is not liable for damage due to: the loss of backup copies or passwords, the use of the keys by whoever has access to your computers, operations you confirmed, interruptions or faults of third-party networks and services (the LUKSO network, IPFS, hosting providers), data you made public.`,
      s8t: "8 · Changes to the terms",
      s8: `If these terms change, the date at the top changes and the extension tells you. Changes apply from when you read them; if you do not accept them you can stop using the service, and the account stays yours. Earlier versions stay in the repository's history.`,
      s9t: "9 · Governing law",
      s9: `These terms are governed by Italian law. Any dispute goes to the court the law provides for.`,
      footerHtml: `ChainIntegrate · <a href="index.html">Create your account</a> · <a href="privacy.html">Privacy</a> · Support: info@chainintegrate.it, ${TG} · <a href="https://github.com/ChainIntegrate/up-onboarding" target="_blank" rel="noopener">Source code</a>`,
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
