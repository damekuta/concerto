// =============================================================================
//  CONFIGURAZIONE — Avellino, le nove caselle
// =============================================================================
//  Questo file e' la specifica audio del gioco: quali suoni servono, come si
//  comportano, e tutti i parametri che li governano. Ogni valore qui e'
//  modificabile senza toccare il resto del codice.
//
//  Il 09/09/2026 le regole di Lecce (insegnanti, allievi, spari, munizioni,
//  strumenti da distruggere) sono state tolte in blocco e sostituite dalle
//  nove caselle di `SCHELETRO - le nove caselle.md`.
//
//  I NOMI DEI FILE SONO UN CONTRATTO. Sono quelli del vademecum consegnato
//  agli studenti — `VADEMECUM - gli eventi da sonorizzare.md`, 45 file. Un
//  nome cambiato qui butta il lavoro di chi ha gia' registrato. Eventi nuovi
//  si AGGIUNGONO in fondo, non si sostituiscono.
//
//  L'IMPIANTO, in breve
//  Cinque PEZZI sparsi per l'edificio, ognuno con un loop diegetico che si
//  sente da dove sta. Due ESCHE suonano allo stesso modo ma non servono a
//  niente. Tre pezzi chiedono una PROVA: l'oggetto che serve sta nei
//  corridoi e dorme finche' non serve, poi si sveglia. Un TEMPO scorre;
//  quando scade entra la musica e compare l'INSEGUITORE, che si sente
//  crescere quando si avvicina. I pezzi conquistati SEGUONO il giocatore
//  suonando scombinati, e si allineano solo arrivando in anfiteatro. I due
//  cortili scoperti sono SCORCIATOIE: ci si passa in fretta, ma li' dentro i
//  pezzi non si sentono piu'.
// =============================================================================


// -----------------------------------------------------------------------------
//  DOVE SI GIOCA — le zone della mappa che le regole usano per nome
// -----------------------------------------------------------------------------
//  `avellino/js/mappa.js` e' GENERATO dal ricalco e non si tocca a mano: gli
//  indici delle sue zone slittano a ogni rigenerazione. Qui non si scrivono
//  indici, si scrivono criteri — cosi' la mappa puo' cambiare senza che le
//  regole vadano riscritte.
//
//  Il punto di raccolta (casella 8) e' la gradinata scoperta, l'unica zona di
//  tipo 'anfiteatro'. Le scorciatoie (casella 9) sono le zone che il ricalco
//  ha marcato `scorciatoia: true`: i due cortili interni.
// -----------------------------------------------------------------------------

const CONFIG = {

  // ---------------------------------------------------------------------------
  //  MUSICA — un solo strato, e non c'e' finche' il tempo non scade
  // ---------------------------------------------------------------------------
  //  In fase normale NON c'e' tappeto musicale: c'e' silenzio, ci sono le
  //  ambienze, e ci sono i pezzi da trovare. La musica ha due stati soli —
  //  assente e minacciosa — e per questo ognuno vuol dire qualcosa.
  // ---------------------------------------------------------------------------
  musica: {
    bpm: 100,
    battute: 4,        // loop di 4 battute di 4/4 = 9,6 secondi
    file: 'musica_peggioramento.wav',
    volume: 0.55,
    entrata: 2.5,      // secondi di dissolvenza in entrata: entra, non sbatte
    impianto: 'Basso e largo, in una zona di frequenze lasciata libera dai ' +
              'pezzi. Se ci sta sopra, copre proprio quello che serve per ' +
              'continuare a giocare.',
  },

  // ---------------------------------------------------------------------------
  //  CASELLA 2 — I PEZZI: qui il suono non accompagna il gioco, E' il gioco
  // ---------------------------------------------------------------------------
  //  Cinque loop, ognuno in una zona di frequenze propria, tutti a frasi con i
  //  buchi in mezzo: nei silenzi di uno si sente l'altro. Sono informazione,
  //  non colonna sonora.
  // ---------------------------------------------------------------------------
  //  Gli OTTO strumenti sono i file consegnati dallo studente, e il gioco non
  //  sa in anticipo che cosa contengano: legge il nome dello strumento dalla
  //  coda del nome del file — `strumento_03_piano_fender.wav` diventa
  //  «piano fender» — e lo scrive sul foglio del direttore.
  //
  //  Chi fa pop porta batteria, basso e Fender; chi fa classica flauto, arpa e
  //  timpano. Nessun nome di strumento sta qui dentro: le etichette scritte
  //  sotto sono solo il ripiego per quando un file manca.
  //
  //  A ogni partita il gioco ne sceglie CINQUE da cercare, ne usa DUE come
  //  esche e ne lascia UNO fuori. Nessun file e' un'esca per sempre: per
  //  questo si chiamano tutti allo stesso modo, e la parola «esca» non compare
  //  in nessun nome.
  //
  //  Il consiglio di registro resta valido e sta nel vademecum: otto strumenti
  //  che si sentano distinti fra loro, con i buchi in mezzo alle frasi. Nei
  //  silenzi di uno si sente l'altro. Sono informazione, non colonna sonora.
  pezzi: [
    { id: 'strumento_01', etichetta: 'Strumento 1' },
    { id: 'strumento_02', etichetta: 'Strumento 2' },
    { id: 'strumento_03', etichetta: 'Strumento 3' },
    { id: 'strumento_04', etichetta: 'Strumento 4' },
    { id: 'strumento_05', etichetta: 'Strumento 5' },
    { id: 'strumento_06', etichetta: 'Strumento 6' },
    { id: 'strumento_07', etichetta: 'Strumento 7' },
    { id: 'strumento_08', etichetta: 'Strumento 8' },
  ],

  // ---------------------------------------------------------------------------
  //  IL CONCERTO — la seconda versione dello stesso strumento
  // ---------------------------------------------------------------------------
  //  Ogni strumento si consegna in DUE file. Il primo e' quello che si sente
  //  nelle aule mentre lo si cerca: frasi con i buchi in mezzo, perche' nei
  //  silenzi di uno si sente l'altro. Il secondo e' quello del concerto, e si
  //  chiama come il primo con `_concerto` in coda:
  //
  //      strumento_03_piano_fender.wav            <- l'aula
  //      strumento_03_piano_fender_concerto.wav   <- il concerto
  //
  //  La terza versione — quella sporca di chi viene trascinato in regia — non
  //  si registra: la fa il gioco sulla clip dell'aula. Vedi `sporcaCattura`
  //  in audio.js.
  //
  //  NON C'E' UN BPM COMUNE E NON C'E' UNA DURATA IMPOSTA. Deciso da Gianluca
  //  il 13/09/2026: gli studenti scelgono generi diversi e su un tempo solo
  //  non si accorderebbero. Ognuno porta il loop che vuole, lungo quanto
  //  vuole; il gioco li fa partire tutti insieme e li lascia girare.
  // ---------------------------------------------------------------------------
  concerto: {
    //  La scena non dura un numero di secondi: dura un numero INTERO di giri
    //  del loop piu' lungo, quello piu' vicino a questo bersaglio. Un brano
    //  troncato a meta' frase si sente, e si sente come un difetto.
    //  A 0 il concerto non finisce da solo: va avanti finche' non si preme
    //  ESC o R — l'altra strada che Gianluca aveva indicato.
    durataMirata: 52,   // s
    salita: 1.8,        // s: prendono posto e la vista si allarga sulla sala
    attacco: 0.7,       // s: il silenzio prima che parta il brano
    //  La sfumata di chiusura. Gianluca il 13/09/2026: «se poi sfuma lentamente
    //  (in 5-6 secondi almeno) alla fine del minuto (e non tronca di colpo) va
    //  bene». Il suono ci mette tutti e 5,5 i secondi; il nero scende solo
    //  negli ultimi `nero`, perche' uno schermo che si spegne per cinque
    //  secondi e mezzo sembra un guasto, non una fine.
    dissolvenza: 5.5,   // s: quanto dura la chiusura, dal fader al nero pieno
    nero: 2.6,          // s: quanto dura il nero, dentro quei 5,5
    //  IL SUONO ARRIVA A ZERO PRIMA DEL VIDEO. Gianluca, 14/09/2026: «quella
    //  audio viene troncata troppo bruscamente alla fine: l'audio deve
    //  raggiungere lo zero prima che ci arrivi il video e stacchi il play».
    //  Due cose insieme, e servono tutte e due:
    //   - il fader finisce `anticipoAudio` secondi prima della fine della
    //     scena, cosi' il nero si chiude su una sala gia' silenziosa;
    //   - la curva non e' piu' una retta. Una rampa lineare sull'ampiezza
    //     resta forte fin quasi in fondo e poi cade in un istante: e' proprio
    //     il troncamento che si sentiva. La curva di `sfumaConcerto` arriva
    //     allo zero con pendenza nulla — si posa, non si stacca.
    anticipoAudio: 1.1, // s: quanto il silenzio precede il nero pieno
    //  Il pubblico sulle gradinate: uno ogni tot pixel di arco, con un po' di
    //  disordine perche' una fila perfetta non e' un pubblico.
    pubblico: { passoArco: 27, disordine: 6, massimo: 150 },
  },

  // ---------------------------------------------------------------------------
  //  CASELLA 3 — GLI OGGETTI DELLA PROVA: lo stesso oggetto in due stati
  // ---------------------------------------------------------------------------
  //  Dormiente = appena percettibile, sta li' dall'inizio. Sveglio = suona per
  //  davvero, da quando serve. Chi ha fatto caso al dormiente ci va dritto;
  //  chi non ci ha fatto caso lo trova a orecchio. La memoria e' premiata,
  //  mai obbligatoria.
  //
  //  Suoni NON musicali: devono reggere accanto ai loop dei pezzi senza
  //  sparire e senza coprirli.
  // ---------------------------------------------------------------------------
  oggetti: [
    { id: 'oggetto_prova_01', etichetta: 'Oggetto 1' },
    { id: 'oggetto_prova_02', etichetta: 'Oggetto 2' },
    { id: 'oggetto_prova_03', etichetta: 'Oggetto 3' },
  ],
  volumeDormiente: 0.16,   // appena percettibile: si nota solo se si ascolta
  volumeSveglio: 1.0,

  // il nome del file lo compone il gioco: e' il contratto col vademecum
  fileOggetto: (id, stato) => `${id}_${stato}.wav`,

  // ---------------------------------------------------------------------------
  //  CASELLA 5 — L'INSEGUITORE: la tensione come parametro continuo
  // ---------------------------------------------------------------------------
  //  Non e' un file che parte quando si avvicina: e' un loop sempre acceso su
  //  cui il gioco lavora. La distanza da lui non la dice un'icona, la dice
  //  quanto lo senti.
  // ---------------------------------------------------------------------------
  inseguitore: {
    file: 'inseguitore_presenza.wav',
    volumeMax: 0.95,      // addosso
    volumeMin: 0.04,      // dall'altra parte dell'edificio: si sente appena
    raggioUdibile: 620,   // px: oltre, resta il minimo
    curva: 1.7,           // piu' alto = cresce tardi e in fretta
  },

  // ---------------------------------------------------------------------------
  //  I PERSONAGGI — due presenze che non ti inseguono, ma cambiano la partita
  // ---------------------------------------------------------------------------
  //  L'inseguitore e' una minaccia; questi due sono il contorno che la rende
  //  leggibile. Il trombettista e' l'unico suono del gioco che si vuole
  //  EVITARE, Alba l'unico che si spera di sentire. Sono i due poli fra cui
  //  sta tutto il resto, e per questo devono stare lontani fra loro in
  //  frequenza e in carattere.
  // ---------------------------------------------------------------------------
  personaggi: {

    //  QUANTO LONTANO SI SENTONO. Gianluca, 14/09/2026: «non ha senso che
    //  questi personaggi si sentano arrivare da lontano: sono sufficienti dei
    //  passi a volume moderato quando sono in scena». Prima usavano il raggio
    //  generale dei pezzi (470 px) e un fondo che non scendeva mai sotto 0,06:
    //  li si sentiva da mezzo edificio, e nel mucchio sembravano dei passi in
    //  avvicinamento. Adesso il loro raggio e' quanto se ne vede: la finestra
    //  inquadra 450 px di mondo per 310, quindi 230 px e' il bordo dello
    //  schermo. Oltre, silenzio vero — `fondo` a zero.
    //
    //  L'inseguitore NON e' toccato: la casella 5 sta in piedi proprio perche'
    //  lo si sente da lontano, ed e' l'unico che deve farlo.
    raggioInScena: 230,   // px: oltre, non si sentono per niente

    //  Gira per i corridoi e studia: cammina un po', si ferma a suonare, e
    //  riparte. Dentro il suo alone il giocatore rallenta e il mondo si
    //  impasta — li' l'inseguitore ti prende facile.
    trombettista: {
      id: 'trombettista', etichetta: 'Trombettista',
      file: 'trombettista_presenza.wav',
      velocita: 44,            // px/s: cammina piano, e' in mezzo a uno studio
      sosta: [5, 11],          // secondi fermo a suonare prima di ripartire
      passeggiata: [3.5, 8],   // secondi di cammino prima di fermarsi
      alone: 130,              // px: il raggio dentro cui si e' rallentati
      rallenta: 0.22,          // frazione di velocita' che resta al centro
      taglio: 1300,            // Hz: dentro l'alone il mondo perde il dettaglio
      transizione: 0.5,
    },

    //  Alba gira libera, aule comprese. Quando incontra l'inseguitore lo ferma
    //  a parlare: finche' parlano si cerca indisturbati. E' l'unica notizia
    //  buona del gioco, e arriva da sola — non si raccoglie e non si chiama.
    alba: {
      id: 'alba', etichetta: 'Alba',
      file: 'alba_presenza.wav',
      //  Piu' svelta dell'inseguitore (82) di un buon margine, altrimenti lo
      //  insegue senza raggiungerlo mai e il colloquio non capita: misurato
      //  l'11/09/2026, a 92 px/s in quattro minuti non lo prendeva mai.
      velocita: 112,           // px/s: la seconda cosa piu' veloce del gioco
      //  Sotto questa distanza gli punta dritto addosso; sopra, segue la
      //  rotta calcolata sulla pianta. Tenerla larga non serve: la parte
      //  difficile e' girare gli angoli, e quella la fa la rotta.
      avvicinamento: 70,       // px: la distanza a cui gli punta addosso
      incontro: 30,            // px: a questa distanza lo ferma a parlare
      colloquio: [13, 25],     // secondi di colloquio: non si sa quanto durera'
      riposo: [22, 40],        // secondi prima che possa fermarlo di nuovo
    },

    //  Il colloquio non e' un evento: e' un loop che dura quanto dura. Due
    //  varianti che si alternano, perche' capita spesso e una sola diventa un
    //  tormentone dopo tre partite. Il gioco lo mette dove stanno i due, e
    //  puo' succedere dall'altra parte dell'edificio: e' l'unico modo che il
    //  giocatore ha per sapere che l'inseguitore e' occupato.
    colloquio: {
      id: 'colloquio', etichetta: 'Colloquio',
      varianti: ['colloquio_01.wav', 'colloquio_02.wav'],
    },
  },

  // ---------------------------------------------------------------------------
  //  LIVELLI DEI BUS — il bilanciamento FRA le famiglie di suoni
  // ---------------------------------------------------------------------------
  //  Il bilanciamento DENTRO una famiglia si fa nel DAW: i cinque pezzi fra
  //  loro, gli eventi fra loro. Quello FRA famiglie si fa qui, perche' dipende
  //  da cosa succede a schermo e cambia di continuo.
  //
  //  Sono modificabili dal vivo con i cursori del banco di missaggio, e la
  //  posizione dei cursori resta memorizzata nel browser.
  // ---------------------------------------------------------------------------
  livelli: {
    generale: 0.90,
    pezzi:    1.30,   // sono l'informazione: stanno sopra tutto il resto
    musica:   0.85,
    eventi:   0.60,
    ambienze: 1.00,
    //  Il trombettista e Alba fino al 14/09/2026 non avevano un cursore: il
    //  loro bus restava a 1.00 e nessuno poteva abbassarli dal banco. Stanno
    //  sotto ai pezzi di proposito — sono il contorno, non il compito.
    personaggi: 0.75,
  },

  // ---------------------------------------------------------------------------
  //  SPAZIALIZZAZIONE — la posizione del giocatore diventa il mix
  // ---------------------------------------------------------------------------
  spazio: {
    fondo: 0.06,         // quanto si sente un pezzo lontanissimo
    raggioUdibile: 470,  // px: oltre, resta solo il fondo
    curva: 2.0,          // piu' alto = l'avvicinamento si sente piu' tardi
    dentroLaStanza: 1.0, // volume del pezzo nella stanza in cui sei
    attenuaAltri: 0.30,  // quanto calano gli altri quando sei dentro una stanza
    ampiezzaPan: 380,    // px: a questa distanza laterale il pan e' tutto a L o R
    //  QUANTO DEI LOOP VA NEL RIVERBERO. Fino al 14/09/2026 era zero: gli
    //  strumenti erano asciutti dappertutto, e il riverbero lo prendevano solo
    //  gli eventi. Si sentiva attraversando il cortile coi musicisti dietro —
    //  Gianluca: «deve cambiare solo il riverbero», e invece non cambiava
    //  niente. Sta sotto al livello degli eventi perche' qui le sorgenti sono
    //  quattordici loop sempre accesi: alla mandata degli eventi impastano.
    mandataRiverbero: 0.35,
  },

  // ---------------------------------------------------------------------------
  //  LA TELECAMERA — quanto edificio si vede in una volta
  // ---------------------------------------------------------------------------
  //  A zoom 1 si vede tutta la pianta e il suono e' un ornamento: si vede gia'
  //  dove sta ogni cosa. Zoomando, la finestra segue il giocatore e mostra poco
  //  piu' di una stanza per volta — da li' in avanti si cammina a orecchio.
  //
  //  Non c'e' nessun tasto per la pianta intera e nessuna mappina d'angolo: il
  //  disorientamento fra le stanze e' voluto, ed e' quello che si prova
  //  camminando nell'edificio vero.
  // ---------------------------------------------------------------------------
  vista: {
    zoom: 2.0,
    finestra: { larghezza: 900, altezza: 620 },  // px canvas: la fetta di mondo inquadrata, non l'edificio intero
  },

  // ---------------------------------------------------------------------------
  //  CASELLA 7 — L'OCCLUSIONE: che cosa si sente quando non si sente niente
  // ---------------------------------------------------------------------------
  //  L'occlusione non e' silenzio: e' un altro mondo sonoro. Il passa-basso
  //  toglie tutto quello che serve per orientarsi, il fronte stereo si stringe,
  //  e resta un rimbombo sordo — la testa dentro una scatola.
  // ---------------------------------------------------------------------------
  occlusione: {
    taglio: 320,          // Hz
    risonanza: 3.0,       // il tappo ha una sua nota: e' quella che disorienta
    attenuazione: 0.55,
    larghezza: 0.15,      // 0 = mono
    durata: 12,           // secondi
    transizione: 0.35,
  },

  // ---------------------------------------------------------------------------
  //  CASELLA 6 — IL DISTURBATORE: una lavorazione, non un suono in piu'
  // ---------------------------------------------------------------------------
  //  Compare, degrada la percezione, e non si combatte ne' si evita: va
  //  aspettato. E' la casella che spiega la differenza fra «l'audio e' una
  //  lista di file» e «l'audio e' anche una manopola».
  //
  //  Qui il mondo non si abbassa: si SFALSA. L'intonazione ondeggia in modo
  //  irregolare e il fronte stereo si accartoccia, cosi' la direzione da cui
  //  arriva un pezzo non e' piu' affidabile. Si sente tutto, ma si sbaglia
  //  strada.
  // ---------------------------------------------------------------------------
  disturbo: {
    primoArrivo: [40, 70],   // secondi: intervallo casuale prima del primo
    intervallo: [55, 95],    // secondi fra un disturbo e il successivo
    durata: [9, 15],         // quanto dura
    wowCent: 42,             // ampiezza dell'ondeggiamento d'intonazione
    wowVelocita: [0.37, 0.59, 0.91],   // Hz, non commensurabili fra loro
    larghezza: 0.35,         // il fronte si accartoccia: il pan mente
    taglio: 5200,            // Hz: si perde il dettaglio, non il corpo
    transizione: 0.6,
  },

  // ---------------------------------------------------------------------------
  //  CASELLA 7 — GLI AIUTI A DOPPIO TAGLIO
  // ---------------------------------------------------------------------------
  //  Ognuno aiuta e insieme toglie qualcosa. Sono due, uno solo per tipo per
  //  partita, e si consumano.
  // ---------------------------------------------------------------------------
  //  Erano tre: il terzo sospendeva la caccia, e nel gioco finito non serve
  //  piu' — quel mestiere lo fa Alba, che ferma l'inseguitore a parlare.
  //  Togliendolo sparisce anche l'ultimo aiuto senza sagoma propria.
  aiuti: {
    occlusione: { durata: 12, descrizione: 'Toglie l\'udito e protegge dal ' +
                'disturbatore. La protezione costa l\'ascolto.' },
    //  Il laptop non rivela piu' un pezzo: apre la pianta del palazzo per
    //  3,2 secondi, e per quei 3,2 secondi non vedi altro. Salita e discesa
    //  sono dentro la durata, non in aggiunta: 0,25 + 2,45 + 0,5.
    //  La discesa e' essa stessa informazione — «sta andando via, guarda adesso».
    rivela: { durata: 3.2, salita: 0.25, discesa: 0.5,
              descrizione: 'Apre la pianta del palazzo per tre secondi, e per ' +
                'tre secondi ti toglie la vista del gioco. Dice in che zona ' +
                'stanno i musicisti, non in quale aula.' },
  },

  // ---------------------------------------------------------------------------
  //  LE CINQUE ACUSTICHE
  // ---------------------------------------------------------------------------
  //  Le aule sono asciutte, i corridoi rimbombano, l'anfiteatro ha la coda piu'
  //  lunga, i cortili sono aperti e senza code, e fuori dall'edificio c'e' il
  //  traffico di Via Circumvallazione e nessuna parete che rimandi indietro il
  //  suono. Sono la terza condizione d'ascolto della casella 9, e devono
  //  restare riconoscibili a orecchio nudo.
  //
  //  I nomi delle chiavi vengono da quando le acustiche erano quattro:
  //  'scorciatoia' sono i due cortili, 'anfiteatro' e' l'auditorium. Non si
  //  rinominano perche' sono la chiave con cui il motore le chiama.
  //
  //  'livello' e' la quantita' di segnale riverberato; 'durataFinta' e
  //  'coloreFinto' valgono solo per il riverbero sintetico di ripiego.
  // ---------------------------------------------------------------------------
  ambienze: {
    aula:        { file: 'ambiente_01.wav',          volume: 0.09 },
    corridoio:   { file: 'ambiente_02.wav',          volume: 0.30 },
    anfiteatro:  { file: 'ambiente_03.wav',          volume: 0.20 },
    scorciatoia: { file: 'ambiente_scorciatoia.wav', volume: 0.34 },
    esterno:     { file: 'ambiente_esterno.wav',     volume: 0.42 },
    //  Di notte cambiano solo gli esterni. Se il file notturno manca si
    //  sente quello di giorno: il cortile non resta muto.
    scorciatoia_notte: { file: 'ambiente_scorciatoia_notte.wav', volume: 0.34 },
    esterno_notte:     { file: 'ambiente_esterno_notte.wav',     volume: 0.42 },
  },

  riverberi: {
    aula:        { file: 'ir_01.wav',          durataFinta: 0.35, coloreFinto: 4200, livello: 0.07 },
    corridoio:   { file: 'ir_02.wav',          durataFinta: 2.8,  coloreFinto: 2400, livello: 0.62 },
    anfiteatro:  { file: 'ir_03.wav',          durataFinta: 3.2,  coloreFinto: 1700, livello: 0.50 },
    scorciatoia: { file: 'ir_scorciatoia.wav', durataFinta: 0.55, coloreFinto: 6000, livello: 0.10 },
    esterno:     { file: 'ir_esterno.wav',     durataFinta: 0.22, coloreFinto: 7000, livello: 0.04 },
  },

  // ---------------------------------------------------------------------------
  //  LA DIMENSIONE DELL'AULA — la sesta acustica nascosta dentro la prima
  // ---------------------------------------------------------------------------
  //  Le aule del Cimarosa vanno da 52 a 146 px di lato: quasi il triplo. Un
  //  solo riverbero per tutte le fa suonare tutte uguali, e chi gioca a
  //  orecchio perde un'informazione che nella realta' ha.
  //
  //  Il file registrato e' UNO SOLO — `ir_01.wav`, l'aula media. Le altre due
  //  code il gioco se le ricava allungandolo e accorciandolo: un'aula grande
  //  ha la coda piu' lunga e piu' scura, una piccola piu' corta e piu' chiara.
  //  Chi registra non deve fare niente di piu'.
  //
  //  La taglia la decide la pianta, non un'etichetta scritta a mano: `lato` e'
  //  il lato del quadrato di pari area, in px di gioco. Con queste due soglie
  //  vengono 10 aule piccole, 21 medie e 12 grandi.
  // ---------------------------------------------------------------------------
  taglieAula: [
    { nome: 'piccola', finoA:  80, coda: 0.62, livello: 0.75 },
    { nome: 'media',   finoA: 110, coda: 1.00, livello: 1.00 },
    { nome: 'grande',  finoA: Infinity, coda: 1.55, livello: 1.45 },
  ],

  // ---------------------------------------------------------------------------
  //  EVENTI — i suoni che partono e finiscono
  // ---------------------------------------------------------------------------
  //  A un evento si risponde con un suono; a uno stato con un trattamento.
  //  Qui stanno solo gli eventi: gli stati (occlusione, disturbo, inseguitore)
  //  sono lavorazioni e non hanno un file.
  // ---------------------------------------------------------------------------
  eventi: {
    //  0,30 fino al 14/09/2026. «Alleggerirei anche i passi del player in ogni
    //  caso»: sono il suono piu' frequente della partita — uno ogni 32 px — e
    //  a quel livello stavano davanti agli strumenti, che sono l'informazione.
    passo: { casella: 0, descrizione: 'Ogni passo del giocatore mentre cammina.',
      file: ['passo_01.wav', 'passo_02.wav', 'passo_03.wav', 'passo_04.wav'],
      volume: 0.18, variazione: 0.07, spazializza: false, riverbero: 0.3 },

    porta: { casella: 0, descrizione: 'Una porta si apre o si chiude: si entra ' +
        'o si esce da una stanza.',
      file: ['porta_01.wav', 'porta_02.wav', 'porta_03.wav'],
      volume: 0.42, variazione: 0.04, spazializza: false, riverbero: 0.35 },

    porta_soglia: { casella: 0, descrizione: 'Si attraversa la soglia fra due ' +
        'acustiche diverse. Deve far capire che la posizione e\' cambiata.',
      file: ['porta_soglia_01.wav', 'porta_soglia_02.wav'],
      volume: 0.40, variazione: 0.05, spazializza: false, riverbero: 0.6 },

    interfaccia_inizio: { casella: 0, descrizione: 'Inizio della partita.',
      file: ['interfaccia_inizio_01.wav'],
      volume: 0.55, variazione: 0.0, spazializza: false, riverbero: 0.2 },

    interfaccia_fine: { casella: 0, descrizione: 'Fine della partita, vinta o persa.',
      file: ['interfaccia_fine_01.wav'],
      volume: 0.70, variazione: 0.0, spazializza: false, riverbero: 0.4 },

    interfaccia_conferma: { casella: 0, descrizione: 'Il giocatore conferma una ' +
        'scelta: conquista un pezzo, raccoglie un oggetto. Breve e netto.',
      file: ['interfaccia_conferma_01.wav'],
      volume: 0.55, variazione: 0.0, spazializza: false, riverbero: 0.25 },

    pezzo_richiesta: { casella: 1, descrizione: 'Il gioco annuncia la ' +
        'combinazione da raccogliere. Cambia ogni partita: il segnale non puo\' ' +
        'raccontare un pezzo preciso.',
      file: ['pezzo_richiesta_01.wav'],
      volume: 0.60, variazione: 0.0, spazializza: false, riverbero: 0.35 },

    inseguitore_avvistamento: { casella: 5, descrizione: 'L\'inseguitore si ' +
        'accorge di te. E\' l\'unico avviso che ricevi: deve bucare il suo suono ' +
        'continuo senza coprirlo.',
      file: ['inseguitore_avvistamento_01.wav', 'inseguitore_avvistamento_02.wav'],
      volume: 0.62, variazione: 0.03, spazializza: true, riverbero: 0.4 },

    inseguitore_perde: { casella: 5, descrizione: 'Ti ha perso: si puo\' tornare ' +
        'a cercare. Basso e breve.',
      file: ['inseguitore_perde_01.wav'],
      volume: 0.45, variazione: 0.0, spazializza: true, riverbero: 0.4 },

    disturbo_arrivo: { casella: 6, descrizione: 'Comincia il disturbatore. Non ' +
        'serve che sia forte: serve che sia inconfondibile.',
      file: ['disturbo_arrivo_01.wav'],
      volume: 0.55, variazione: 0.0, spazializza: false, riverbero: 0.3 },

    disturbo_fine: { casella: 6, descrizione: 'Il disturbatore smette. E\' un ' +
        'sollievo, non un allarme.',
      file: ['disturbo_fine_01.wav'],
      volume: 0.45, variazione: 0.0, spazializza: false, riverbero: 0.3 },

    aiuto_occlusione: { casella: 7, descrizione: 'Prendi l\'aiuto che toglie ' +
        'l\'udito. E\' l\'ultimo suono che si sente per intero prima che il mondo ' +
        'cambi: pensalo a come finisce, non a come comincia.',
      file: ['aiuto_occlusione_01.wav'],
      volume: 0.60, variazione: 0.0, spazializza: false, riverbero: 0.35 },

    aiuto_rivela: { casella: 7, descrizione: 'Apri il laptop e per tre secondi ' +
        'vedi solo la pianta. Il gioco lo mette nello spazio, verso il ' +
        'musicista richiesto piu\' vicino: la mappa dice dove stanno, il suono ' +
        'dice da dove viene il primo.',
      file: ['aiuto_rivela_01.wav'],
      volume: 0.58, variazione: 0.0, spazializza: true, riverbero: 0.35 },

    aiuto_fine: { casella: 7, descrizione: 'Finisce l\'effetto di un aiuto, ' +
        'qualunque dei tre: e\' il ritorno alla normalita\', e la normalita\' e\' una sola.',
      file: ['aiuto_fine_01.wav'],
      volume: 0.45, variazione: 0.0, spazializza: false, riverbero: 0.3 },

    //  Il bagno (06/09 e 11/09/2026): quattro scene diverse — sciacquone,
    //  rubinetto, asciugamani, «occupato» — che RUOTANO a ogni ingresso, non a
    //  caso. Un evento solo per file: il riverbero lo mette il gioco.
    bagno: { casella: 5, descrizione: 'Si entra in bagno. Quattro scene ' +
        'diverse, una per ingresso a turno: sciacquone, rubinetto aperto, ' +
        'asciugamani, una voce che dice «occupato».',
      file: ['bagno_01.wav', 'bagno_02.wav', 'bagno_03.wav', 'bagno_04.wav'],
      volume: 0.55, variazione: 0.0, spazializza: false, riverbero: 0.35 },

    cattura: { casella: 5, descrizione: 'L\'inseguitore ti mette le mani ' +
        'addosso: la partita finisce qui. Corto e netto, e chiude di colpo ' +
        'tutto quello che stava suonando.',
      file: ['cattura_01.wav'],
      volume: 0.85, variazione: 0.0, spazializza: false, riverbero: 0.3 },

    regia_porta: { casella: 5, descrizione: 'La porta della regia che si ' +
        'chiude da fuori. Solo il battente: una porta pesante che si accosta e ' +
        'si assesta nel telaio. La serratura NON sta qui — e\' regia_chiavi, ' +
        'un file a parte, perche\' il silenzio fra le due lo misura il gioco.',
      file: ['regia_porta_01.wav'],
      volume: 0.80, variazione: 0.0, spazializza: false, riverbero: 0.5 },

    allarme_sirena: { casella: 5, descrizione: 'Solo di notte, se ti ' +
        'prende Aluzzi: la sirena dell\'edificio. Un ' +
        'giro di circa tre secondi; il gioco lo ripete finche\' la porta della ' +
        'regia non si chiude.',
      file: ['allarme_sirena_01.wav'],
      volume: 0.6, variazione: 0.0, spazializza: false, riverbero: 0.4 },

    regia_chiavi: { casella: 5, descrizione: 'La chiave che gira nella ' +
        'serratura, sentita da dentro. Arriva nel silenzio dopo che la porta ' +
        'si e\' chiusa, ed e\' il penultimo suono della partita: il mazzo che ' +
        'tintinna, il doppio giro, lo scatto. Registralo asciutto e vicino, ' +
        'senza coda: la coda la mette il gioco.',
      file: ['regia_chiavi_01.wav'],
      volume: 0.78, variazione: 0.0, spazializza: false, riverbero: 0.5 },

    finestra_apre: { casella: 9, descrizione: 'Una finestra si apre lontano: il palazzo respira e il varco torna percorribile.',
      file: ['finestra_apre_01.wav', 'finestra_apre_02.wav', 'finestra_apre_03.wav', 'finestra_apre_04.wav'],
      volume: 0.48, variazione: 0.04, spazializza: true, riverbero: 0.35 },

    finestra_chiude: { casella: 9, descrizione: 'Una finestra si richiude senza intrappolare chi la sta attraversando.',
      file: ['finestra_chiude_01.wav', 'finestra_chiude_02.wav', 'finestra_chiude_03.wav', 'finestra_chiude_04.wav'],
      volume: 0.46, variazione: 0.04, spazializza: true, riverbero: 0.35 },
  },

  // ---------------------------------------------------------------------------
  //  REGOLE DI GIOCO
  // ---------------------------------------------------------------------------
  gioco: {
    // --- casella 1: l'obiettivo che si compone di pezzi ---------------------
    //  I cinque pezzi stanno tutti nella mappa e li si chiede tutti e cinque.
    //  Cosi' ogni file registrato dagli studenti si sente in ogni partita, che
    //  in un prototipo didattico conta piu' della varieta'. Quello che cambia
    //  a ogni partita e' DOVE stanno e QUALI chiedono una prova.
    //  Mettendo 3 qui si torna alla combinazione variabile: i due pezzi non
    //  richiesti restano fuori dalla mappa e non suonano.
    pezziRichiesti: 5,
    pezziConProva: 3,          // fra i richiesti; casella 3 dice due o tre su cinque
    escheInGioco: 2,

    // --- casella 4: il tempo che scorre -------------------------------------
    //  Quando scade la partita non finisce: peggiora. E' l'unico momento in
    //  cui entra la musica, ed e' l'audio adattivo vero.
    tempoLimite: 120,          // secondi prima del peggioramento (Gianluca 24/09: 3 minuti troppi)
    avvisoTempo: 30,           // quanti secondi prima il conto alla rovescia si vede

    // --- casella 5: l'inseguitore -------------------------------------------
    velocitaInseguitore: 82,
    raggioVista: 300,          // px entro cui ti vede, se non sei in una stanza
    memoriaInseguitore: 4.0,   // secondi che continua verso l'ultimo punto visto
    presaInseguitore: 14,      // px di contatto
    //  I primi secondi Aluzzi e' inoffensivo: esce di casa e basta. Serve a
    //  dargli il tempo di farsi vedere, e a chi si trova in regia il tempo di
    //  scappare prima che chiuda la porta. Deciso da Gianluca il 13/09/2026.
    graziaInseguitore: 5.5,    // secondi in cui non prende nessuno
    //  «NON PARTE FINCHE' NON MI AVVICINO ALLA REGIA» (Gianluca, 24/09/2026).
    //  Due cause, misurate: girava a caso per tutto l'edificio, quindi da
    //  lontano non arrivava mai; e Alba lo fermava a parlare appena uscito,
    //  una partita su due entro 8 secondi, per 13-25 secondi davanti alla regia.
    fiutoInseguitore: 450,     // px: quando non ti vede, gira qui intorno a te
    albaDopo: 25,              // secondi dal risveglio prima che Alba lo possa fermare

    //  ALLE PORTE DELLE AULE. Aluzzi nelle aule non entra: si ferma
    //  fuori dalla porta di quella in cui sei, e ogni `portaSosta` secondi si
    //  allontana di poco e torna alla stessa porta. Alba no: gira per i
    //  corridoi e basta, il suo mestiere e' fermare lui (Gianluca, 24/09). E' la finestra in cui
    //  uscire. Deciso da Gianluca il 24/09/2026, al posto di farli entrare.
    portaSosta: 20,            // secondi fermi davanti alla porta
    portaVia: 72,              // px di corridoio di cui si allontanano
    portaFuori: 4,             // secondi lontani prima di tornare

    //  Preso vuol dire preso: la partita finisce. L'inseguitore insegna ai
    //  tecnici del suono, ti porta in regia e ti chiude dentro. La regia e'
    //  un'aula vera della pianta, e per questo non e' piu' un posto dove
    //  nascondere un musicista.
    aulaRegia: 'Aula 49',
    zonaPalco: 'PALCOSCENICO',   // il trapezio in fondo: li' si siede l'orchestra

    // --- movimento -----------------------------------------------------------
    velocitaGiocatore: 118,
    passoOgniPx: 32,
    //  Ogni pezzo che segui ti rallenta: piu' roba ti porti dietro, piu' ci
    //  metti. E' l'altra meta' del baratto della casella 8.
    zavorraPerPezzo: 0.055,    // frazione di velocita' persa per pezzo al seguito
    raggioRaccolta: 15,        // px per conquistare un pezzo o prendere un oggetto
    distanzaSeguace: 22,       // px fra un seguace e il precedente

    //  Nella scorciatoia si corre: e' il motivo per cui uno ci passa.
    spintaScorciatoia: 1.35,

    // --- finestre -----------------------------------------------------------
    //  Il palazzo respira senza mai cambiare il numero dei varchi: un terzo
    //  e' aperto, poi una finestra lontana si chiude e un'altra si apre.
    finestre: {
      frazioneAperte: 1 / 3,
      ricambioOgni: 2.5,       // secondi: abbastanza lento da poterlo sentire
      distanzaMinima: 120,     // px fra due varchi aperti nello stesso momento
      raggioSicurezza: 26,     // px: non chiudere addosso a chi sta passando
      durataRespiro: 0.42,     // secondi: il muro si apre e si richiude, non scatta
    },
  },

  // ---------------------------------------------------------------------------
  //  LA NOTTE — il secondo schema (deciso da Gianluca il 24/09/2026)
  // ---------------------------------------------------------------------------
  //  Stessa mappa, stessi suoni. Cambiano tre cose: e' buio e si vede solo
  //  dove punta la torcia; Aluzzi esce dopo 30 secondi invece di 120 ed e' un
  //  po' piu' veloce; fuori (i due cortili e la strada) l'ambienza e' quella
  //  notturna, file a parte (`ambienze.*_notte`).
  //
  //  Si sblocca vincendo una partita di giorno. Nella versione da giocare il
  //  pulsante si vede fin dall'inizio, col lucchetto: chi gioca deve sapere
  //  che c'e'. Nella versione di lavoro e' sempre aperta (tasto N), cosi' gli
  //  studenti la sonorizzano anche senza aver vinto.
  notte: {
    tempoLimite: 30,           // secondi prima che esca Aluzzi
    velocitaAluzzi: 1.15,      // 82 px/s di giorno -> ~94 di notte
    buio: 0.95,                // quanto e' nero fuori dalla torcia (0-1)
    //  Quando Aluzzi ti prende di notte. Due prove chieste da Gianluca il
    //  25/09/2026, una dopo l'altra: 'buio' = resta notte, con le torce, e
    //  l'unica stanza accesa e' la regia; 'allarme' = parte la sirena e
    //  una luce rossa lampeggia su tutto l'edificio.
    //  Scelta: 'allarme' (25/09). In tutte e due la regia resta accesa.
    cattura: 'allarme',
    regiaAccesa: 0.8,          // quanto buca il buio la luce della regia (0-1)
    auleAccese: 0.45,          // luce tenue nelle aule dei musicisti, dopo che ci sei entrato (0-1)
    allarme: {
      lampi: 1.6,              // lampi al secondo
      rosso: 0.32,             // quanto tinge di rosso il lampo (0-1)
      schiarisce: 0.45,        // quanto il lampo solleva il buio (0-1)
      sirena: 3.0,             // secondi fra un giro di sirena e il successivo
    },
    //  Le soglie delle aule: una striscia di luce tenue sulla porta, come le
    //  luci d'emergenza. Chiesta da Gianluca il 25/09: al buio le porte non
    //  si imboccavano.
    soglie: { luce: 0.45, largo: 5, massima: 70 },   // massima: px, oltre non e' una porta
    torcia: {
      lunghezza: 240,          // px di mondo illuminati davanti a te
      apertura: 0.95,          // radianti, tutto il cono (~55 gradi)
      alone: 36,               // px di luce intorno ai piedi, per non perdersi
      morbidezza: 0.2,         // secondi: quanto ci mette la torcia a girare verso lo sguardo
    },
    //  Le torce di Aluzzi e Alba: piu' corte della tua, colorate come loro.
    //  Il trombettista va al buio.
    //  Le ombre delle torce: raggi del ventaglio; px di luce oltre il lato
    //  lontano della cosa colpita, e dentro il muro.
    ombre: { raggi: 90, dentro: 1, dentroMuro: 1 },
    torcePersonaggi: {
      lunghezza: 140,
      apertura: 0.8,
      alone: 22,
      morbidezza: 0.25,
      colore: 0.10,            // quanto tinge il fascio (0 = luce bianca)
    },
  },

  //  LA VERSIONE DA GIOCARE. Si apre con `GIOCA.html`, che rimanda qui con
  //  `?gioca`. Niente pannelli, niente modalita' libera, la notte col
  //  lucchetto. Ctrl + Alt + P riapre i pannelli: e' la porta di servizio
  //  per chi sonorizza, e non sta scritta nella schermata d'avvio.
  //  Nella copia per telefono, che e' quella pubblica, si gioca sempre:
  //  l'indirizzo nudo non deve aprire i pannelli di lavoro (30/09/2026).
  daGiocare: true,
};
