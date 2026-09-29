// =============================================================================
//  MOTORE AUDIO — Avellino, le nove caselle
// =============================================================================
//  Il grafo, dall'alto:
//
//    pezzi nel mondo ──> gDist ──> PAN ─┐
//    oggetti (dormiente + sveglio) ─────┴─> SCORCIATOIA ─┐
//                                          (casella 9)   │
//    pezzi CHE TI SEGUONO ─────────────────────────────  │
//    inseguitore (volume = vicinanza) ──────────────────┤ │
//    trombettista e Alba ───────────────────────────────┤ │
//    ambienze di zona ──────────────────────────────────┤ │
//    mandata RIVERBERO del mondo ───────────────────────┴─┤
//                                                         │
//                          MONDO: occlusione (casella 7)  │
//                                 disturbo   (casella 6)  │
//                                                         │
//    musica del peggioramento (casella 4) ────────────────┤
//    eventi ──> volume ──> PAN ─┬─ secco ─────────────────┤
//                               └─ mandata ─> RIVERBERO ──┴─> MASTER
//
//  Due principi che valgono come regole di lettura:
//  · un suono, un significato — la lavorazione dell'occlusione appartiene
//    all'aiuto che toglie l'udito e a nient'altro;
//  · le lavorazioni toccano il MONDO, non gli eventi: quando il giocatore
//    sente peggio deve comunque capire che cosa ha appena fatto.
//
//  Un solo punto di contatto col gioco per gli eventi: audio.suona('nome',
//  {pan, distanza}). Gli stati continui hanno metodi propri, perche' non sono
//  eventi: impostaMondo, impostaScorciatoia, aggiornaSpazio.
// =============================================================================

const TAGLIO_APERTO = 18000;      // il filtro del mondo a riposo: spalancato

class MotoreAudio {

  constructor() {
    this.pronto = false;
    this.buffer = {};
    this.stato = {};
    //  id dello strumento -> { file, nome }: lo riempie `registraNomi`
    this.strumenti = {};
    this.acustica = 'corridoio';
    this.larghezza = 1;      // ampiezza del fronte stereo: 1 = piena, 0 = mono
    this.tWow = 0;
    this.occluso = false;
    this.disturbato = false;
    this.nellAlone = false;
    this.dentroScorciatoia = false;
    this.centCorrente = 0;
    this.taglioCorrente = TAGLIO_APERTO;
  }

  // Deve girare DENTRO il click, prima di ogni attesa: Safari sblocca l'audio
  // solo cosi', e resume() non va mai atteso o puo' non risolversi mai.
  //
  //  TELEFONO (30/09/2026). Su iPhone servono altre tre cose:
  //  1. `audioSession.type = 'playback'` (Safari 16.4+): senza, col tasto
  //     silenzioso abbassato il gioco e' muto e nessuno capisce perche'.
  //     Il prezzo: ferma la musica di un'altra app, come fa ogni gioco.
  //  2. Tornando da un'altra app o dal blocco schermo Safari lascia il
  //     contesto 'suspended' o 'interrupted'. Si riprova da solo quando la
  //     pagina torna visibile, e comunque al primo tocco: fuori da un gesto
  //     iOS spesso rifiuta, dentro un gesto no.
  //  3. La pausa del gioco chiama `ctx.suspend()` da gioco.js: quella NON va
  //     disfatta. Si ricorda chi ha sospeso apposta avvolgendo i due metodi,
  //     cosi' la ripresa automatica non scavalca la pausa.
  sbloccaAudio() {
    if (this.ctx) return;
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch (e) { /* Safari vecchio o altro browser: si va avanti */ }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume();                                  // senza await, mai
    const s = ctx.createBufferSource();
    s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    s.connect(ctx.destination);
    s.start(0);
    this.preparaRipresa();
  }

  preparaRipresa() {
    const ctx = this.ctx;
    this.sospesoApposta = false;
    const sospendi = ctx.suspend.bind(ctx), riprendi = ctx.resume.bind(ctx);
    ctx.suspend = () => { this.sospesoApposta = true; return sospendi(); };
    ctx.resume = () => { this.sospesoApposta = false; return riprendi(); };
    //  la ripresa automatica passa da `riprendi`, non da `ctx.resume`: non
    //  deve cancellare la pausa voluta, solo rimediare a quella imposta
    const rimedia = () => {
      if (this.sospesoApposta || ctx.state === 'running' || ctx.state === 'closed') return;
      if (document.hidden) return;
      try { riprendi().catch(() => {}); } catch (e) {}
    };
    this.rimediaAudio = rimedia;
    document.addEventListener('visibilitychange', rimedia);
    addEventListener('pageshow', rimedia);
    addEventListener('focus', rimedia);
    ctx.addEventListener && ctx.addEventListener('statechange', rimedia);
    //  il gesto: touchend e non touchstart, che su iOS non sblocca l'audio
    for (const tipo of ['touchend', 'pointerup', 'click', 'keydown'])
      document.addEventListener(tipo, rimedia, { capture: true, passive: true });
  }

  async avvia(avanzamento) {
    this.sbloccaAudio();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.leggiFader().generale;
    this.master.connect(ctx.destination);

    // IL MONDO — tutto cio' con cui ci si orienta passa di qui, e solo di qui
    // arrivano l'occlusione e il disturbo. Eventi e musica lo scavalcano.
    this.filtroMondo = ctx.createBiquadFilter();
    this.filtroMondo.type = 'lowpass';
    this.filtroMondo.frequency.value = TAGLIO_APERTO;
    this.filtroMondo.Q.value = 0.7;
    this.volMondo = ctx.createGain();
    this.filtroMondo.connect(this.volMondo);
    this.volMondo.connect(this.master);

    // LA SCORCIATOIA — casella 9: qui dentro i pezzi non arrivano piu'.
    // Sta PRIMA del filtro del mondo e riguarda solo pezzi e oggetti:
    // l'ambienza della scorciatoia e l'inseguitore si continuano a sentire.
    this.gPezziMondo = ctx.createGain();
    this.gPezziMondo.connect(this.filtroMondo);

    this.busPezzi = ctx.createGain(); this.busPezzi.connect(this.gPezziMondo);
    this.busOggetti = ctx.createGain(); this.busOggetti.connect(this.gPezziMondo);
    //  CHI TI SEGUE NON PASSA DI LI'. La casella 9 toglie i pezzi DEL MONDO —
    //  quelli rimasti nelle aule, che nella scorciatoia non ti arrivano piu'.
    //  I musicisti che ti camminano dietro invece ci sono, e devono sentirsi:
    //  fino al 14/09/2026 attraversando il cortile ammutolivano tutti insieme
    //  («smettono di suonare o suonano troppo piano: non ha senso, deve
    //  cambiare solo il riverbero»). Stesso livello di `busPezzi`, ma fuori
    //  dal cancello della scorciatoia.
    this.busPezziAlSeguito = ctx.createGain();
    this.busPezziAlSeguito.connect(this.filtroMondo);
    this.busInseguitore = ctx.createGain(); this.busInseguitore.connect(this.filtroMondo);
    // I personaggi stanno col mondo, non coi pezzi: nella scorciatoia i pezzi
    // spariscono, ma il trombettista e Alba si continuano a sentire — sono
    // dentro l'edificio, non dentro il compito.
    this.busPersonaggi = ctx.createGain(); this.busPersonaggi.connect(this.filtroMondo);
    this.busAmbiente = ctx.createGain(); this.busAmbiente.connect(this.filtroMondo);
    this.busMusica = ctx.createGain(); this.busMusica.connect(this.master);
    this.busEventi = ctx.createGain(); this.busEventi.connect(this.master);
    this.busRiverbero = ctx.createGain();
    //  La mandata di riverbero del MONDO, separata da quella degli eventi. Non
    //  e' un vezzo: la coda degli eventi esce diretta al master — un evento
    //  deve restare leggibile anche col tappo nelle orecchie — mentre quella
    //  dei loop deve passare dal filtro del mondo, altrimenti sotto occlusione
    //  la stanza continuerebbe a rimbombare chiara dietro la testa nella
    //  scatola. Due mandate, due file di convolutori, stessi livelli.
    this.busRiverberoMondo = ctx.createGain();
    this.busRiverberoMondo.connect(this.filtroMondo);

    //  Le mandate si prendono dai BUS, non da ogni sorgente: un send per bus
    //  invece di quattordici, ed e' quello che si farebbe su una console.
    //  `gPezziMondo` si prende DOPO il cancello della scorciatoia — prendendola
    //  prima, nel cortile i pezzi sarebbero spariti dall'asciutto e sarebbero
    //  rimasti nella coda, che e' peggio del difetto che si sta togliendo.
    //  L'inseguitore resta ASCIUTTO di proposito: il suo volume e' la distanza,
    //  e una coda lunga di corridoio sopra quella curva la spalma e toglie
    //  proprio l'informazione su cui e' costruita la casella 5.
    const manda = nodo => {
      const g = ctx.createGain();
      g.gain.value = CONFIG.spazio.mandataRiverbero;
      nodo.connect(g); g.connect(this.busRiverberoMondo);
      return g;
    };
    this.sendMondo = [manda(this.gPezziMondo), manda(this.busPezziAlSeguito),
                      manda(this.busPersonaggi)];

    this.preparaMix();

    this.durataLoop = CONFIG.musica.battute * 4 * 60 / CONFIG.musica.bpm;

    await this.scopriStrumenti();
    await this.caricaTutto(avanzamento);
    this.costruisciRiverberi();
    this.avviaSorgenti();
    this.avviaMusica();
    this.avviaInseguitore();
    this.avviaAmbienze();
    this.impostaAcustica('corridoio', true);
    this.applicaMix();      // senza questa i bus restano a 1.0 e i livelli
                            // configurati non entrano mai in funzione
    this.pronto = true;
    this.generaDifferiti();
  }

  // ---------------------------------------------------------------------------
  //  CARICAMENTO — uno alla volta, con tempo massimo: non puo' bloccarsi
  // ---------------------------------------------------------------------------
  //  L'elenco che esce da qui E' il vademecum: 45 file, quei nomi e non altri.
  //  Chi trascina un file con un nome fuori elenco se lo vede rifiutare, ed e'
  //  voluto — e' il primo controllo sulla consegna degli studenti.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  //  GLI OTTO STRUMENTI — il nome lo porta il file, non il codice
  // ---------------------------------------------------------------------------
  //  Lo studente consegna `strumento_03_piano_fender.wav`: la testa
  //  `strumento_03_` la impone il gioco, la coda la sceglie lui. Di qui esce
  //  la coppia (file vero, nome da scrivere sul foglio del direttore).
  //
  //  Una pagina web non puo' leggere da sola l'elenco di una cartella. Le vie
  //  sono due, e si usano tutte e due:
  //
  //  1. la pagina che il server mostra al posto di `audio/` — funziona con
  //     `python3 -m http.server`, che e' come gira il gioco in aula;
  //  2. il pulsante che carica una cartella intera (`webkitdirectory` in
  //     index.html), che passa qui i nomi con `registraNomi` — e funziona
  //     anche a chi apre `index.html` con un doppio clic.
  //
  //  Se non si scopre niente il gioco riparte con `strumento_03.wav` e le
  //  etichette generiche: non suona come voleva lo studente, ma non si rompe.
  // ---------------------------------------------------------------------------
  //  Due file per strumento: quello dell'aula e quello del concerto. Il
  //  secondo si chiama come il primo con `_concerto` in coda — vedi
  //  `CONFIG.concerto` — e se manca il gioco ne genera un segnaposto suo.
  fileStrumento(id, versione = 'aula') {
    const s = this.strumenti[id];
    if (versione === 'concerto') return (s && s.concerto) || id + '_concerto.wav';
    return (s && s.file) || id + '.wav';
  }

  nomeStrumento(id) {
    const s = this.strumenti[id];
    if (s && s.nome) return s.nome;
    const v = CONFIG.pezzi.find(p => p.id === id);
    return v ? v.etichetta : id;
  }

  //  Da un elenco di nomi di file ricava, per ognuno degli otto, il file vero e
  //  il nome dello strumento. Il confronto e' senza maiuscole: un file
  //  `Strumento_03_Arpa.WAV` vale quanto quello scritto giusto — su un difetto
  //  di battitura non si butta la registrazione di nessuno.
  //  Di file per strumento adesso ce ne sono DUE, e si distinguono dalla coda:
  //  quello che finisce per `_concerto` e' la versione del palco, l'altro
  //  quella dell'aula. Il nome dello strumento e' la coda senza quel suffisso,
  //  cosi' sul foglio del direttore si legge «piano fender» comunque.
  //
  //  Si AGGIORNA quello che si sa, non si riscrive: `sostituisci` passa di qui
  //  con un nome solo alla volta, e riscrivendo la scheda intera trascinare il
  //  file del concerto cancellava quello dell'aula.
  registraNomi(nomi) {
    let trovati = 0;
    for (const p of CONFIG.pezzi) {
      const testa = p.id.toLowerCase();
      const suoi = nomi.filter(n => {
        const b = n.toLowerCase();
        return b.startsWith(testa) && /\.wav$/.test(b) &&
               (b.length === testa.length + 4 || b[testa.length] === '_');
      });
      if (!suoi.length) continue;
      const coda = n => n.slice(p.id.length).replace(/\.wav$/i, '').replace(/^_/, '');
      const delConcerto = n => /(^|_)concerto$/i.test(coda(n));
      const aula = suoi.find(n => !delConcerto(n));
      const concerto = suoi.find(delConcerto);
      const S = this.strumenti[p.id] ||
                (this.strumenti[p.id] = { file: null, concerto: null, nome: null });
      if (aula) S.file = aula;
      if (concerto) S.concerto = concerto;
      //  gli underscore tornano spazi: `piano_fender` si legge «piano fender»
      const etichetta = coda(aula || concerto)
        .replace(/(^|_)concerto$/i, '').replace(/_+/g, ' ').trim();
      if (etichetta) S.nome = etichetta;
      trovati++;
    }
    return trovati;
  }

  //  Chiede al server la pagina di `audio/` e ne spreme i nomi dei file. Se non
  //  c'e' un server, o se la pagina non e' un elenco, non succede niente: e'
  //  un tentativo, non un requisito.
  //
  //  TELEFONO (30/09/2026): GitHub Pages non mostra l'elenco delle cartelle.
  //  Senza sapere quali file ci sono, il gioco chiedeva uno per uno tutti i
  //  77 nomi e prendeva 77 risposte 404: sul cellulare, una decina di secondi
  //  di «CARICO I SUONI» per non trovare niente. Adesso si sa PRIMA:
  //
  //  1. `audio/elenco.json` — facoltativo. Un array di nomi di file
  //     (`["passo_01.wav", "strumento_03_arpa.wav", ...]`) oppure
  //     `{ "file": [...] }`. E' l'unico modo che funziona su GitHub Pages:
  //     chi mette i suoi file in `audio/` deve mettere anche questo, se no
  //     il gioco non li vede.
  //  2. se manca, l'elenco della cartella (server di prova in locale);
  //  3. se manca anche quello, la cartella e' vuota: niente fetch, segnaposto.
  //
  //  `this.presenti` resta un insieme di nomi in minuscolo; `this.inArchivio`
  //  lo stesso per l'archivio del browser, letto una volta sola.
  async scopriStrumenti() {
    if (!this.strumenti) this.strumenti = {};
    this.presenti = new Set();
    this.inArchivio = new Set();
    //  Aperto con un doppio clic non c'e' server: i nomi degli strumenti si
    //  leggono dall'archivio del browser. Senza, `strumento_03_piano_fender.wav`
    //  caricato ieri oggi non si ritrovava e tornava il segnaposto.
    try {
      const nomi = await this.archivioNomi();
      nomi.forEach(n => this.inArchivio.add(n.toLowerCase()));
      this.registraNomi(nomi);
    } catch (e) {}

    let nomi = null;
    try {
      const r = await MotoreAudio.prendi('audio/elenco.json', 4000);
      if (r.ok) {
        const d = await r.json();
        const lista = Array.isArray(d) ? d : (d && Array.isArray(d.file) ? d.file : null);
        if (lista) nomi = lista.filter(n => typeof n === 'string').map(n => n.split('/').pop());
      }
    } catch (e) { /* niente elenco: si prova la pagina della cartella */ }

    if (!nomi) {
      try {
        const r = await MotoreAudio.prendi('audio/', 2000);
        if (r.ok) {
          const testo = await r.text();
          nomi = [...testo.matchAll(/(?:href="|>)([^"<>/]+\.wav)/gi)]
            .map(m => decodeURIComponent(m[1]));
        }
      } catch (e) {}
    }
    if (!nomi) return 0;
    nomi = [...new Set(nomi)];
    nomi.forEach(n => this.presenti.add(n.toLowerCase()));
    return this.registraNomi(nomi);
  }

  //  Una richiesta con tempo massimo. `no-cache` e non `no-store`: il file si
  //  ricontrolla col server ogni volta (un 304 costa niente), ma se non e'
  //  cambiato non si riscarica — sul telefono, in rete mobile, conta.
  static prendi(url, ms) {
    return Promise.race([
      fetch(url, { cache: 'no-cache' }),
      new Promise((_, no) => setTimeout(() => no(new Error('tempo scaduto')), ms)),
    ]);
  }

  elencoFile() {
    const out = [];
    for (const p of CONFIG.pezzi) {
      out.push({ gruppo: 'pezzi', nome: this.fileStrumento(p.id), sorgente: p.id, ramo: 'aula' });
      out.push({ gruppo: 'pezzi', nome: this.fileStrumento(p.id, 'concerto'),
                 sorgente: p.id, ramo: 'concerto' });
    }
    for (const o of CONFIG.oggetti)
      for (const stato of ['dormiente', 'sveglio'])
        out.push({ gruppo: 'oggetti', nome: CONFIG.fileOggetto(o.id, stato), sorgente: o.id, ramo: stato });
    out.push({ gruppo: 'musica', nome: CONFIG.musica.file });
    out.push({ gruppo: 'inseguitore', nome: CONFIG.inseguitore.file });
    const P = CONFIG.personaggi;
    out.push({ gruppo: 'personaggi', nome: P.trombettista.file, sorgente: P.trombettista.id, ramo: 'unico' });
    out.push({ gruppo: 'personaggi', nome: P.alba.file, sorgente: P.alba.id, ramo: 'unico' });
    P.colloquio.varianti.forEach((f, k) =>
      out.push({ gruppo: 'personaggi', nome: f, sorgente: P.colloquio.id, ramo: 'v' + k }));
    for (const [id, e] of Object.entries(CONFIG.eventi))
      e.file.forEach(f => out.push({ gruppo: 'eventi', nome: f, evento: id }));
    for (const [z, a] of Object.entries(CONFIG.ambienze))
      out.push({ gruppo: 'ambienze', nome: a.file, acustica: z });
    for (const [z, r] of Object.entries(CONFIG.riverberi))
      out.push({ gruppo: 'riverberi', nome: r.file, acustica: z });
    return out;
  }

  async caricaTutto(avanzamento) {
    const elenco = this.elencoFile();
    for (let i = 0; i < elenco.length; i++) {
      await this.caricaUno(elenco[i]);
      if (avanzamento) avanzamento(i + 1, elenco.length);
      await new Promise(r => setTimeout(r, 0));
    }
  }

  //  Tre sorgenti, in quest'ordine:
  //  1. la cartella audio/, se la pagina e' servita da un server;
  //  2. l'archivio locale del browser, dove finisce cio' che e' stato caricato
  //     a mano — e' quello che salva chi apre index.html con un doppio clic,
  //     perche' li' il browser vieta di leggere i file vicini;
  //  3. un segnaposto sintetico.
  //  Si chiede solo cio' che `scopriStrumenti` ha visto: un file che non e'
  //  nell'elenco non si cerca, e il segnaposto arriva subito.
  async caricaUno(voce) {
    const chiave = voce.nome.toLowerCase();
    if (!this.presenti || this.presenti.has(chiave)) try {
      const r = await MotoreAudio.prendi('audio/' + voce.nome, 8000);
      if (!r.ok) throw 0;
      this.buffer[voce.nome] = await this.ctx.decodeAudioData(await r.arrayBuffer());
      this.stato[voce.nome] = 'cartella';
      return;
    } catch (e) { /* nessun server: si prova l'archivio */ }

    if (!this.inArchivio || this.inArchivio.has(chiave)) try {
      const dati = await this.archivioPrendi(voce.nome);
      if (dati) {
        this.buffer[voce.nome] = await this.ctx.decodeAudioData(dati);
        this.stato[voce.nome] = 'archivio';
        return;
      }
    } catch (e) { /* archivio non disponibile */ }

    this.stato[voce.nome] = 'segnaposto';
    //  TELEFONO (30/09/2026): i segnaposto del concerto non servono prima
    //  della fine della partita — per tutta la partita stanno a volume zero.
    //  Non si calcolano qui ma dopo l'avvio, uno alla volta (`generaDifferiti`),
    //  e se il concerto arriva prima li calcola `bufferDi` sul momento.
    if (voce.gruppo === 'pezzi' && voce.ramo === 'concerto') {
      delete this.buffer[voce.nome];
      (this.differiti || (this.differiti = new Map())).set(voce.nome, voce);
      return;
    }
    this.buffer[voce.nome] = this.generaSegnaposto(voce);
  }

  //  Il buffer di un file, calcolando sul momento il segnaposto rimandato.
  bufferDi(nome) {
    if (!this.buffer[nome] && this.differiti && this.differiti.has(nome))
      this.buffer[nome] = this.generaSegnaposto(this.differiti.get(nome));
    if (this.differiti) this.differiti.delete(nome);
    return this.buffer[nome];
  }

  //  I segnaposto rimandati, dopo l'avvio: uno ogni mezzo secondo, cosi' non
  //  si mangiano un fotogramma intero sul telefono.
  generaDifferiti() {
    const passo = () => {
      if (!this.differiti || !this.differiti.size) return;
      this.bufferDi(this.differiti.keys().next().value);
      setTimeout(passo, 500);
    };
    setTimeout(passo, 3000);
  }

  // ---------------------------------------------------------------------------
  //  ARCHIVIO LOCALE — i file caricati a mano sopravvivono alla ricarica
  // ---------------------------------------------------------------------------
  apriArchivio() {
    if (this._db) return this._db;
    this._db = new Promise((ok, no) => {
      if (!window.indexedDB) return no(new Error('archivio non disponibile'));
      const r = indexedDB.open('avellino-audio', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('file');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
      //  2 s e non 3: su alcuni iPhone la prima apertura non risponde mai, e
      //  sul telefono l'archivio quasi sempre e' vuoto
      setTimeout(() => no(new Error('archivio: tempo scaduto')), 2000);
    });
    return this._db;
  }

  async archivioMetti(nome, dati) {
    const db = await this.apriArchivio();
    return new Promise((ok, no) => {
      const t = db.transaction('file', 'readwrite');
      t.objectStore('file').put(dati, nome);
      t.oncomplete = ok; t.onerror = () => no(t.error);
    });
  }

  async archivioPrendi(nome) {
    const db = await this.apriArchivio();
    return new Promise((ok, no) => {
      const q = db.transaction('file', 'readonly').objectStore('file').get(nome);
      q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error);
    });
  }

  async archivioNomi() {
    const db = await this.apriArchivio();
    return new Promise((ok, no) => {
      const q = db.transaction('file', 'readonly').objectStore('file').getAllKeys();
      q.onsuccess = () => ok(q.result.map(String)); q.onerror = () => no(q.error);
    });
  }

  async archivioSvuota() {
    const db = await this.apriArchivio();
    return new Promise((ok, no) => {
      const t = db.transaction('file', 'readwrite');
      t.objectStore('file').clear();
      t.oncomplete = ok; t.onerror = () => no(t.error);
    });
  }

  // ---------------------------------------------------------------------------
  //  LE CINQUE ACUSTICHE
  // ---------------------------------------------------------------------------
  //  Una mandata per acustica, tutte accese in permanenza e tenute a zero: si
  //  cambia stanza incrociando due guadagni, mai staccando un nodo. Staccare e
  //  riattaccare un convolutore taglia la coda di netto, e si sente.
  //
  //  L'aula fa eccezione e ne ha TRE, una per taglia. Il file registrato resta
  //  uno: le altre due code il gioco se le ricava da quella — vedi `scalaIR`.
  //  Le chiavi diventano allora 'aula:piccola', 'aula:media', 'aula:grande',
  //  e le altre quattro restano il nome dell'acustica e basta.
  // ---------------------------------------------------------------------------
  costruisciRiverberi() {
    this.riv = {};
    for (const [z, cfg] of Object.entries(CONFIG.riverberi)) {
      if (z === 'aula') { this.costruisciAule(cfg); continue; }
      this.riv[z] = this.mandataRiverbero(z, this.buffer[cfg.file], cfg.livello);
    }
  }

  costruisciAule(cfg) {
    for (const t of CONFIG.taglieAula)
      this.riv['aula:' + t.nome] = this.mandataRiverbero(
        'aula', this.scalaIR(this.buffer[cfg.file], t.coda), cfg.livello * t.livello);
  }

  mandataRiverbero(acustica, buffer, livello) {
    const conv = this.ctx.createConvolver();
    conv.buffer = buffer;
    const wet = this.ctx.createGain(); wet.gain.value = 0;
    //  L'INGRESSO NON SI COLLEGA QUI: lo collega `impostaAcustica` solo per
    //  l'acustica in uso. Vedi il commento li'.
    conv.connect(wet); wet.connect(this.master);

    //  La gemella del mondo: stesso impulso, stesso livello, ma la coda esce
    //  nel filtro del mondo invece che al master. Sono i due modi diversi in
    //  cui deve comportarsi la stessa stanza — vedi il commento su
    //  `busRiverberoMondo`.
    const convM = this.ctx.createConvolver();
    convM.buffer = buffer;
    const wetM = this.ctx.createGain(); wetM.gain.value = 0;
    convM.connect(wetM);
    wetM.connect(this.filtroMondo);

    return { conv, wet, convM, wetM, livello, acustica };
  }

  // Una coda piu' lunga (o piu' corta) ricavata da quella registrata,
  // rileggendo il buffer a passo diverso. Non e' un trucco: allungare una
  // risposta all'impulso la scurisce, accorciarla la schiarisce, ed e'
  // esattamente quello che fa una stanza piu' grande o piu' piccola.
  //
  // Un fattore di 1 deve restituire il buffer com'e', bit per bit: l'aula
  // media e' il file che l'allievo ha registrato, e non si tocca.
  scalaIR(buf, fattore) {
    if (!buf || Math.abs(fattore - 1) < 0.001) return buf;
    const lunghezza = Math.max(1, Math.round(buf.length * fattore));
    const out = this.ctx.createBuffer(buf.numberOfChannels, lunghezza, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const src = buf.getChannelData(c), dst = out.getChannelData(c);
      for (let i = 0; i < lunghezza; i++) {
        const t = i / fattore, i0 = Math.floor(t), k = t - i0;
        const a = src[i0] || 0, b = src[i0 + 1] !== undefined ? src[i0 + 1] : a;
        dst[i] = a + (b - a) * k;
      }
    }
    return out;
  }

  avviaAmbienze() {
    this.amb = {};
    for (const [z, cfg] of Object.entries(CONFIG.ambienze)) {
      const gain = this.ctx.createGain(); gain.gain.value = 0;
      gain.connect(this.busAmbiente);
      this.amb[z] = { gain, src: null, cfg };
      this.faiPartireAmbiente(z);
    }
  }

  faiPartireAmbiente(z) {
    const A = this.amb[z];
    if (A.src) { try { A.src.stop(); } catch (e) {} }
    const s = this.ctx.createBufferSource();
    s.buffer = this.buffer[A.cfg.file]; s.loop = true;
    s.connect(A.gain); s.start();
    A.src = s;
  }

  //  `chiave` e' il nome dell'acustica, e per le aule porta appesa la taglia:
  //  'aula:grande'. L'ambienza pero' e' una sola per acustica — di un'aula
  //  cambia la coda, non il brusio — e per quella si guarda solo la prima
  //  meta' della chiave.
  impostaAcustica(chiave, immediato = false) {
    if (!this.riv || (chiave === this.acustica && !immediato)) return;
    this.acustica = chiave;
    const base = chiave.split(':')[0];
    const t = this.ctx.currentTime, d = immediato ? 0.01 : 0.45;
    const muovi = (par, v) => {
      par.cancelScheduledValues(t); par.setValueAtTime(par.value, t);
      par.linearRampToValueAtTime(v, t + d);
    };
    //  TELEFONO (30/09/2026): un convolutore lavora finche' gli arriva suono,
    //  anche con l'uscita a zero. Col grafo di avellino/ i sette del mondo
    //  giravano TUTTI per tutta la partita, perche' i pezzi suonano sempre:
    //  code fino a 3,2 s, il pezzo piu' caro del grafo, per sentirne uno.
    //  Adesso l'ingresso ce l'ha solo l'acustica in uso. Si stacca l'INGRESSO,
    //  non l'uscita: la coda di quella che si lascia continua a spegnersi da
    //  sola mentre il suo guadagno scende, quindi non si taglia niente.
    //  Collegare due volte la stessa coppia non fa niente, e staccarne una
    //  che non c'e' solleva un errore: di qui i try.
    for (const [z, r] of Object.entries(this.riv)) {
      const usa = z === chiave;
      for (const [bus, nodo] of [[this.busRiverbero, r.conv], [this.busRiverberoMondo, r.convM]]) {
        if (usa && !nodo._collegato) { bus.connect(nodo); nodo._collegato = true; }
        if (!usa && nodo._collegato) { try { bus.disconnect(nodo); } catch (e) {} nodo._collegato = false; }
      }
      muovi(r.wet.gain, usa ? r.livello : 0);
      muovi(r.wetM.gain, usa ? r.livello : 0);
    }
    //  Di notte l'esterno suona la sua versione notturna, se c'e' davvero.
    const zona = this.notte && this.amb[base + '_notte'] &&
                 this.stato[CONFIG.ambienze[base + '_notte'].file] !== 'segnaposto' ? base + '_notte' : base;
    for (const [z, a] of Object.entries(this.amb)) muovi(a.gain.gain, z === zona ? CONFIG.ambienze[z].volume : 0);
  }

  // ===========================================================================
  //  LE SORGENTI — pezzi, esche, oggetti
  // ===========================================================================
  //  Sono tutte fatte allo stesso modo: uno o piu' rami in loop perpetuo, un
  //  guadagno che dipende dalla distanza e un pan che dipende dalla direzione.
  //  Il loop non si ferma MAI: si alza e si abbassa. Fermare e far ripartire un
  //  loop a ogni cambio di stato si sente, e si sente male.
  // ---------------------------------------------------------------------------
  avviaSorgenti() {
    const t0 = this.ctx.currentTime + 0.15;
    this.tMusica = t0;
    this.sorgenti = {};

    const crea = (cfg, rami, bus, tipo) => {
      const gDist = this.ctx.createGain(); gDist.gain.value = 0;
      const pan = this.panner();
      gDist.connect(pan);

      //  Un pezzo ha DUE uscite e ne usa una alla volta: quella del mondo,
      //  che nella scorciatoia si chiude, e quella di chi ti segue, che non si
      //  chiude mai. Non e' un secondo suono: e' lo stesso musicista che
      //  cambia strada dentro il mixer, esattamente come i rami cambiano
      //  versione. Il passaggio e' un incrocio di un quarto di secondo.
      const gMondo = this.ctx.createGain(); gMondo.gain.value = 1;
      pan.connect(gMondo); gMondo.connect(bus);
      let gSeguito = null;
      if (tipo === 'pezzo') {
        gSeguito = this.ctx.createGain(); gSeguito.gain.value = 0;
        pan.connect(gSeguito); gSeguito.connect(this.busPezziAlSeguito);
      }

      const S = { id: cfg.id, cfg, tipo, gDist, pan, gMondo, gSeguito, rami: {},
                  x: 0, y: 0, attivo: false, livello: 0, sfasato: false,
                  alSeguito: false };
      for (const [nome, file] of Object.entries(rami)) {
        const vol = this.ctx.createGain();
        vol.gain.value = 0;
        vol.connect(gDist);
        S.rami[nome] = { vol, src: null, file };
        this.faiPartireRamo(S, nome, t0, 0);
      }
      this.sorgenti[cfg.id] = S;
      return S;
    };

    //  Due rami per ogni strumento, come per gli oggetti: e' lo STESSO
    //  musicista che cambia modo di suonare, non un altro suono che parte.
    //  Il ramo del concerto sta a zero per tutta la partita e si alza soltanto
    //  quando salgono sul palco.
    for (const p of CONFIG.pezzi) {
      const S = crea(p, { aula: this.fileStrumento(p.id),
                          concerto: this.fileStrumento(p.id, 'concerto') },
                     this.busPezzi, 'pezzo');
      S.rami.aula.vol.gain.value = 1;
      S.rami.concerto.vol.gain.value = 0;
      S.alConcerto = false;
    }
    for (const o of CONFIG.oggetti) {
      const S = crea(o, { dormiente: CONFIG.fileOggetto(o.id, 'dormiente'),
                          sveglio:   CONFIG.fileOggetto(o.id, 'sveglio') },
                     this.busOggetti, 'oggetto');
      S.sveglio = false;
      S.rami.dormiente.vol.gain.value = CONFIG.volumeDormiente;
      S.rami.sveglio.vol.gain.value = 0;
    }

    // I due personaggi: un loop ciascuno, sempre acceso finche' sono in gioco.
    // Il colloquio ha due rami — le due varianti — e ne suona uno alla volta.
    const P = CONFIG.personaggi;
    crea(P.trombettista, { unico: P.trombettista.file }, this.busPersonaggi, 'personaggio')
      .rami.unico.vol.gain.value = 1;
    crea(P.alba, { unico: P.alba.file }, this.busPersonaggi, 'personaggio')
      .rami.unico.vol.gain.value = 1;
    const C = crea(P.colloquio,
                   Object.fromEntries(P.colloquio.varianti.map((f, k) => ['v' + k, f])),
                   this.busPersonaggi, 'personaggio');
    for (const r of Object.values(C.rami)) r.vol.gain.value = 0;
  }

  //  IL PEZZO PASSA DA «NEL MONDO» A «DIETRO DI TE», e viceversa quando lo
  //  consegni. Si chiama a ogni fotogramma con lo stato vero e non fa niente
  //  finche' non cambia davvero: cosi' non c'e' un solo punto del gioco in cui
  //  ci si possa dimenticare di dirlo.
  routingSeguito(S, seguito) {
    if (!S.gSeguito || S.alSeguito === !!seguito) return;
    S.alSeguito = !!seguito;
    const t = this.ctx.currentTime;
    S.gMondo.gain.setTargetAtTime(S.alSeguito ? 0 : 1, t, 0.08);
    S.gSeguito.gain.setTargetAtTime(S.alSeguito ? 1 : 0, t, 0.08);
  }

  //  Un solo ramo alla volta, per le sorgenti che hanno varianti: il colloquio
  //  ne sceglie una a ogni incontro. Non si ferma il loop, si sposta il
  //  volume — fermare e far ripartire si sente, e si sente male.
  scegliRamo(id, ramo) {
    const S = this.sorgenti[id];
    if (!S) return;
    const t = this.ctx.currentTime;
    for (const [nome, R] of Object.entries(S.rami))
      R.vol.gain.setTargetAtTime(nome === ramo ? 1 : 0, t, 0.12);
  }

  //  TELEFONO (30/09/2026): il ramo del concerto parte solo al concerto. In
  //  avellino/ girava a volume zero per tutta la partita: otto loop muti che
  //  il telefono doveva comunque leggere. `vaiAlConcerto` lo fa partire da
  //  capo in ogni caso, quindi prima non serviva a niente.
  faiPartireRamo(S, ramo, quando, offset) {
    const R = S.rami[ramo];
    if (R.src) { try { R.src.stop(); } catch (e) {} R.src = null; }
    if (ramo === 'concerto' && !S.alConcerto) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.bufferDi(R.file);
    if (!s.buffer) return;
    s.loop = true;
    s.connect(R.vol);
    s.start(quando, s.buffer.duration ? (offset % s.buffer.duration) : 0);
    R.src = s;
  }

  //  Casella 3: l'oggetto non cambia file, cambia STATO. I due rami suonano
  //  insieme e si scambiano il posto in mezzo secondo: e' lo stesso oggetto
  //  che si sveglia, non un altro suono che parte.
  svegliaOggetto(id, sveglio = true) {
    const S = this.sorgenti[id];
    if (!S || S.tipo !== 'oggetto' || S.sveglio === sveglio) return false;
    S.sveglio = sveglio;
    const t = this.ctx.currentTime;
    S.rami.dormiente.vol.gain.setTargetAtTime(sveglio ? 0 : CONFIG.volumeDormiente, t, 0.18);
    S.rami.sveglio.vol.gain.setTargetAtTime(sveglio ? CONFIG.volumeSveglio : 0, t, 0.18);
    return true;
  }

  //  Casella 8, il viaggio: chi ti segue suona a frammenti NON sincronizzati
  //  fra loro. Ognuno riparte da un punto a caso del proprio loop e va a una
  //  velocita' appena diversa, cosi' si allontanano fra loro mentre cammini:
  //  ingombrante, fuori tempo, ti copre le orecchie.
  scombina(id) {
    const S = this.sorgenti[id];
    if (!S) return;
    S.sfasato = true;
    const t = this.ctx.currentTime + 0.02;
    for (const nome of Object.keys(S.rami)) {
      const R = S.rami[nome];
      const dur = R.src && R.src.buffer ? R.src.buffer.duration : this.durataLoop;
      this.faiPartireRamo(S, nome, t, Math.random() * dur);
      if (R.src && R.src.detune) R.src.detune.value = (Math.random() * 2 - 1) * 9;
      if (R.src) R.src.playbackRate.value = 1 + (Math.random() * 2 - 1) * 0.012;
    }
  }

  //  Casella 8, l'arrivo: gli stessi suonano INSIEME. Nessuna nota nuova —
  //  cambia solo se stanno insieme, ed e' tutta la differenza fra la sala
  //  prove e il concerto.
  allinea(ids) {
    const t = this.ctx.currentTime + 0.06;
    for (const id of ids) {
      const S = this.sorgenti[id];
      if (!S) continue;
      S.sfasato = false;
      for (const nome of Object.keys(S.rami)) {
        this.faiPartireRamo(S, nome, t, 0);
        const R = S.rami[nome];
        //  `cancelScheduledValues` prima del valore, sempre: la sporcatura
        //  della cattura e' una CURVA programmata, e scrivere `.value = 1`
        //  sopra una curva in corso non la ferma — il valore torna indietro al
        //  campione dopo. Senza questo, dopo un ricomincia i pezzi ripartivano
        //  ancora ubriachi.
        if (R.src) {
          this.fermaAutomazione(R.src.playbackRate, t);
          R.src.playbackRate.value = 1;
          if (R.src.detune) { R.src.detune.cancelScheduledValues(t); R.src.detune.value = 0; }
        }
        S.sporcoFino = 0; S.sporcoV = 1;
      }
    }
  }

  // ---------------------------------------------------------------------------
  //  IL CONCERTO — gli stessi strumenti, l'altra versione, tutti in fase
  // ---------------------------------------------------------------------------
  //  Non parte un suono nuovo: si spegne il ramo dell'aula e si alza quello del
  //  concerto, sullo stesso musicista. E partono tutti allo STESSO istante, da
  //  capo: e' l'unica cosa che il gioco impone, perche' nessuno ha fissato un
  //  tempo comune e l'unico incastro possibile e' l'attacco.
  //
  //  Torna l'istante d'attacco e la durata del loop piu' lungo: la scena la usa
  //  per finire su un giro intero invece che a meta' frase.
  vaiAlConcerto(ids) {
    const t = this.ctx.currentTime + 0.08;
    let durata = 0;
    for (const id of ids) {
      const S = this.sorgenti[id];
      if (!S || !S.rami.concerto) continue;
      S.sfasato = false;
      S.alConcerto = true;
      this.faiPartireRamo(S, 'concerto', t, 0);
      const R = S.rami.concerto;
      if (R.src) {
        this.fermaAutomazione(R.src.playbackRate, t);
        R.src.playbackRate.value = 1;
        if (R.src.detune) { R.src.detune.cancelScheduledValues(t); R.src.detune.value = 0; }
        if (R.src.buffer) durata = Math.max(durata, R.src.buffer.duration);
      }
      S.rami.aula.vol.gain.setTargetAtTime(0, t, 0.10);
      R.vol.gain.setTargetAtTime(1, t, 0.10);
    }
    return { quando: t, durata: durata || this.durataLoop };
  }

  //  La sfumata di chiusura: il brano si spegne sul ramo del concerto, non sul
  //  volume della distanza. Due secondi non si ottengono con `setTargetAtTime`
  //  — quello e' una costante di tempo, non una durata.
  //
  //  NON E' PIU' UNA RETTA. Una rampa lineare sull'ampiezza, all'orecchio, non
  //  e' una sfumata: i primi tre quarti si sentono quasi pieni e l'ultimo
  //  scalino — dai -12 dB al silenzio — dura un attimo. Gianluca il
  //  14/09/2026: «viene troncata troppo bruscamente alla fine». Questa curva
  //  arriva allo zero con pendenza nulla: verso il fondo rallenta invece di
  //  cadere, e il silenzio si posa. 128 punti bastano — sono uno ogni 35
  //  millesimi su una sfumata di quattro secondi e mezzo.
  sfumaConcerto(ids, secondi) {
    const t = this.ctx.currentTime;
    const N = 128;
    for (const id of ids) {
      const S = this.sorgenti[id];
      if (!S || !S.rami.concerto) continue;
      const g = S.rami.concerto.vol.gain;
      const v0 = g.value;
      const curva = new Float32Array(N);
      for (let k = 0; k < N; k++) {
        const q = k / (N - 1);
        curva[k] = v0 * 0.5 * (1 + Math.cos(Math.PI * q));
      }
      curva[N - 1] = 0;
      this.fermaAutomazione(g, t);
      //  Una curva scritta sopra un'automazione ancora in corso solleva
      //  un'eccezione, e l'`attacco` ne lascia una accesa (`setTargetAtTime`
      //  non ha una fine). Se capita si ripiega sulla retta: meglio una
      //  sfumata meno bella di un brano che resta acceso.
      try {
        g.setValueCurveAtTime(curva, t, Math.max(0.05, secondi));
      } catch (e) {
        g.setValueAtTime(v0, t);
        g.linearRampToValueAtTime(0, t + secondi);
      }
    }
  }

  //  Si torna in aula a partita nuova: il ramo del concerto si spegne di
  //  colpo, non in dissolvenza — fra una partita e l'altra non c'e' niente da
  //  raccordare.
  tornaInAula() {
    if (!this.sorgenti) return;
    const t = this.ctx.currentTime;
    for (const p of CONFIG.pezzi) {
      const S = this.sorgenti[p.id];
      if (!S || !S.rami.concerto) continue;
      S.alConcerto = false;
      //  `fermaAutomazione` e non `cancelScheduledValues`: se si ricomincia
      //  a sfumata ancora in corso la curva va tagliata, altrimenti il
      //  `setValueAtTime` sopra solleva un'eccezione e la partita non riparte
      this.fermaAutomazione(S.rami.aula.vol.gain, t);
      S.rami.aula.vol.gain.setValueAtTime(1, t);
      this.fermaAutomazione(S.rami.concerto.vol.gain, t);
      S.rami.concerto.vol.gain.setValueAtTime(0, t);
      //  gia' a zero: si ferma anche il loop, riparte al prossimo concerto
      if (S.rami.concerto.src) {
        try { S.rami.concerto.src.stop(t + 0.01); } catch (e) {}
        S.rami.concerto.src = null;
      }
    }
  }

  // ---------------------------------------------------------------------------
  //  LA VERSIONE DEL TRASCINAMENTO — non si registra, si sporca
  // ---------------------------------------------------------------------------
  //  La terza versione della clip la fa il gioco, e costa zero agli studenti:
  //  un musicista che ti cammina dietro per mezzo edificio non suona un'altra
  //  interpretazione, suona MALE. Tre cose insieme:
  //
  //  - la velocita' di lettura vaga (gli attacchi perdono il passo);
  //  - l'intonazione scivola in giu', che e' il verso in cui scivola davvero;
  //  - nessuna delle due e' monotona: e' un passo storto, non un rallentando.
  //
  //  SOLO MENTRE TI SEGUONO, e non durante la cattura. Deciso da Gianluca il
  //  13/09/2026: quelli che avevi dietro, quando Aluzzi ti porta via, restano
  //  lontani e non si sentono — farli suonare male li' non racconta niente.
  //  Si sporca chi ti cammina dietro adesso, e appena lo consegni torna pulito:
  //  e' quello il momento in cui il gioco dice che sono arrivati.
  //
  //  Si chiama a OGNI FOTOGRAMMA con l'elenco di chi ti segue: chi entra si
  //  sporca, chi esce torna pulito, e la curva si rinnova prima di scadere,
  //  perche' un trascinamento puo' durare minuti e una curva sola dura 14 s.
  //  Si tocca il solo ramo dell'aula: e' quello che si sente mentre cammini.
  sporcaTrascinati(ids) {
    if (!this.sorgenti) return;
    const t = this.ctx.currentTime;
    const dietro = new Set(ids);
    for (const [id, S] of Object.entries(this.sorgenti)) {
      if (S.tipo !== 'pezzo') continue;
      if (dietro.has(id)) {
        //  si riprogramma quando alla curva in corso resta meno di mezzo
        //  secondo, e la nuova parte da dove finiva la vecchia: cosi' fra un
        //  tratto e l'altro non c'e' uno scalino che si sente
        if (!(S.sporcoFino > t + 0.5))
          S.sporcoFino = this.sporcaRamo(S, Math.max(t + 0.02, S.sporcoFino || 0));
      } else if (S.sporcoFino) {
        this.pulisciRamo(S);
      }
    }
  }

  //  SI USA LA SOLA VELOCITA' DI LETTURA, non il `detune`.
  //  Due motivi, e il secondo e' un difetto gia' pagato:
  //  1. su un buffer la velocita' muove insieme il passo e l'altezza, che e'
  //     poi quello che succede a un musicista che perde il filo: non servono
  //     due manopole per dire una cosa sola;
  //  2. il `detune` e' gia' di qualcun altro. Il wow del disturbatore lo
  //     riscrive a OGNI fotogramma su tutte le sorgenti, e una curva
  //     programmata sopra fa scoppiare `setTargetAtTime` con
  //     «overlaps setValueCurveAtTime». Preso dal collaudo, non a occhio.
  sporcaRamo(S, quando) {
    const R = S.rami.aula;
    if (!R || !R.src) return 0;
    const DURATA = 14, PASSI = 28;
    const vel = new Float32Array(PASSI);
    let v = S.sporcoV || 1;
    for (let k = 0; k < PASSI; k++) {
      //  richiamo verso 1: senza, il cammino casuale scappa da una parte sola
      //  e in tre minuti diventa un rallentando, che e' un'altra cosa. Cosi'
      //  invece vaga e non se ne va mai del tutto.
      v += (Math.random() * 2 - 1) * 0.013 + (1 - v) * 0.22;
      vel[k] = Math.max(0.95, Math.min(1.04, v));
    }
    S.sporcoV = vel[PASSI - 1];
    try {
      this.fermaAutomazione(R.src.playbackRate, quando);
      R.src.playbackRate.setValueCurveAtTime(vel, quando, DURATA);
    } catch (e) { return 0; }
    return quando + DURATA;
  }

  //  Torna pulito, in un quarto di secondo. `scombina` pero' non si disfa: chi
  //  ti ha seguito resta fuori fase rispetto agli altri finche' non lo
  //  consegni, e quella e' un'altra cosa — la decide la casella 8, non questa.
  pulisciRamo(S) {
    const t = this.ctx.currentTime;
    const R = S.rami.aula;
    S.sporcoFino = 0; S.sporcoV = 1;
    if (!R || !R.src) return;
    this.fermaAutomazione(R.src.playbackRate, t);
    R.src.playbackRate.setTargetAtTime(1, t, 0.25);
  }

  //  Fermare una curva GIA' IN CORSO non lo fa `cancelScheduledValues`: quello
  //  toglie solo gli appuntamenti futuri, la curva partita prima resta, e la
  //  prima automazione che le si scrive sopra solleva un'eccezione.
  //  `cancelAndHoldAtTime` la taglia e tiene il valore raggiunto.
  fermaAutomazione(par, t) {
    if (par.cancelAndHoldAtTime) par.cancelAndHoldAtTime(t);
    else par.cancelScheduledValues(t);
  }

  //  IL PAN CHE TRATTA UN MONO COME UNO STEREO CON DUE CANALI UGUALI.
  //  TELEFONO (30/09/2026): i segnaposto adesso sono mono (meta' memoria). Il
  //  pan di serie, con un ingresso mono, divide la potenza fra i due lati:
  //  al centro -3 dB, e il livello cambierebbe spostandosi. Con
  //  `explicit` a 2 canali il mono entra copiato su tutti e due i lati e il
  //  pan lavora come lavorava prima coi segnaposto stereo: stessi livelli,
  //  stesso comportamento ai lati. Un file vero stereo non cambia niente.
  panner() {
    const pan = this.ctx.createStereoPanner();
    try { pan.channelCountMode = 'explicit'; pan.channelCount = 2; } catch (e) {}
    return pan;
  }

  //  Una partita nuova non eredita i loop scombinati di quella prima. Senza
  //  questo, dopo un ricomincia i pezzi gia' portati ripartivano fuori tempo
  //  "gia' di default", e il salto della casella 8 non si sentiva piu'.
  azzeraSorgenti() {
    if (!this.pronto) return;
    for (const S of Object.values(this.sorgenti)) this.routingSeguito(S, false);
    this.tornaInAula();
    this.allinea(Object.keys(this.sorgenti));
    for (const o of CONFIG.oggetti) this.svegliaOggetto(o.id, false);
    this.dentroScorciatoia = true; this.impostaScorciatoia(false);
    this.musicaAccesa = true; this.impostaMusica(false);
    this.occluso = true; this.disturbato = true; this.nellAlone = true;
    this.impostaMondo({ occlusione: false, disturbo: false, alone: false });
    this.scegliRamo(CONFIG.personaggi.colloquio.id, null);
  }

  // ---------------------------------------------------------------------------
  //  IL CUORE: la posizione del giocatore diventa il mix
  // ---------------------------------------------------------------------------
  //  `voci` e' una lista di { id, x, y, attivo, insieme } che il gioco ricompone
  //  a ogni fotogramma. `insieme` vuol dire "sta nella stanza in cui sto io":
  //  li' il pezzo si sente pieno e gli altri si abbassano.
  // ---------------------------------------------------------------------------
  //  TELEFONO (30/09/2026): SI CALCOLA A OGNI FOTOGRAMMA, SI RIPROGRAMMA
  //  MOLTO MENO. In avellino/ volume e pan di ogni sorgente si riscrivevano a
  //  ogni fotogramma, anche fermi: ~2600 automazioni al secondo, ognuna un
  //  messaggio al thread audio. Adesso al massimo 20 volte al secondo, e solo
  //  se il valore si e' mosso davvero. Non si sente: `setTargetAtTime` con
  //  0,12 s di costante addolcisce comunque il gradino di 50 ms.
  //  `livello` (lo legge il disegno) resta aggiornato a ogni fotogramma.
  aggiornaSpazio(px, py, voci) {
    if (!this.pronto) return;
    const S = CONFIG.spazio, t = this.ctx.currentTime;
    const inUnaStanza = voci.some(v => v.insieme);
    const scrivi = this.tocca('spazio', t);

    for (const v of voci) {
      const s = this.sorgenti[v.id];
      if (!s) continue;
      s.x = v.x; s.y = v.y; s.attivo = !!v.attivo;
      this.routingSeguito(s, v.alSeguito);

      let vol;
      if (!v.attivo) {
        vol = 0;
      } else if (v.insieme) {
        vol = S.dentroLaStanza;
      } else {
        //  `raggio` e `fondo` si possono scavalcare per voce: il trombettista
        //  e Alba hanno il raggio di quanto se ne vede e un fondo a zero, e
        //  fuori da li' non esistono. Chi non li passa usa i numeri generali.
        const raggio = v.raggio || S.raggioUdibile;
        const fondo = v.fondo === undefined ? S.fondo : v.fondo;
        const dist = Math.hypot(v.x - px, v.y - py);
        const vicinanza = Math.max(0, 1 - dist / raggio);
        vol = fondo + (1 - fondo) * Math.pow(vicinanza, S.curva);
        if (inUnaStanza) vol *= S.attenuaAltri;
      }
      s.livello = vol;
      if (!scrivi) continue;
      if (MotoreAudio.cambiato(s._vol, vol, 0.002)) {
        s.gDist.gain.setTargetAtTime(vol, t, 0.12); s._vol = vol;
      }
      const panPieno = Math.max(-1, Math.min(1, (v.x - px) / S.ampiezzaPan));
      const pan = panPieno * this.larghezza;
      if (MotoreAudio.cambiato(s._pan, pan, 0.005)) {
        s.pan.pan.setTargetAtTime(pan, t, 0.12); s._pan = pan;
      }
    }
  }

  //  Vero al massimo 20 volte al secondo per ciascun `nome`.
  tocca(nome, t) {
    const T = this._tocchi || (this._tocchi = {});
    if (T[nome] !== undefined && t - T[nome] < 0.05 && t >= T[nome]) return false;
    T[nome] = t;
    return true;
  }

  //  Il valore si e' mosso abbastanza da riscriverlo? Lo zero conta sempre:
  //  un volume che deve spegnersi non resta a un millesimo.
  static cambiato(prima, ora, soglia) {
    if (prima === undefined) return true;
    if ((prima === 0) !== (ora === 0)) return true;
    return Math.abs(ora - prima) > soglia;
  }

  // ===========================================================================
  //  CASELLA 4 — LA MUSICA DEL PEGGIORAMENTO
  // ===========================================================================
  //  Un solo strato, e per tutta la prima fase e' spento. Entra in dissolvenza
  //  lunga: se sbattesse dentro sarebbe un evento, e invece e' uno stato.
  // ---------------------------------------------------------------------------
  avviaMusica() {
    this.gMusica = this.ctx.createGain();
    this.gMusica.gain.value = 0;
    this.gMusica.connect(this.busMusica);
    const s = this.ctx.createBufferSource();
    s.buffer = this.buffer[CONFIG.musica.file];
    s.loop = true; s.connect(this.gMusica); s.start();
    this.srcMusica = s;
    this.musicaAccesa = false;
  }

  impostaMusica(accesa) {
    if (!this.gMusica || this.musicaAccesa === accesa) return false;
    this.musicaAccesa = accesa;
    const t = this.ctx.currentTime;
    this.gMusica.gain.cancelScheduledValues(t);
    this.gMusica.gain.setValueAtTime(this.gMusica.gain.value, t);
    this.gMusica.gain.linearRampToValueAtTime(accesa ? CONFIG.musica.volume : 0,
                                              t + (accesa ? CONFIG.musica.entrata : 1.2));
    return true;
  }

  // ===========================================================================
  //  CASELLA 5 — L'INSEGUITORE: un loop e una manopola, non un file per stato
  // ===========================================================================
  avviaInseguitore() {
    this.gInseguitore = this.ctx.createGain();
    this.gInseguitore.gain.value = 0;
    this.panInseguitore = this.panner();
    this.gInseguitore.connect(this.panInseguitore);
    this.panInseguitore.connect(this.busInseguitore);
    const s = this.ctx.createBufferSource();
    s.buffer = this.buffer[CONFIG.inseguitore.file];
    s.loop = true; s.connect(this.gInseguitore); s.start();
    this.srcInseguitore = s;
    this.tensione = 0;
  }

  //  `distanza` in px, oppure null quando l'inseguitore non e' in gioco.
  //  La tensione e' un parametro continuo: e' la casella 5 in una riga.
  aggiornaInseguitore(distanza, dx) {
    if (!this.gInseguitore) return;
    //  come `aggiornaSpazio`: 20 volte al secondo, e solo se cambia
    const I = CONFIG.inseguitore, t = this.ctx.currentTime;
    if (distanza === null || distanza === undefined) {
      this.tensione = 0;
      if (this._vIns !== 0) {
        this.gInseguitore.gain.setTargetAtTime(0, t, 0.5); this._vIns = 0;
      }
      return;
    }
    const vicinanza = Math.max(0, 1 - distanza / I.raggioUdibile);
    this.tensione = Math.pow(vicinanza, I.curva);
    if (!this.tocca('inseguitore', t)) return;
    const v = I.volumeMin + (I.volumeMax - I.volumeMin) * this.tensione;
    if (MotoreAudio.cambiato(this._vIns, v, 0.002)) {
      this.gInseguitore.gain.setTargetAtTime(v, t, 0.15); this._vIns = v;
    }
    const p = Math.max(-1, Math.min(1, (dx || 0) / CONFIG.spazio.ampiezzaPan)) * this.larghezza;
    if (MotoreAudio.cambiato(this._pIns, p, 0.005)) {
      this.panInseguitore.pan.setTargetAtTime(p, t, 0.15); this._pIns = p;
    }
  }

  // ===========================================================================
  //  LE LAVORAZIONI — caselle 6, 7, 9
  // ===========================================================================
  //  Qui non parte nessun file: si muovono manopole. E' la differenza fra
  //  «l'audio e' una lista di file» e «l'audio e' anche una manopola», ed e'
  //  esattamente cio' che le caselle 6 e 7 devono insegnare.
  //
  //  OCCLUSIONE (7): si sente MENO. Passa-basso stretto e risonante, fronte
  //  stereo quasi mono, volume giu': la testa dentro una scatola.
  //  DISTURBO (6): si sente MALE. L'intonazione ondeggia in modo irregolare e
  //  il fronte si accartoccia — la direzione da cui arriva un pezzo non e' piu'
  //  affidabile. Si sente tutto, ma si sbaglia strada.
  // ---------------------------------------------------------------------------
  impostaMondo({ occlusione, disturbo, alone }) {
    if (!this.pronto) return;
    if (occlusione !== undefined) this.occluso = !!occlusione;
    if (disturbo !== undefined) this.disturbato = !!disturbo;
    if (alone !== undefined) this.nellAlone = !!alone;

    const O = CONFIG.occlusione, D = CONFIG.disturbo,
          T = CONFIG.personaggi.trombettista, t = this.ctx.currentTime;
    const tr = this.occluso || !this.disturbato ? O.transizione : D.transizione;

    // l'occlusione vince: e' piu' stretta, e chi e' occluso e' protetto dal
    // disturbatore per regola di gioco (casella 7). L'alone del trombettista
    // e' il piu' largo dei tre: chiude per ultimo e cede a chiunque altro.
    const taglio = this.occluso ? O.taglio
                 : this.disturbato ? D.taglio
                 : this.nellAlone ? T.taglio : TAGLIO_APERTO;
    const q = this.occluso ? O.risonanza : 0.7;
    const vol = this.occluso ? O.attenuazione : 1;
    this.taglioCorrente = taglio;

    this.filtroMondo.frequency.setTargetAtTime(taglio, t, tr);
    this.filtroMondo.Q.setTargetAtTime(q, t, tr);
    this.volMondo.gain.setTargetAtTime(vol, t, tr);
  }

  //  Casella 9: dentro la scorciatoia i pezzi non arrivano. Non e' un muto
  //  netto — e' un varco che si chiude in un terzo di secondo mentre ci entri.
  impostaScorciatoia(dentro) {
    if (!this.pronto || this.dentroScorciatoia === !!dentro) return false;
    this.dentroScorciatoia = !!dentro;
    this.gPezziMondo.gain.setTargetAtTime(this.dentroScorciatoia ? 0 : 1,
                                          this.ctx.currentTime, 0.12);
    return true;
  }

  //  Il wow del disturbatore e la larghezza del fronte stereo si muovono a ogni
  //  fotogramma: sono continui, non commutati.
  //
  //  TELEFONO (30/09/2026): il wow si CALCOLA a ogni fotogramma (la sua fase
  //  corre col tempo del gioco) ma si SCRIVE 20 volte al secondo. In
  //  avellino/ col disturbo acceso erano ~1600 automazioni al secondo, una
  //  per sorgente a fotogramma. Il wow piu' veloce fa meno di un giro al
  //  secondo e `setTargetAtTime` a 0,08 s lo liscia: il gradino non c'e'.
  //  Il `detune` resta solo del wow — vedi `sporcaRamo`.
  aggiornaMondo(dt) {
    if (!this.pronto) return;
    const O = CONFIG.occlusione, D = CONFIG.disturbo, t = this.ctx.currentTime;

    this.larghezza = this.occluso ? O.larghezza : (this.disturbato ? D.larghezza : 1);

    this.tWow += dt;
    if (!this.tocca('mondo', t)) return;
    let cent = 0;
    if (this.disturbato && !this.occluso) {
      const [f1, f2, f3] = D.wowVelocita;
      const w = (Math.sin(2 * Math.PI * f1 * this.tWow) +
                 Math.sin(2 * Math.PI * f2 * this.tWow + 1.7) +
                 Math.sin(2 * Math.PI * f3 * this.tWow + 3.9)) / 3;
      cent = w * D.wowCent;
    }
    if (Math.abs(cent - this.centCorrente) < 0.4 && cent === 0) return;
    this.centCorrente = cent;

    for (const s of Object.values(this.sorgenti)) {
      for (const R of Object.values(s.rami)) {
        // i seguaci scombinati hanno gia' un loro scarto: non glielo si azzera
        if (s.sfasato && cent === 0) continue;
        if (R.src && R.src.detune) R.src.detune.setTargetAtTime(cent, t, 0.08);
      }
    }
  }

  // ===========================================================================
  //  BANCO DI MISSAGGIO — silenzia e isola, come su un mixer
  // ===========================================================================
  //  Due livelli: i bus e i singoli eventi. Il solo funziona come su una
  //  console: se almeno una voce e' in solo, tutto cio' che non lo e' tace.
  // ---------------------------------------------------------------------------
  preparaMix() {
    this.mixBus = {};
    for (const b of ['pezzi', 'oggetti', 'personaggi', 'inseguitore', 'musica',
                     'eventi', 'ambienze', 'riverbero'])
      this.mixBus[b] = { muto: false, solo: false };
    this.mixEv = {};
    for (const id of Object.keys(CONFIG.eventi)) this.mixEv[id] = { muto: false, solo: false };
    if (!this.fader) this.fader = this.leggiFader();
  }

  // I cursori restano memorizzati: chi trova un equilibrio non lo riperde
  leggiFader() {
    const base = { ...CONFIG.livelli };
    try {
      const salvati = JSON.parse(localStorage.getItem('avellino-livelli') || '{}');
      for (const k of Object.keys(base))
        if (typeof salvati[k] === 'number') base[k] = salvati[k];
    } catch (e) { /* niente memoria: si usano i valori di partenza */ }
    return base;
  }

  impostaFader(nome, valore) {
    this.fader[nome] = valore;
    try { localStorage.setItem('avellino-livelli', JSON.stringify(this.fader)); } catch (e) {}
    this.applicaMix();
  }

  //  I cursori viaggiano con i suoni: `livelli.json` nella cartella `audio/`.
  //  Si leggono solo le chiavi che il banco conosce, e solo se sono numeri.
  impostaLivelli(dati) {
    if (!dati || typeof dati !== 'object') return false;
    const L = dati.livelli || dati;
    let n = 0;
    for (const k of Object.keys(CONFIG.livelli))
      if (typeof L[k] === 'number' && isFinite(L[k])) { this.fader[k] = L[k]; n++; }
    if (!n) return false;
    try { localStorage.setItem('avellino-livelli', JSON.stringify(this.fader)); } catch (e) {}
    this.applicaMix();
    return true;
  }

  testoLivelli() {
    return JSON.stringify({ gioco: 'Avellino — le nove caselle', livelli: this.fader }, null, 2) + '\n';
  }

  azzeraFader() {
    this.fader = { ...CONFIG.livelli };
    try { localStorage.removeItem('avellino-livelli'); } catch (e) {}
    this.applicaMix();
  }

  commutaMix(tipo, chiave, campo) {
    const t = tipo === 'bus' ? this.mixBus : this.mixEv;
    t[chiave][campo] = !t[chiave][campo];
    this.applicaMix();
    return t[chiave][campo];
  }

  azzeraMix() { this.preparaMix(); this.applicaMix(); }

  // un bus si sente se non e' muto e, quando c'e' un solo attivo, se e' lui
  busAudibile(b) {
    const soloAttivo = Object.values(this.mixBus).some(v => v.solo);
    const s = this.mixBus[b];
    return !!s && !s.muto && (!soloAttivo || s.solo);
  }

  eventoAudibile(id) {
    if (!this.busAudibile('eventi')) return false;
    const soloAttivo = Object.values(this.mixEv).some(v => v.solo);
    const s = this.mixEv[id];
    return s && !s.muto && (!soloAttivo || s.solo);
  }

  applicaMix() {
    if (!this.busPezzi) return;
    const t = this.ctx.currentTime;
    const v = (bus, fader) => (this.busAudibile(bus) ? 1 : 0) *
                              (fader === undefined || this.fader[fader] === undefined ? 1 : this.fader[fader]);
    this.master.gain.setTargetAtTime(this.fader.generale, t, 0.03);
    this.busPezzi.gain.setTargetAtTime(v('pezzi', 'pezzi'), t, 0.03);
    //  chi ti segue sta sullo stesso cursore dei pezzi: e' lo stesso musicista,
    //  cambia solo la strada che fa dentro il mixer
    this.busPezziAlSeguito.gain.setTargetAtTime(v('pezzi', 'pezzi'), t, 0.03);
    this.busOggetti.gain.setTargetAtTime(v('oggetti', 'pezzi'), t, 0.03);
    this.busPersonaggi.gain.setTargetAtTime(v('personaggi', 'personaggi'), t, 0.03);
    this.busInseguitore.gain.setTargetAtTime(v('inseguitore'), t, 0.03);
    this.busMusica.gain.setTargetAtTime(v('musica', 'musica'), t, 0.03);
    this.busEventi.gain.setTargetAtTime(v('eventi', 'eventi'), t, 0.03);
    this.busAmbiente.gain.setTargetAtTime(v('ambienze', 'ambienze'), t, 0.03);
    this.busRiverbero.gain.setTargetAtTime(this.busAudibile('riverbero') ? 1 : 0, t, 0.03);
    this.busRiverberoMondo.gain.setTargetAtTime(this.busAudibile('riverbero') ? 1 : 0, t, 0.03);
  }

  // ---------------------------------------------------------------------------
  //  EVENTI — l'unico punto di contatto fra gioco e suono per cio' che accade
  // ---------------------------------------------------------------------------
  suona(idEvento, opt = {}) {
    if (!this.pronto) return null;
    const cfg = CONFIG.eventi[idEvento];
    if (!cfg) return null;
    if (!opt.forzato && !this.eventoAudibile(idEvento)) return null;
    //  `variante` sceglie il file a turno invece che a caso: serve al bagno,
    //  dove le quattro scene devono ruotare.
    const nome = opt.variante !== undefined ? cfg.file[opt.variante % cfg.file.length]
                                            : cfg.file[Math.floor(Math.random() * cfg.file.length)];
    const buf = this.buffer[nome];
    if (!buf) return null;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    if (cfg.variazione) src.playbackRate.value = 1 + (Math.random() * 2 - 1) * cfg.variazione;

    const vol = this.ctx.createGain();
    const dist = opt.distanza === undefined ? 1 : opt.distanza;
    vol.gain.value = cfg.volume * (cfg.spazializza ? (0.25 + 0.75 * dist) : 1);

    const pan = this.panner();
    const p = cfg.spazializza ? Math.max(-1, Math.min(1, opt.pan || 0)) : 0;
    pan.pan.value = p * this.larghezza;

    src.connect(vol); vol.connect(pan);
    pan.connect(opt.forzato ? this.master : this.busEventi);
    if (cfg.riverbero > 0) {
      const send = this.ctx.createGain(); send.gain.value = cfg.riverbero;
      pan.connect(send); send.connect(this.busRiverbero);
    }
    src.start();
    return { nome, pan: pan.pan.value };
  }

  // ---------------------------------------------------------------------------
  //  SOSTITUZIONE AL VOLO — il nome del file decide dove finisce
  // ---------------------------------------------------------------------------
  //  Il nome che il Finder mostra non e' sempre quello vero. Segnalato dagli
  //  studenti (09/2026): file col nome giusto rifiutati, e poi accettati dopo
  //  averli rinominati «uguale». Tre cose invisibili a occhio:
  //  - estensione nascosta: la DAW esporta `pioggia.wav` + `.wav`, il Finder
  //    mostra `pioggia.wav` ma il file e' `pioggia.wav.wav`;
  //  - spazi in coda o prima del punto (`pioggia .wav`);
  //  - lettere accentate scritte in due pezzi (NFD) invece che in uno (NFC).
  //  Rinominando a mano il Finder li toglie tutti e tre: qui si fa lo stesso.
  static nomePulito(n) {
    return n.normalize('NFC').trim()
      .replace(/(\.wav)+$/i, '.wav')
      .replace(/\s+\.wav$/i, '.wav');
  }

  async sostituisci(file) {
    const nome = MotoreAudio.nomePulito(file.name);
    //  Un file che comincia con `strumento_NN` e' previsto anche se la coda non
    //  si e' mai vista prima: la coda e' il nome che lo studente ha scelto, e
    //  scoprirlo qui e' l'unico modo per chi apre index.html con un doppio clic.
    if (/^strumento_\d+/i.test(nome)) this.registraNomi([nome]);

    const voce = this.elencoFile().find(v => v.nome.toLowerCase() === nome.toLowerCase());
    if (!voce) return { ok: false, motivo: 'nome non previsto' };

    let buf, dati;
    try {
      dati = await file.arrayBuffer();
      // decodeAudioData consuma i dati: se ne tiene una copia per l'archivio
      buf = await this.ctx.decodeAudioData(dati.slice(0));
    } catch (e) { return { ok: false, motivo: 'formato non leggibile' }; }

    this.buffer[voce.nome] = buf;
    this.stato[voce.nome] = 'trascinato';
    this.archivioMetti(voce.nome, dati).catch(() => {});   // se fallisce, pazienza
    this.aggancia(voce, buf);
    return { ok: true, voce };
  }

  //  Un file che non c'e' piu' torna al segnaposto, e smette subito di suonare.
  tornaSegnaposto(voce) {
    const buf = this.generaSegnaposto(voce);
    this.buffer[voce.nome] = buf;
    this.stato[voce.nome] = 'segnaposto';
    this.aggancia(voce, buf);
  }

  //  Mette un buffer nuovo al posto giusto mentre il gioco gira.
  aggancia(voce, buf) {
    const ora = this.ctx.currentTime + 0.02;
    if (voce.gruppo === 'pezzi' || voce.gruppo === 'oggetti') {
      const S = this.sorgenti[voce.sorgente];
      //  il nome del file puo' essere cambiato sotto i piedi (una coda nuova):
      //  se il ramo resta agganciato al nome vecchio, continua a suonare il
      //  segnaposto anche con la registrazione buona gia' in memoria
      if (S && S.rami[voce.ramo]) S.rami[voce.ramo].file = voce.nome;
      // riparte in fase con gli altri: e' l'equivalente povero del live update
      const off = (this.ctx.currentTime - this.tMusica) % (buf.duration || this.durataLoop);
      if (S) this.faiPartireRamo(S, voce.ramo, ora, off);
    } else if (voce.gruppo === 'musica') {
      const acceso = this.musicaAccesa;
      try { this.srcMusica.stop(); } catch (e) {}
      const s = this.ctx.createBufferSource();
      s.buffer = buf; s.loop = true; s.connect(this.gMusica); s.start(ora);
      this.srcMusica = s;
      this.musicaAccesa = !acceso; this.impostaMusica(acceso);
    } else if (voce.gruppo === 'inseguitore') {
      try { this.srcInseguitore.stop(); } catch (e) {}
      const s = this.ctx.createBufferSource();
      s.buffer = buf; s.loop = true; s.connect(this.gInseguitore); s.start(ora);
      this.srcInseguitore = s;
    } else if (voce.gruppo === 'ambienze') {
      this.faiPartireAmbiente(voce.acustica);
      if (this.acustica) this.impostaAcustica(this.acustica, true);   // un file notturno appena arrivato
    } else if (voce.gruppo === 'riverberi') {
      // L'aula ha tre mandate e un file solo: cambiandolo si rifanno tutte e
      // tre le code, non una.
      const cfg = CONFIG.riverberi[voce.acustica];
      //  Tutti e due i convolutori, quello degli eventi e quello del mondo:
      //  cambiando solo il primo, i loop restavano nella stanza vecchia.
      const metti = (r, b) => { r.conv.buffer = b; r.convM.buffer = b; };
      if (voce.acustica === 'aula')
        CONFIG.taglieAula.forEach(t => metti(this.riv['aula:' + t.nome], this.scalaIR(buf, t.coda)));
      else metti(this.riv[voce.acustica], buf);
      if (cfg) this.impostaAcustica(this.acustica, true);
    }
  }

  //  «CARICA LA CARTELLA» — la cartella scelta e' tutta la verita'.
  //  Chi carica la cartella di un compagno non deve sentire i file di chi
  //  c'era prima: se B non ha un file, torna il segnaposto, non quello di A.
  //  Per questo prima si svuota l'archivio del browser e si dimenticano i
  //  nomi degli strumenti, poi si carica, poi quello che manca torna finto.
  //  `livelli.json`, se c'e', rimette i cursori del banco com'erano.
  async caricaCartella(files, avanzamento) {
    const audioFile = files.filter(f => /\.(wav|mp3|m4a|aif|aiff|ogg|flac)$/i.test(f.name));
    const json = files.find(f => /^livelli\.json$/i.test(MotoreAudio.nomePulito(f.name)));
    const diPrima = this.elencoFile().filter(v => this.stato[v.nome] !== 'segnaposto').map(v => v.nome);
    try { await this.archivioSvuota(); } catch (e) { /* senza archivio si va avanti */ }
    this.strumenti = {};
    this.registraNomi(audioFile.map(f => MotoreAudio.nomePulito(f.name)));

    const presi = new Set(), scartati = [];
    for (const f of audioFile) {
      const r = await this.sostituisci(f);
      if (r.ok) presi.add(r.voce.nome); else scartati.push(f.name);
      if (avanzamento) avanzamento(presi.size, audioFile.length);
    }
    //  Uno strumento puo' aver cambiato nome (`_arpa` di A, niente di B): il
    //  suo ramo resta agganciato al file vecchio anche se la voce nuova risulta
    //  gia' segnaposto. Si guarda anche quello.
    const agganciatoAltrove = v => {
      const S = v.gruppo === 'pezzi' && this.sorgenti[v.sorgente];
      return !!(S && S.rami[v.ramo] && S.rami[v.ramo].file !== v.nome);
    };
    for (const v of this.elencoFile())
      if (!presi.has(v.nome) && (this.stato[v.nome] !== 'segnaposto' || agganciatoAltrove(v)))
        this.tornaSegnaposto(v);
    const tolti = diPrima.filter(n => !presi.has(n)).length;

    let livelli = false;
    if (json) {
      try { livelli = this.impostaLivelli(JSON.parse(await json.text())); } catch (e) { livelli = false; }
    }
    return { messi: presi.size, scartati, tolti, livelli };
  }

  // ===========================================================================
  //  SEGNAPOSTI SINTETICI — volutamente brutti, servono a essere sostituiti
  // ===========================================================================
  //  TELEFONO (30/09/2026): i segnaposto costavano ~3 s di calcolo e ~90 MB
  //  sul MacBook, troppo per un iPhone. Due leve, che non cambiano il suono:
  //  - MONO dove il pan lo fa comunque il gioco (pezzi, oggetti, personaggi,
  //    inseguitore, eventi, musica): prima i due canali erano quasi uguali, e
  //    il pan a valle tratta il mono come stereo — vedi `panner`;
  //  - META' FREQUENZA DI CAMPIONAMENTO (`ridotto`) per i loop fatti di toni:
  //    la loro armonica piu' alta sta sotto i 5 kHz, e a 24 kHz si arriva
  //    fino a 12. Chi ha rumore o metallo acuto (oggetti, eventi) resta a
  //    frequenza piena. Mai sotto i 22050: i Safari vecchi rifiutano.
  //  Le IR restano stereo e a frequenza piena: il convolutore le vuole cosi'.
  nuovoBuffer(dur, { mono = false, ridotto = false } = {}) {
    const piena = this.ctx.sampleRate;
    const sr = ridotto ? Math.max(22050, Math.round(piena / 2)) : piena;
    try {
      return this.ctx.createBuffer(mono ? 1 : 2, Math.max(1, Math.round(dur * sr)), sr);
    } catch (e) {
      return this.ctx.createBuffer(mono ? 1 : 2, Math.max(1, Math.round(dur * piena)), piena);
    }
  }

  //  Una nota: fondamentale, seconda e terza armonica, attacco e decadimento
  //  esponenziali — sommata in `d` da `i0` per `lung` campioni. E' il suono
  //  dei pezzi, calcolato senza un seno per campione: la fase gira con una
  //  rotazione, le armoniche escono dalle formule del seno doppio e triplo,
  //  gli inviluppi si moltiplicano. Stesso risultato, un decimo del lavoro.
  //  `avvolgi`: cio' che sborda dalla fine rientra dall'inizio.
  static nota(d, i0, lung, sr, f, a2, a3, decad, attacco, amp, avvolgi) {
    const w = 2 * Math.PI * f / sr, cw = Math.cos(w), sw = Math.sin(w);
    const k1 = Math.exp(-decad / sr), k2 = Math.exp(-attacco / sr);
    const N = d.length;
    let s = 0, c = 1, e1 = amp, e2 = 1;
    for (let j = 0; j < lung; j++) {
      let q = i0 + j;
      if (q >= N) { if (!avvolgi) break; q %= N; }
      d[q] += s * (1 + 2 * a2 * c + a3 * (3 - 4 * s * s)) * e1 * (1 - e2);
      const s2 = s * cw + c * sw; c = c * cw - s * sw; s = s2;
      e1 *= k1; e2 *= k2;
    }
  }

  rendiCiclico(buf, fade = 0.02) {
    const n = Math.min(Math.floor(fade * buf.sampleRate), Math.floor(buf.length / 2));
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) {
        const k = i / n;
        d[buf.length - n + i] = d[buf.length - n + i] * (1 - k) + d[i] * k;
      }
    }
    return buf;
  }

  generaSegnaposto(voce) {
    if (voce.gruppo === 'pezzi') {
      return voce.ramo === 'concerto'
        ? this.segnapostoPezzoConcerto(Math.max(0, CONFIG.pezzi.findIndex(p => p.id === voce.sorgente)))
        : this.segnapostoPezzo(Math.max(0, CONFIG.pezzi.findIndex(p => p.id === voce.sorgente)));
    }
    if (voce.gruppo === 'oggetti')
      return this.segnapostoOggetto(CONFIG.oggetti.findIndex(o => o.id === voce.sorgente),
                                    voce.ramo === 'sveglio');
    if (voce.gruppo === 'personaggi') return this.segnapostoPersonaggio(voce.sorgente);
    if (voce.gruppo === 'musica') return this.segnapostoMusica();
    if (voce.gruppo === 'inseguitore') return this.segnapostoInseguitore();
    if (voce.gruppo === 'ambienze') return this.segnapostoAmbiente(voce.acustica);
    if (voce.gruppo === 'riverberi') return this.segnapostoIR(voce.acustica);
    return this.segnapostoEvento(voce.evento, voce.nome);
  }

  // --- i cinque pezzi -------------------------------------------------------
  //  Ognuno in una zona di frequenze propria e in una FINESTRA propria del
  //  loop: quando uno parla gli altri tacciono, e nei buchi di uno si sente
  //  l'altro. E' il principio della casella 2 messo in pratica dai segnaposto,
  //  cosi' che chi li sostituisce senta subito che cosa deve conservare.
  //  I pezzi fanno da esca a turno (config.js): esca e pezzo vero escono da
  //  qui allo stesso modo, e deve restare cosi'. A distinguerli fra loro sono
  //  altezza, finestra e numero di colpi — non il canale, che il mono toglie:
  //  lo sbilanciamento sinistra/destra di prima (0,85) era un decibel e mezzo
  //  e il pan del gioco lo copriva comunque. 0,93 ne tiene l'energia media.
  segnapostoPezzo(i) {
    const dur = this.durataLoop;
    const buf = this.nuovoBuffer(dur, { mono: true, ridotto: true });
    const sr = buf.sampleRate, D = buf.getChannelData(0);

    const FREQ    = [110, 155, 220, 330, 440, 660, 1180, 1660];
    const FINESTRA = [[0.00, 0.26], [0.14, 0.40], [0.26, 0.52], [0.38, 0.62],
                      [0.50, 0.74], [0.62, 0.86], [0.74, 0.94], [0.86, 1.00]];
    const IMPULSI = [2, 3, 3, 4, 4, 5, 6, 3];
    const DECAD   = [1.4, 1.8, 2.2, 2.6, 3.2, 4.2, 5.5, 7.0];
    const AMP     = [0.30, 0.28, 0.25, 0.22, 0.19, 0.16, 0.13, 0.11];

    const [f0, f1] = FINESTRA[i];
    const t0 = f0 * dur, t1 = f1 * dur;
    const n = IMPULSI[i], passo = (t1 - t0) / n;

    for (let k = 0; k < n; k++) {
      const i0 = Math.floor((t0 + k * passo) * sr);
      const lung = Math.floor(passo * 0.8 * sr);
      MotoreAudio.nota(D, i0, lung, sr, FREQ[i], 0.28, 0.12, DECAD[i], 160, AMP[i] * 0.93, false);
    }
    return this.rendiCiclico(buf);
  }

  // --- i cinque pezzi, versione da concerto ---------------------------------
  //  La differenza con quello dell'aula deve sentirsi al primo secondo, ed e'
  //  la stessa che lo studente dovra' registrare: in aula FRASI CON I BUCHI —
  //  uno parla e gli altri tacciono, perche' li' il suono e' informazione e
  //  deve lasciar passare gli altri; sul palco un GIRO CONTINUO che si
  //  incastra con gli altri sette e non lascia buchi.
  //
  //  Le note non sono piu' quelle dell'aula. Li' gli otto stavano in ottave
  //  slegate e non importava: non suonavano mai insieme. Qui suonano tutti
  //  insieme dall'inizio alla fine, e otto altezze scelte a caso farebbero un
  //  grappolo. Sono una pentatonica di LA — la stessa nota di partenza, senza
  //  il tritono che c'era in mezzo.
  //
  //  E' un segnaposto, non un modello di scrittura: serve a far sentire che
  //  cosa cambia, non a dire come si scrive un brano.
  segnapostoPezzoConcerto(i) {
    const dur = this.durataLoop;
    const buf = this.nuovoBuffer(dur, { mono: true, ridotto: true });
    const sr = buf.sampleRate, D = buf.getChannelData(0);

    //  la minor pentatonica su tre ottave e mezzo, una per strumento
    const FREQ   = [110, 165, 220, 264, 330, 440, 528, 660];
    //  quante note in tutto il giro: i gravi rade, gli acuti fitte. Sono tutti
    //  divisori delle sedici pulsazioni del loop, quindi cadono sulla griglia
    const NOTE   = [4, 4, 8, 8, 16, 16, 32, 32];
    //  di quanto entra dopo la pulsazione: cosi' non attaccano tutti insieme
    const RITARDO = [0, 0.5, 0, 0.25, 0.5, 0.75, 0.125, 0.375];
    const DECAD  = [2.0, 2.4, 3.0, 3.4, 4.0, 5.0, 6.5, 8.0];
    const AMP    = [0.26, 0.24, 0.21, 0.19, 0.17, 0.15, 0.12, 0.10];

    const n = NOTE[i], passo = dur / n;
    for (let k = 0; k < n; k++) {
      const i0 = Math.floor((k * passo + RITARDO[i] * passo) * sr);
      const lung = Math.floor(passo * 0.9 * sr);
      //  una nota ogni tanto piu' piena: un giro tutto uguale non e' musica,
      //  e' un metronomo
      const spinta = (k % 4 === 0) ? 1 : 0.72;
      //  il giro si chiude: quello che sborda dalla fine rientra dall'inizio,
      //  altrimenti l'ultima nota viene tagliata netta a ogni passaggio.
      //  0,915: l'energia media dei due canali di prima (1 e 0,82)
      MotoreAudio.nota(D, i0, lung, sr, FREQ[i], 0.24, 0.10, DECAD[i], 150,
                       AMP[i] * spinta * 0.915, true);
    }
    //  niente `rendiCiclico` qui: la giuntura e' gia' continua perche' la coda
    //  rientra dall'inizio da sola, e la dissolvenza incrociata la sporcherebbe
    return buf;
  }

  //  I personaggi sono loop lunghi e sommessi, non un tic che si ripete: prima
  //  cadevano nel segnaposto generico da 0,2 secondi (pensato per un evento
  //  secco), che in loop continuo suonava come un ribattuto fastidioso e
  //  copriva il resto. Qui l'intonazione oscilla piano, cosi' si sente che e'
  //  una presenza viva, non una macchina.
  segnapostoPersonaggio(id) {
    const dur = 4.0;
    const buf = this.nuovoBuffer(dur, { mono: true, ridotto: true });
    const sr = buf.sampleRate, D = buf.getChannelData(0);
    const BASE = { trombettista: 165, alba: 340, colloquio: 220 };
    const f0 = BASE[id] || 220;
    for (let i = 0; i < buf.length; i++) {
      const t = i / sr;
      const f = f0 + Math.sin(2 * Math.PI * 0.35 * t) * 6;      // vibrato lento
      const env = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.12 * t); // respiro lentissimo
      const v = (Math.sin(2 * Math.PI * f * t) +
                 Math.sin(2 * Math.PI * f * 2 * t) * 0.2) * env * 0.18;
      D[i] = v * 0.975;
    }
    return this.rendiCiclico(buf, 0.3);
  }

  segnapostoOggetto(i, sveglio) {
    //  mono ma a frequenza piena: lo scatto e il ronzio sono rumore, e il
    //  rumore a meta' frequenza perde proprio lo spigolo che lo fa riconoscere
    const dur = 2.4, sr = this.ctx.sampleRate;
    const buf = this.nuovoBuffer(dur, { mono: true });
    const D = buf.getChannelData(0);
    const battiti = sveglio ? [3, 4, 6][i] : [1, 1, 2][i];
    const passo = dur / battiti;

    for (let k = 0; k < battiti; k++) {
      const i0 = Math.floor(k * passo * sr);
      const lung = Math.floor(Math.min(passo * 0.85, sveglio ? 0.5 : 0.3) * sr);
      for (let j = 0; j < lung && i0 + j < buf.length; j++) {
        const t = j / sr;
        let v;
        if (i === 0) {          // metronomo: uno scatto secco di legno
          v = (Math.random() * 2 - 1) * Math.exp(-t * (sveglio ? 90 : 130)) * 0.5
            + Math.sin(2 * Math.PI * 1900 * t) * Math.exp(-t * 120) * 0.3;
        } else if (i === 1) {   // accordatore: un tono fermo che pulsa
          v = Math.sin(2 * Math.PI * (sveglio ? 660 : 640) * t)
              * Math.exp(-t * 3) * (1 - Math.exp(-t * 40)) * 0.32;
        } else {                // telefono che vibra sul tavolo
          v = (Math.sin(2 * Math.PI * 58 * t) + (Math.random() * 2 - 1) * 0.35)
              * Math.exp(-t * 5) * (1 - Math.exp(-t * 60)) * 0.4;
        }
        v *= sveglio ? 1 : 0.55;
        D[i0 + j] += v * (i === 2 ? 1 : 0.96);
      }
    }
    return this.rendiCiclico(buf);
  }

  // --- lo strato del peggioramento -----------------------------------------
  //  Basso e largo, in una zona che i pezzi lasciano libera: 55 e 82,5 Hz con
  //  una quinta sopra appena accennata. Non ha attacchi — se li avesse
  //  sarebbe un evento, e invece e' uno stato.
  segnapostoMusica() {
    const dur = this.durataLoop;
    const buf = this.nuovoBuffer(dur, { mono: true, ridotto: true });
    const sr = buf.sampleRate, D = buf.getChannelData(0);
    for (let n = 0; n < buf.length; n++) {
      const t = n / sr, p = n / buf.length;
      const respiro = 0.55 + 0.45 * Math.sin(2 * Math.PI * p);
      const v = (Math.sin(2 * Math.PI * 55 * t) * 0.5 +
                 Math.sin(2 * Math.PI * 82.5 * t) * 0.22 +
                 Math.sin(2 * Math.PI * 110.3 * t) * 0.10) * respiro * 0.32;
      D[n] = v * 0.97;
    }
    return this.rendiCiclico(buf, 0.25);
  }

  // --- la presenza dell'inseguitore ----------------------------------------
  //  Un impulso grave che ribatte: spaventa ma lascia leggibile il resto. Se
  //  al suo posto ci fosse una voce mascherebbe gli strumenti, e avvicinandosi
  //  renderebbe il gioco impossibile invece che difficile — e' esattamente la
  //  scoperta che la casella 5 chiede di fare ascoltando.
  segnapostoInseguitore() {
    const dur = 1.6;
    const buf = this.nuovoBuffer(dur, { mono: true, ridotto: true });
    const sr = buf.sampleRate, D = buf.getChannelData(0);
    for (let k = 0; k < 2; k++) {
      const i0 = Math.floor(k * (dur / 2) * sr);
      const lung = Math.floor((dur / 2) * 0.9 * sr);
      for (let j = 0; j < lung && i0 + j < buf.length; j++) {
        const t = j / sr;
        const env = Math.exp(-t * 5.5) * (1 - Math.exp(-t * 70));
        const v = (Math.sin(2 * Math.PI * (48 - 8 * t) * t) * 0.8 +
                   (Math.random() * 2 - 1) * 0.12) * env * 0.45;
        D[i0 + j] += v * 0.95;
      }
    }
    return this.rendiCiclico(buf);
  }

  // L'ambienza mancante resta SILENZIOSA, non sintetica.
  // Un letto di rumore continuo per tutta la partita e' insopportabile, e a
  // differenza degli altri segnaposto non insegna nulla: un'ambienza si
  // giudica solo quando e' vera. Appena il file arriva nella cartella, suona.
  segnapostoAmbiente(acustica) {
    return this.nuovoBuffer(1, { mono: true, ridotto: true });
  }

  //  L'IR finto: rumore che si spegne. Due cose lo rendono credibile, e la
  //  prima versione non aveva ne' l'una ne' l'altra.
  //
  //  UN POLO SOLO NON BASTA. Sei decibel per ottava lasciano passare quasi
  //  tutto: a diecimila hertz il filtro tagliava undici decibel scarsi, e la
  //  coda restava brillante. Adesso i poli sono due, dodici decibel per
  //  ottava, ed e' la pendenza che si sente.
  //
  //  LE ACUTE DEVONO SPEGNERSI PRIMA DELLE GRAVI. Prima tutte le bande
  //  decadevano con la stessa curva: nel corridoio le acute duravano due
  //  secondi e otto come i bassi, e Gianluca l'ha sentito subito — «uno
  //  strano ed eccessivo riverbero sulle frequenze acute nei corridoi»
  //  (13/09/2026). L'aria e i muri se le mangiano molto prima, quindi il
  //  filtro si chiude mentre la coda si spegne.
  //
  //  Alla fine il buffer si normalizza sull'energia: il colore cambia, il
  //  livello no, e i numeri in `CONFIG.riverberi` restano quelli tarati a
  //  orecchio. Quando arrivano gli `ir_*.wav` veri tutto questo non serve
  //  piu' — e' un segnaposto, non un modello.
  segnapostoIR(acustica) {
    const cfg = CONFIG.riverberi[acustica], sr = this.ctx.sampleRate;
    const buf = this.nuovoBuffer(cfg.durataFinta);
    const k0 = Math.min(0.9, cfg.coloreFinto / sr * 6);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let a = 0, b = 0, energia = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const p = t / cfg.durataFinta;              // 0 all'attacco, 1 alla fine
        const k = k0 * (1 - 0.82 * p);              // il filtro si chiude strada facendo
        a += ((Math.random() * 2 - 1) - a) * k;
        b += (a - b) * k;                           // secondo polo: 12 dB per ottava
        d[i] = b * Math.pow(1 - p, 2.4) * (1 - Math.exp(-t * 400));
        energia += d[i] * d[i];
      }
      //  stessa energia di prima, cosi' il livello non cambia sotto i piedi
      const rms = Math.sqrt(energia / d.length);
      if (rms > 1e-9) { const g = 0.05 / rms; for (let i = 0; i < d.length; i++) d[i] *= g; }
    }
    return buf;
  }

  segnapostoEvento(idEvento, nomeFile) {
    const sr = this.ctx.sampleRate;
    const seme = [...nomeFile].reduce((a, c) => a + c.charCodeAt(0), 0);
    //  mono: i due canali erano gia' identici
    const fai = (dur, fn) => {
      const buf = this.nuovoBuffer(dur, { mono: true });
      const D = buf.getChannelData(0);
      for (let i = 0; i < buf.length; i++) D[i] = fn(i / sr, i / buf.length);
      return buf;
    };
    const rumore = () => Math.random() * 2 - 1;

    switch (idEvento) {
      case 'passo':
        return fai(0.11, t => rumore() * Math.exp(-t * 58)
                            * Math.sin(2 * Math.PI * (850 + (seme % 5) * 120) * t) * 0.9);
      case 'porta':
        return fai(0.5, (t, p) => (rumore() * Math.exp(-t * 9) * 0.22
                                 + Math.sin(2 * Math.PI * (120 + 60 * p) * t) * Math.exp(-t * 6) * 0.2)
                                 * (1 - Math.exp(-t * 30)));
      case 'porta_soglia':
        return fai(0.35, t => rumore() * Math.exp(-t * 20) * 0.26
                            + Math.sin(2 * Math.PI * 165 * t) * Math.exp(-t * 9) * 0.22);
      case 'interfaccia_inizio':
        return fai(1.0, (t, p) => (Math.sin(2 * Math.PI * 330 * t) +
                                   Math.sin(2 * Math.PI * 495 * t) * 0.4)
                                  * Math.sin(Math.PI * Math.pow(p, 0.6)) * 0.3);
      case 'interfaccia_fine':
        return fai(1.6, (t, p) => (Math.sin(2 * Math.PI * (300 - 190 * p) * t) +
                                   Math.sin(2 * Math.PI * (150 - 95 * p) * t) * 0.5)
                                  * Math.exp(-t * 1.4) * 0.4);
      case 'interfaccia_conferma':
        return fai(0.3, t => (Math.sin(2 * Math.PI * 880 * t) * 0.6 +
                              Math.sin(2 * Math.PI * 1320 * t) * 0.25) * Math.exp(-t * 11) * 0.4);
      case 'pezzo_richiesta':
        return fai(1.2, (t, p) => (Math.sin(2 * Math.PI * (392 + 130 * Math.floor(p * 3)) * t))
                                  * Math.exp(-((p * 3) % 1) * 4) * 0.32);
      case 'inseguitore_avvistamento':
        return fai(0.5, (t, p) => Math.sin(2 * Math.PI * (240 + 420 * p) * t) * Math.exp(-t * 5) * 0.5
                                + rumore() * Math.exp(-t * 30) * 0.12);
      case 'inseguitore_perde':
        return fai(0.7, (t, p) => Math.sin(2 * Math.PI * (200 - 120 * p) * t) * Math.exp(-t * 3.4) * 0.36);
      case 'disturbo_arrivo':
        return fai(0.9, (t, p) => (Math.sin(2 * Math.PI * 70 * t) * 0.5 +
                                   rumore() * 0.3 * Math.sin(2 * Math.PI * 7 * t))
                                  * Math.sin(Math.PI * Math.pow(p, 0.35)) * 0.45);
      case 'disturbo_fine':
        return fai(0.8, (t, p) => Math.sin(2 * Math.PI * (140 + 200 * p) * t)
                                  * Math.sin(Math.PI * p) * 0.3);
      case 'regia_porta':
        // il battente: un colpo sordo che si assesta, nessun metallo
        return fai(0.7, (t, p) => (Math.sin(2 * Math.PI * (90 - 40 * p) * t) * 0.7
                                 + rumore() * 0.35 * Math.exp(-t * 26))
                                  * Math.exp(-t * 4.2) * 0.5);
      case 'allarme_sirena':
        // due toni che salgono e scendono, come una sirena d'istituto
        return fai(3.0, (t, p) => Math.sin(2 * Math.PI * (620 + 260 * Math.sin(2 * Math.PI * 0.66 * t)) * t)
                                  * Math.min(1, t * 20, (3 - t) * 8) * 0.28);
      case 'regia_chiavi':
        // il mazzo che tintinna e lo scatto: tutto metallo acuto, corto
        return fai(0.8, (t, p) => (rumore() * Math.exp(-((t % 0.14) * 60)) * 0.5
                                 + Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 7) * 0.18
                                 + (p > 0.72 ? rumore() * Math.exp(-(t - 0.58) * 50) * 0.6 : 0))
                                  * 0.34);
      case 'aiuto_occlusione':
        return fai(1.1, (t, p) => (Math.sin(2 * Math.PI * (500 - 380 * p) * t) * (1 - p * 0.6)
                                 + rumore() * 0.1 * (1 - p)) * Math.sin(Math.PI * Math.pow(p, 0.3)) * 0.4);
      case 'aiuto_rivela':
        return fai(0.8, (t, p) => Math.sin(2 * Math.PI * (600 + 500 * p) * t)
                                  * Math.exp(-t * 3.5) * 0.34);
      case 'aiuto_fine':
        return fai(0.6, (t, p) => (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 587 * t) * 0.4)
                                  * Math.sin(Math.PI * p) * 0.26);
      case 'bagno': {
        //  Quattro segnaposto che si distinguono fra loro, non quattro imitazioni:
        //  scroscio che cala, filo d'acqua, soffio, due note di voce.
        const v = +(nomeFile.match(/(\d+)\.wav$/) || [0, 1])[1];
        if (v === 1) return fai(1.4, (t, p) => rumore() * Math.sin(Math.PI * Math.pow(p, 0.25)) * (1 - p) * 0.4);
        if (v === 2) return fai(1.2, (t, p) => (rumore() * 0.12 + Math.sin(2 * Math.PI * 2100 * t) * 0.05 * rumore())
                                              * Math.sin(Math.PI * p));
        if (v === 3) return fai(1.3, (t, p) => rumore() * (0.5 + 0.5 * Math.sin(2 * Math.PI * 90 * t)) * 0.22
                                              * Math.min(1, p * 8, (1 - p) * 4));
        return fai(0.7, (t, p) => Math.sin(2 * Math.PI * (p < 0.45 ? 220 : 180) * t)
                                  * Math.sin(Math.PI * ((p * 2.2) % 1)) * (p < 0.9 ? 0.32 : 0));
      }
      default:
        return fai(0.2, t => Math.sin(2 * Math.PI * 440 * t) * Math.exp(-t * 10) * 0.4);
    }
  }
}
