// The guide (guida.html): how to use the ChainIntegrate Account extension, step by step, with the names of its
// buttons as the extension shows them (extension/app.js, confirm.js). For clients who do not use crypto: no crypto
// term in either language (test/e2e.js checks it, as for the client's page).
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let LANG = SiteUI.initialLang();
  const B = (s) => `<span class="btn">${s}</span>`;

  const I18N = {
    it: {
      langToggleBtn: "English",
      pageTitle: "Guida all'account ChainIntegrate",
      h1: "Guida all'account ChainIntegrate",
      subtitle: "Tutto quello che serve per usare il tuo account: dall'installazione ai servizi di ChainIntegrate, passo per passo.",
      tocTitle: "In questa guida",
      footerHtml: `ChainIntegrate · <a href="./">Crea il tuo account</a> · <a href="privacy.html">Privacy</a> · <a href="https://t.me/Simone_1977_2" target="_blank" rel="noopener">Assistenza su Telegram</a> · e-mail info@chainintegrate.it`,
      sections: [
        { id: "prima", title: "1. Prima di iniziare", html: `
          <p>Ti servono:</p>
          <ul>
            <li>un <b>computer</b> con Chrome, Edge o Brave (l'estensione non funziona sul telefono);</li>
            <li>il <b>codice di invito</b> che ti ha mandato ChainIntegrate (di solito con un link: aprendolo, il codice compare in cima alla pagina);</li>
            <li>un posto sicuro <b>fuori dal computer</b> per la copia di backup: una chiavetta USB, l'archivio documenti dell'azienda.</li>
          </ul>
          <p>L'account è tuo: nessuno, nemmeno ChainIntegrate, può usarlo o recuperarlo al posto tuo. Per questo la copia di backup è obbligatoria.</p>
          <div class="tip"><b>Copia di backup o secondo computer?</b> Sono due cose diverse:
            <ul>
              <li>la <b>copia di backup</b> serve a riportare il tuo accesso su un computer che <b>sostituisce</b> quello di prima: perso, rotto, formattato o reinstallato (sezione 9);</li>
              <li>per usare l'account da <b>due postazioni insieme</b> (per esempio ufficio e casa) <b>aggiungi un secondo computer</b>: ognuno ha il suo accesso, il suo nome e la sua copia di backup (sezione 7).</li>
            </ul></div>` },
        { id: "installa", title: "2. Installare l'estensione", html: `
          <ol>
            <li>Dalla pagina <a href="./">Crea il tuo account ChainIntegrate</a> premi ${B("Installa l'estensione")}: si scarica un file .zip.</li>
            <li>Scompattalo in una cartella dove resterà e che <b>non</b> viene sincronizzata con OneDrive, iCloud o Dropbox: su Windows <b>%LOCALAPPDATA%\\ChainIntegrate</b> (scrivilo nella barra degli indirizzi di Esplora file), su Mac <b>Libreria / Application Support / ChainIntegrate</b>. Ne esce la cartella <b>chainintegrate-account</b>.</li>
            <li>Nel browser apri <b>chrome://extensions</b> (in Edge: edge://extensions) e attiva <b>Modalità sviluppatore</b>.</li>
            <li>Premi ${B("Carica estensione non pacchettizzata")} e scegli la cartella chainintegrate-account.</li>
            <li>Si apre la pagina dell'estensione. Per riaprirla in seguito, premi la sua icona nella barra del browser (se non la vedi, è nel menu a forma di puzzle: puoi fissarla).</li>
          </ol>` },
        { id: "accesso", title: "3. Creare l'accesso e la copia di backup", html: `
          <ol>
            <li>Nella pagina dell'estensione premi ${B("Inizia: crea il tuo accesso")}.</li>
            <li><b>Proteggi l'accesso su questo computer</b>: con il <b>blocco del computer</b> (impronta, volto o PIN, come per sbloccare il computer) oppure con una <b>password</b> di almeno 12 caratteri. Ti verrà chiesto ogni volta che usi l'account.</li>
            <li><b>Crea la copia di backup</b>: scegli una password per la copia (diversa da quella del computer va benissimo) e premi ${B("Scarica la copia di backup")}. Si scarica un file.</li>
            <li>Sposta il file in un posto sicuro fuori dal computer e annota la password in un posto separato.</li>
            <li><b>Controlla la copia di backup</b>: ricarica il file, scrivi la sua password e premi ${B("Controlla")}. Solo ora l'accesso viene salvato: così sei sicuro che la copia si apre.</li>
          </ol>` },
        { id: "account", title: "4. Creare l'account", html: `
          <ol>
            <li>In <b>Crea il tuo account</b> scrivi il <b>Codice di invito</b>.</li>
            <li><b>Nome del profilo</b>: solo lettere minuscole, numeri e trattini, da 3 a 32 caratteri (per esempio <b>rossi-srl</b>). Il nome completo dell'azienda scrivilo nella descrizione.</li>
            <li><b>Nome di questo computer</b>: per riconoscerlo, per esempio «Portatile ufficio».</li>
            <li>Facoltativi: una <b>descrizione</b> e un'<b>immagine o logo</b>.</li>
            <li>Premi ${B("Crea il mio account")}: in circa un minuto l'account è pronto.</li>
            <li>L'estensione ti chiede subito una <b>nuova copia di backup</b>, che contiene anche il tuo account: falla e controllala come al passo 3. Da qui in poi conserva questa, non quella di prima.</li>
          </ol>
          <div class="warn"><b>Il profilo è pubblico</b>: nome, descrizione e immagine sono visibili a chiunque. Non inserire dati riservati. Puoi cambiarli, ma le versioni precedenti restano consultabili.</div>` },
        { id: "pronto", title: "5. La pagina del tuo account", html: `
          <p>Aprendo l'estensione trovi:</p>
          <ul>
            <li><b>Il tuo account</b>: il nome, l'immagine, ${B("Copia l'indirizzo dell'account")} e ${B("Vedi il tuo profilo pubblico")}.</li>
            <li>${B("Modifica il profilo o il nome di questo computer")}: cambia nome, descrizione o immagine e premi ${B("Aggiorna il profilo")}; per il nome del computer ${B("Cambia il nome nell'account")}. Se non scegli una nuova immagine resta quella di adesso. Le modifiche compaiono sul profilo pubblico dopo qualche minuto.</li>
            <li><b>I computer del tuo account</b>, <b>Siti collegati</b>, <b>Questo computer</b>, <b>Copia di backup</b>: li trovi spiegati più avanti.</li>
          </ul>
          <div class="tip">Ogni modifica la confermi con il blocco del computer o con la password di questo computer.</div>` },
        { id: "siti", title: "6. Usare l'account sui siti di ChainIntegrate", html: `
          <p>I servizi di ChainIntegrate (per esempio i registri di tracciabilità e delle bombole) sono su indirizzi <b>…chainintegrate.it</b>. Quando un servizio ti chiede di accedere:</p>
          <ol>
            <li>tra i modi di accesso proposti dal sito scegli <b>ChainIntegrate Account</b>;</li>
            <li>la prima volta si apre la finestra dell'estensione «Collegare il tuo account a questo sito?»: controlla l'indirizzo del sito e premi ${B("Collega")};</li>
            <li>ogni volta che il sito ti chiede una conferma o un'operazione si apre la <b>finestra dell'estensione</b>: dice in parole semplici cosa succede, per quale servizio e da quale sito. Leggila e premi ${B("Conferma")}, oppure ${B("Annulla")} se non ti torna.</li>
          </ol>
          <div class="warn">La conferma avviene <b>sempre nella finestra dell'estensione</b>, mai dentro la pagina del sito. Se un sito ti chiede la password del computer o della copia di backup in una sua pagina, non scriverla.</div>
          <p>In <b>Siti collegati</b> vedi i siti a cui hai collegato l'account; ${B("Scollega")} toglie il collegamento (il sito non vede più il tuo account finché non lo ricolleghi).</p>
          <p>L'estensione funziona solo sui siti di ChainIntegrate previsti: altrove non fa nulla.</p>` },
        { id: "computer", title: "7. Usare l'account da più computer", html: `
          <p>Per usare l'account da <b>più postazioni</b> (per esempio l'ufficio e casa, o due colleghi) aggiungi ogni computer così. Ognuno ha il <b>suo accesso</b>, il <b>suo nome</b> e la <b>sua copia di backup</b>, e puoi revocarlo da solo senza toccare gli altri.</p>
          <div class="warn"><b>Non usare la copia di backup per questo.</b> Ripristinata su un secondo computer, la copia ci porta <b>lo stesso accesso</b> del primo: i due computer risultano un computer solo, con un solo nome, e non puoi revocarne uno senza bloccare anche l'altro.</div>
          <p><b>Sul computer nuovo</b>:</p>
          <ol>
            <li>installa l'estensione (passo 2) e premi ${B("Aggiungi questo computer a un account esistente")};</li>
            <li>proteggi l'accesso e fai la sua copia di backup (passo 3);</li>
            <li>compare il <b>codice di questo computer</b>, a gruppi di 4 caratteri: copialo con ${B("Copia il codice")} e tienilo a portata.</li>
          </ol>
          <p><b>Sul computer che usa già l'account</b>:</p>
          <ol>
            <li>in <b>I computer del tuo account</b> apri ${B("Autorizza un altro computer")};</li>
            <li>incolla il codice, dai un nome (per esempio «Computer ufficio») e scegli il tipo:
              <ul>
                <li><b>Accesso</b>: usa l'account nei servizi di ChainIntegrate e conferma le operazioni, ma non può cambiare il profilo né autorizzare o revocare altri computer. Va bene per la maggior parte dei casi;</li>
                <li><b>Amministratore</b>: può fare tutto, come il primo computer.</li>
              </ul></li>
            <li>premi ${B("Autorizza questo computer")}, controlla il riepilogo e conferma.</li>
          </ol>
          <p>Sul computer nuovo l'account compare da solo entro pochi secondi (oppure premi ${B("Controlla adesso")}); l'estensione chiede poi la copia di backup che contiene l'account, come al passo 4. È la copia <b>di questo computer</b>: conservala insieme a quella del primo, sono due copie diverse (sezione 8).</p>
          <p>Non serve fare tutto subito: puoi creare l'accesso sul computer nuovo, copiare il codice e autorizzarlo anche giorni dopo dall'altro computer. Riaprendo l'estensione sul computer nuovo, l'account compare da solo.</p>
          <div class="tip">Se un computer si rompe o lo cambi, con la <b>copia di backup</b> ritrovi l'accesso su un altro computer, come il primo giorno. I computer che hai autorizzato restano autorizzati.</div>` },
        { id: "backup", title: "8. La copia di backup", html: `
          <ul>
            <li>È un file, protetto dalla password che hai scelto, che contiene l'accesso di quel computer. Chi ha <b>il file e la password</b> può usare il tuo account.</li>
            <li>Serve a <b>riportare l'accesso</b> se quel computer non c'è più o è stato reinstallato (sezione 9). Non serve ad aggiungere un secondo computer: per quello c'è la sezione 7.</li>
            <li>Conservalo fuori dal computer; tieni la password in un posto separato. <b>Non mandarli mai a nessuno</b>, nemmeno a ChainIntegrate: non te li chiederemo mai.</li>
            <li>In <b>Copia di backup</b>: ${B("Controlla la copia di backup")} verifica che il file si apra ancora (fallo ogni tanto); ${B("Crea una nuova copia di backup")} ne fa una nuova, per esempio se hai perso la vecchia o vuoi cambiarne la password.</li>
          </ul>
          <p><b>Se usi più computer, ognuno ha la sua copia</b>, e non sono uguali:</p>
          <ul>
            <li>la copia di un computer riporta <b>l'accesso di quel computer</b>: il suo codice, il suo nome e il suo tipo (amministratore o accesso). Ripristinata su un computer nuovo, è come avere di nuovo quel computer;</li>
            <li>non c'è una copia «principale»: <b>ognuna basta da sola</b> per rientrare nell'account con i permessi di quel computer. Se due computer sono entrambi amministratori, le loro copie valgono uguale; la copia di un computer di tipo accesso riporta un accesso, non un amministratore;</li>
            <li>la copia di un computer che hai <b>revocato</b> non serve più: quell'accesso non è più nell'account;</li>
            <li>sullo stesso computer conta l'<b>ultima</b> copia che hai fatto (quella che contiene anche l'account): le copie precedenti di quel computer aprono lo stesso accesso, ma tieni l'ultima.</li>
          </ul>` },
        { id: "ripristino", title: "9. Computer perso, rotto o reinstallato: ripristinare dalla copia di backup", html: `
          <p>Quando il computer di prima <b>non c'è più</b> (perso, rotto, formattato) o hai reinstallato il sistema o il browser, ritrovi l'accesso così, sul computer che lo sostituisce:</p>
          <ol>
            <li>installa l'estensione (passo 2) e premi ${B("Ho già un accesso: ripristina dalla copia di backup")};</li>
            <li>scegli il file della copia, scrivi la sua password e premi ${B("Ripristina")};</li>
            <li>proteggi l'accesso su questo computer: l'account, il profilo e il nome del computer tornano da soli.</li>
          </ol>
          <div class="warn">Il ripristino porta sul nuovo computer <b>lo stesso accesso</b> di quello di prima. Se il computer di prima <b>funziona ancora</b> e vuoi usarli entrambi, non ripristinare: aggiungi il nuovo come secondo computer (sezione 7).</div>` },
        { id: "perso", title: "10. Se perdi un computer", html: `
          <ul>
            <li><b>Hai un altro computer autorizzato come amministratore</b>: da lì, in <b>I computer del tuo account</b>, premi ${B("Revoca")} accanto a quello perso. Da quel momento non può più usare l'account.</li>
            <li><b>Era il tuo unico computer</b>: ripristina dalla copia di backup su un computer nuovo (sezione 9).</li>
            <li><b>Non hai né un altro computer né la copia di backup</b>: l'account non si può più usare. Nessuno può recuperarlo al posto tuo, nemmeno ChainIntegrate. Puoi chiedere a ChainIntegrate un nuovo account.</li>
          </ul>` },
        { id: "aggiorna", title: "11. Aggiornare l'estensione", html: `
          <ol>
            <li>Quando esce una nuova versione, aprendo l'estensione compare «È disponibile una nuova versione»: premi ${B("Scarica la nuova versione")}.</li>
            <li>Scompatta il file <b>nella stessa cartella di sempre</b>, sostituendo i file.</li>
            <li>In <b>chrome://extensions</b> premi ${B("Ricarica")} su ChainIntegrate Account.</li>
          </ol>
          <p>Il tuo accesso, l'account e i siti collegati restano come sono. Non serve rifare ${B("Carica estensione non pacchettizzata")}.</p>` },
        { id: "sicurezza", title: "12. Sicurezza", html: `
          <ul>
            <li>Ogni volta che si apre, l'estensione controlla che i suoi file siano quelli pubblicati da ChainIntegrate. Se compare <b>«Questa estensione è stata modificata»</b>, non scrivere nessuna password: togli l'estensione, scaricala di nuovo dalla pagina di ChainIntegrate e, se serve, ripristina dalla copia di backup. Avvisa ChainIntegrate.</li>
            <li>ChainIntegrate non ti chiederà mai le tue password, il file della copia di backup o di installare altro.</li>
            <li>Conferma nella finestra dell'estensione solo ciò che hai chiesto tu, su un sito <b>…chainintegrate.it</b> che conosci.</li>
          </ul>` },
        { id: "togli", title: "13. Togliere l'accesso da un computer", html: `
          <p>Se lasci un computer (per esempio lo restituisci o lo vendi): in <b>Togli l'accesso da questo computer</b> spunta la conferma di avere la copia di backup, premi ${B("Togli l'accesso da questo computer")} e poi ${B("Sì, togli l'accesso")}. L'accesso viene cancellato da quel computer; l'account resta, e lo usi dagli altri computer o dalla copia di backup.</p>
          <p>Se il computer è autorizzato come computer separato, è bene anche revocarlo da un computer amministratore (sezione 10).</p>
          <p><b>Assistenza</b>: scrivi a ChainIntegrate (info@chainintegrate.it o Telegram). Per aiutarti potremmo chiederti l'indirizzo dell'account o il codice del computer: non sono segreti. Mai le password o la copia di backup.</p>` },
      ],
    },
    en: {
      langToggleBtn: "Italiano",
      pageTitle: "Guide to the ChainIntegrate account",
      h1: "Guide to the ChainIntegrate account",
      subtitle: "Everything you need to use your account: from the installation to ChainIntegrate's services, step by step.",
      tocTitle: "In this guide",
      footerHtml: `ChainIntegrate · <a href="./">Create your account</a> · <a href="privacy.html">Privacy</a> · <a href="https://t.me/Simone_1977_2" target="_blank" rel="noopener">Support on Telegram</a> · e-mail info@chainintegrate.it`,
      sections: [
        { id: "prima", title: "1. Before you start", html: `
          <p>You need:</p>
          <ul>
            <li>a <b>computer</b> with Chrome, Edge or Brave (the extension does not work on a phone);</li>
            <li>the <b>invitation code</b> ChainIntegrate sent you (usually with a link: opening it, the code appears at the top of the page);</li>
            <li>a safe place <b>outside the computer</b> for the backup copy: a USB stick, the company's document archive.</li>
          </ul>
          <p>The account is yours: no one, not even ChainIntegrate, can use it or recover it in your place. This is why the backup copy is required.</p>
          <div class="tip"><b>Backup copy or second computer?</b> They are two different things:
            <ul>
              <li>the <b>backup copy</b> brings your access back on a computer that <b>replaces</b> the previous one: lost, broken, wiped or reinstalled (section 9);</li>
              <li>to use the account from <b>two places at the same time</b> (for example the office and home) <b>add a second computer</b>: each one has its own access, its own name and its own backup copy (section 7).</li>
            </ul></div>` },
        { id: "installa", title: "2. Installing the extension", html: `
          <ol>
            <li>On the page <a href="./">Create your ChainIntegrate account</a> press ${B("Install the extension")}: a .zip file is downloaded.</li>
            <li>Unzip it into a folder where it will stay and that is <b>not</b> synced with OneDrive, iCloud or Dropbox: on Windows <b>%LOCALAPPDATA%\\ChainIntegrate</b> (type it in File Explorer's address bar), on Mac <b>Library / Application Support / ChainIntegrate</b>. It gives the <b>chainintegrate-account</b> folder.</li>
            <li>In the browser open <b>chrome://extensions</b> (in Edge: edge://extensions) and turn on <b>Developer mode</b>.</li>
            <li>Press ${B("Load unpacked")} and choose the chainintegrate-account folder.</li>
            <li>The extension's page opens. To open it again later, press its icon in the browser's bar (if you do not see it, it is in the puzzle-shaped menu: you can pin it).</li>
          </ol>` },
        { id: "accesso", title: "3. Creating the access and the backup copy", html: `
          <ol>
            <li>On the extension's page press ${B("Start: create your access")}.</li>
            <li><b>Protect the access on this computer</b>: with the <b>computer's lock</b> (fingerprint, face or PIN, as to unlock the computer) or with a <b>password</b> of at least 12 characters. It is asked each time you use the account.</li>
            <li><b>Create the backup copy</b>: choose a password for the copy (different from the computer's is fine) and press ${B("Download the backup copy")}. A file is downloaded.</li>
            <li>Move the file to a safe place outside the computer and note the password somewhere else.</li>
            <li><b>Check the backup copy</b>: load the file again, type its password and press ${B("Check")}. Only now is the access saved: so you know the copy opens.</li>
          </ol>` },
        { id: "account", title: "4. Creating the account", html: `
          <ol>
            <li>In <b>Create your account</b> type the <b>Invitation code</b>.</li>
            <li><b>Profile name</b>: lowercase letters, digits and hyphens only, 3 to 32 characters (for example <b>rossi-srl</b>). The company's full name goes in the description.</li>
            <li><b>Name of this computer</b>: to recognize it, for example “Office laptop”.</li>
            <li>Optional: a <b>description</b> and a <b>picture or logo</b>.</li>
            <li>Press ${B("Create my account")}: in about a minute the account is ready.</li>
            <li>The extension then asks for a <b>new backup copy</b>, which also holds your account: make it and check it as in step 3. From now on keep this one, not the earlier one.</li>
          </ol>
          <div class="warn"><b>The profile is public</b>: name, description and picture can be seen by anyone. Do not enter private data. You can change them, but earlier versions remain viewable.</div>` },
        { id: "pronto", title: "5. Your account's page", html: `
          <p>Opening the extension you find:</p>
          <ul>
            <li><b>Your account</b>: the name, the picture, ${B("Copy the account's address")} and ${B("See your public profile")}.</li>
            <li>${B("Change the profile or this computer's name")}: change name, description or picture and press ${B("Update the profile")}; for the computer's name ${B("Change the name in the account")}. Without a new picture the current one stays. Changes appear on the public profile after a few minutes.</li>
            <li><b>Your account's computers</b>, <b>Connected sites</b>, <b>This computer</b>, <b>Backup copy</b>: explained below.</li>
          </ul>
          <div class="tip">You confirm every change with the computer's lock or this computer's password.</div>` },
        { id: "siti", title: "6. Using the account on ChainIntegrate's sites", html: `
          <p>ChainIntegrate's services (for example the traceability and cylinder registries) are on <b>…chainintegrate.it</b> addresses. When a service asks you to sign in:</p>
          <ol>
            <li>among the ways to sign in the site offers, choose <b>ChainIntegrate Account</b>;</li>
            <li>the first time the extension's window “Connect your account to this site?” opens: check the site's address and press ${B("Connect")};</li>
            <li>each time the site asks for a confirmation or an operation, the <b>extension's window</b> opens: it says in plain words what happens, for which service and from which site. Read it and press ${B("Confirm")}, or ${B("Cancel")} if it does not look right.</li>
          </ol>
          <div class="warn">You confirm <b>always in the extension's window</b>, never inside the site's page. If a site asks for the computer's or the backup copy's password in one of its pages, do not type it.</div>
          <p>In <b>Connected sites</b> you see the sites your account is connected to; ${B("Disconnect")} removes the connection (the site no longer sees your account until you connect it again).</p>
          <p>The extension works only on ChainIntegrate's own sites: anywhere else it does nothing.</p>` },
        { id: "computer", title: "7. Using the account from more computers", html: `
          <p>To use the account from <b>more than one place</b> (for example the office and home, or two colleagues) add each computer this way. Each one has <b>its own access</b>, <b>its own name</b> and <b>its own backup copy</b>, and you can revoke it alone without touching the others.</p>
          <div class="warn"><b>Do not use the backup copy for this.</b> Restored on a second computer, the copy brings it <b>the same access</b> as the first: the two computers count as one, with one name, and you cannot revoke one without blocking the other too.</div>
          <p><b>On the new computer</b>:</p>
          <ol>
            <li>install the extension (step 2) and press ${B("Add this computer to an existing account")};</li>
            <li>protect the access and make its backup copy (step 3);</li>
            <li>the <b>code of this computer</b> appears, in groups of 4 characters: copy it with ${B("Copy the code")} and keep it at hand.</li>
          </ol>
          <p><b>On the computer that already uses the account</b>:</p>
          <ol>
            <li>in <b>Your account's computers</b> open ${B("Authorize another computer")};</li>
            <li>paste the code, give a name (for example “Office computer”) and choose the kind:
              <ul>
                <li><b>Access</b>: uses the account in ChainIntegrate's services and confirms operations, but cannot change the profile nor authorize or revoke other computers. Right for most cases;</li>
                <li><b>Administrator</b>: can do everything, like the first computer.</li>
              </ul></li>
            <li>press ${B("Authorize this computer")}, check the summary and confirm.</li>
          </ol>
          <p>On the new computer the account appears by itself within a few seconds (or press ${B("Check now")}); the extension then asks for the backup copy holding the account, as in step 4. It is <b>this computer's</b> copy: keep it along with the first computer's, they are two different copies (section 8).</p>
          <p>No need to do everything at once: you can create the access on the new computer, copy the code and authorize it even days later from the other computer. Opening the extension on the new computer again, the account appears by itself.</p>
          <div class="tip">If a computer breaks or you replace it, with the <b>backup copy</b> you get the access back on another computer, as on the first day. The computers you authorized stay authorized.</div>` },
        { id: "backup", title: "8. The backup copy", html: `
          <ul>
            <li>It is a file, protected by the password you chose, holding that computer's access. Whoever has <b>the file and the password</b> can use your account.</li>
            <li>It <b>brings the access back</b> if that computer is gone or was reinstalled (section 9). It is not the way to add a second computer: that is section 7.</li>
            <li>Keep it outside the computer; keep the password somewhere else. <b>Never send them to anyone</b>, not even to ChainIntegrate: we will never ask for them.</li>
            <li>In <b>Backup copy</b>: ${B("Check the backup copy")} checks the file still opens (do it now and then); ${B("Create a new backup copy")} makes a new one, for example if you lost the old one or want to change its password.</li>
          </ul>
          <p><b>If you use more computers, each one has its own copy</b>, and they are not the same:</p>
          <ul>
            <li>a computer's copy brings back <b>that computer's access</b>: its code, its name and its kind (administrator or access). Restored on a new computer, it is like having that computer again;</li>
            <li>there is no “main” copy: <b>each one is enough on its own</b> to get back into the account with that computer's permissions. If two computers are both administrators, their copies are worth the same; the copy of an access computer brings back an access, not an administrator;</li>
            <li>the copy of a computer you <b>revoked</b> is no longer of any use: that access is no longer in the account;</li>
            <li>on the same computer, the <b>latest</b> copy counts (the one that also holds the account): earlier copies of that computer open the same access, but keep the latest.</li>
          </ul>` },
        { id: "ripristino", title: "9. A computer lost, broken or reinstalled: restoring from the backup copy", html: `
          <p>When the previous computer <b>is gone</b> (lost, broken, wiped) or you reinstalled the system or the browser, you get the access back this way, on the computer that replaces it:</p>
          <ol>
            <li>install the extension (step 2) and press ${B("I already have an access: restore from the backup copy")};</li>
            <li>choose the copy's file, type its password and press ${B("Restore")};</li>
            <li>protect the access on this computer: the account, the profile and the computer's name come back by themselves.</li>
          </ol>
          <div class="warn">Restoring brings to the new computer <b>the same access</b> as the previous one. If the previous computer <b>still works</b> and you want to use both, do not restore: add the new one as a second computer (section 7).</div>` },
        { id: "perso", title: "10. If you lose a computer", html: `
          <ul>
            <li><b>You have another computer authorized as administrator</b>: from it, in <b>Your account's computers</b>, press ${B("Revoke")} next to the lost one. From then on it can no longer use the account.</li>
            <li><b>It was your only computer</b>: restore from the backup copy on a new computer (section 9).</li>
            <li><b>You have neither another computer nor the backup copy</b>: the account can no longer be used. No one can recover it in your place, not even ChainIntegrate. You can ask ChainIntegrate for a new account.</li>
          </ul>` },
        { id: "aggiorna", title: "11. Updating the extension", html: `
          <ol>
            <li>When a new version is out, opening the extension shows “A new version is available”: press ${B("Download the new version")}.</li>
            <li>Unzip the file <b>into the same folder as always</b>, replacing the files.</li>
            <li>In <b>chrome://extensions</b> press ${B("Reload")} on ChainIntegrate Account.</li>
          </ol>
          <p>Your access, the account and the connected sites stay as they are. No need to use ${B("Load unpacked")} again.</p>` },
        { id: "sicurezza", title: "12. Safety", html: `
          <ul>
            <li>Each time it opens, the extension checks that its files are the ones ChainIntegrate published. If <b>“This extension has been modified”</b> appears, do not type any password: remove the extension, download it again from ChainIntegrate's page and, if needed, restore from the backup copy. Tell ChainIntegrate.</li>
            <li>ChainIntegrate will never ask for your passwords, the backup copy's file or to install anything else.</li>
            <li>Confirm in the extension's window only what you asked for, on a <b>…chainintegrate.it</b> site you know.</li>
          </ul>` },
        { id: "togli", title: "13. Removing the access from a computer", html: `
          <p>If you leave a computer (for example you return or sell it): in <b>Remove the access from this computer</b> tick that you have the backup copy, press ${B("Remove the access from this computer")} and then ${B("Yes, remove the access")}. The access is deleted from that computer; the account stays, and you use it from the other computers or from the backup copy.</p>
          <p>If the computer was authorized as a separate computer, also revoke it from an administrator computer (section 10).</p>
          <p><b>Support</b>: write to ChainIntegrate (info@chainintegrate.it or Telegram). To help you we may ask for the account's address or the computer's code: they are not secret. Never the passwords or the backup copy.</p>` },
      ],
    },
  };
  const t = (k) => I18N[LANG][k];
  // The screenshots of each section (web/guide/<lang>/, made by tools/guide-screenshots.js from the extension itself,
  // with example data): [file, Italian caption, English caption].
  const FIGS = {
    accesso: [["welcome", "La prima schermata dell'estensione.", "The extension's first screen."],
      ["protect", "Proteggere l'accesso: blocco del computer o password.", "Protecting the access: the computer's lock or a password."],
      ["backup", "La copia di backup: una password scelta ora, poi il file da scaricare.", "The backup copy: a password chosen now, then the file to download."],
      ["verify", "Il controllo della copia: il file ricaricato e la sua password.", "Checking the copy: the file loaded again and its password."]],
    account: [["create", "Il modulo per creare l'account.", "The form to create the account."]],
    pronto: [["account", "Il tuo account: nome, immagine, indirizzo.", "Your account: name, picture, address."]],
    siti: [["window-connect", "La finestra dell'estensione per collegare un sito.", "The extension's window to connect a site."],
      ["window-request", "Una richiesta di un servizio, descritta in parole semplici: Annulla è selezionato.", "A service's request, described in plain words: Cancel is selected."]],
    computer: [["join", "Sul computer nuovo: il suo codice, a gruppi di 4 caratteri.", "On the new computer: its code, in groups of 4 characters."],
      ["devices", "Sul computer che ha già l'account: i computer e «Autorizza un altro computer».", "On the computer that has the account: the computers and “Authorize another computer”."],
      ["devices-confirm", "Il riepilogo prima di autorizzare.", "The summary before authorizing."]],
  };
  function figures(id) {
    const box = document.createElement("div");
    for (const [file, it, en] of FIGS[id] || []) {
      const f = document.createElement("figure");
      const img = document.createElement("img"); img.src = `guide/${LANG}/${file}.png`; img.alt = LANG === "en" ? en : it; img.loading = "lazy";
      const c = document.createElement("figcaption"); c.textContent = LANG === "en" ? en : it;
      f.append(img, c); box.appendChild(f);
    }
    return box;
  }

  function render() {
    document.documentElement.lang = LANG;
    document.title = t("pageTitle");
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.getAttribute("data-i18n-html")); });
    $("langToggle").textContent = t("langToggleBtn");
    const toc = $("toc"), box = $("sections");
    toc.innerHTML = ""; box.innerHTML = "";
    for (const s of t("sections")) {
      const li = document.createElement("li"); const a = document.createElement("a"); a.href = "#" + s.id; a.textContent = s.title.replace(/^\d+\.\s*/, ""); li.appendChild(a); toc.appendChild(li);
      const p = document.createElement("div"); p.className = "panel";
      const h = document.createElement("h2"); h.id = s.id; h.textContent = s.title;
      const body = document.createElement("div"); body.innerHTML = s.html; // fixed text of this file only
      p.append(h, body, figures(s.id)); box.appendChild(p);
    }
    if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
  }
  $("langToggle").addEventListener("click", () => { LANG = LANG === "it" ? "en" : "it"; SiteUI.saveLang(LANG); render(); });
  render();
})();
