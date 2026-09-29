// =============================================================================
//  GIOCO — Avellino, le nove caselle
// =============================================================================
//  Cinque PEZZI sono nascosti nelle stanze del Conservatorio Cimarosa. Non si
//  vedono: si sentono. Ognuno tiene acceso il proprio loop, e piu' ci si
//  avvicina piu' si sente. Due ESCHE suonano allo stesso modo e non servono a
//  niente. Tre pezzi chiedono una PROVA: l'oggetto che serve dorme in un
//  corridoio da inizio partita, e si sveglia solo quando lo si scopre.
//
//  Un tempo scorre. Quando scade la partita non finisce: PEGGIORA — entra la
//  musica e compare l'INSEGUITORE, che si sente crescere avvicinandosi. I
//  pezzi conquistati ti SEGUONO suonando scombinati fra loro, e si allineano
//  solo arrivando in anfiteatro, che e' il punto di raccolta. I due cortili
//  scoperti sono SCORCIATOIE: ci si passa in fretta, ma li' dentro i pezzi non
//  si sentono piu'.
//
//  Ogni volta che succede qualcosa di sonoro il gioco chiama
//  audio.suona('nome_evento', {pan, distanza}). E' l'unico punto di contatto
//  fra gioco e suono per cio' che ACCADE; per cio' che DURA — occlusione,
//  disturbo, tensione, scorciatoia — ci sono metodi propri, perche' uno stato
//  non e' un evento.
//
//  Le regole di Lecce (insegnanti, allievi, spari, munizioni, strumenti da
//  distruggere) sono state tolte in blocco il 09/09/2026. Quel gioco vive
//  ancora, intero, in `Didattica_AudioGioco/gioco/`.
// =============================================================================

const audio = new MotoreAudio();
const G = CONFIG.gioco;

//  LA NOTTE. I valori di giorno si mettono da parte una volta sola: ogni
//  partita riscrive `G` a partire da questi, di giorno o di notte.
const NOTTE = CONFIG.notte;
const GIORNO = { tempoLimite: G.tempoLimite, velocitaInseguitore: G.velocitaInseguitore };
const CHIAVE_NOTTE = 'avellino.notteAperta';
let notte = false;

//  Nella versione da giocare i pannelli partono chiusi.
let pannelliAperti = !CONFIG.daGiocare;
function mostraPannelli(si) {
  pannelliAperti = si;
  document.body.classList.toggle('pannelli-chiusi', !si);
  document.body.classList.toggle('da-giocare', CONFIG.daGiocare);
  if (!si && modalitaLibera) commutaLibera();
}
//  all'avvio solo le classi: `modalitaLibera` non e' ancora dichiarata
document.body.classList.toggle('pannelli-chiusi', !pannelliAperti);
document.body.classList.toggle('da-giocare', CONFIG.daGiocare);

function notteAperta() {
  if (!CONFIG.daGiocare) return true;
  try { return localStorage.getItem(CHIAVE_NOTTE) === '1'; } catch (e) { return false; }
}
function apriLaNotte() {
  try { localStorage.setItem(CHIAVE_NOTTE, '1'); } catch (e) {}
}

const cv = document.getElementById('schermo');
const ctx = cv.getContext('2d');
cv.width = CONFIG.vista.finestra.larghezza;
cv.height = CONFIG.vista.finestra.altezza;

// -----------------------------------------------------------------------------
//  TELECAMERA
// -----------------------------------------------------------------------------
//  Il mondo e' grande quanto il canvas; la telecamera ne mostra solo una parte,
//  ingrandita, e segue il giocatore. Ai bordi si ferma, cosi' non si vede mai
//  il fuori dell'edificio.
//
//  Rimettendo zoom a 1 in config.js si torna alla pianta intera senza toccare
//  altro: camera resta a 0,0 e la trasformazione diventa l'identita'.
// -----------------------------------------------------------------------------
const MONDO_L = LARG * TILE, MONDO_A = ALT * TILE;
const ZOOM = CONFIG.vista.zoom;
//  Lo zoom e' fisso per tutta la partita, tranne nel concerto: li' la
//  telecamera si allarga sulla sala e smette di inseguire il giocatore. E'
//  l'unico momento in cui si guarda invece di giocare, ed e' l'unico in cui
//  vedere dove si sta seduti conta piu' che vedersi i piedi.
let zoomVista = ZOOM;
const camera = { x: 0, y: 0 };

function aggiornaCamera() {
  if (!giocatore) return;
  //  Se una scena ha una sua inquadratura, comanda quella e non si insegue
  //  piu' nessuno.
  const V = scena && scena.vista;
  if (V) { zoomVista = V.zoom; camera.x = V.x; camera.y = V.y; return; }
  zoomVista = ZOOM;
  const vl = cv.width / zoomVista, va = cv.height / zoomVista;
  camera.x = Math.max(0, Math.min(MONDO_L - vl, giocatore.x - vl / 2));
  camera.y = Math.max(0, Math.min(MONDO_A - va, giocatore.y - va / 2));
}

// -----------------------------------------------------------------------------
//  Lo stato della partita
// -----------------------------------------------------------------------------
let giocatore, stanze, pezzi, oggetti, aiuti, inseguitore, scia, finestre;
let trombettista, alba, colloquio, regia;
let stanzaCorrente, acusticaCorrente, inScorciatoia, distanzaPasso, tPrec;
let bagnoCorrente = -1, ingressiBagno = 0;
let tempo = 0, tempoScaduto = false, inPausa = false, modalitaLibera = false;
let partitaFinita = false, esito = '', consegnati = 0, richiesti = 0;
//  La scena della cattura, quando sta recitando: null in tutto il resto
//  della partita. Finche' c'e', comanda lei — vedi `aggiornaScena`.
let scena = null;
//  Il foglio del direttore: aperto all'inizio di ogni partita, richiamabile
//  con C. Finche' e' aperto il gioco non scorre — il tempo della casella 4
//  comincia quando il giocatore ha finito di leggere, non prima.
let consegnaAperta = true;
let disturbo, occlusione, laptop;

// -----------------------------------------------------------------------------
//  Avvio
// -----------------------------------------------------------------------------
//  Il pulsante della notte si vede sempre; chiuso, porta il lucchetto e dice
//  come si apre. Il lucchetto e' una forma, non un colore.
(function preparaPulsanteNotte() {
  const b = document.getElementById('btnNotte');
  if (!b) return;
  if (notteAperta()) { b.innerHTML = '☾ NOTTE'; b.disabled = false; }
  else { b.innerHTML = '🔒 NOTTE <span>si apre vincendo una partita di giorno</span>'; b.disabled = true; }
  b.addEventListener('click', () => { if (notteAperta()) { notte = true; avviaPartita(b); } });
})();

document.getElementById('btnAvvia').addEventListener('click', () => {
  notte = false; avviaPartita(document.getElementById('btnAvvia'));
});

async function avviaPartita(b) {
  document.querySelectorAll('#avvio button').forEach(x => x.disabled = true);
  b.textContent = 'CARICO I SUONI…';

  const guardia = setTimeout(() => {
    if (!audio.pronto) mostraProblema('Il caricamento non finisce.',
      'Apri lo stesso indirizzo in un\'altra finestra del browser:\n' + location.href);
  }, 90000);

  audio.sbloccaAudio();   // dentro il click, finche' il gesto e' valido

  try {
    await audio.avvia((f, t) => { b.textContent = `CARICO I SUONI  ${f}/${t}`; });
    clearTimeout(guardia);
    document.getElementById('avvio').hidden = true;
    document.getElementById('app').hidden = false;
    controllaMappa();
    inizializza();
    preparaPannelli();
    tPrec = performance.now();
    requestAnimationFrame(ciclo);
  } catch (err) {
    clearTimeout(guardia);
    mostraProblema('Il gioco non e\' riuscito a partire.', String(err));
  }
}

function mostraProblema(titolo, dettaglio) {
  const box = document.querySelector('#avvio .box');
  if (!box || box.dataset.errore) return;
  box.dataset.errore = '1';
  box.innerHTML = '<h1 style="font-size:22px;color:#cc4b4b">' + titolo + '</h1>' +
    '<p class="nota" style="white-space:pre-wrap;text-align:left;font-family:Menlo,monospace;' +
    'font-size:11px;background:#14171c;padding:12px;border-radius:3px">' + dettaglio + '</p>';
}
addEventListener('error', e => mostraProblema('Errore nel codice.', e.message));
addEventListener('unhandledrejection', e => mostraProblema('Errore nel caricamento.', String(e.reason)));

// Se il ricalco sigilla un pezzo di edificio, lo si sa subito.
function controllaMappa() {
  const r = verificaMappa();
  if (r.ok) return;
  const avviso = document.getElementById('avvisoMappa');
  avviso.hidden = false;
  const righe = [];
  if (r.irraggiungibili?.length) righe.push(`zone irraggiungibili: ${r.irraggiungibili.join(', ')}.`);
  if (r.inattesi?.length)        righe.push(`zone chiuse che non dovrebbero esserlo: ${r.inattesi.join(', ')}.`);
  if (r.porteStrette?.length)    righe.push(`porte strette, sotto i 18 px: ${r.porteStrette.join(', ')}.`);
  avviso.textContent = 'ATTENZIONE alla mappa — ' + righe.join(' ');
}


// =============================================================================
//  LA MAPPA, LETTA PER CRITERI
// =============================================================================
//  `mappa.js` e' generato dal ricalco: i suoi indici slittano a ogni
//  rigenerazione, quindi qui non se ne scrive nemmeno uno. Il punto di
//  raccolta e' l'unica zona di tipo 'anfiteatro'; le scorciatoie sono le zone
//  che il ricalco ha marcato `scorciatoia`.
// -----------------------------------------------------------------------------
const RACCOLTA = ANFITEATRO;
const SCORCIATOIE = ZONE.filter(z => z.scorciatoia);

// Le celle dei corridoi si ricavano scandendo tutta la griglia — duecentomila
// caselle. Si calcolano una volta sola all'avvio: chiederle a ogni fotogramma,
// come faceva l'inseguitore quando cambiava meta', faceva saltare il ciclo.
const CELLE_CORRIDOIO = celleCorridoio();
//  Le mete di Aluzzi: i corridoi meno i bagni, dove non entra.
const CELLE_INSEGUITORE = CELLE_CORRIDOIO.filter(p => bagnoContenente(p.x, p.y) < 0);

//  I CORRIDOI CHE SI TENGONO PER MANO
//
//  Il trombettista sta nei corridoi, e basta: il vincolo di prima — «dovunque
//  tranne che nelle aule» — gli lasciava aperti i cortili, l'anfiteatro e il
//  palcoscenico, e nel Cortile A ci e' rimasto piantato per mezza partita
//  (visto da Gianluca il 13/09/2026). Il cortile non e' un'aula, quindi
//  passava; una volta dentro, la meta successiva stava dall'altra parte di un
//  muro e lui ci si appoggiava contro.
//
//  Ma «solo corridoi» da solo non basta: dei nove corridoi, otto sono un
//  blocco unico da 27.579 celle e il nono — il PALCOSCENICO — e' staccato, ci
//  si arriva passando dall'auditorium. Nato di la', avrebbe puntato mete che
//  non puo' raggiungere. Quindi le celle si dividono in blocchi collegati una
//  volta all'avvio, e lui nasce e cammina dentro UN blocco solo.
//
//  Il conto costa una scansione della griglia: si fa una volta, come per
//  CELLE_CORRIDOIO.
const BLOCCHI_CORRIDOIO = (() => {
  const corpo = 6;                           // r * 0.75 del trombettista
  //  Si parte dalle celle di corridoio gia' contate, non da tutta la griglia:
  //  sono trentottomila invece di duecentodiecimila, e il caricamento del
  //  gioco non se ne accorge.
  const dentro = new Uint8Array(LARG * ALT);
  for (const p of CELLE_CORRIDOIO)
    if (libero(p.x, p.y, corpo))
      dentro[Math.floor(p.y / CELLA) * LARG + Math.floor(p.x / CELLA)] = 1;

  const marchio = new Int32Array(LARG * ALT).fill(-1);
  const coda = new Int32Array(LARG * ALT);
  const blocchi = [];
  for (let i = 0; i < LARG * ALT; i++) {
    if (!dentro[i] || marchio[i] >= 0) continue;
    const n = blocchi.length, celle = [];
    let testa = 0, fine = 0;
    coda[fine++] = i; marchio[i] = n;
    while (testa < fine) {
      const p = coda[testa++];
      const c = p % LARG, f = (p - c) / LARG;
      celle.push({ x: c * CELLA + CELLA / 2, y: f * CELLA + CELLA / 2 });
      if (c > 0        && dentro[p - 1]    && marchio[p - 1]    < 0) { marchio[p - 1]    = n; coda[fine++] = p - 1; }
      if (c < LARG - 1 && dentro[p + 1]    && marchio[p + 1]    < 0) { marchio[p + 1]    = n; coda[fine++] = p + 1; }
      if (f > 0        && dentro[p - LARG] && marchio[p - LARG] < 0) { marchio[p - LARG] = n; coda[fine++] = p - LARG; }
      if (f < ALT - 1  && dentro[p + LARG] && marchio[p + LARG] < 0) { marchio[p + LARG] = n; coda[fine++] = p + LARG; }
    }
    blocchi.push(celle);
  }
  blocchi.sort((a, b) => b.length - a.length);
  //  rimarchia dopo l'ordinamento: `bloccoDi` legge questa mappa
  const indice = new Int32Array(LARG * ALT).fill(-1);
  blocchi.forEach((celle, n) => celle.forEach(p => {
    indice[Math.floor(p.y / CELLA) * LARG + Math.floor(p.x / CELLA)] = n;
  }));
  return { blocchi, indice };
})();

//  In quale blocco di corridoio sta un punto: -1 se non e' in nessuno.
function bloccoCorridoio(x, y) {
  const c = Math.floor(x / CELLA), f = Math.floor(y / CELLA);
  if (c < 0 || f < 0 || c >= LARG || f >= ALT) return -1;
  return BLOCCHI_CORRIDOIO.indice[f * LARG + c];
}

// Cinque acustiche, e una regola sola per sceglierle: le aule sono asciutte, i
// corridoi rimbombano, l'anfiteatro ha la coda lunga, i cortili sono aperti, e
// fuori dall'edificio non c'e' niente che rimandi indietro il suono.
//
// L'aula porta appesa la sua taglia — 'aula:grande' — perche' un'aula di 146 px
// di lato e una di 52 non possono avere la stessa coda. La taglia si legge
// dalla pianta (`latoZona`), non da un'etichetta scritta a mano: se il ricalco
// cambia, cambia da sola.
function acusticaA(px, py) {
  const z = zonaContenente(px, py);
  if (!z) return 'corridoio';
  if (z.tipo === 'anfiteatro') return 'anfiteatro';
  if (z.tipo === 'aula') return 'aula:' + tagliaAula(z);
  if (z.tipo === 'cortile') return 'scorciatoia';
  if (z.tipo === 'esterno') return 'esterno';
  return 'corridoio';
}

// Si misura una volta per aula e si tiene da parte: `latoZona` scorre l'elenco
// delle zone, e qui si passa a ogni fotogramma.
const TAGLIA_AULA = new Map();
function tagliaAula(z) {
  let t = TAGLIA_AULA.get(z);
  if (!t) {
    const lato = latoZona(z);
    t = (CONFIG.taglieAula.find(x => lato < x.finoA) || CONFIG.taglieAula[CONFIG.taglieAula.length - 1]).nome;
    TAGLIA_AULA.set(z, t);
  }
  return t;
}

function nellaScorciatoia(px, py) {
  const z = zonaContenente(px, py);
  return !!(z && z.scorciatoia);
}

//  IL PROSCENIO — dove il giocatore nasce, e perche' proprio li'
//
//  Il direttore gli ha appena messo in mano il foglio con i cinque strumenti,
//  e glielo ha dato sul palco: quello stesso palco dove alla fine i musicisti
//  si siederanno a suonare. Il posto in cui deve tornare, quindi, lo ha visto
//  con i suoi occhi al primo secondo di partita. Fino al 12/09/2026 nasceva
//  invece in un punto a caso dei corridoi, a 900 px dalla sala — e il traguardo
//  era una cosa di cui gli era stato solo detto.
//
//  Le file della sala sono archi concentrici attorno a un centro che sta fuori
//  dalla sagoma (`gradinate.centro` in mappa.js). Il proscenio e' l'arco piu'
//  basso, `raggi[0]`: sotto c'e' il palco, sopra cominciano i gradini.
//  IL PROSCENIO, misurato invece che scritto a mano.
//
//  Sotto il primo arco delle gradinate c'e' il proscenio — la fascia davanti
//  alle file, che NON e' il palco: il palco vero e' il trapezio in fondo, la
//  zona `PALCOSCENICO`. Qui si nasce e qui i musicisti aspettano.
//  La fascia finisce dove finisce la zona. Quanto sia profondo non lo sa nessuno finche' non lo si misura: si
//  cammina all'indietro lungo la mira finche' si esce, e quello e' il fondo.
//  Misurarlo qui vuol dire che il giorno in cui il ricalco cambia la sagoma
//  questi numeri si spostano da soli, invece di restare indietro in silenzio.
let PROSCENIO = null;
function geometriaProscenio() {
  if (PROSCENIO) return PROSCENIO;
  if (!RACCOLTA || !RACCOLTA.gradinate) return null;
  const gc = RACCOLTA.gradinate.centro, r0 = RACCOLTA.gradinate.raggi[0];
  //  la direzione in cui la sala si apre: dal centro del ventaglio al centro
  //  della zona ricalcata
  const mira = Math.atan2(RACCOLTA.centro.y - gc.y, RACCOLTA.centro.x - gc.x);
  let fondo = r0;
  for (let r = r0; r >= 40; r -= 2) {
    if (!nellaRaccolta(gc.x + Math.cos(mira) * r, gc.y + Math.sin(mira) * r)) break;
    fondo = r;
  }
  //  I VARCHI DEL PROSCENIO — le porte che si aprono sulla fascia, non quelle
  //  in cima alle gradinate. Servono per non piantarci davanti nessuno:
  //  l'ingresso laterale della sala e' l'unico modo che ha il giocatore di
  //  entrare, e fino al 13/09/2026 chi aspettava ci finiva sopra — misurato,
  //  un musicista a sette pixel dallo stipite. Si misurano dalla pianta invece
  //  di scriverli a mano: se il ricalco sposta la porta, si spostano da soli.
  const varchi = confineDi(RACCOLTA, () => true)
    .filter(p => { const r = Math.hypot(p.x - gc.x, p.y - gc.y);
                   return r >= fondo - 10 && r <= r0 + 10; });

  return (PROSCENIO = { gc, mira, r0, fondo, mezzo: (r0 + fondo) / 2, varchi });
}

//  Meta' strada esatta fra il primo gradino e il fondo del proscenio. Fino al
//  13/09/2026 si nasceva sul filo del primo gradino, e da li' la sala sembrava
//  alle spalle invece che davanti: le file si vedevano solo girandosi. Ora si
//  nasce in mezzo al palco, col ventaglio delle file davanti agli occhi.
function proscenio() {
  if (!RACCOLTA) return null;
  const P = geometriaProscenio();
  if (!P) return RACCOLTA.centro;

  //  Si apre a ventaglio attorno alla mira: il primo punto dentro la sala e
  //  abbastanza lontano dai muri vince. Senza il controllo su `libero` con il
  //  raggio del corpo si ripete il difetto del 09/09 — nato incastrato, i
  //  tasti non rispondono.
  for (let d = 0; d <= 0.7; d += 0.035)
    for (const verso of (d ? [-1, 1] : [0]))
      for (const r of [P.mezzo, P.mezzo - 14, P.mezzo + 14, P.mezzo - 28, P.mezzo + 28]) {
        const x = P.gc.x + Math.cos(P.mira + verso * d) * r;
        const y = P.gc.y + Math.sin(P.mira + verso * d) * r;
        if (nellaRaccolta(x, y) && libero(x, y, 6)) return { x, y };
      }
  return RACCOLTA.centro;
}

//  IL PALCOSCENICO — il palco vero, il trapezio in fondo alla sala.
//
//  Non e' l'anfiteatro: e' una zona sua, che il ricalco chiama `PALCOSCENICO`.
//  Una striscia lunga e stretta in diagonale — 85 px di profondita' contro 302
//  di larghezza — e questo detta la forma del semicerchio: largo quasi da un
//  angolo all'altro e poco profondo, non il cerchietto stretto che c'era prima.
//
//  L'ASSE SI MISURA, NON SI DEDUCE. Fino al 13/09/2026 la direzione del
//  pubblico era la retta dal centro della zona al centro della sala: -17,9
//  gradi. L'asse vero della striscia sta a 59,6 gradi, e la sua perpendicolare
//  a -30,4: dodici gradi e mezzo di scarto, che sul semicerchio si vedevano
//  eccome — da una parte il musicista finiva quasi nell'angolo, dall'altra
//  l'arco si fermava prima. Il centro della zona, per una striscia in
//  diagonale, non e' il suo asse di simmetria.
//
//  L'asse si ricava dalle celle della zona (momenti del secondo ordine): e'
//  la direzione in cui la striscia si allunga di piu'. Perpendicolare a
//  quella, girata dalla parte della sala, c'e' il pubblico.
let PALCO = null;
function geometriaPalco() {
  if (PALCO) return PALCO;
  const z = ZONE.find(q => q.nome === G.zonaPalco);
  if (!z || !RACCOLTA) return null;

  const celle = celleZona(z);
  let cx = z.centro.x, cy = z.centro.y, asse = 0;
  if (celle.length) {
    cx = 0; cy = 0;
    for (const c of celle) { cx += c.x; cy += c.y; }
    cx /= celle.length; cy /= celle.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const c of celle) {
      const dx = c.x - cx, dy = c.y - cy;
      sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
    }
    asse = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  }

  //  la perpendicolare all'asse, girata verso la sala: e' da quella parte che
  //  sta il pubblico, ed e' li' che i musicisti guardano
  let mira = asse + Math.PI / 2;
  if (Math.cos(mira) * (RACCOLTA.centro.x - cx) +
      Math.sin(mira) * (RACCOLTA.centro.y - cy) < 0) mira += Math.PI;

  //  Il musicista di mezzo sta ARRETRATO, cosi' i due di punta possono venire
  //  avanti: e' quello a dare la curva. Il centro di curvatura sta davanti a
  //  loro, dalla parte del pubblico — e' il posto del direttore, e i musicisti
  //  gli si aprono intorno.
  const mid = { x: cx - Math.cos(mira) * 20, y: cy - Math.sin(mira) * 20 };
  return (PALCO = { zona: z, mira, asse, centro: { x: cx, y: cy }, raggio: 235,
                    curva: { x: mid.x + Math.cos(mira) * 235, y: mid.y + Math.sin(mira) * 235 } });
}

const nelPalco = (x, y) => { const P = geometriaPalco();
  return !!P && zonaContenente(x, y) === P.zona; };

//  Il posto del musicista numero `k` di `n` nel semicerchio del concerto.
//
//  L'apertura si sceglie da sola: si parte dalla piu' larga e si stringe finche'
//  tutti e `n` i posti non stanno dentro la zona. Cosi' il giorno in cui il
//  ricalco cambia la sagoma del palco il semicerchio si adatta invece di
//  mandare due musicisti dentro un muro.
function postoSulPalco(k, n) {
  const P = geometriaPalco();
  if (!P) return { x: RACCOLTA.centro.x, y: RACCOLTA.centro.y };
  const seggio = (k, ap) => {
    const q = (n > 1 ? k / (n - 1) - 0.5 : 0) * 2 * ap;
    const a = P.mira + Math.PI + q;
    return { x: P.curva.x + Math.cos(a) * P.raggio, y: P.curva.y + Math.sin(a) * P.raggio };
  };
  for (let ap = 0.55; ap > 0.08; ap -= 0.02) {
    let tutti = true;
    for (let j = 0; j < n; j++) {
      const q = seggio(j, ap);
      if (!nelPalco(q.x, q.y) || !libero(q.x, q.y, 5)) { tutti = false; break; }
    }
    if (tutti) return seggio(k, ap);
  }
  return { x: P.centro.x, y: P.centro.y };
}

//  DOVE ASPETTANO — il proscenio, in ordine sparso.
//
//  Un musicista consegnato non va subito sul palco: aspetta davanti alle file
//  che il gruppo si completi, e aspetta come aspetta la gente, sparso e a
//  capannelli. In semicerchio ci si mette solo per suonare, ed e' quello a
//  rendere il concerto un momento invece di una posizione.
function postoDiAttesa(k) {
  const P = geometriaProscenio();
  if (!P) return { x: RACCOLTA.centro.x, y: RACCOLTA.centro.y };
  //  chi sta ancora camminando conta per il posto dove andra', non per dove
  //  si trova adesso: se no due arrivati insieme sceglievano lo stesso punto
  const presi = pezzi.filter(q => q.consegnato && q.x !== undefined)
                     .map(q => q.meta ? { x: q.meta.x, y: q.meta.y } : { x: q.x, y: q.y });
  //  `-Infinity` e non `-1`: il punteggio di un capannello e' la distanza dal
  //  vicino cambiata di segno, quindi e' sempre negativo. Partendo da -1 non lo
  //  batteva mai nessuno e tornavano tutti il ripiego, cioe' lo stesso identico
  //  punto: tre musicisti uno dentro l'altro. Preso dal collaudo, non a occhio.
  let migliore = null, miglioreD = -Infinity;
  for (let tent = 0; tent < 120; tent++) {
    const r = P.fondo + 10 + Math.random() * (P.r0 - P.fondo - 20);
    //  Il ventaglio si e' stretto da ±0,60 a ±0,34 radianti, e la somma di due
    //  sorteggi lo tira verso il mezzo invece di spalmarlo uniforme: chi
    //  aspetta sta al centro del proscenio, non sui bordi. Prima il bordo
    //  positivo arrivava esattamente sull'ingresso laterale della sala.
    const d = (Math.random() + Math.random() - 1) * 0.34;
    const q = { x: P.gc.x + Math.cos(P.mira + d) * r, y: P.gc.y + Math.sin(P.mira + d) * r };
    if (!nellaRaccolta(q.x, q.y) || !libero(q.x, q.y, 6)) continue;
    //  e comunque mai davanti a una porta: ci si deve poter passare
    if (P.varchi.some(v => Math.hypot(v.x - q.x, v.y - q.y) < 50)) continue;
    //  vicino a qualcuno, ma non addosso: e' quello che fa il capannello
    const vicino = presi.length
      ? Math.min(...presi.map(a => Math.hypot(a.x - q.x, a.y - q.y))) : 999;
    if (vicino < 16) continue;
    const punteggio = presi.length ? -vicino : Math.random();
    if (punteggio > miglioreD) { miglioreD = punteggio; migliore = q; }
  }
  return migliore || proscenio() || { x: RACCOLTA.centro.x, y: RACCOLTA.centro.y };
}

function nellaRaccolta(px, py) {
  return !!RACCOLTA && zonaContenente(px, py) === RACCOLTA;
}

const nomeZona = (px, py) => (zonaContenente(px, py) || {}).nome || 'Corridoio';

// Un punto a caso dentro una zona, lontano da un altro punto: serve a non far
// nascere l'inseguitore addosso al giocatore e a spargere gli oggetti.
//
// `raggio` non e' un dettaglio: una cella di corridoio puo' stare a due pixel
// dal muro, e un corpo che ci nasce sopra non e' `libero` in nessuna delle
// quattro direzioni — resta piantato li' per tutta la partita, con i tasti che
// non rispondono. Succedeva a una partenza su cinque (misurato il 09/09/2026,
// 12 su 60), ed e' il difetto che in aula si racconta come «il gioco non parte».
function puntoIn(celle, lontanoDa, minimo, raggio) {
  if (!celle.length) return null;
  const sta = p => !raggio || libero(p.x, p.y, raggio);
  let migliore = null, miglioreD = -1;
  for (let k = 0; k < 400; k++) {
    const p = celle[Math.floor(Math.random() * celle.length)];
    if (!sta(p)) continue;
    if (!lontanoDa) return p;
    const d = Math.hypot(p.x - lontanoDa.x, p.y - lontanoDa.y);
    if (d > (minimo || 0)) return p;
    if (d > miglioreD) { miglioreD = d; migliore = p; }
  }
  // nessun punto valido a caso: si scandisce, invece di restituire un muro
  return migliore || celle.find(sta) || null;
}

function mescola(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


// =============================================================================
//  PREPARAZIONE DELLA PARTITA
// =============================================================================
function inizializza() {
  G.tempoLimite = notte ? NOTTE.tempoLimite : GIORNO.tempoLimite;
  G.velocitaInseguitore = GIORNO.velocitaInseguitore * (notte ? NOTTE.velocitaAluzzi : 1);
  audio.notte = notte;
  document.getElementById('segnoNotte').style.display = notte ? '' : 'none';   // .voce vince su [hidden]
  tempo = 0; tempoScaduto = false; partitaFinita = false; esito = ''; consegnati = 0;
  scena = null;
  scia = [];
  disturbo = { attivo: false, fino: 0, prossimo: fraDue(CONFIG.disturbo.primoArrivo) };
  occlusione = { attiva: false, fino: 0 };
  laptop = { aperto: 0, fino: 0, id: null };

  audio.azzeraSorgenti();      // niente loop scombinati ereditati dalla partita prima
  stanze = AULE.map((a, i) => ({ indice: i, scoperta: false }));

  // --- casella 1: l'obiettivo si compone di pezzi ---------------------------
  //  Quali pezzi, dove stanno e quali chiedono una prova cambiano a ogni
  //  partita: e' per questo che il suono della richiesta non puo' raccontare
  //  un pezzo preciso.
  //  Il mazzo e' uno solo: otto strumenti, nessuno dei quali nasce esca. Si
  //  mescola, i primi cinque sono quelli che il direttore chiede, i due dopo
  //  fanno da esca, l'ottavo resta fuori da questa partita. Alla prossima
  //  saranno altri — ed e' per questo che nel nome dei file la parola «esca»
  //  non c'e' piu'.
  const mazzo = mescola(CONFIG.pezzi.map(p => p.id));
  const scelti = mazzo.slice(0, G.pezziRichiesti);
  const perEsca = mazzo.slice(G.pezziRichiesti, G.pezziRichiesti + G.escheInGioco);
  richiesti = scelti.length;
  const conProva = mescola([...scelti]).slice(0, Math.min(G.pezziConProva, CONFIG.oggetti.length));

  //  La regia e' dove finisci se ti prendono: nessuno ci si nasconde, e
  //  nessun oggetto ci finisce. Si cerca per nome, non per indice: mappa.js e'
  //  generato e i suoi indici slittano a ogni rigenerazione.
  regia = AULE.findIndex(a => a.nome === G.aulaRegia);
  const stanzeLibere = mescola(AULE.map((_, i) => i).filter(i => i !== regia));
  pezzi = [];

  scelti.forEach((id, k) => {
    const i = stanzeLibere.pop();
    const c = postoInAula(i);
    const j = conProva.indexOf(id);
    pezzi.push({ id, esca: false, stanza: i, x: c.x, y: c.y, x0: c.x, y0: c.y,
                 oggetto: j >= 0 ? CONFIG.oggetti[j].id : null,
                 conquistato: false, consegnato: false, scoperto: false });
  });

  //  Le esche si mettono per ultime e si disegnano identiche ai pezzi: a
  //  guardarle non si distinguono, e non e' una svista. Da quando il foglio del
  //  direttore elenca gli strumenti per nome, l'unico modo di riconoscere
  //  un'esca e' sentire che strumento e' — e questo e' il gioco.
  perEsca.forEach(id => {
    const i = stanzeLibere.pop();
    const c = postoInAula(i);
    pezzi.push({ id, esca: true, stanza: i, x: c.x, y: c.y, x0: c.x, y0: c.y,
                 oggetto: null, conquistato: false, consegnato: false, scoperto: false });
  });

  //  Le finestre si sistemano PRIMA di scegliere le posizioni: chiudono e
  //  riaprono un sottoinsieme a caso, e una cella di corridoio che e' anche
  //  una finestra puo' cambiare da libera a muro. Sceglierle dopo vuol dire
  //  scegliere posizioni su una mappa che sta per cambiare sotto i piedi.
  preparaFinestre();

  //  Di notte l'aula dove c'era un musicista (anche un'esca) si accende di
  //  luce tenue quando ci entri, e resta accesa fino alla fine della partita.
  pezzi.forEach(p => { stanze[p.stanza].musicista = true; });

  // --- il giocatore parte sul proscenio, foglio in mano ---------------------
  const corridoio = CELLE_CORRIDOIO;
  const partenza = proscenio() ||
                   corridoio.find(c => libero(c.x, c.y, 6)) || { x: MONDO_L / 2, y: MONDO_A / 2 };
  giocatore = { x: partenza.x, y: partenza.y, r: 6, dirx: 0, diry: -1, portati: [] };

  // --- casella 3: gli oggetti della prova, sparsi nei corridoi -------------
  //  Stanno li' dall'inizio e dormono. Chi ha fatto caso al suono dormiente,
  //  quando serve ci va dritto: la memoria e' premiata, mai obbligatoria.
  oggetti = CONFIG.oggetti.map((o, k) => {
    const p = puntoIn(corridoio, giocatore, 420, 8) || partenza;
    audio.svegliaOggetto(o.id, false);
    return { id: o.id, x: p.x, y: p.y, sveglio: false, preso: false, portato: false };
  });

  // --- casella 7: gli aiuti a doppio taglio, nascosti dietro una porta -----
  //  Non nei corridoi: sempre dentro un'aula ancora chiusa, anche la prima
  //  volta. Vedi `nascondiAiuto`.
  aiuti = [
    { tipo: 'occlusione', evento: 'aiuto_occlusione', preso: true, stanza: -1, x: 0, y: 0 },
    { tipo: 'rivela',     evento: 'aiuto_rivela',     preso: true, stanza: -1, x: 0, y: 0 },
  ];
  for (const a of aiuti) nascondiAiuto(a);

  // --- casella 5: l'inseguitore, non ancora in gioco ------------------------
  inseguitore = { x: 0, y: 0, bx: 0, by: 0, r: 9, inGioco: false, vede: false, fuoriDaiBagni: true,
                  ultimoVisto: 0, sospesoFino: 0, fermoConAlba: 0,
                  innocuoFino: 0, chiudeFino: 0, meta: null, rottaFino: 0 };

  preparaPersonaggi(partenza);

  consegnaAperta = true;
  stanzaCorrente = aulaContenente(giocatore.x, giocatore.y);
  bagnoCorrente = bagnoContenente(giocatore.x, giocatore.y);
  ingressiBagno = 0;
  acusticaCorrente = acusticaA(giocatore.x, giocatore.y);
  inScorciatoia = false;
  audio.impostaAcustica(acusticaCorrente, true);
  audio.impostaScorciatoia(false);
  audio.impostaMusica(false);
  audio.impostaMondo({ occlusione: false, disturbo: false });
  audio.aggiornaInseguitore(null);
  distanzaPasso = 0;

  registra('interfaccia_inizio', audio.suona('interfaccia_inizio'));
  annunciaRichiesta();
}

const fraDue = ([a, b]) => a + Math.random() * (b - a);

//  Casella 1: il segnale che annuncia la richiesta. Uno solo, sempre lo
//  stesso, e deve reggere qualunque combinazione: e' per questo che non puo'
//  raccontare un pezzo preciso.
function annunciaRichiesta() {
  registra('pezzo_richiesta', audio.suona('pezzo_richiesta'),
           pezzi.filter(p => !p.esca).length + ' pezzi');
}


// =============================================================================
//  COMANDI
// =============================================================================
const tasti = {};
function commutaPausa() {
  if (scena) return;              // durante la scena non si comanda niente
  inPausa = !inPausa;
  if (audio.ctx) inPausa ? audio.ctx.suspend() : audio.ctx.resume();
}

//  La modalita' libera esiste perche' sentire il proprio lavoro non deve
//  dipendere dal saper giocare. Qui il tempo si ferma, l'inseguitore sparisce
//  e ogni pezzo si conquista al tocco, senza prova: si cammina e si ascolta.
function commutaLibera() {
  if (scena) return;
  modalitaLibera = !modalitaLibera;
  if (modalitaLibera) {
    inseguitore.inGioco = false;
    audio.aggiornaInseguitore(null);
  }
  aggiornaPannelli();
}

// Se si sta scrivendo in un campo di testo i tasti appartengono al campo,
// non al gioco: senza questo, scrivere "problema" nella finestra delle
// segnalazioni metteva in pausa e accendeva la modalita libera.
const TIPI_DI_TESTO = ['text', 'search', 'url', 'email', 'password', 'number', 'tel'];
function dentroUnCampoDiTesto(e) {
  const t = e.target;
  if (!t) return false;
  if (t.tagName === 'TEXTAREA' || t.isContentEditable) return true;
  // ATTENZIONE: i cursori del banco di missaggio sono <input type="range">.
  // Se li si tratta come campi di testo, il gioco perde la tastiera appena si
  // tocca un fader.
  return t.tagName === 'INPUT' && TIPI_DI_TESTO.includes((t.type || '').toLowerCase());
}

addEventListener('keydown', e => {
  if (dentroUnCampoDiTesto(e)) return;
  //  Mentre l'inseguitore ti porta via il giocatore non comanda niente: ne'
  //  cammina, ne' mette in pausa, ne' ricomincia. E' l'unico pezzo di gioco
  //  che si sta soltanto a sentire, e un tasto che risponde lo romperebbe.
  //
  //  Il concerto invece due tasti li ha, e sono gli unici: ESC per uscire e R
  //  per ricominciare. Nessuno dei due e' un modo di giocare — sono il modo di
  //  dire «basta», e a un brano che gira in loop servono per forza.
  //
  //  A brano finito ce n'e' un terzo, N: la schermata finale resta sopra la
  //  sala e dice «N per giocare di notte», quindi N deve rispondere anche qui.
  //  Solo a scena in 'fine' — prima la scritta non c'e' — e fa quello che fa
  //  sempre: `inizializza` chiude la scena da se' (scena = null), come per R.
  if (scena) {
    e.preventDefault();
    if (scena.tipo !== 'concerto') return;
    const t = e.key ? e.key.toLowerCase() : '', cc = e.code || '';
    if (t === 'escape' || cc === 'Escape') chiudiConcerto();
    else if (t === 'r' || cc === 'KeyR') inizializza();
    else if ((t === 'n' || cc === 'KeyN') && scena.fase === 'fine' && notteAperta()) { notte = !notte; inizializza(); }
    return;
  }
  // e.code non dipende dalla disposizione della tastiera: e.key da solo puo
  // mancare il bersaglio con layout non italiani o tastiere a schermo.
  const k = e.key ? e.key.toLowerCase() : '';
  const c = e.code || '';
  //  Il foglio si chiude con un tasto qualunque: chi ha finito di leggere non
  //  deve cercare quale. Per rileggerlo si mette in PAUSA — non c'e' un tasto
  //  suo. Le due cose sono la stessa: chi si ferma o vuole rileggere il foglio
  //  fa lo stesso gesto, e il gioco non gli scorre sotto mentre legge.
  if (consegnaAperta && !partitaFinita) {
    consegnaAperta = false;
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
    e.preventDefault();
    return;
  }
  //  Ctrl + Alt + P apre e chiude i pannelli di lavoro. Si legge `code` e non
  //  `key`: sul Mac Alt cambia la lettera (Alt+P scrive «π»).
  if (e.ctrlKey && e.altKey && c === 'KeyP') { mostraPannelli(!pannelliAperti); e.preventDefault(); return; }
  if (k === 'p' || k === 'escape' || c === 'KeyP' || c === 'Escape') { commutaPausa(); e.preventDefault(); return; }
  if ((k === 'l' || c === 'KeyL') && pannelliAperti) { commutaLibera(); e.preventDefault(); return; }
  if ((k === 'r' || c === 'KeyR') && partitaFinita) { inizializza(); return; }
  //  N passa dal giorno alla notte e viceversa, e ricomincia la partita.
  if ((k === 'n' || c === 'KeyN') && notteAperta()) { notte = !notte; inizializza(); e.preventDefault(); return; }

  // Le manopole del tecnico del suono: provare uno stato senza doverlo
  // meritare in gioco. Sono la ragione per cui la modalita' libera esiste.
  if (modalitaLibera && !inPausa) {
    if (k === 'm' || c === 'KeyM') { audio.impostaMusica(!audio.musicaAccesa); e.preventDefault(); return; }
    if (k === 'o' || c === 'KeyO') { commutaOcclusione(); e.preventDefault(); return; }
    if (k === 'v' || c === 'KeyV') { apriLaptop(); e.preventDefault(); return; }
    if (k === 'u' || c === 'KeyU') { commutaDisturbo(); e.preventDefault(); return; }
    if (k === 'i' || c === 'KeyI') { commutaInseguitore(); e.preventDefault(); return; }
    if (k === 't' || c === 'KeyT') { tempo = Math.max(tempo, G.tempoLimite); e.preventDefault(); return; }
    if (k === 'k' || c === 'KeyK') { provaIlConcerto(); e.preventDefault(); return; }
  }
  if (!inPausa && audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();

  // Shift + freccia sinistra/destra gira lo sguardo di 45° senza camminare.
  // e.repeat esclude la ripetizione automatica del tasto tenuto premuto.
  if (e.shiftKey && !e.repeat && !inPausa && !partitaFinita) {
    if (k === 'arrowleft'  || c === 'ArrowLeft')  { ruotaMira(-1); e.preventDefault(); return; }
    if (k === 'arrowright' || c === 'ArrowRight') { ruotaMira(+1); e.preventDefault(); return; }
  }
  if (TASTI_MOVIMENTO.includes(k)) mouse.comanda = false;

  tasti[k] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
});
// Il rilascio non si filtra mai: se un keyup viene ignorato il tasto resta
// premuto a vita e il giocatore cammina e gira da solo.
addEventListener('keyup', e => { if (e.key) tasti[e.key.toLowerCase()] = false; });
// E se la finestra perde il fuoco a meta corsa, si lascia tutto.
addEventListener('blur', () => { for (const k in tasti) tasti[k] = false; });
const premuto = (...k) => k.some(x => tasti[x]);
const TASTI_MOVIMENTO = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'];

const OTTAVO = Math.PI / 4;
function ruotaMira(verso) {
  const k = Math.round(Math.atan2(giocatore.diry, giocatore.dirx) / OTTAVO) + verso;
  giocatore.dirx = Math.cos(k * OTTAVO);
  giocatore.diry = Math.sin(k * OTTAVO);
  mouse.comanda = false;
}

// -----------------------------------------------------------------------------
//  Sguardo col mouse
// -----------------------------------------------------------------------------
//  Il puntatore si tiene in coordinate DELLO SCHERMO e si traduce in punto del
//  mondo a ogni fotogramma. Tenerlo gia' tradotto sembra piu' semplice e
//  invece incolla lo sguardo: il punto del mondo resta fermo mentre la
//  telecamera scorre dietro al giocatore.
// -----------------------------------------------------------------------------
const mouse = { x: 0, y: 0, comanda: false };

function coordinate(ev) {
  const r = cv.getBoundingClientRect();
  // se il canvas non e' ancora impaginato la scala esplode
  if (r.width < 10 || r.height < 10) return null;
  return { x: (ev.clientX - r.left) * (cv.width / r.width),
           y: (ev.clientY - r.top) * (cv.height / r.height) };
}

function mouseNelMondo() {
  return { x: camera.x + mouse.x / zoomVista, y: camera.y + mouse.y / zoomVista };
}

cv.addEventListener('mousemove', ev => {
  const p = coordinate(ev);
  if (!p) return;
  mouse.x = p.x; mouse.y = p.y; mouse.comanda = true;
});
cv.addEventListener('mouseleave', () => { mouse.comanda = false; });
cv.addEventListener('contextmenu', ev => ev.preventDefault());

function spaziale(x, y) {
  return {
    pan: Math.max(-1, Math.min(1, (x - giocatore.x) / CONFIG.spazio.ampiezzaPan)),
    distanza: Math.max(0, Math.min(1, 1 - Math.hypot(x - giocatore.x, y - giocatore.y) / 560)),
  };
}


// =============================================================================
//  FINESTRE — il palazzo respira a somma costante
// =============================================================================
// Le celle del varco sono gestite dal motore della mappa; qui restano soltanto
// lo stato della partita, il ritmo e le cautele verso i due corpi mobili.
// -----------------------------------------------------------------------------
const distanzaFinestre = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mescolaFinestre = a => mescola([...a]);

function preparaFinestre() {
  const cfg = G.finestre;
  FINESTRE.forEach(chiudiFinestra);
  finestre = FINESTRE.map((mappa, indice) => ({
    mappa, indice, aperta: false, respiro: 0, da: 0, iniziata: tempo,
  }));
  const quante = Math.round(finestre.length * cfg.frazioneAperte);
  const aperte = [];
  for (const f of mescolaFinestre(finestre)) {
    if (aperte.length >= quante) break;
    if (aperte.every(a => distanzaFinestre(a.mappa, f.mappa) >= cfg.distanzaMinima)) aperte.push(f);
  }
  // Con i dati attuali il primo giro trova 26 finestre. Questo ripiego non
  // lascia comunque una partita a numero variabile se una pianta futura le
  // addensa oltre il limite configurato.
  for (const f of mescolaFinestre(finestre)) {
    if (aperte.length >= quante) break;
    if (!aperte.includes(f)) aperte.push(f);
  }
  aperte.forEach(f => cambiaFinestra(f, true, false));
  finestre.prossimo = tempo + cfg.ricambioOgni;
}

function cambiaFinestra(f, aperta, anima = true) {
  if (f.aperta === aperta) return;
  f.da = f.respiro;
  f.aperta = aperta;
  f.iniziata = tempo;
  if (!anima) { f.respiro = aperta ? 1 : 0; f.da = f.respiro; }
  if (aperta) apriFinestra(f.mappa); else chiudiFinestra(f.mappa);
}

function aggiornaRespiroFinestra(f) {
  const d = G.finestre.durataRespiro;
  const p = Math.max(0, Math.min(1, (tempo - f.iniziata) / d));
  const morbido = p * p * (3 - 2 * p);
  f.respiro = f.da + ((f.aperta ? 1 : 0) - f.da) * morbido;
}

function corpoVicinoAllaFinestra(corpo, f) {
  if (!corpo) return false;
  const m = f.mappa, r = G.finestre.raggioSicurezza;
  const dx = Math.abs(corpo.x - m.x), dy = Math.abs(corpo.y - m.y);
  const lungo = m.larghezza / 2;
  const distanza = m.dir === 'h' ? Math.hypot(Math.max(0, dx - lungo), dy)
                                 : Math.hypot(dx, Math.max(0, dy - lungo));
  return distanza <= r + corpo.r;
}

//  NON SI CHIUDE UNA FINESTRA ADDOSSO A NESSUNO. Fino al 14/09/2026 qui si
//  guardavano solo il giocatore e l'inseguitore: Alba e il trombettista no, e
//  una finestra che si richiudeva mentre uno dei due la stava attraversando se
//  lo murava dentro. E' la meta' della storia dell'«Alba incastrata», quella
//  che si ripresentava anche dopo averla chiusa fuori dalle aule: non era
//  l'aula, era il varco che le si chiudeva sotto i piedi.
//  L'altra meta' e' `sbloccaCorpo`, qui sotto: questa evita il guaio, quella
//  lo ripara se succede lo stesso.
function chiusuraSicura(f) {
  const corpi = [giocatore,
                 inseguitore.inGioco ? inseguitore : null,
                 alba && alba.inGioco ? alba : null,
                 trombettista && trombettista.inGioco ? trombettista : null];
  return !corpi.some(c => c && corpoVicinoAllaFinestra(c, f));
}

function gestisciFinestre() {
  if (!finestre) return;
  finestre.forEach(aggiornaRespiroFinestra);
  if (tempo < finestre.prossimo) return;
  finestre.prossimo = tempo + G.finestre.ricambioOgni;

  const aperte = finestre.filter(f => f.aperta);
  const chiuse = finestre.filter(f => !f.aperta);
  for (const chiude of mescolaFinestre(aperte)) {
    if (!chiusuraSicura(chiude)) continue;
    const restano = aperte.filter(f => f !== chiude);
    const candidate = chiuse.filter(apre =>
      distanzaFinestre(apre.mappa, chiude.mappa) >= G.finestre.distanzaMinima &&
      restano.every(f => distanzaFinestre(apre.mappa, f.mappa) >= G.finestre.distanzaMinima));
    if (!candidate.length) continue;
    const apre = candidate[Math.floor(Math.random() * candidate.length)];
    cambiaFinestra(chiude, false);
    cambiaFinestra(apre, true);
    registra('finestra_chiude', audio.suona('finestra_chiude', spaziale(chiude.mappa.x, chiude.mappa.y)));
    registra('finestra_apre', audio.suona('finestra_apre', spaziale(apre.mappa.x, apre.mappa.y)));
    return;
  }
}


// =============================================================================
//  CICLO PRINCIPALE
// =============================================================================
let contaFps = 0, tFps = 0;
function ciclo(ora) {
  // Il salto va limitato dai due lati: una scheda tornata in primo piano puo'
  // consegnare un dt enorme, e un orologio che arretra ne consegna uno
  // negativo — con quello il tempo di gioco tornava indietro.
  const dt = Math.max(0, Math.min(0.05, (ora - tPrec) / 1000));
  tPrec = ora;
  //  La scena della cattura gira AL POSTO del gioco: e' l'unico momento in cui
  //  il mondo sta fermo e si muovono soltanto chi ti porta via e tu che vieni
  //  portato.
  if (!inPausa && !consegnaAperta) {
    if (scena) aggiornaScena(dt);
    else if (!partitaFinita) aggiorna(dt);
  }
  disegna();
  if (scena) disegnaScena();
  else if (partitaFinita) disegnaFine();
  else if (consegnaAperta) disegnaConsegna(false);
  else if (inPausa) disegnaConsegna(true);
  contaFps++;
  if (ora - tFps > 500) {
    document.getElementById('fps').textContent = Math.round(contaFps * 1000 / (ora - tFps)) + ' fps';
    contaFps = 0; tFps = ora;
  }
  requestAnimationFrame(ciclo);
}

function aggiorna(dt) {
  tempo += dt;
  muoviGiocatore(dt);
  gestisciZone();
  gestisciPezzi();
  gestisciOggetti();
  gestisciAiuti(dt);
  gestisciTempo();
  gestisciInseguitore(dt);
  gestisciPersonaggi(dt);
  gestisciFinestre();
  gestisciDisturbo();
  gestisciConsegna();
  muoviConsegnati(dt);
  aggiornaSuono(dt);
  aggiornaPannelli();
}

//  Tutto quello che il motore audio deve sapere del mondo, in un posto solo.
function aggiornaSuono(dt) {
  const voci = [];
  for (const p of pezzi) {
    if (p.consegnato) { voci.push({ id: p.id, x: p.x, y: p.y, attivo: true, insieme: false }); continue; }
    voci.push({ id: p.id, x: p.x, y: p.y, attivo: true,
                // un pezzo che ti segue e' "insieme a te": si sente pieno, e
                // fa abbassare tutto il resto. E' la casella 8 — piu' roba ti
                // porti dietro, meno senti chi manca.
                insieme: p.conquistato || (stanzaCorrente >= 0 && stanzaCorrente === p.stanza),
                //  e non passa dal cancello della scorciatoia: attraversando
                //  il cortile chi ti cammina dietro continua a suonare, e a
                //  cambiare e' solo la stanza che ha intorno
                alSeguito: p.conquistato });
  }
  for (const o of oggetti)
    voci.push({ id: o.id, x: o.x, y: o.y, attivo: !o.preso, insieme: false });

  //  I DUE PERSONAGGI SI SENTONO SOLO QUANDO SONO IN SCENA. Fino al
  //  14/09/2026 usavano il raggio dei pezzi e li si sentiva arrivare da mezzo
  //  edificio: «non ha senso che questi personaggi si sentano arrivare da
  //  lontano». Adesso il loro raggio e' quanto se ne vede, e oltre il bordo
  //  dello schermo non c'e' un fondo che resta — c'e' silenzio.
  //
  //  Il colloquio invece resta com'era, e non e' una svista: si sente da dove
  //  sono fermi a parlare, anche dall'altra parte dell'edificio, perche' e'
  //  l'unico modo che il giocatore ha per sapere che l'inseguitore e' occupato.
  const P = CONFIG.personaggi;
  const inScena = { raggio: P.raggioInScena, fondo: 0 };
  voci.push({ id: P.trombettista.id, x: trombettista.x, y: trombettista.y,
              attivo: trombettista.inGioco, insieme: false, ...inScena });
  voci.push({ id: P.alba.id, x: alba.x, y: alba.y,
              attivo: alba.inGioco, insieme: false, ...inScena });
  voci.push({ id: P.colloquio.id, x: colloquio.x, y: colloquio.y,
              attivo: colloquio.attivo, insieme: false });

  audio.aggiornaSpazio(giocatore.x, giocatore.y, voci);
  audio.aggiornaMondo(dt);
  //  LA TERZA VERSIONE DELLA CLIP: chi ti cammina dietro suona male, e la
  //  degradazione la fa il gioco invece di chiederla a uno studente. Vale solo
  //  finche' ti segue — consegnato torna pulito, ed e' il salto della casella 8.
  audio.sporcaTrascinati(giocatore.portati.map(p => p.id));

  if (inseguitore.inGioco) {
    audio.aggiornaInseguitore(Math.hypot(inseguitore.x - giocatore.x, inseguitore.y - giocatore.y),
                              inseguitore.x - giocatore.x);
  } else {
    audio.aggiornaInseguitore(null);
  }
}


// =============================================================================
//  IL GIOCATORE
// =============================================================================
function muoviGiocatore(dt) {
  const modoMira = premuto('shift');
  let dx = 0, dy = 0;
  if (premuto('a') || (!modoMira && premuto('arrowleft')))  dx -= 1;
  if (premuto('d') || (!modoMira && premuto('arrowright'))) dx += 1;
  if (premuto('w') || (!modoMira && premuto('arrowup')))    dy -= 1;
  if (premuto('s') || (!modoMira && premuto('arrowdown')))  dy += 1;
  if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }

  // Comanda lo sguardo chi l'ha toccato per ultimo: il mouse muovendosi, la
  // tastiera premendo un tasto di movimento o girando con Shift.
  if (mouse.comanda) {
    const m = mouseNelMondo();
    const mx = m.x - giocatore.x, my = m.y - giocatore.y;
    const d = Math.hypot(mx, my);
    if (d > 4) { giocatore.dirx = mx / d; giocatore.diry = my / d; }
  } else if ((dx || dy) && !modoMira) {
    giocatore.dirx = dx; giocatore.diry = dy;
  }

  // Casella 8: ogni pezzo al seguito e' zavorra. Casella 9: nella scorciatoia
  // si corre. Sono le due meta' dello stesso baratto — velocita' contro
  // ascolto — e si incontrano proprio qui, in una riga di aritmetica.
  const zavorra = Math.max(0.45, 1 - giocatore.portati.length * G.zavorraPerPezzo);
  const spinta = inScorciatoia ? G.spintaScorciatoia : 1;
  // dentro l'alone del trombettista si cammina nel miele, e li' l'inseguitore
  // ti prende facile: e' l'unico suono del gioco che si vuole evitare
  const vel = G.velocitaGiocatore * zavorra * spinta * frenoTrombettista();

  const px = dx * vel * dt, py = dy * vel * dt;
  if (libero(giocatore.x + px, giocatore.y, giocatore.r) && fraMobili(giocatore.x + px, giocatore.y)) giocatore.x += px;
  if (libero(giocatore.x, giocatore.y + py, giocatore.r) && fraMobili(giocatore.x, giocatore.y + py)) giocatore.y += py;

  // la scia: e' su questa che camminano i pezzi al seguito
  scia.unshift({ x: giocatore.x, y: giocatore.y });
  if (scia.length > 400) scia.length = 400;
  aggiornaSeguaci();

  distanzaPasso += Math.hypot(px, py);
  if (distanzaPasso > G.passoOgniPx) { distanzaPasso = 0; registra('passo', audio.suona('passo')); }
}

//  I MOBILI SONO SOLIDI, per ora solo per il giocatore (prova del 24/09/2026):
//  gli altri personaggi camminano come prima, finche' non si decide se tenerlo.
//  Le sedie e la poltrona si attraversano (deciso con Gianluca). Si puo' sempre
//  uscire da un mobile in cui ci si trova gia': si ferma solo chi ci entra.
const ATTRAVERSABILI = new Set(['sedia', 'poltrona']);
let mobiliSolidi = null;
function mobili() {
  if (mobiliSolidi) return mobiliSolidi;
  mobiliSolidi = [];
  for (const g of AULE) for (const o of ARREDI.ingombri(g)) {
    if (ATTRAVERSABILI.has(o.nome)) continue;
    const b = o.tipo === 'cerchio'
      ? [o.centro.x - o.r, o.centro.y - o.r, o.centro.x + o.r, o.centro.y + o.r]
      : [Math.min(...o.punti.map(p => p.x)), Math.min(...o.punti.map(p => p.y)), Math.max(...o.punti.map(p => p.x)), Math.max(...o.punti.map(p => p.y))];
    mobiliSolidi.push({ ...o, b });
  }
  return mobiliSolidi;
}
function toccaMobile(x, y, r) {
  for (const o of mobili()) {
    if (x + r < o.b[0] || x - r > o.b[2] || y + r < o.b[1] || y - r > o.b[3]) continue;
    if (o.tipo === 'cerchio') { if (Math.hypot(x - o.centro.x, y - o.centro.y) < r + o.r) return true; continue; }
    const q = o.punti; let dentro = false;
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      if ((q[i].y > y) !== (q[j].y > y) && x < (q[j].x - q[i].x) * (y - q[i].y) / (q[j].y - q[i].y) + q[i].x) dentro = !dentro;
      const ex = q[i].x - q[j].x, ey = q[i].y - q[j].y, t = Math.max(0, Math.min(1, ((x - q[j].x) * ex + (y - q[j].y) * ey) / (ex * ex + ey * ey)));
      if (Math.hypot(x - q[j].x - t * ex, y - q[j].y - t * ey) < r) return true;
    }
    if (dentro) return true;
  }
  return false;
}
function fraMobili(x, y) { return !toccaMobile(x, y, giocatore.r) || toccaMobile(giocatore.x, giocatore.y, giocatore.r); }

//  UN CORPO E' UN CERCHIO, NON QUATTRO SPILLI.
//
//  Fino al 13/09/2026 qui si guardavano i quattro angoli del quadrato che
//  contiene il corpo. Fra un angolo e l'altro ci sono dodici pixel di niente, e
//  le celle della mappa ne misurano tre: la punta di uno stipite ci passava in
//  mezzo senza essere vista. Si entrava dentro il muro camminando, e da li' non
//  si usciva piu' — succedeva al giocatore e ad Alba, sempre sulle porte.
//
//  Ora si guardano TUTTE le celle che il cerchio tocca davvero. Costa una
//  ventina di confronti invece di quattro, e il gioco non se ne accorge.
//  Misurato: si perde lo 0,19% delle posizioni — sono esattamente quelle in
//  cui il corpo stava dentro un muro — e nessuna zona diventa irraggiungibile.
function libero(x, y, r) {
  const c0 = Math.floor((x - r) / CELLA), c1 = Math.floor((x + r) / CELLA);
  const f0 = Math.floor((y - r) / CELLA), f1 = Math.floor((y + r) / CELLA);
  const rr = r * r;
  for (let f = f0; f <= f1; f++)
    for (let c = c0; c <= c1; c++) {
      const ax = c * CELLA, ay = f * CELLA;
      //  distanza fra il centro del cerchio e la cella: se e' zero il cerchio
      //  ci sta sopra, e quella cella deve essere pavimento
      const dx = Math.max(ax - x, 0, x - (ax + CELLA));
      const dy = Math.max(ay - y, 0, y - (ay + CELLA));
      if (dx * dx + dy * dy >= rr) continue;
      if (!camminabile(ax + CELLA / 2, ay + CELLA / 2)) return false;
    }
  return true;
}

//  I pezzi conquistati camminano sulla scia, uno dietro l'altro. Non e' un
//  vezzo: e' quello che li tiene tutti addosso alle orecchie mentre si cerca
//  quel che manca.
function aggiornaSeguaci() {
  const passo = Math.max(4, Math.round(G.distanzaSeguace / 3));
  giocatore.portati.forEach((p, k) => {
    const q = scia[Math.min(scia.length - 1, (k + 1) * passo)] || giocatore;
    p.x = q.x; p.y = q.y;
  });
}


// =============================================================================
//  LE ZONE — porte, soglie, acustiche, scorciatoia
// =============================================================================
function gestisciZone() {
  const s = aulaContenente(giocatore.x, giocatore.y);
  const a = acusticaA(giocatore.x, giocatore.y);
  const sc = nellaScorciatoia(giocatore.x, giocatore.y);

  // la soglia e' il cambio di ACUSTICA: e' quello che si sente
  if (a !== acusticaCorrente) {
    acusticaCorrente = a;
    audio.impostaAcustica(a);
    registra('porta_soglia', audio.suona('porta_soglia'), nomeZona(giocatore.x, giocatore.y));
  }

  // la porta e' l'ingresso o l'uscita da una stanza: e' un altro gesto
  if (s !== stanzaCorrente) {
    if (s >= 0 || stanzaCorrente >= 0) registra('porta', audio.suona('porta'));
    stanzaCorrente = s;
    if (s >= 0 && !stanze[s].scoperta) stanze[s].scoperta = true;
  }

  //  IL BAGNO. Si entra, si apre, parte una delle quattro scene — a turno, non
  //  a caso — e quando esci si richiude col punto interrogativo, come se non
  //  ci fossi mai entrato. Dentro non c'e' niente: e' tempo perso, e si impara
  //  perdendolo. Ma e' anche un rifugio sempre: li' Aluzzi non entra.
  const b = bagnoContenente(giocatore.x, giocatore.y);
  if (b !== bagnoCorrente) {
    if (b >= 0) {
      registra('bagno', audio.suona('bagno', { variante: ingressiBagno }), b ? 'sud' : 'nord');
      ingressiBagno++;
    }
    bagnoCorrente = b;
  }

  // casella 9: qui dentro i pezzi non arrivano piu'
  if (sc !== inScorciatoia) {
    inScorciatoia = sc;
    audio.impostaScorciatoia(sc);
  }
}


// =============================================================================
//  CASELLA 2 e 3 — trovare un pezzo, e conquistarlo
// =============================================================================
//  Trovarlo non basta: tre pezzi su cinque chiedono una prova. Il primo
//  contatto SVEGLIA l'oggetto che serve — da quel momento, da qualche parte
//  nei corridoi, qualcosa comincia a suonare per davvero. E' l'unico avviso
//  che si riceve, e non e' un file in piu': e' lo stesso oggetto che passa da
//  dormiente a sveglio.
// -----------------------------------------------------------------------------
function gestisciPezzi() {
  for (const p of pezzi) {
    if (p.conquistato || p.consegnato) continue;
    if (Math.hypot(p.x - giocatore.x, p.y - giocatore.y) > G.raggioRaccolta) continue;

    // un'esca non fa niente, e non lo dice: costa il tempo che ci hai messo
    if (p.esca) { p.scoperto = true; continue; }

    if (p.oggetto && !modalitaLibera) {
      const o = oggetti.find(x => x.id === p.oggetto);
      if (o && !o.portato) {
        if (!o.sveglio) { o.sveglio = true; audio.svegliaOggetto(o.id, true); p.scoperto = true; }
        continue;                       // torna quando ce l'hai
      }
      if (o) { o.portato = false; o.preso = true; }   // l'oggetto si consuma
    }

    conquista(p);
  }
}

function conquista(p) {
  p.conquistato = true;
  p.scoperto = true;
  giocatore.portati.push(p);
  audio.scombina(p.id);                 // da qui in poi suona fuori tempo
  registra('interfaccia_conferma', audio.suona('interfaccia_conferma'), p.id);
  aggiornaSeguaci();
}

function gestisciOggetti() {
  for (const o of oggetti) {
    //  Dormiente non si raccoglie: e' li' dall'inizio, ma serve solo dopo che
    //  il pezzo lo sveglia. Prenderlo prima vorrebbe dire risolvere la prova
    //  a caso, prima ancora che il gioco l'abbia posta.
    if (o.preso || o.portato || !o.sveglio) continue;
    if (Math.hypot(o.x - giocatore.x, o.y - giocatore.y) > G.raggioRaccolta) continue;
    o.portato = true;
    audio.svegliaOggetto(o.id, false);
    registra('interfaccia_conferma', audio.suona('interfaccia_conferma'), o.id);
  }
  // un oggetto in mano cammina addosso al giocatore: se non lo si spostasse
  // continuerebbe a suonare dal punto in cui stava
  for (const o of oggetti) if (o.portato) { o.x = giocatore.x; o.y = giocatore.y; }
}


// =============================================================================
//  CASELLA 4 — il tempo che scorre
// =============================================================================
//  Quando scade la partita non finisce: cambia stato, e peggiora. E' uno dei
//  due soli momenti in cui entra la musica, ed e' l'audio adattivo vero.
// -----------------------------------------------------------------------------
function gestisciTempo() {
  if (modalitaLibera || tempoScaduto) return;
  if (tempo < G.tempoLimite) return;
  tempoScaduto = true;
  audio.impostaMusica(true);
  facciEntrareInseguitore();
}

//  ALUZZI ENTRA IN SCENA, e parte da casa sua.
//
//  Aluzzi e' il nome dell'inseguitore. Nel codice la variabile si chiama ancora
//  `inseguitore` perche' quella parola e' anche l'identificativo di sei eventi
//  audio e di un bus del banco: rinominarla vorrebbe dire cambiare i nomi dei
//  file che gli studenti hanno gia' in mano.
//
//  La regia e' la sua tana. E' da li' che esce quando scade il tempo, ed e' li'
//  che ti porta se ti prende: le due cose si legano da sole.
//
//  I primi secondi e' INOFFENSIVO: esce di casa, e non prende nessuno. Ma se al
//  suo risveglio sei proprio in regia, quei secondi sono i tuoi per uscire —
//  scaduti, ti chiude dentro e la partita finisce li'. Scelto da Gianluca il
//  13/09/2026: «se fosse pure la prima volta che ci gioco, capisco che non devo
//  trovarmi li' appena nasce».
function facciEntrareInseguitore() {
  const casa = regia >= 0 && libero(centroAula(regia).x, centroAula(regia).y, 9)
    ? centroAula(regia) : null;
  const p = casa || puntoIn(CELLE_INSEGUITORE, giocatore, 700, 9) ||
            { x: giocatore.x, y: giocatore.y };
  inseguitore.x = p.x; inseguitore.y = p.y;
  inseguitore.bx = p.x; inseguitore.by = p.y;
  inseguitore.inGioco = true;
  inseguitore.vede = false;
  inseguitore.aggiraFino = 0;
  inseguitore.meta = null; inseguitore.rottaFino = 0;
  inseguitore.innocuoFino = tempo + G.graziaInseguitore;
  //  Appena sveglio deve farsi vedere in giro, non restare a chiacchierare
  //  davanti a casa: Alba lo puo' fermare solo dopo `albaDopo` secondi.
  if (alba) alba.liberaDa = Math.max(alba.liberaDa || 0, tempo + G.albaDopo);
  //  Eri in casa sua quando si e' svegliato: hai la grazia per uscire.
  inseguitore.chiudeFino = (casa && aulaContenente(giocatore.x, giocatore.y) === regia)
    ? tempo + G.graziaInseguitore : 0;
}

function commutaInseguitore() {
  if (inseguitore.inGioco) { inseguitore.inGioco = false; audio.aggiornaInseguitore(null); }
  else facciEntrareInseguitore();
}


// =============================================================================
//  CASELLA 5 — qualcuno che ti da' la caccia
// =============================================================================
//  La distanza da lui non te la dice un'icona: te la dice quanto lo senti. Qui
//  dentro non c'e' nessuna barra e nessuna freccia, ed e' voluto.
//
//  Dentro una stanza ti vede da meta' distanza: le pareti non ti nascondono,
//  ti coprono. E' l'unico riparo che il gioco offre, e non ha un suono suo —
//  si sente perche' lui smette di avvicinarsi.
// -----------------------------------------------------------------------------
function gestisciInseguitore(dt) {
  const I = inseguitore;
  if (!I.inGioco || modalitaLibera) return;

  // Fermo a parlare con Alba: non e' sospeso e basta, e' proprio piantato
  // li'. Chi lo sente parlare sa che per quel tratto non arriva.
  if (tempo < I.fermoConAlba) { I.vede = false; return; }

  //  Ti chiude dentro: eri in regia quando si e' svegliato e non sei uscito.
  //  Basta mettere un piede fuori perche' non succeda — la grazia serve a
  //  quello.
  if (I.chiudeFino) {
    if (aulaContenente(giocatore.x, giocatore.y) !== regia) I.chiudeFino = 0;
    else if (tempo >= I.chiudeFino) { I.chiudeFino = 0; tiChiudeDentro(); return; }
  }

  const dist = Math.hypot(I.x - giocatore.x, I.y - giocatore.y);
  const sospeso = tempo < I.sospesoFino || tempo < I.innocuoFino;
  const raggio = G.raggioVista * (stanzaCorrente >= 0 ? 0.5 : 1);
  //  In bagno sei al riparo: non ti vede e non ti prende, e sulla porta si ferma.
  const alRiparo = bagnoCorrente >= 0;
  const vede = !sospeso && !alRiparo && dist < raggio;

  if (vede && !I.vede) {
    I.vede = true;
    registra('inseguitore_avvistamento', audio.suona('inseguitore_avvistamento', spaziale(I.x, I.y)));
  } else if (!vede && I.vede && tempo - I.ultimoVisto > G.memoriaInseguitore) {
    I.vede = false;
    registra('inseguitore_perde', audio.suona('inseguitore_perde', spaziale(I.x, I.y)));
  }

  //  IN GIRO: PRIMA IL VARCO, POI LA STRADA.
  //
  //  `avvicina` sa costeggiare un muro, non attraversare un edificio: puntato a
  //  un corridoio dall'altra parte della pianta si appoggia alla prima parete e
  //  ci resta. Finche' nasceva in mezzo a un corridoio non si vedeva; da quando
  //  nasce dentro la regia si vede eccome — il 13/09/2026 Gianluca l'ha provato
  //  da giocatore: «dallo scadere del tempo non si e' visto fino a che non mi
  //  sono avvicinato alla regia».
  //
  //  La cura e' la stessa gia' scritta per la scena della cattura, e per lo
  //  stesso motivo: **da dentro una stanza la rotta non trova niente**, perche'
  //  sulla griglia grossa i nodi della porta non passano. Quindi finche' e'
  //  dentro punta al varco, che e' quello che farebbe chiunque; una volta fuori
  //  va a rotta, un nodo per volta. Con solo la prima meta' usciva e rientrava
  //  subito: fuori, senza strada, tornava ad appoggiarsi al muro di casa.
  //
  //  Quando ti VEDE resta il muso dritto di prima: chi ti insegue non calcola
  //  percorsi, ti viene addosso.
  const suaStanza = aulaContenente(I.x, I.y);

  //  Sei in un'aula e ti ha visto entrare: non ti segue dentro, si ferma alla
  //  porta (vedi `allaPorta`). La regia no: li' vale la chiusura a chiave.
  const tua = aulaContenente(giocatore.x, giocatore.y);
  const assedio = tua >= 0 && tua !== regia && suaStanza !== tua &&
                  (vede || (I.porta && I.porta.stanza === tua))
    ? allaPorta(I, tua, () => CELLE_INSEGUITORE[Math.floor(Math.random() * CELLE_INSEGUITORE.length)])
    : null;
  if (!assedio) I.porta = null;
  else {
    if (vede) I.ultimoVisto = tempo;
    I.meta = null;
    passoVerso(I, assedio, G.velocitaInseguitore * (vede ? 1 : 0.55), dt);
    I.fermoDa = 0;
    if (dist < G.presaInseguitore && !sospeso && !alRiparo) tiPrende();
    return;
  }

  if (vede) { I.ultimoVisto = tempo; I.meta = null; I.bx = giocatore.x; I.by = giocatore.y; }
  else if (suaStanza >= 0) {
    const porta = sogliaAula(suaStanza);
    I.bx = porta.x; I.by = porta.y; I.meta = null; I.rottaFino = 0;
  } else {
    if (!I.meta || Math.hypot(I.meta.x - I.x, I.meta.y - I.y) < 26) {
      const p = metaVicinoATe();
      I.meta = p ? { x: p.x, y: p.y } : null;
      I.rottaFino = 0;
    }
    if (I.meta && (tempo > (I.rottaFino || 0) || Math.hypot(I.bx - I.x, I.by - I.y) < 10)) {
      I.rottaFino = tempo + 0.2;
      const passo = rottaVerso(I, I.meta, 4, 1) || I.meta;
      I.bx = passo.x; I.by = passo.y;
    }
  }

  const primaX = I.x, primaY = I.y;
  avvicina(I, G.velocitaInseguitore * (vede ? 1 : 0.55) * dt);

  // Rete di sicurezza: nessuna euristica di aggiramento copre ogni geometria,
  // e restare incastrati contro un muro e' il difetto piu' visibile di tutti.
  if (Math.hypot(I.x - primaX, I.y - primaY) < 0.05) {
    I.fermoDa = (I.fermoDa || 0) + dt;
    if (I.fermoDa > 1.5) {
      I.fermoDa = 0; I.aggiraFino = 0; I.rottaFino = 0;
      const p = CELLE_INSEGUITORE[Math.floor(Math.random() * CELLE_INSEGUITORE.length)];
      if (p) { I.meta = { x: p.x, y: p.y }; I.bx = p.x; I.by = p.y; }
    }
  } else I.fermoDa = 0;

  if (dist < G.presaInseguitore && !sospeso && !alRiparo) tiPrende();
}

//  NON TI VEDE, MA SA PIU' O MENO DOVE SEI. Fino al 24/09/2026 la meta era un
//  corridoio a caso dell'edificio intero: da lontano non arrivava mai, e a
//  Gianluca sembrava che non partisse. Adesso sceglie un corridoio a meno di
//  `fiutoInseguitore` da te: non ti punta, ti gira intorno finche' ti vede.
//  Se li' intorno non c'e' corridoio (sei nel cortile, in fondo al palco) va
//  a caso come prima.
function metaVicinoATe() {
  const R = G.fiutoInseguitore;
  const vicine = CELLE_INSEGUITORE.filter(p =>
    Math.abs(p.x - giocatore.x) < R && Math.abs(p.y - giocatore.y) < R &&
    Math.hypot(p.x - giocatore.x, p.y - giocatore.y) < R);
  const da = vicine.length ? vicine : CELLE_INSEGUITORE;
  return da[Math.floor(Math.random() * da.length)];
}

//  TI CHIUDE DENTRO — la fine corta, senza trascinamento.
//
//  Non c'e' niente da trascinare: sei gia' in regia, lui esce e gira la chiave.
//  E' la stessa scena della cattura, saltata alla parte in cui conta: la porta.
function tiChiudeDentro() {
  if (partitaFinita || scena) return;
  tiPrende();
  if (!scena) return;
  scena.lontano = lontanoDallaPorta();
  const fuori = fuoriDallaPorta(scena.lontano, 2);
  inseguitore.x = fuori.x; inseguitore.y = fuori.y;
  inseguitore.bx = fuori.x; inseguitore.by = fuori.y;
  scena.dentro = false; scena.tagliato = true; scena.velo = 0;
  faseScena('soglia');
}

//  Preso vuol dire preso. Ma non finisce li' di colpo: da qui in poi comanda
//  la scena, e il gioco si guarda. Vedi `aggiornaScena` subito sotto.
function tiPrende() {
  if (partitaFinita || scena) return;
  const I = inseguitore;
  I.vede = false;

  // i pezzi al seguito restano dove li hai lasciati: non c'e' un dopo
  giocatore.portati.splice(0);

  audio.impostaMusica(false);
  audio.impostaMondo({ occlusione: false, disturbo: false, alone: false });
  registra('cattura', audio.suona('cattura'));

  //  Chi ti seguiva torna pulito da solo: `aggiornaSuono` chiama
  //  `sporcaTrascinati` con l'elenco di chi ti cammina dietro, e da qui in poi
  //  quell'elenco e' vuoto. Durante la cattura quei musicisti restano lontani e
  //  non si sentono: farli suonare male li' non racconterebbe niente.

  //  Senza una regia sulla pianta non c'e' scena da recitare: si chiude e
  //  basta. Non dovrebbe succedere mai — `aulaRegia` sta in config.js e la
  //  verifica della mappa gira a ogni avvio — ma una fine che non arriva
  //  sarebbe peggio di una fine brusca.
  if (regia < 0) {
    partitaFinita = true; esito = 'presa';
    registra('interfaccia_fine', audio.suona('interfaccia_fine'));
    return;
  }

  scena = {
    fase: 'presa', t: 0, velo: 0,
    tagliato: false, dentro: false,
    //  La scia parte con dentro anche il tuo punto: senza, al primo passo
    //  ti si ritroverebbe addosso a lui invece che un braccio indietro.
    scia: [{ x: I.x, y: I.y }, { x: giocatore.x, y: giocatore.y }],
    soglia: sogliaAula(regia),      // il punto appena FUORI dalla porta
    centro: centroAula(regia),
    rottaFino: 0, fermo: 0, fuori: 0, lontano: null,
    posto: null,                    // dove si fermera' a chiudere: si cerca qui sotto
  };
  scena.posto = postoDiChiusura(scena.soglia, regia);
}


// =============================================================================
//  LA SCENA DELLA CATTURA — l'unico pezzo di gioco che si sta a sentire
// =============================================================================
//  L'inseguitore insegna ai tecnici del suono, e chi prende se lo porta in
//  regia. Ti prende per un braccio, ti trascina fin dentro, ti lascia li',
//  torna sulla soglia, chiude a chiave e se ne va. La partita finisce quando
//  i suoi passi si sono allontanati, non un istante prima.
//
//  Tutto il racconto passa per le orecchie, e non c'e' una parola scritta:
//  la presa; i passi che diventano due invece di uno; l'acustica che cambia
//  entrando — il corridoio che rimbomba, poi la stanza asciutta; la porta con
//  la serratura; e da li' in poi l'edificio intero dietro un muro, con la sua
//  presenza che si allontana da sola. L'occlusione, che nel gioco e' un aiuto
//  da raccogliere, qui e' il muro della regia: stessa manopola, senso opposto.
//
//  Per tutta la scena il mondo sta fermo. Non e' pigrizia: un trombettista che
//  continua a girare in fondo al corridoio ruberebbe l'ascolto proprio dove
//  serve tutto, e questa e' la sola volta in cui al giocatore si chiede di non
//  fare niente.
//
//  Il tragitto vero puo' essere lungo mezzo edificio, e mezzo edificio di
//  cammino guardato non e' una scena, e' un'attesa. Dopo `trascinaMax` si
//  taglia: nero, e si riapre a pochi passi dalla porta della regia. E' lo
//  stacco del cinema — chi viene preso vicino alla regia non lo vede mai.
// -----------------------------------------------------------------------------
const SCENA = {
  presa: 1.0,          // fermi, appena preso: la mano addosso si sente prima del passo
  trascinaMax: 3.5,    // secondi di cammino guardato, poi si stacca
  buio: 0.6,           // il nero dello stacco: meta' per chiudere, meta' per riaprire
  //  I tempi della scena, rifatti il 13/09/2026 dopo che Gianluca l'ha vista:
  //  «si ferma troppo tempo, proprio sulla soglia». Il peso va spostato
  //  all'inizio — qualche istante in piu' addosso a te, appena ti ha mollato
  //  in regia — e tolto alla fine, dove servono solo i due suoni: la porta che
  //  si chiude e la chiave che gira.
  posa: 1.7,           // ti molla in mezzo alla regia e si gira
  soglia: 0.8,         // fermo davanti alla porta, a guardarti dentro
  chiuso: 0.9,         // la porta e' chiusa e lui e' ancora li'
  //  Fra la porta che si chiude e la chiave che gira c'e' un silenzio, ed e'
  //  quello a fare paura: per poterlo accorciare o allungare a orecchio, la
  //  serratura e' un suono suo (`regia_chiavi`) e non la coda di `regia_porta`.
  chiavi: 0.3,         // quanto silenzio passa prima che la chiave giri (era 0,7: «andrebbe leggermente anticipato», Gianluca 24/09)
  seneVa: 2.6,         // si allontana: la sua presenza scende da sola
  spegnimento: 1.4,    // il nero finale, sopra quello che resta
  passoDietro: 15,     // px: quanto stai indietro rispetto a chi ti trascina
  strappo: 1.15,       // quanto va piu' svelto del suo passo di caccia
  //  Le due soste fuori dalla porta, contate in nodi della rotta (un nodo =
  //  dodici px): dove si riapre dopo lo stacco, e dove si ferma a chiudere.
  nodiRipresa: 6,      // ~70 px prima della porta
  fuoriPrimaDiChiudere: 1.1,    // secondi di corridoio prima di fermarsi a chiudere
  //  DOVE SI FERMA A CHIUDERE: un passo fuori dal varco, sulla perpendicolare
  //  al muro. Prima si accontentava di «e' fuori, si e' allontanato, sta
  //  fermo» — e con quella regola si fermava dove capitava, in mezzo al
  //  corridoio e piu' in basso della porta. Visto da Gianluca il 13/09/2026:
  //  «basterebbe una decina di pixel dalla soglia e sarebbe nel posto giusto».
  //
  //  Tredici pixel sulla normale uscente, davanti alla regia, cadono nove
  //  pixel a destra della soglia e dieci sopra: il muro li' corre in
  //  diagonale, e il posto giusto lo dice la parete, non gli assi dello
  //  schermo. Il punto non e' scritto a mano — `postoDiChiusura` lo cerca
  //  sulla pianta e controlla che il corpo ci stia, cosi' regge anche se il
  //  ricalco sposta la porta.
  //  Diciassette e non tredici: a tredici Gianluca lo vedeva ancora troppo
  //  addosso al vano — «deve stare ancora un po' piu' in alto e un po' piu' a
  //  destra». Sulla normale a 46 gradi quei quattro pixel in piu' sono tre
  //  a destra e tre in su.
  sostaDallaPorta: 17, // px dal varco: dove si ferma a chiudere
  cercaSosta: [11, 30],// px: entro quanto cercarlo, se a tredici non ci sta
  arrivatoASosta: 5,   // px: quando si considera arrivato
  //  Rete di sicurezza, se al posto giusto non ci arriva: si ferma comunque
  //  fuori dal vano e non oltre questo raggio. La soglia dei dieci pixel sta
  //  sotto ai tredici della sosta apposta: il posto giusto deve poter valere
  //  come «fuori dal vano», altrimenti ci arriva e li' non chiude.
  fermatiA: 54,        // px dal varco: arrivato qui si ferma comunque
  fuoriDalVarco: 10,   // px dal varco: sotto, non si ferma
};

//  Di notte, con la prova «allarme»: la sirena gira finche' la porta della
//  regia non si chiude. Dopo, basta il silenzio.
function sirena(s) {
  if (!notte || NOTTE.cattura !== 'allarme') return;
  if (['chiuso', 'seneVa', 'spegnimento'].includes(s.fase)) return;
  if (s.sirena !== undefined && tempo - s.sirena < NOTTE.allarme.sirena) return;
  s.sirena = tempo;
  registra('allarme_sirena', audio.suona('allarme_sirena'));
}

function aggiornaScena(dt) {
  //  Le scene sono due, e non si somigliano: la cattura e' un tragitto, il
  //  concerto e' un'attesa che si ascolta. Da qui in giu' c'e' solo la cattura.
  if (scena.tipo === 'concerto') return aggiornaConcerto(dt);
  const S = SCENA, I = inseguitore, s = scena;
  //  `avvicina` misura su `tempo` la durata dei suoi aggiramenti: fermandolo,
  //  chi sta costeggiando un muro resta a costeggiarlo per sempre.
  tempo += dt;
  s.t += dt;
  sirena(s);

  switch (s.fase) {

    //  Ti ha preso. Nessuno si muove: si gira soltanto la testa verso di lui.
    case 'presa':
      verso(giocatore, I.x, I.y);
      sirena(s);
      if (s.t >= S.presa) faseScena('trascina');
      break;

    //  Ti porta via. Lui segue la rotta verso la porta della regia, tu cammini
    //  dove ha camminato lui un passo fa — sulla sua scia, non addosso a una
    //  direzione: seguirlo per direzione ti infila negli spigoli.
    case 'trascina': {
      if (!s.dentro && (aulaContenente(I.x, I.y) === regia ||
                        Math.hypot(I.x - s.soglia.x, I.y - s.soglia.y) < 14)) s.dentro = true;
      const passo = camminaScena(I, s.dentro ? s.centro : s.soglia, S.strappo * dt);
      dietroDiLui();
      passiDiDue(passo);
      if (s.dentro && Math.hypot(I.x - s.centro.x, I.y - s.centro.y) < 14) faseScena('posa');
      else if (!s.tagliato && !s.dentro && s.t > S.trascinaMax) faseScena('stacco');
      //  Rete di sicurezza: nessuna rotta copre ogni geometria, e una scena che
      //  non arriva mai in fondo lascia la partita appesa per sempre. Passato il
      //  tempo, in regia ci si finisce comunque.
      else if (s.t > 12) {
        I.x = s.centro.x; I.y = s.centro.y; I.bx = I.x; I.by = I.y;
        s.scia = [{ x: I.x, y: I.y }];
        dietroDiLui();
        faseScena('posa');
      }
      break;
    }

    //  Lo stacco: si chiude sul nero, si riapre a pochi passi dalla porta.
    //  Quello che si toglie e' il tragitto di mezzo, mai l'arrivo.
    case 'stacco': {
      const meta = S.buio / 2;
      s.velo = s.t < meta ? s.t / meta : Math.max(0, 1 - (s.t - meta) / meta);
      if (!s.tagliato && s.t >= meta) {
        s.tagliato = true;
        const p = fuoriDallaPorta(I, S.nodiRipresa);
        I.x = p.x; I.y = p.y; I.bx = p.x; I.by = p.y;
        I.aggiraFino = 0; I.fermoDa = 0;
        s.scia = [{ x: p.x, y: p.y }];
        s.rottaFino = 0;
        dietroDiLui();
        //  L'acustica del punto nuovo si prende in silenzio: lo stacco non ha
        //  una porta che si apre, e `gestisciZone` qui sotto non deve trovare
        //  un cambio da annunciare.
        stanzaCorrente = aulaContenente(giocatore.x, giocatore.y);
        bagnoCorrente = bagnoContenente(giocatore.x, giocatore.y);
        acusticaCorrente = acusticaA(giocatore.x, giocatore.y);
        audio.impostaAcustica(acusticaCorrente, true);
      }
      if (s.t >= S.buio) { s.velo = 0; faseScena('trascina'); }
      break;
    }

    //  Ti lascia in mezzo alla regia. Gli ultimi passi non li fai piu' sulla
    //  sua scia: ti spinge dentro, e finisci al centro della stanza — non
    //  sulla porta, dove una regia piccola ti lascerebbe mezzo fuori.
    case 'posa':
      giocatore.x += (s.centro.x - giocatore.x) * Math.min(1, dt * 6);
      giocatore.y += (s.centro.y - giocatore.y) * Math.min(1, dt * 6);
      verso(giocatore, I.x, I.y);
      if (s.t >= S.posa) faseScena('esce');
      break;

    //  Esce, e tu resti dentro. Da qui in poi cammina lui solo: e' la prima
    //  volta che lo si sente allontanarsi invece che arrivare.
    case 'esce': {
      //  Si decide subito anche DOVE se ne andra': esce gia' incamminato da
      //  quella parte, e quando ripartira' non dovra' girarsi indietro.
      if (!s.lontano) s.lontano = lontanoDallaPorta();
      //  Prima il varco, poi la strada. Da dentro la stanza la rotta non trova
      //  niente — sulla griglia grossa i nodi della porta non passano — e
      //  puntando dritto al corridoio si spinge contro lo stipite: restava
      //  incastrato dentro per tutta la scena. Il varco lo si passa mirando al
      //  varco, che e' poi quello che farebbe chiunque.
      const dentro = aulaContenente(I.x, I.y) === regia;
      //  Dentro punta il varco; fuori punta il posto davanti alla porta, e se
      //  quel posto non c'e' (pianta cambiata, corpo che non ci sta) si torna
      //  al vecchio ripiego: cammina via e si ferma a tempo.
      const meta = dentro ? s.soglia : (s.posto || s.lontano);
      const passo = camminaScena(I, meta, dt);
      verso(giocatore, I.x, I.y);
      if (!dentro) s.fuori += dt;
      s.fermo = passo < 0.15 ? s.fermo + dt : 0;

      //  Arrivato al posto: si ferma li' e chiude. E' questa la strada
      //  normale — le due righe sotto sono solo la rete.
      if (!dentro && s.posto &&
          Math.hypot(I.x - s.posto.x, I.y - s.posto.y) < S.arrivatoASosta) {
        faseScena('soglia');
        break;
      }
      //  Da qui in giu' e' la rete, per quando al posto non ci arriva: basta
      //  che sia uscito, si sia scostato dal vano e si sia fermato. E' la
      //  regola che valeva da sola fino al 13/09/2026, e che lo lasciava
      //  fermarsi dove capitava — in mezzo al corridoio, piu' in basso della
      //  porta.
      //
      //  Il vano va chiesto per forza: uscendo dalla regia stretta, per un
      //  attimo si struscia contro lo stipite e il passo scende sotto la
      //  soglia. Il ripiego «e' fuori e sta fermo» scattava li', in mezzo al
      //  varco, e la porta la chiudeva da dentro il suo stesso vano.
      const lontanoDalVarco =
        Math.hypot(I.x - s.soglia.x, I.y - s.soglia.y) > S.fuoriDalVarco;
      const abbastanzaFuori =
        Math.hypot(I.x - s.soglia.x, I.y - s.soglia.y) > S.fermatiA;
      //  Con un posto da raggiungere la rete deve stare zitta finche' non ci
      //  ha almeno provato: uscendo dalla regia stretta struscia sullo
      //  stipite, il passo scende sotto la soglia, e `s.fermo > 0.3` lo
      //  fermava li' — «proprio sulla soglia», detto da Gianluca il
      //  13/09/2026. Se il posto c'e', gli si danno due secondi e mezzo.
      const reteAperta = !s.posto || s.t > 2.5;
      if (!dentro && lontanoDalVarco && reteAperta &&
          (abbastanzaFuori || s.fuori > S.fuoriPrimaDiChiudere || s.fermo > 0.3))
        faseScena('soglia');
      //  Rete di sicurezza: qualunque cosa succeda, la scena va avanti.
      else if (s.t > 6) faseScena('soglia');
      break;
    }

    //  Fermo davanti alla porta, a guardarti. E' il silenzio prima della
    //  porta, e dura quanto basta ad aspettarsela.
    case 'soglia':
      verso(giocatore, I.x, I.y);
      if (s.t >= S.soglia) {
        registra('regia_porta', audio.suona('regia_porta'));
        //  Da adesso l'edificio si sente da dietro un muro. La porta e' un
        //  evento e passa pulita — e' l'ultima cosa che si sente per intero.
        audio.impostaMondo({ occlusione: true });
        faseScena('chiuso');
      }
      break;

    //  Chiusa. Nessuno si muove: si sente solo che il mondo si e' ristretto.
    //  Poi, nel silenzio, la chiave gira. Il suono e' un evento e arriva
    //  pulito anche a porta chiusa: e' la serratura sentita da dentro.
    case 'chiuso':
      if (!s.girata && s.t >= S.chiavi) {
        s.girata = true;
        registra('regia_chiavi', audio.suona('regia_chiavi'));
      }
      if (s.t >= S.chiuso) faseScena('seneVa');
      break;

    //  Se ne va. Non c'e' niente da fare e niente da guardare: si ascolta la
    //  sua presenza scendere, ed e' la casella 5 letta al contrario.
    case 'seneVa':
      camminaScena(I, s.lontano, dt * 0.95);
      if (s.t >= S.seneVa) {
        registra('interfaccia_fine', audio.suona('interfaccia_fine'));
        faseScena('spegnimento');
      }
      break;

    //  Il nero si chiude sopra quello che resta.
    case 'spegnimento':
      camminaScena(I, s.lontano, dt * 0.8);
      s.velo = Math.min(1, s.t / S.spegnimento);
      if (s.t >= S.spegnimento) {
        partitaFinita = true; esito = 'presa';
        scena = null;
      }
      break;
  }

  if (!scena) return;
  //  La soglia si sente: entrando in regia l'acustica cambia da sola, ed e' il
  //  momento piu' istruttivo di tutta la scena.
  gestisciZone();
  aggiornaSuono(dt);
  //  I pannelli restano fermi all'istante della presa: il cronometro che
  //  continua a scorrere durante la scena e' un conto che non conta piu'.
}

function faseScena(f) { scena.fase = f; scena.t = 0; scena.fermo = 0; scena.fuori = 0; }

function verso(e, x, y) {
  const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy);
  if (d > 0.5) { e.dirx = dx / d; e.diry = dy / d; }
}

//  Un passo di scena: rotta ricalcolata spesso — il corridoio gira, e una
//  direzione sola incolla al primo muro. Torna quanto si e' camminato davvero.
function camminaScena(e, meta, passo) {
  const s = scena;
  if (tempo > s.rottaFino || Math.hypot(e.bx - e.x, e.by - e.y) < 10) {
    s.rottaFino = tempo + 0.12;
    //  Raggio 4 come per Alba: i nodi della griglia cadono dove capita dentro
    //  il corridoio, e chiedendo la larghezza vera non passa nessun percorso.
    //  La meta intermedia si prende a UN NODO, non a sette come per Alba: qui
    //  non si insegue nessuno che scappa, si percorre una strada, e un punto
    //  lontano davanti fa tagliare l'angolo. Costava caro: uscito dalla regia
    //  puntava dritto al corridoio venti metri piu' in la', si appoggiava allo
    //  spigolo, scivolava di lato in una rientranza e li' restava — `avvicina`
    //  devia fino a 126 gradi, e da una nicchia l'unica via libera e' indietro.
    //  Dodici pixel alla volta la strada la fa tutta.
    const p = rottaVerso(e, meta, 4, 1) || meta;
    e.bx = p.x; e.by = p.y;
  }
  const primaX = e.x, primaY = e.y;
  avvicina(e, G.velocitaInseguitore * passo);
  return Math.hypot(e.x - primaX, e.y - primaY);
}

//  Dove finisci tu: `passoDietro` px indietro lungo la scia di chi ti trascina.
function dietroDiLui() {
  const s = scena, I = inseguitore;
  const d = Math.hypot(I.x - s.scia[0].x, I.y - s.scia[0].y);
  if (d > 0.4) {
    s.scia.unshift({ x: I.x, y: I.y });
    if (s.scia.length > 200) s.scia.length = 200;
  }
  let resta = SCENA.passoDietro, px = I.x, py = I.y;
  for (const q of s.scia) {
    const passo = Math.hypot(q.x - px, q.y - py);
    if (passo >= resta) {
      const k = passo ? resta / passo : 0;
      px += (q.x - px) * k; py += (q.y - py) * k;
      resta = 0; break;
    }
    resta -= passo; px = q.x; py = q.y;
  }
  giocatore.x = px; giocatore.y = py;
  verso(giocatore, I.x, I.y);
}

//  Trascinati si cammina in due, e i passi sono il doppio.
function passiDiDue(percorso) {
  distanzaPasso += percorso;
  if (distanzaPasso > G.passoOgniPx * 0.55) {
    distanzaPasso = 0;
    registra('passo', audio.suona('passo'));
  }
}

//  Il punto fuori dalla porta dove un corpo ci sta DAVVERO, a `nodi` passi di
//  rotta dalla soglia, andando verso `dove`. Serve a riaprire lo stacco vicino
//  alla regia senza materializzare l'inseguitore dentro un muro.
//
//  Due trappole, tutte e due pagate il 12/09/2026 con una scena che si
//  piantava. La prima: `sogliaAula` da' il centro geometrico del varco, e li'
//  l'inseguitore non ci sta — sei pixel e tre quarti di fianchi contro uno
//  stipite, e `avvicina` non trova piu' un passo consentito in nessuna
//  direzione. Restava fermo sulla porta per tutto il tempo in cui doveva
//  andarsene. La seconda: «un po' piu' in la' sulla retta che esce dalla
//  stanza» non e' un posto, e' un'idea — la porta dell'Aula 49 da' su un
//  corridoio che gira a est, e la retta ci mandava dentro un muro a nord.
//
//  La rotta vera, invece, sa dov'e' il corridoio: si chiede a `rottaVerso` la
//  strada CHE PARTE DALLA PORTA e si prende la stazione giusta, provando a
//  scendere di nodo finche' il corpo non ci entra.
function fuoriDallaPorta(dove, nodi) {
  const s = scena, I = inseguitore;
  for (let n = nodi; n >= 1; n--) {
    const p = rottaVerso(s.soglia, dove, 4, n);
    if (p && consentito(I, p.x, p.y)) return { x: p.x, y: p.y };
  }
  if (consentito(I, s.soglia.x, s.soglia.y)) return { x: s.soglia.x, y: s.soglia.y };
  return { x: s.centro.x, y: s.centro.y };
}

//  UN PASSO FUORI DALLA PORTA — dove si ferma a chiuderla.
//
//  La direzione non la danno gli assi dello schermo: la da' il muro. Si guarda
//  cosa c'e' intorno alla soglia entro ventiquattro pixel, si tiene solo quello
//  che sta fuori dalla stanza e si fa la media delle direzioni: viene la
//  perpendicolare uscente dal varco. Davanti alla regia sono quarantasei gradi
//  — quel tratto di parete corre in diagonale — e non si sarebbe potuto
//  indovinare a mano.
//
//  Poi si cammina su quella retta finche' il corpo dell'inseguitore ci sta
//  davvero, partendo dalla distanza voluta. Se non ci sta da nessuna parte si
//  torna null, e la scena si arrangia col vecchio ripiego a tempo.
function postoDiChiusura(soglia, stanza, chi) {
  const I = chi || inseguitore;
  let sx = 0, sy = 0;
  for (let dx = -24; dx <= 24; dx += 3)
    for (let dy = -24; dy <= 24; dy += 3) {
      const d = Math.hypot(dx, dy);
      if (d < 3 || d > 24) continue;
      const x = soglia.x + dx, y = soglia.y + dy;
      if (!camminabile(x, y) || aulaContenente(x, y) === stanza) continue;
      sx += dx / d; sy += dy / d;
    }
  const L = Math.hypot(sx, sy);
  if (L < 0.001) return null;                 // varco senza un fuori: non capita
  const ux = sx / L, uy = sy / L;

  const [vicino, lontano] = SCENA.cercaSosta;
  //  si parte dalla distanza voluta e si allarga da tutte e due le parti
  for (let passo = 0; passo <= lontano - vicino; passo += 2)
    for (const d of [SCENA.sostaDallaPorta + passo, SCENA.sostaDallaPorta - passo]) {
      if (d < vicino || d > lontano) continue;
      const x = soglia.x + ux * d, y = soglia.y + uy * d;
      if (aulaContenente(x, y) === stanza) continue;
      if (consentito(I, x, y)) return { x, y };
    }
  return null;
}

//  Dove se ne va: il corridoio piu' lontano dalla porta fra quelli sorteggiati.
//  Non deve arrivarci — deve solo andarsene in una direzione sensata per il
//  tempo che dura la scena.
function lontanoDallaPorta() {
  const s = scena;
  let scelto = null, distanza = -1;
  for (let k = 0; k < 60; k++) {
    const p = CELLE_CORRIDOIO[Math.floor(Math.random() * CELLE_CORRIDOIO.length)];
    if (!p) break;
    const d = Math.hypot(p.x - s.soglia.x, p.y - s.soglia.y);
    if (d > distanza) { distanza = d; scelto = p; }
  }
  return scelto ? { x: scelto.x, y: scelto.y } : { x: s.soglia.x, y: s.soglia.y };
}

//  Il velo della scena: solo nero, nessuna scritta. Le parole arrivano dopo,
//  con la schermata di fine.
function disegnaScena() {
  if (scena.tipo === 'concerto') return disegnaConcerto();
  if (scena.velo <= 0.002) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = `rgba(11,13,16,${Math.min(1, scena.velo)})`;
  ctx.fillRect(0, 0, cv.width, cv.height);
}

// =============================================================================
//  LA SCENA DEL CONCERTO — l'altra scena che si sta a sentire
// =============================================================================
//  Fino al 13/09/2026 il finale era un velo nero con scritto «suonano tutti
//  insieme». Parole di Gianluca: «ne abbiamo parlato per ore e questo non
//  accade». Adesso accade: i musicisti salgono sul palco e si mettono in
//  semicerchio, il pubblico riempie le gradinate, tu ti siedi in prima fila
//  accanto ad Alba e al trombettista, e parte il brano.
//
//  QUELLO CHE CAMBIA NELLE ORECCHIE, che poi e' il motivo per cui la scena
//  esiste: nelle aule ogni strumento suona a FRASI CON I BUCHI, e nei silenzi
//  di uno si sente l'altro — li' il suono e' informazione. Sul palco ognuno
//  passa alla propria versione da concerto, tutti attaccano nello stesso
//  istante e nessuno lascia piu' spazio a nessuno. E' la stessa differenza che
//  c'e' fra una sala prove e un concerto, e non c'e' una parola scritta a
//  dirla.
//
//  NIENTE BPM COMUNE, NIENTE DURATA IMPOSTA. Deciso da Gianluca: gli studenti
//  scelgono generi diversi e su un tempo solo non si accorderebbero. L'unica
//  cosa che il gioco impone e' l'ATTACCO — partono tutti insieme — e l'unica
//  cosa che si prende dai file e' la loro durata, per finire su un giro intero
//  invece che a meta' frase.
// -----------------------------------------------------------------------------
const CONCERTO = CONFIG.concerto;

//  L'inquadratura del concerto: tutta la sala e tutto il palco, dentro la
//  finestra, con un margine. Le zone portano gia' il loro riquadro appresso
//  (`x, y, w, h` in mappa.js), quindi non si scandisce nessun poligono.
function vistaConcerto() {
  const P = geometriaPalco();
  const zone = [RACCOLTA, P && P.zona].filter(Boolean);
  if (!zone.length) return { zoom: ZOOM, x: camera.x, y: camera.y };
  const x0 = Math.min(...zone.map(z => z.x)), y0 = Math.min(...zone.map(z => z.y));
  const x1 = Math.max(...zone.map(z => z.x + z.w)), y1 = Math.max(...zone.map(z => z.y + z.h));
  const M = 34;
  const zoom = Math.max(0.5, Math.min(ZOOM,
    (cv.width - M * 2) / (x1 - x0), (cv.height - M * 2) / (y1 - y0)));
  return { zoom,
           x: (x0 + x1) / 2 - cv.width  / (2 * zoom),
           y: (y0 + y1) / 2 - cv.height / (2 * zoom) };
}

const vistaDelGioco = () => ({ zoom: ZOOM, x: camera.x, y: camera.y });

//  IL PUBBLICO — la gente sulle gradinate, seduta sulle file vere
//
//  Le file sono gli archi concentrici che si vedono disegnati nella sala:
//  stesso centro e stessi raggi (`RACCOLTA.gradinate`), una fila di gente ogni
//  due gradini. Ogni posto deve stare dentro la sagoma della zona e avere il
//  corpo libero, esattamente come per chiunque altro: cosi' nessuno si siede
//  dentro un muro il giorno in cui il ricalco cambia la sala.
//
//  Le tre poltrone di mezzo della prima fila sono riservate, e non e' un
//  dettaglio: quelle sono le tue e dei due che ti hanno accompagnato per tutta
//  la partita.
function postiPubblico() {
  const GR = RACCOLTA && RACCOLTA.gradinate;
  const PR = geometriaProscenio();
  if (!GR || !PR) return { pubblico: [], giocatore: null, alba: null, trombettista: null };
  const C = CONCERTO.pubblico;
  const [rMin, rMax] = GR.raggi;
  const file = [];
  for (let r = rMin + 10; r <= rMax - 8 && file.length < 14; r += 24) {
    const posti = [], passo = C.passoArco / r;
    for (let a = PR.mira - 1.45; a <= PR.mira + 1.45; a += passo) {
      const rr = a === PR.mira ? r : r + (Math.random() * 2 - 1) * C.disordine * 0.5;
      const aa = a + (Math.random() * 2 - 1) * passo * 0.22;
      const x = GR.centro.x + Math.cos(aa) * rr, y = GR.centro.y + Math.sin(aa) * rr;
      if (!nellaRaccolta(x, y) || !libero(x, y, 5)) continue;
      posti.push({ x, y, scarto: Math.abs(aa - PR.mira) });
    }
    if (posti.length >= 3) file.push(posti);
  }
  if (!file.length) return { pubblico: [], giocatore: null, alba: null, trombettista: null };

  //  in prima fila, al centro: il posto piu' vicino alla mira e i suoi due
  //  vicini. Si prendono per indice e non per distanza, cosi' sono davvero
  //  ACCANTO e non due poltrone piu' in la'.
  const prima = file[0];
  let k = 0;
  prima.forEach((q, i) => { if (q.scarto < prima[k].scarto) k = i; });
  const i0 = Math.max(1, Math.min(prima.length - 2, k));
  const tre = prima.splice(i0 - 1, 3);
  const [alba, giocatore, trombettista] = tre.length === 3 ? tre : [null, tre[0] || null, null];

  const pubblico = [];
  for (const f of file)
    for (const q of f) { if (pubblico.length < C.massimo) pubblico.push(q); }
  return { pubblico, giocatore: giocatore || null, alba, trombettista };
}

//  IL DIRETTORE — il punto nero al centro del semicerchio.
//  Sta davanti al musicista di mezzo, dalla parte del pubblico, e il posto si
//  cerca sulla pianta: il palco e' profondo 85 px e un numero scritto a mano
//  lo manderebbe dentro la buca il giorno in cui il ricalco lo accorcia.
function postoDirettore() {
  const P = geometriaPalco();
  if (!P) return null;
  let trovato = null;
  for (let d = 6; d <= 40; d += 2) {
    const x = P.centro.x + Math.cos(P.mira) * d, y = P.centro.y + Math.sin(P.mira) * d;
    if (nelPalco(x, y) && libero(x, y, 5)) trovato = { x, y };
  }
  return trovato || { x: P.centro.x, y: P.centro.y };
}

//  Quanti giri interi del loop stanno piu' vicini al bersaglio. La scena non
//  dura un numero di secondi: dura un numero di GIRI. Un brano troncato a
//  meta' frase si sente, e si sente come un difetto — ed e' l'unico modo di
//  avere una durata sensata senza imporre a nessuno quanto deve essere lungo
//  il proprio loop.
function giriDelConcerto(durata) {
  if (!CONCERTO.durataMirata) return 0;          // 0 = non finisce da solo
  if (!(durata > 0.2)) return 0;
  const n = Math.max(1, Math.round(CONCERTO.durataMirata / durata));
  return n;
}

function avviaConcerto() {
  const suonano = pezzi.filter(p => p.consegnato);
  suonano.forEach((q, k) => {
    const posto = postoSulPalco(k, suonano.length);
    q.meta = null;                 // chi camminava ancora, sale da dove sta
    q.da = { x: q.x, y: q.y };
    q.a = posto;
  });
  const posti = postiPubblico();

  //  Il mondo si azzera prima che la scena cominci: niente laptop aperto sugli
  //  occhi, niente occlusione addosso, niente musica del peggioramento e
  //  nessun inseguitore. Da qui in avanti c'e' solo il brano.
  laptop.fino = 0; laptop.aperto = 0;
  occlusione.attiva = false; occlusione.fino = 0;
  disturbo.attivo = false; disturbo.fino = 0;
  trombettista.inGioco = false;
  alba.inGioco = false;
  colloquio.attivo = false;
  inseguitore.inGioco = false;
  audio.impostaMusica(false);
  audio.impostaMondo({ occlusione: false, disturbo: false, alone: false });
  acusticaCorrente = acusticaA(giocatore.x, giocatore.y);
  audio.impostaAcustica(acusticaCorrente, true);

  scena = {
    tipo: 'concerto', fase: 'salita', t: 0, velo: 0, suona: false,
    suonano, pubblico: posti.pubblico,
    daGiocatore: { x: giocatore.x, y: giocatore.y },
    aGiocatore: posti.giocatore || { x: giocatore.x, y: giocatore.y },
    postoAlba: posti.alba, postoTrombettista: posti.trombettista,
    direttore: postoDirettore(),
    daVista: vistaDelGioco(), aVista: vistaConcerto(),
    vista: vistaDelGioco(),
    entrata: 0,                 // quanto e' comparso il pubblico: 0 -> 1
    giri: 0, giro: 0, finoA: 0, sfumata: CONCERTO.dissolvenza,
  };
  registra('interfaccia_fine', audio.suona('interfaccia_fine'));
}

//  K, in modalita' libera: porta dritto al concerto.
//
//  E' la stessa idea del banco di missaggio — provare uno stato senza doverlo
//  meritare in gioco — applicata all'unico stato che finora costava una partita
//  intera. Sentire il proprio lavoro non deve dipendere dal saper giocare, e
//  questo vale per la scena finale piu' che per ogni altra cosa: e' quella che
//  si guarda una volta sola, e ogni volta bisognava rifare mezz'ora di caccia.
function provaIlConcerto() {
  if (partitaFinita || scena) return;
  const mancanti = pezzi.filter(p => !p.esca && !p.consegnato);
  mancanti.forEach(p => {
    p.conquistato = false; p.consegnato = true;
    const posto = postoDiAttesa();
    p.x = posto.x; p.y = posto.y;
  });
  consegnati = pezzi.filter(p => p.consegnato && !p.esca).length;
  giocatore.portati.splice(0);
  //  in proscenio, dove si nasce: il concerto si guarda dalla sala, e da li'
  //  `avviaConcerto` sa dove mandarti a sedere
  const q = proscenio() || RACCOLTA.centro;
  giocatore.x = q.x; giocatore.y = q.y;
  audio.allinea(pezzi.filter(p => p.consegnato).map(p => p.id));
  avviaConcerto();
}

//  ESC: si chiude quando si vuole. Un brano che gira in loop ha bisogno di un
//  modo per dire basta, e questo e' il suo.
function chiudiConcerto() {
  if (!scena || scena.tipo !== 'concerto') return;
  if (scena.fase === 'chiusura' || scena.fase === 'fine') return;
  scena.sfumata = scena.fase === 'brano' ? 1.1 : 0.5;
  audio.sfumaConcerto(scena.suonano.map(q => q.id), sfumataAudio(scena.sfumata));
  faseScena('chiusura');
}

//  Quanto dura la sfumata DEL SUONO, dentro una chiusura che a schermo dura
//  `s`. Il silenzio deve arrivare prima del nero: «l'audio deve raggiungere lo
//  zero prima che ci arrivi il video e stacchi il play». Su una chiusura lunga
//  l'anticipo e' quello configurato; su una corta — l'uscita con ESC — sarebbe
//  piu' lungo della sfumata stessa, e allora ci si tiene una frazione, cosi'
//  il rapporto resta lo stesso e il suono non si stacca di colpo.
const sfumataAudio = s => Math.max(s * 0.45, s - CONCERTO.anticipoAudio);

//  addolcita in entrata e in uscita: una salita lineare sembra un trascinamento
const morbido = k => k * k * (3 - 2 * k);

function aggiornaConcerto(dt) {
  const S = scena;
  tempo += dt;
  S.t += dt;

  switch (S.fase) {

    //  SALITA — i musicisti lasciano il proscenio e prendono posto, tu vai a
    //  sederti, la telecamera si allarga sulla sala. Gli strumenti tacciono:
    //  fra la sala prove e il concerto ci vuole un silenzio, o non si sente
    //  che e' cominciato qualcosa.
    case 'salita': {
      const k = Math.min(1, S.t / CONCERTO.salita), e = morbido(k);
      S.suonano.forEach(q => {
        q.x = q.da.x + (q.a.x - q.da.x) * e;
        q.y = q.da.y + (q.a.y - q.da.y) * e;
      });
      giocatore.x = S.daGiocatore.x + (S.aGiocatore.x - S.daGiocatore.x) * e;
      giocatore.y = S.daGiocatore.y + (S.aGiocatore.y - S.daGiocatore.y) * e;
      if (S.direttore) verso(giocatore, S.direttore.x, S.direttore.y);
      S.vista = {
        zoom: S.daVista.zoom + (S.aVista.zoom - S.daVista.zoom) * e,
        x:    S.daVista.x    + (S.aVista.x    - S.daVista.x)    * e,
        y:    S.daVista.y    + (S.aVista.y    - S.daVista.y)    * e,
      };
      S.entrata = e;
      if (k >= 1) faseScena('attacco');
      break;
    }

    //  ATTACCO — tutti a posto, e il silenzio prima della prima nota.
    case 'attacco':
      if (S.t >= CONCERTO.attacco) {
        const avvio = audio.vaiAlConcerto(S.suonano.map(q => q.id));
        S.durataLoop = avvio.durata;
        S.giri = giriDelConcerto(avvio.durata);
        S.finoA = S.giri ? S.giri * avvio.durata : 0;
        S.suona = true;
        faseScena('brano');
      }
      break;

    //  IL BRANO — gira, e si conta a giri. Il velo comincia a scendere un
    //  istante prima della fine, cosi' il nero e l'ultima nota arrivano
    //  insieme invece che uno dopo l'altro.
    case 'brano':
      S.giro = S.durataLoop ? S.t / S.durataLoop : 0;
      if (S.finoA && S.t >= S.finoA - CONCERTO.dissolvenza) {
        S.sfumata = CONCERTO.dissolvenza;
        audio.sfumaConcerto(S.suonano.map(q => q.id), sfumataAudio(S.sfumata));
        faseScena('chiusura');
      }
      break;

    //  CHIUSURA — il brano si spegne col fader e il nero lo raggiunge solo in
    //  fondo: prima si va via col suono, poi si chiude anche la luce. Uno
    //  schermo che si spegne per cinque secondi e mezzo sembra un guasto.
    //  Il suono arriva allo zero `anticipoAudio` secondi prima del nero pieno:
    //  l'ultimo tratto e' buio che si chiude su una sala gia' silenziosa, e
    //  non un suono tagliato dallo stacco.
    case 'chiusura': {
      const nero = Math.min(CONCERTO.nero, S.sfumata);
      S.velo = Math.max(0, Math.min(1, (S.t - (S.sfumata - nero)) / nero));
      if (S.t >= S.sfumata) {
        S.suona = false;
        partitaFinita = true; esito = 'vinta';
        if (!notte) apriLaNotte();
        faseScena('fine');
      }
      break;
    }

    //  FINE — il nero si riapre sulla sala, e la schermata finale ci resta
    //  sopra: si vedono l'orchestra sul palco e le gradinate piene, invece del
    //  solito velo su una mappa qualunque. Da qui si esce con R.
    case 'fine':
      S.velo = Math.max(0, 1 - S.t / 0.7);
      break;
  }

  aggiornaSuonoConcerto(dt);
}

//  Il mix del concerto: suonano solo quelli sul palco, e suonano PIENI.
//  `insieme` non e' una forzatura — vuol dire «sono insieme a te», ed e'
//  esattamente la casella 8: cambia solo che stanno insieme, e la sala te li
//  mette davanti invece che dietro una porta.
function aggiornaSuonoConcerto(dt) {
  const S = scena;
  const voci = [];
  for (const q of pezzi) {
    const suona = q.consegnato && S.suona;
    voci.push({ id: q.id, x: q.x, y: q.y, attivo: suona, insieme: suona });
  }
  for (const o of oggetti)
    voci.push({ id: o.id, x: o.x, y: o.y, attivo: false, insieme: false });
  const P = CONFIG.personaggi;
  for (const id of [P.trombettista.id, P.alba.id, P.colloquio.id])
    voci.push({ id, x: giocatore.x, y: giocatore.y, attivo: false, insieme: false });

  audio.aggiornaSpazio(giocatore.x, giocatore.y, voci);
  audio.aggiornaMondo(dt);
  audio.aggiornaInseguitore(null);
}

// -----------------------------------------------------------------------------
//  IL DISEGNO DEL CONCERTO
// -----------------------------------------------------------------------------
//  Si disegna SOPRA il mondo, dentro la stessa trasformazione: il pubblico e il
//  direttore non esistono nel resto della partita e non hanno niente da fare
//  in `disegna()`.
//
//  Nessuno e' riconoscibile dal colore: il pubblico e' fatto di sagome tutte
//  uguali, piu' piccole e piu' spente; tu sei l'unico grosso e chiaro, con la
//  linea del naso azzurra che hai avuto per tutta la partita; Alba ha i raggi
//  e il trombettista la campana, come sempre.
function disegnaConcerto() {
  const S = scena;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save();
  ctx.scale(zoomVista, zoomVista);
  ctx.translate(-camera.x, -camera.y);

  const a = Math.min(1, S.entrata);
  if (a > 0.01) {
    ctx.globalAlpha = a;
    for (const q of S.pubblico) sagomaSeduta(q.x, q.y, 4.6, '#8a93a1', 0.55);
    //  seduta e' la stessa Alba del corridoio, un po' piu' piccola: prima
    //  qui aveva ancora i raggi dritti del sole e girava (Gianluca, 24/09)
    if (S.postoAlba) figuraAlba(S.postoAlba.x, S.postoAlba.y, 5 / 6.5);
    if (S.postoTrombettista) {
      const T = S.postoTrombettista;
      cerchio(T.x, T.y, 5, C.trombettista);
      //  la campana appoggiata in grembo: piu' corta di quella che ha in
      //  corridoio, perche' adesso non sta suonando
      const d = mirandoIlPalco(T);
      ctx.beginPath();
      ctx.moveTo(T.x + d.x * 3, T.y + d.y * 3);
      ctx.lineTo(T.x + d.x * 10 - d.y * 4, T.y + d.y * 10 + d.x * 4);
      ctx.lineTo(T.x + d.x * 10 + d.y * 4, T.y + d.y * 10 - d.x * 4);
      ctx.closePath();
      ctx.fillStyle = C.trombettista; ctx.fill();
    }
    //  IL DIRETTORE — un punto scuro al centro del semicerchio, con l'anello
    //  chiaro intorno: nero su nero non si vedrebbe, e la forma deve reggere
    //  da sola. Le braccia sono alzate verso l'orchestra e stanno ferme: una
    //  bacchetta che batte un tempo che nessuno ha fissato sarebbe una bugia
    //  che a un musicista salta all'occhio.
    if (S.direttore) {
      //  le braccia vanno VERSO l'orchestra, non verso la sala: il direttore
      //  sta in mezzo e da' le spalle al pubblico
      const D = S.direttore, m = mirandoIlPalco(D);
      ctx.strokeStyle = '#98a2af'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      for (const lato of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(D.x + m.x * 2, D.y + m.y * 2);
        ctx.lineTo(D.x + m.x * 8 - m.y * 5.5 * lato, D.y + m.y * 8 + m.x * 5.5 * lato);
        ctx.stroke();
      }
      cerchio(D.x, D.y, 5.2, '#12151a', '#98a2af', 1.4);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (S.velo > 0.002) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(11,13,16,${Math.min(1, S.velo)})`;
    ctx.fillRect(0, 0, cv.width, cv.height);
  }
  if (S.fase === 'fine') disegnaFine();
}

//  La direzione in cui si guarda il palco da un punto della sala: e' la linea
//  del naso di tutti quelli che stanno seduti, e sono tutti girati dalla stessa
//  parte — e' questo a farli leggere come pubblico invece che come puntini.
function mirandoIlPalco(q) {
  const P = geometriaPalco();
  const m = P ? P.centro : RACCOLTA.centro;
  const dx = m.x - q.x, dy = m.y - q.y, d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}

//  Una persona seduta: il corpo e la linea del naso verso il palco. E' la
//  stessa grammatica del giocatore, in piccolo — chi guarda capisce che sono
//  gente perche' guardano tutti dalla stessa parte.
function sagomaSeduta(x, y, r, colore, opacita) {
  const d = mirandoIlPalco({ x, y });
  ctx.globalAlpha *= opacita;
  cerchio(x, y, r, colore);
  ctx.strokeStyle = colore; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + d.x * r, y + d.y * r);
  ctx.lineTo(x + d.x * (r + 4.5), y + d.y * (r + 4.5));
  ctx.stroke();
  ctx.globalAlpha /= opacita;
}

// Dove puo' stare un inseguitore: dovunque si cammini. Il vincolo di stanza
// serve solo se un giorno tornera' qualcuno chiuso in una stanza sola.
//
// `soloCorridoi` e' il vincolo opposto, e ce l'ha solo il trombettista: uno che
// studia camminando gira per i corridoi, non si infila nelle aule e non
// attraversa i cortili.
//
// Prima il vincolo diceva «dovunque tranne che nelle aule», e non bastava: il
// cortile non e' un'aula, quindi ci entrava, e nel Cortile A ci e' rimasto
// piantato (visto da Gianluca il 13/09/2026). Adesso il centro deve stare in
// un corridoio, e per giunta nel BLOCCO in cui sta gia' lui — il palcoscenico
// e' un corridoio staccato dagli altri otto.
//
// Si guarda il centro e basta, non le quattro spalle: le celle sono larghe tre
// pixel, e chi passa davanti a una porta aperta ha sempre una spalla oltre la
// linea. Col centro dentro non resta comunque bloccato, ed e' quello che conta.
// Il corpo intero lo controlla `libero` qui sotto, come per tutti gli altri.
function consentito(e, x, y, stanzaVincolo) {
  if (stanzaVincolo !== undefined) return aulaContenente(x, y) === stanzaVincolo;
  if (e.fuoriDaiBagni && bagnoContenente(x, y) >= 0) return false;
  if (e.soloCorridoi) {
    const b = bloccoCorridoio(x, y);
    if (b < 0) return false;
    if (e.blocco !== undefined && b !== e.blocco) return false;
  }
  //  stesso corpo intero del giocatore: Alba si incastrava sulle porte per lo
  //  stesso motivo, i quattro angoli che non vedevano lo stipite in mezzo
  return libero(x, y, e.r * 0.75);
}

// =============================================================================
//  UNA ROTTA, NON SOLO UNA DIREZIONE
// =============================================================================
//  `avvicina` sa costeggiare un muro, non attraversare un edificio: puntata a
//  una meta' dall'altra parte della pianta si appoggia alla prima parete e ci
//  resta. Finche' a muoversi era solo l'inseguitore non importava — lui non
//  deve arrivare da nessuna parte in particolare. Ad Alba invece serve
//  trovare l'inseguitore, e senza rotta lo trovava in una partita su quattro
//  (misurato l'11/09/2026).
//
//  La rotta si cerca su una griglia GROSSA: un nodo ogni quattro celle, cioe'
//  dodici pixel. Sono tredicimila nodi invece di duecentomila, la ricerca
//  costa un paio di millesimi di secondo, e per camminare in un corridoio
//  quella risoluzione basta e avanza.
// -----------------------------------------------------------------------------
const PASSO_ROTTA = 4;                       // celle per nodo
const ROTTA_L = Math.ceil(LARG / PASSO_ROTTA);
const ROTTA_A = Math.ceil(ALT / PASSO_ROTTA);
const rottaVisti = new Int32Array(ROTTA_L * ROTTA_A);
const rottaDa = new Int32Array(ROTTA_L * ROTTA_A);
const rottaCoda = new Int32Array(ROTTA_L * ROTTA_A);
let rottaGiro = 0;

const nodoDi = (px, py) =>
  Math.min(ROTTA_A - 1, Math.max(0, Math.floor(py / CELLA / PASSO_ROTTA))) * ROTTA_L +
  Math.min(ROTTA_L - 1, Math.max(0, Math.floor(px / CELLA / PASSO_ROTTA)));
const mondoDi = n => ({
  x: (n % ROTTA_L + 0.5) * PASSO_ROTTA * CELLA,
  y: (Math.floor(n / ROTTA_L) + 0.5) * PASSO_ROTTA * CELLA,
});

//  Il prossimo punto da puntare per arrivare a `meta`, oppure `meta` stessa se
//  la strada e' gia' libera. Torna null se non c'e' nessun percorso: e' il caso
//  di un cortile chiuso, e chi chiama deve cavarsela da solo.
//
//  `soloBlocco`, se c'e', tiene la strada dentro un blocco di corridoi: serve
//  al trombettista, che nei cortili non entra. Senza, la rotta gli tagliava
//  per il Cortile A e lui si fermava sul confine, che per gli altri non
//  esiste.
//  `evita`, se c'e', e' un'aula da non attraversare: serve a chi aspetta fuori
//  dalla sua porta (vedi `allaPorta`), perche' certe aule hanno due aperture e
//  la strada piu' corta passava proprio di li'.
function rottaVerso(chi, meta, raggio, avanti = 12, soloBlocco, vista, evita = -1) {
  const partenza = nodoDi(chi.x, chi.y), arrivo = nodoDi(meta.x, meta.y);
  if (partenza === arrivo) return { x: meta.x, y: meta.y };

  const passabile = n => {
    const m = mondoDi(n);
    if (soloBlocco !== undefined && bloccoCorridoio(m.x, m.y) !== soloBlocco) return false;
    if (evita >= 0 && aulaContenente(m.x, m.y) === evita) return false;
    return libero(m.x, m.y, raggio);
  };

  const giro = ++rottaGiro;
  let testa = 0, coda = 0;
  rottaCoda[coda++] = partenza;
  rottaVisti[partenza] = giro; rottaDa[partenza] = -1;

  while (testa < coda) {
    const n = rottaCoda[testa++];
    if (n === arrivo) break;
    const c = n % ROTTA_L, r = (n - c) / ROTTA_L;
    for (let k = 0; k < 4; k++) {
      const cc = c + (k === 0 ? 1 : k === 1 ? -1 : 0);
      const rr = r + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (cc < 0 || rr < 0 || cc >= ROTTA_L || rr >= ROTTA_A) continue;
      const v = rr * ROTTA_L + cc;
      if (rottaVisti[v] === giro) continue;
      rottaVisti[v] = giro;
      if (v !== arrivo && !passabile(v)) continue;
      rottaDa[v] = n;
      rottaCoda[coda++] = v;
    }
  }
  if (rottaVisti[arrivo] !== giro) return null;

  // si risale dall'arrivo e ci si ferma a `avanti` nodi dalla partenza: piu'
  // vicino di cosi' la meta cambia a ogni fotogramma e il passo trema
  let n = arrivo, quanti = 0;
  const strada = [];
  while (n !== -1 && n !== partenza) { strada.push(n); n = rottaDa[n]; }
  if (!strada.length) return { x: meta.x, y: meta.y };

  //  `vista`, se c'e', e' il raggio del corpo: invece di un punto a `avanti`
  //  nodi si punta il nodo PIU' LONTANO che si vede in linea retta. La strada
  //  sulla griglia va a gradini e rade gli spigoli; seguita nodo per nodo,
  //  Alba sbandava a destra e a sinistra anche in un corridoio dritto
  //  (misurato il 23/09/2026: un passo su tre deviato contro un muro).
  //  Cosi' va dritta e gira solo dove il corridoio gira.
  if (vista) {
    const libera = (x, y) => {
      const d = Math.hypot(x - chi.x, y - chi.y), n = Math.ceil(d / 3);
      for (let k = 1; k <= n; k++) {
        const px = chi.x + (x - chi.x) * k / n, py = chi.y + (y - chi.y) * k / n;
        if (soloBlocco !== undefined && bloccoCorridoio(px, py) !== soloBlocco) return false;
        if (evita >= 0 && aulaContenente(px, py) === evita) return false;
        if (!libero(px, py, vista)) return false;
      }
      return true;
    };
    if (libera(meta.x, meta.y)) return { x: meta.x, y: meta.y };
    let visto = null;
    for (let k = strada.length - 1; k >= Math.max(0, strada.length - 40); k--) {
      const m = mondoDi(strada[k]);
      if (!libera(m.x, m.y)) break;
      visto = m;
    }
    if (visto) return visto;
  }
  const scelto = strada[Math.max(0, strada.length - 1 - avanti)];
  return strada.length <= avanti ? { x: meta.x, y: meta.y } : mondoDi(scelto);
}

// Contro un muro curvo lo scivolamento per assi non basta: ai poli una delle
// due componenti si annulla e l'inseguitore resta incollato alla parete.
// Deviare progressivamente di lato basta a costeggiare l'ostacolo senza dover
// calcolare un percorso vero.
const ANGOLI = [0.6, 0.9, 1.2, 1.5, 1.8, 2.2];

//  Si puo' andare da dove sta `e` fino a (x, y) in linea retta? Si prova un
//  punto ogni tre pixel con la stessa regola di ogni passo.
function lineaLibera(e, x, y, stanzaVincolo) {
  const d = Math.hypot(x - e.x, y - e.y), n = Math.ceil(d / 3);
  for (let k = 1; k <= n; k++)
    if (!consentito(e, e.x + (x - e.x) * k / n, e.y + (y - e.y) * k / n, stanzaVincolo))
      return false;
  return true;
}

function avvicina(e, passo, stanzaVincolo) {
  const dx = e.bx - e.x, dy = e.by - e.y;
  const d = Math.hypot(dx, dy);
  if (d <= 1) return;
  const ux = dx / d, uy = dy / d;

  const prova = ang => {
    const c = Math.cos(ang), s = Math.sin(ang);
    const nx = e.x + (ux * c - uy * s) * passo;
    const ny = e.y + (ux * s + uy * c) * passo;
    return consentito(e, nx, ny, stanzaVincolo) ? { nx, ny } : null;
  };

  // Chi sta aggirando un ostacolo tiene il verso per quasi un secondo. Senza
  // questo impegno si ricontrolla la via diretta a ogni fotogramma, si riparte
  // dritti, si ritrova il muro, e si oscilla sul posto.
  //  ...ma l'impegno serve solo finche' il muro sta ancora davanti. Se la
  //  linea fino al punto da raggiungere e' tutta libera, si torna dritti
  //  subito: prima un solo passo contro uno spigolo teneva Alba di sbieco per
  //  quasi un secondo, e si vedeva sbandare a destra e a sinistra anche in un
  //  corridoio sgombro (23/09/2026: 3400 passi deviati su 3554 avevano la via
  //  dritta libera).
  let staAggirando = e.aggiraFino && tempo < e.aggiraFino;
  if (staAggirando && lineaLibera(e, e.bx, e.by, stanzaVincolo)) {
    staAggirando = false; e.aggiraFino = 0;
  }
  if (staAggirando) {
    for (const a of ANGOLI) {
      const p = prova(a * e.verso);
      if (p) { e.x = p.nx; e.y = p.ny; return; }
    }
  } else {
    const dritto = prova(0);
    if (dritto) { e.x = dritto.nx; e.y = dritto.ny; e.aggiraFino = 0; return; }
  }

  let scelta = null;
  for (const v of [1, -1]) {
    for (const a of ANGOLI) {
      const p = prova(a * v);
      if (!p) continue;
      const dist = Math.hypot(e.bx - p.nx, e.by - p.ny);
      if (!scelta || dist < scelta.dist) scelta = { ...p, v, dist };
      break;                       // per ogni lato basta la deviazione minima
    }
  }
  if (scelta) {
    e.x = scelta.nx; e.y = scelta.ny;
    e.verso = scelta.v; e.aggiraFino = tempo + 0.9;
    return;
  }
  e.bx = e.x; e.by = e.y;      // circondato davvero: si scegliera' un'altra meta
}


// =============================================================================
//  NESSUNO RESTA INCASTRATO — la rete sotto a tutto il resto
// =============================================================================
//  Alba che si pianta fra una finestra e una porta e' il difetto che si e'
//  ripresentato piu' volte, sempre con una causa diversa: gli stipiti larghi
//  mezza cella, le aule senza via d'uscita, la finestra che le si richiudeva
//  addosso. Ogni volta si e' tolta LA CAUSA, e ogni volta ne e' rimasta
//  un'altra sotto.
//
//  Questa e' l'altra strada, e va tenuta INSIEME alle correzioni di prima, non
//  al loro posto: non evita l'incastro, lo DISFA. Chiude la categoria intera —
//  qualunque sia il motivo per cui un corpo si e' trovato dentro un muro o non
//  riesce piu' a muoversi, entro pochi secondi torna a camminare.
//
//  Tre gradini, dal piu' gentile al piu' brusco:
//   1. il corpo sta dentro un muro (`consentito` dice di no dove si trova):
//      si estrae subito, nel punto buono piu' vicino. Succede da fermo, dura
//      un fotogramma, e sposta di pochi pixel;
//   2. il corpo sta in un punto valido ma non si muove da tre secondi: si
//      butta via la meta e l'impegno ad aggirare, e si riparte da capo;
//   3. non si muove da sei: si ricomincia da un altro punto dei corridoi. E'
//      l'ultima spiaggia e in pratica non si vede mai, ma esiste perche' il
//      gioco non deve MAI lasciare un personaggio piantato per tre minuti.
// -----------------------------------------------------------------------------

//  Il punto buono piu' vicino, cercato a spirale. Il giro parte stretto e si
//  allarga: quasi sempre finisce entro dieci pixel, perche' in un muro ci si
//  infila di poco.
function puntoBuonoVicino(e) {
  for (let r = 4; r <= 200; r += 4)
    for (let k = 0; k < 24; k++) {
      //  l'angolo di partenza ruota col raggio, cosi' i giri non provano
      //  sempre le stesse otto direzioni e non si esce sempre dallo stesso lato
      const a = (k / 24) * Math.PI * 2 + r * 0.37;
      const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
      if (consentito(e, x, y)) return { x, y };
    }
  return null;
}

//  Azzera tutto quello che un corpo si porta dietro del suo incastro: la meta
//  intermedia, l'impegno ad aggirare da un lato, i contatori del fermo.
function ripartiDaCapo(e) {
  e.bx = e.x; e.by = e.y;
  e.aggiraFino = 0; e.rottaFino = 0;
  e.fermaDa = 0; e.fermoDa = 0; e.bloccatoDa = 0;
  e.meta = null;
  e.ancora = null;
}

//  MUOVERSI NON E' FARE STRADA. Il fermo si contava fotogramma per fotogramma
//  («si e' spostata di almeno 0,05 px?»), e un corpo che oscilla — scarta a
//  destra, poi a sinistra, poi di nuovo a destra — per quel conto cammina
//  sempre. Alba e' rimasta cosi' sulla soglia di un'aula finche' l'inseguitore
//  non usciva, e contro un muro per trenta secondi di fila (misurato il
//  23/09/2026). Si conta allora la strada vera: un punto d'ancora che si
//  sposta solo quando il corpo se ne e' allontanato di 16 px. Se in un secondo
//  e mezzo non ci riesce, per lo sblocco e' fermo, anche se si agita.
function faStrada(e, primaX, primaY) {
  if (Math.hypot(e.x - primaX, e.y - primaY) < 0.05) return false;
  if (!e.ancora || Math.hypot(e.x - e.ancora.x, e.y - e.ancora.y) > 16)
    e.ancora = { x: e.x, y: e.y, t: tempo };
  return tempo - e.ancora.t < 1.5;
}

//  ALLE PORTE DELLE AULE — Aluzzi non entra (Gianluca, 24/09/2026). Alba
//  e' esclusa di proposito: gira per i corridoi, il suo mestiere e' fermare lui.
//
//  Farli entrare davvero vorrebbe dire una rotta porta per porta e intorno ai
//  mobili, ed e' proprio li' che si sono incastrati piu' spesso. Invece si
//  fermano fuori dalla porta dell'aula in cui sei, `portaSosta` secondi; poi si
//  allontanano di `portaVia` px lungo il corridoio, restano li' `portaFuori`
//  secondi e tornano alla STESSA porta. Torna il punto da raggiungere, o null
//  se davanti a quella porta il corpo non ci sta (e allora si fa come prima).
function allaPorta(e, stanza, lontano) {
  let P = e.porta;
  if (!P || P.stanza !== stanza) {
    if (e.portaNo && e.portaNo.stanza === stanza && tempo < e.portaNo.fino) return null;
    const soglia = sogliaAula(stanza);
    const posto = postoDiChiusura(soglia, stanza, e) || fuoriDallaSoglia(e, soglia, stanza, lontano);
    if (!posto) { e.porta = null; return null; }
    //  30 secondi per arrivarci: certe aule hanno la porta dall'altra parte
    //  dell'isolato, e il giro intorno ne prende piu' di dieci
    P = e.porta = { stanza, posto, via: null, lontano, fase: 'va', fino: tempo + 30 };
  }
  const arrivato = q => Math.hypot(q.x - e.x, q.y - e.y) < 8;
  if (P.fase === 'va') {
    if (arrivato(P.posto)) { P.fase = 'sosta'; P.fino = tempo + G.portaSosta; }
    else if (tempo >= P.fino) {          // alla porta non ci arriva: la si lascia
      e.porta = null; e.portaNo = { stanza, fino: tempo + 30 };
      return null;
    }
  } else if (P.fase === 'sosta') {
    if (tempo >= P.fino) { P.via = viaDallaPorta(e, P); P.fase = 'via'; P.fino = tempo + 8; }
  } else if (P.fase === 'via') {
    if (!P.via || arrivato(P.via) || tempo >= P.fino) { P.fase = 'fuori'; P.fino = tempo + G.portaFuori; }
  } else if (tempo >= P.fino) { P.fase = 'va'; P.fino = tempo + 30; }
  return (P.fase === 'via' || P.fase === 'fuori') && P.via ? P.via : P.posto;
}

//  Ripiego per le porte dove `postoDiChiusura` non trova posto sulla retta
//  uscente (Aula 35): il primo nodo della rotta che dalla soglia va verso il
//  corridoio, fuori dall'aula e con il corpo che ci sta.
function fuoriDallaSoglia(e, soglia, stanza, lontano) {
  const dove = lontano();
  if (!dove) return null;
  for (let n = 1; n <= 4; n++) {
    const p = rottaVerso(soglia, dove, 4, n);
    if (p && aulaContenente(p.x, p.y) !== stanza && consentito(e, p.x, p.y)) return { x: p.x, y: p.y };
  }
  return null;
}

//  Il punto «non troppo lontano»: sulla rotta che parte dal posto davanti alla
//  porta, a `portaVia` px, scendendo di nodo finche' il corpo non ci entra.
function viaDallaPorta(e, P) {
  const dove = P.lontano();
  if (!dove) return null;
  const blocco = e.soloCorridoi ? e.blocco : undefined;
  for (let n = Math.round(G.portaVia / (PASSO_ROTTA * CELLA)); n >= 2; n--) {
    const p = rottaVerso(P.posto, dove, 4, n, blocco, undefined, P.stanza);
    if (p && consentito(e, p.x, p.y)) return { x: p.x, y: p.y };
  }
  return null;
}

//  Un passo verso `meta` seguendo la rotta; arrivato, sta fermo. Il posto sta
//  a un passo dalla porta, e `avvicina`, girando attorno a uno stipite, ci
//  scivolava dentro: se il passo finisce nell'aula della porta, non si fa.
function passoVerso(e, meta, velocita, dt, blocco) {
  if (Math.hypot(meta.x - e.x, meta.y - e.y) < 6) { e.bx = e.x; e.by = e.y; e.portaFermo = 0; return; }
  if (tempo > (e.rottaFino || 0) || Math.hypot(e.bx - e.x, e.by - e.y) < 10) {
    //  un nodo alla volta, come `camminaScena`: puntando il nodo piu' lontano
    //  in vista si piantava sugli spigoli (Aula 14, misurato il 24/09/2026)
    e.rottaFino = tempo + 0.12;
    const p = rottaVerso(e, meta, 4, 1, blocco, undefined, e.porta ? e.porta.stanza : -1) || meta;
    e.bx = p.x; e.by = p.y;
  }
  const px = e.x, py = e.y;
  avvicina(e, velocita * dt);
  const vietata = e.porta ? e.porta.stanza : -1;
  if (vietata >= 0 && aulaContenente(e.x, e.y) === vietata &&
      aulaContenente(px, py) !== vietata) {
    e.x = px; e.y = py; e.aggiraFino = 0; e.rottaFino = 0;
  }
  const d = Math.hypot(e.x - px, e.y - py);
  if (d > 0.05) { e.dirx = (e.x - px) / d; e.diry = (e.y - py) / d; }
  //  Fermo tre secondi senza essere arrivato: la strada non si fa (Aula 46,
  //  contro il bordo della pianta). Si chiude la fase subito invece di
  //  aspettarne la scadenza: in andata rinuncia alla porta, al ritorno torna.
  e.portaFermo = d > 0.05 ? 0 : (e.portaFermo || 0) + dt;
  if (e.portaFermo > 3 && e.porta) { e.portaFermo = 0; e.porta.fino = tempo; }
}

function liberaSeIncastrato(e, dt, mosso) {
  if (!e || !e.inGioco) return false;

  //  1. dentro un muro: si esce e basta
  if (!consentito(e, e.x, e.y)) {
    const p = puntoBuonoVicino(e);
    if (p) { e.x = p.x; e.y = p.y; ripartiDaCapo(e); return true; }
  }

  e.bloccatoDa = mosso ? 0 : (e.bloccatoDa || 0) + dt;

  //  2. fermo da tre secondi in un punto valido: si butta via il piano
  if (e.bloccatoDa > 3 && e.bloccatoDa <= 6) {
    const p = puntoNeiCorridoi(e.blocco, e, 200);
    ripartiDaCapo(e);
    e.bloccatoDa = 3.01;            // il contatore prosegue: se non basta, il 3
    if (p) { e.meta = p; e.bx = p.x; e.by = p.y; }
    return true;
  }

  //  3. fermo da sei: si ricomincia da un'altra parte dei corridoi
  if (e.bloccatoDa > 6) {
    const p = puntoNeiCorridoi(e.blocco, e, 260) || puntoBuonoVicino(e);
    if (p) { e.x = p.x; e.y = p.y; }
    ripartiDaCapo(e);
    return true;
  }
  return false;
}


// =============================================================================
//  I PERSONAGGI — il trombettista e Alba
// =============================================================================
//  Non ti inseguono. Girano per conto loro, e proprio per questo cambiano la
//  partita senza mai diventare un secondo inseguitore: uno ti rallenta dove
//  capita lui, l'altra ti regala tempo quando incontra chi ti da' la caccia.
//
//  Tutti e due stanno nei corridoi. Alba fino al 13/09/2026 entrava anche
//  nelle aule, ed era voluto; ma ci restava incastrata, e per adesso gira di
//  fuori come lui.
// -----------------------------------------------------------------------------
//  Un punto dove il trombettista ci sta davvero: dentro un corridoio, nel
//  blocco `blocco` (se e' chiesto), e con il corpo libero da muri. Le celle si
//  pescano dal blocco stesso e non da tutto CELLE_CORRIDOIO: sorteggiare dalla
//  lista intera e poi scartare significava, stando sul palcoscenico, tirare
//  centinaia di volte a vuoto.
function puntoNeiCorridoi(blocco, lontanoDa, minimo) {
  const lista = BLOCCHI_CORRIDOIO.blocchi[blocco >= 0 ? blocco : 0];
  if (!lista || !lista.length) return null;
  const corpo = { r: 8, soloCorridoi: true, blocco: blocco >= 0 ? blocco : undefined };
  let ripiego = null;
  for (let k = 0; k < 300; k++) {
    const p = lista[Math.floor(Math.random() * lista.length)];
    if (!consentito(corpo, p.x, p.y)) continue;
    if (!lontanoDa) return p;
    if (Math.hypot(p.x - lontanoDa.x, p.y - lontanoDa.y) > (minimo || 0)) return p;
    ripiego = p;                            // ci sta, ma e' vicino: meglio di niente
  }
  return ripiego || lista.find(p => consentito(corpo, p.x, p.y)) || null;
}

function preparaPersonaggi(partenza) {
  const P = CONFIG.personaggi;

  //  Nasce nel blocco di corridoi piu' grande — quello che tiene insieme otto
  //  corridoi su nove — e li' dentro ci resta per tutta la partita. Il nono e'
  //  il palcoscenico, staccato: farcelo nascere vorrebbe dire chiudercelo.
  const t = puntoNeiCorridoi(0, partenza, 500) ||
            puntoNeiCorridoi(0) || partenza;
  trombettista = { x: t.x, y: t.y, bx: t.x, by: t.y, r: 8, inGioco: true,
                   soloCorridoi: true, blocco: bloccoCorridoio(t.x, t.y),
                   studia: true, fermoFino: tempo + fraDue(P.trombettista.sosta),
                   meta: null, rottaFino: 0,
                   camminaFino: 0, fermoDa: 0, aggiraFino: 0, verso: 1,
                   dirx: 0, diry: 1, fase: Math.random() * 10 };

  const a = puntoNeiCorridoi(0, partenza, 620) || puntoNeiCorridoi(0) || partenza;
  alba = { x: a.x, y: a.y, bx: a.x, by: a.y, r: 8,
           inGioco: true, soloCorridoi: true, blocco: bloccoCorridoio(a.x, a.y),
           aggiraFino: 0, verso: 1, liberaDa: 0 };

  colloquio = { attivo: false, fino: 0, x: 0, y: 0 };
}

//  Quanta velocita' resta al giocatore: 1 lontano dal trombettista, `rallenta`
//  addosso a lui, e in mezzo una salita graduale — cosi' si sente arrivare il
//  peso prima di esserci dentro, e si fa in tempo a girare di la'.
//  Con le cuffie addosso il freno sparisce: l'alone non ti arriva, e quello che
//  non senti non ti pesa.
function frenoTrombettista() {
  if (occlusione && occlusione.attiva) return 1;
  if (!trombettista || !trombettista.inGioco) return 1;
  const T = CONFIG.personaggi.trombettista;
  const d = Math.hypot(trombettista.x - giocatore.x, trombettista.y - giocatore.y);
  if (d >= T.alone) return 1;
  const dentro = 1 - d / T.alone;              // 0 sul bordo, 1 al centro
  return 1 - (1 - T.rallenta) * dentro;
}

function gestisciPersonaggi(dt) {
  if (modalitaLibera) {
    //  Qui i due stanno fermi, ma le finestre continuano a respirare e una
    //  puo' chiudersi proprio dove sta uno di loro. Il salvagente resta acceso:
    //  la modalita' libera e' quella in cui gli studenti passano piu' tempo, e
    //  trovarci Alba murata dentro sarebbe lo stesso difetto di sempre.
    //  `mosso` a true lascia lavorare solo il primo gradino — quello del corpo
    //  dentro un muro — perche' qui star fermi e' normale, non un incastro.
    liberaSeIncastrato(trombettista, dt, true);
    liberaSeIncastrato(alba, dt, true);
    return;
  }
  muoviTrombettista(dt);
  muoviAlba(dt);
  gestisciColloquio();
  aggiornaAlone();
}

//  Cammina un po', si ferma a studiare, riparte. La sosta e' la parte che si
//  sente: fermo in un punto, la sua tromba diventa un ostacolo che sta li' e
//  che si puo' aggirare — se ci si accorge in tempo di dove sta.
function muoviTrombettista(dt) {
  const T = CONFIG.personaggi.trombettista, e = trombettista;
  if (!e.inGioco) return;
  e.fase += dt;

  //  Anche da fermo si puo' finire dentro un muro — basta una finestra che si
  //  chiude li' dove sta studiando. `mosso` a true tiene a zero il contatore
  //  del fermo: la sosta e' voluta, e non e' un incastro.
  if (e.studia && liberaSeIncastrato(e, dt, true)) return;

  // Due stati soli, e si alternano: studia fermo, poi cammina fino alla
  // prossima meta. Tenerli separati e' quello che fa sentire la ripartenza —
  // con un timer solo la sosta non arrivava mai.
  if (e.studia) {
    if (tempo < e.fermoFino) return;
    e.studia = false;
    e.fermoDa = 0;
    e.aggiraFino = 0;
    e.meta = puntoNeiCorridoi(e.blocco, e, 260);
    e.rottaFino = 0;
    if (e.meta) { e.bx = e.meta.x; e.by = e.meta.y; }
    e.camminaFino = tempo + fraDue(T.passeggiata);
    return;
  }

  //  La strada gliela dice una rotta vera, come ad Alba. Puntando dritto alla
  //  meta arrivava dove voleva 60 volte su 863 (misurato il 13/09/2026): il
  //  resto del tempo si appoggiava al primo muro e ripartiva a caso quando
  //  scadeva la passeggiata. Si vedeva: una partita su quaranta lo lasciava a
  //  girare dentro sessanta pixel.
  if (e.meta && (tempo > (e.rottaFino || 0) || Math.hypot(e.bx - e.x, e.by - e.y) < 14)) {
    e.rottaFino = tempo + 0.7;
    const p = rottaVerso(e, e.meta, 6, 5, e.blocco);
    if (p) { e.bx = p.x; e.by = p.y; }
    else { e.meta = null; e.bx = e.x; e.by = e.y; }   // nessuna strada: si sosta e si riprova
  }

  const primaX = e.x, primaY = e.y;
  avvicina(e, T.velocita * dt);

  // il verso resta quello dell'ultimo passo: fermo a studiare la campana
  // deve continuare a puntare da qualche parte, non sparire
  const px = e.x - primaX, py = e.y - primaY, pd = Math.hypot(px, py);
  if (pd > 0.2) { e.dirx = px / pd; e.diry = py / pd; }

  // incastrato davvero, non per un fotogramma: contro un muro ci si appoggia
  // anche mentre lo si costeggia
  const strada = faStrada(e, primaX, primaY);
  if (!strada) e.fermoDa += dt;
  else e.fermoDa = 0;

  if (liberaSeIncastrato(e, dt, strada)) return;

  const arrivato = e.meta ? Math.hypot(e.meta.x - e.x, e.meta.y - e.y) < 14
                          : Math.hypot(e.bx - e.x, e.by - e.y) < 12;
  if (arrivato || e.fermoDa > 1.2 || tempo > e.camminaFino) {
    e.studia = true;
    e.fermoFino = tempo + fraDue(T.sosta);
  }
}

//  Alba gira e basta: nessuna sosta, nessuna meta che la riguardi. Il suo
//  mestiere e' capitare addosso all'inseguitore.
function muoviAlba(dt) {
  const A = CONFIG.personaggi.alba, e = alba;
  if (!e.inGioco) return;
  if (colloquio.attivo) { liberaSeIncastrato(e, dt, true); return; }  // ferma a parlare

  //  Quando se lo trova a tiro e ha finito di riposare, Alba gli VA incontro:
  //  e' una collega che lo ferma a parlare, non una pallina che lo incrocia
  //  per caso. Il raggio serve: lanciata su di lui da un capo all'altro
  //  dell'edificio si appoggia al primo muro e non arriva mai — nessuno dei
  //  due calcola un percorso, sanno solo costeggiare.
  //
  //  ...ma solo se lui sta dove lei puo' arrivare: nel SUO blocco di
  //  corridoi. Con l'inseguitore dentro un'aula a meno di `avvicinamento`,
  //  Alba gli puntava dritto addosso, arrivava alla porta, non poteva entrare
  //  (gira solo nei corridoi) e scartava di lato da uno stipite all'altro.
  //  Siccome si muoveva, nessuno sblocco scattava: restava sulla soglia finche'
  //  lui non usciva. Visto da Gianluca il 23/09/2026 («rimbalza sulla soglia
  //  tra uno stipite e l'altro»), riprodotto su cinque porte su cinque.
  //  Adesso, se lui e' in un'aula, lei continua il suo giro: lo incontrera'
  //  quando esce.
  const cerca = inseguitore.inGioco && tempo >= e.liberaDa &&
                bloccoCorridoio(inseguitore.x, inseguitore.y) === e.blocco;


  if (cerca) {
    // Addosso gli punta dritto; da piu' lontano segue una rotta vera,
    // ricalcolata spesso — lui si sposta, e una rotta di mezzo minuto fa
    // porta dove non e' piu'. Senza rotta lo trovava in una partita su
    // quattro: `avvicina` sa costeggiare, non sa girare un angolo.
    if (Math.hypot(inseguitore.x - e.x, inseguitore.y - e.y) < A.avvicinamento) {
      e.bx = inseguitore.x; e.by = inseguitore.y;
      e.rottaFino = 0;
    } else if (tempo > (e.rottaFino || 0) || Math.hypot(e.bx - e.x, e.by - e.y) < 14) {
      e.rottaFino = tempo + 0.6;
      //  Il raggio qui e' piu' stretto del corpo di Alba, e non e' una svista:
      //  i nodi della griglia cadono dove capita dentro il corridoio, e
      //  chiedendo la larghezza vera non passava nessun percorso. Il pelo fine
      //  lo fa `avvicina`, un fotogramma alla volta.
      const p = rottaVerso(e, inseguitore, 4, 7, e.blocco, e.r * 0.75) ||
                puntoNeiCorridoi(e.blocco, e, 200);    // nessuna strada: si gira
      if (p) { e.bx = p.x; e.by = p.y; }
    }
  } else {
    //  IN GIRO ANCHE LEI SEGUE UNA ROTTA. Prima puntava la meta in linea retta:
    //  la meta sta a 300 px, quasi sempre dietro un muro, e contro il muro
    //  `avvicina` scartava a destra e a sinistra di quaranta pixel — abbastanza
    //  perche' `faStrada` la desse in cammino. Misurato il 23/09/2026: 25
    //  secondi di fila avanti e indietro nello stesso corridoio, con la stessa
    //  meta. E' quello del filmato di Gianluca (IMG_5264).
    if (!e.meta || Math.hypot(e.meta.x - e.x, e.meta.y - e.y) < 14) {
      e.meta = puntoNeiCorridoi(e.blocco, e, 300);
      e.rottaFino = 0;
    }
    if (e.meta && (tempo > (e.rottaFino || 0) || Math.hypot(e.bx - e.x, e.by - e.y) < 14)) {
      e.rottaFino = tempo + 0.6;
      const p = rottaVerso(e, e.meta, 4, 7, e.blocco, e.r * 0.75);
      if (p) { e.bx = p.x; e.by = p.y; }
      else e.meta = null;                   // nessuna strada: al prossimo giro un'altra meta
    }
    //  ALBA NELLE AULE NON ENTRA PIU'. Entrarci era voluto — era l'unica, e la
    //  si poteva incrociare proprio nella stanza in cui si stava ascoltando —
    //  ma ci restava chiusa dentro: `avvicina` sa costeggiare, non sa
    //  ritrovare la porta. Gianluca l'ha vista incastrata per una partita
    //  intera (13/09/2026), e ha detto lui come chiuderla: «facciamo come per
    //  il trombettista e la facciamo girare solo tra i corridoi».
    //
    //  Provate e scartate, tutte e due misurate: puntare un corridoio con la
    //  rotta (dall'interno di una stanza la rotta non trova niente, i nodi
    //  della porta non passano sulla griglia grossa) e puntare la soglia
    //  dell'aula (ci sbatte contro e oscilla, e la meta che si riscrive ogni
    //  fotogramma spegne anche lo sblocco del `fermaDa`). Restava dentro tre
    //  minuti su tre.
    //
    //  Farla entrare DAVVERO costa un percorso porta per porta, e non e' il
    //  lavoro di questo giro.
  }

  const primaX = e.x, primaY = e.y;
  avvicina(e, A.velocita * dt);
  const mosso = faStrada(e, primaX, primaY);
  if (liberaSeIncastrato(e, dt, mosso)) return;
  if (!mosso) e.fermaDa = (e.fermaDa || 0) + dt;
  else e.fermaDa = 0;
  if (e.fermaDa > 1.2) {
    // bloccata: si sceglie un'altra strada. Se stava andando dall'inseguitore
    // si prende una pausa, altrimenti ritenta all'infinito contro lo stesso muro.
    if (cerca) e.liberaDa = tempo + 6;
    //  Se sta uscendo da un'aula, la meta resta: e' proprio quella che non
    //  deve mollare. Si azzera solo la stazione intermedia, cosi' la rotta si
    //  ricalcola da dove si e' appoggiata.
    e.bx = e.x; e.by = e.y; e.aggiraFino = 0; e.fermaDa = 0; e.rottaFino = 0;
  }

  //  CAMMINARE NON E' AVVICINARSI. `faStrada` guarda se si sposta, e uno
  //  scarto di quaranta pixel avanti e indietro per lei e' strada fatta. Qui si
  //  guarda se la distanza dalla meta scende: se in cinque secondi non e'
  //  calata di 24 px, quella meta non si raggiunge e se ne prende un'altra.
  //  E' la rete sotto la rotta, per la prossima causa che ancora non si vede.
  const bersaglio = cerca ? inseguitore : e.meta;
  if (!bersaglio) { e.progresso = null; return; }
  const dm = Math.hypot(bersaglio.x - e.x, bersaglio.y - e.y);
  if (!e.progresso || e.progresso.di !== bersaglio || dm < e.progresso.d - 24) {
    e.progresso = { di: bersaglio, d: dm, t: tempo };
  } else if (tempo - e.progresso.t > 5) {
    if (cerca) e.liberaDa = tempo + 6;
    e.meta = puntoNeiCorridoi(e.blocco, e, 300);
    e.bx = e.x; e.by = e.y; e.aggiraFino = 0; e.rottaFino = 0;
    e.progresso = null;
  }
}

//  Quando Alba incrocia l'inseguitore lo ferma a parlare. Finche' parlano,
//  lui non vede e non insegue: e' il regalo di tempo piu' grande del gioco, e
//  non si puo' provocare — arriva, e basta.
function gestisciColloquio() {
  const A = CONFIG.personaggi.alba, P = CONFIG.personaggi;
  const I = inseguitore;

  if (colloquio.attivo) {
    if (tempo < colloquio.fino) {
      I.sospesoFino = Math.max(I.sospesoFino, tempo + 0.3);   // resta occupato
      return;
    }
    colloquio.attivo = false;
    alba.liberaDa = tempo + fraDue(A.riposo);
    audio.scegliRamo(P.colloquio.id, null);
    registra('aiuto_fine', audio.suona('aiuto_fine', spaziale(colloquio.x, colloquio.y)));
    return;
  }

  if (!alba.inGioco || !I.inGioco || tempo < alba.liberaDa) return;
  if (Math.hypot(alba.x - I.x, alba.y - I.y) > A.incontro) return;

  colloquio.attivo = true;
  colloquio.fino = tempo + fraDue(A.colloquio);
  colloquio.x = (alba.x + I.x) / 2;
  colloquio.y = (alba.y + I.y) / 2;
  I.sospesoFino = colloquio.fino;
  I.vede = false;
  I.fermoConAlba = colloquio.fino;
  // le due varianti si alternano: una sola diventa un tormentone dopo tre partite
  const quale = Math.floor(Math.random() * P.colloquio.varianti.length);
  audio.scegliRamo(P.colloquio.id, 'v' + quale);
}

//  L'alone non e' un suono in piu': e' una lavorazione, come l'occlusione e il
//  disturbatore. Entra e esce da solo, e cede il passo a tutti e due.
function aggiornaAlone() {
  const dentro = frenoTrombettista() < 0.995;
  if (dentro === !!aggiornaAlone.dentro) return;
  aggiornaAlone.dentro = dentro;
  audio.impostaMondo({ alone: dentro });
}


// =============================================================================
//  CASELLA 6 — un disturbatore che non si puo' eliminare
// =============================================================================
//  Compare, degrada la percezione, e non si combatte ne' si evita: va
//  aspettato. Decide da solo quando smettere. Non e' un suono in piu': e' una
//  lavorazione, ed e' la casella che spiega la differenza fra «l'audio e' una
//  lista di file» e «l'audio e' anche una manopola».
// -----------------------------------------------------------------------------
function gestisciDisturbo() {
  if (modalitaLibera) return;

  if (disturbo.attivo) {
    if (tempo < disturbo.fino) return;
    fermaDisturbo();
    return;
  }
  if (tempo < disturbo.prossimo) return;
  // l'aiuto che toglie l'udito PROTEGGE dal disturbatore: e' il suo doppio
  // taglio, e la protezione costa l'ascolto
  if (occlusione.attiva) { disturbo.prossimo = tempo + 6; return; }
  avviaDisturbo();
}

function avviaDisturbo() {
  disturbo.attivo = true;
  disturbo.fino = tempo + fraDue(CONFIG.disturbo.durata);
  audio.impostaMondo({ disturbo: true });
  registra('disturbo_arrivo', audio.suona('disturbo_arrivo'));
}

function fermaDisturbo() {
  disturbo.attivo = false;
  disturbo.prossimo = tempo + fraDue(CONFIG.disturbo.intervallo);
  audio.impostaMondo({ disturbo: false });
  registra('disturbo_fine', audio.suona('disturbo_fine'));
}

function commutaDisturbo() { disturbo.attivo ? fermaDisturbo() : avviaDisturbo(); }


// =============================================================================
//  CASELLA 7 — aiuti a doppio taglio
// =============================================================================
//  Ognuno aiuta e insieme toglie qualcosa: le cuffie ti proteggono dal
//  disturbatore e in cambio ti togliono l'udito, il laptop ti rivela una
//  posizione che avresti dovuto cercare. Sono due, se ne trova uno per tipo,
//  e si consumano.
//
//  Il terzo — quello che sospendeva la caccia — non c'e' piu': fermare
//  l'inseguitore e' il mestiere di Alba, e due mestieri uguali su due oggetti
//  diversi non insegnano niente. `inseguitore.sospesoFino` resta, ma da oggi
//  a scriverci dentro c'e' solo lei.
// -----------------------------------------------------------------------------
function gestisciAiuti(dt) {
  for (const a of aiuti) {
    if (a.preso) continue;
    if (Math.hypot(a.x - giocatore.x, a.y - giocatore.y) > G.raggioRaccolta) continue;
    a.preso = true;
    prendiAiuto(a);
    nascondiAiuto(a);          // torna subito, in un'altra aula ancora chiusa
  }

  if (occlusione.attiva && tempo > occlusione.fino) {
    occlusione.attiva = false;
    audio.impostaMondo({ occlusione: false });
    registra('aiuto_fine', audio.suona('aiuto_fine'));
  }
  if (laptop.fino && tempo > laptop.fino) { laptop.fino = 0; laptop.id = null; }
  if (inseguitore.sospesoFino && tempo > inseguitore.sospesoFino) {
    inseguitore.sospesoFino = 0;
    registra('aiuto_fine', audio.suona('aiuto_fine'));
  }
}

//  DOVE SI NASCONDE UN AIUTO — sempre in un'aula ancora chiusa.
//
//  Parole di Gianluca, 13/09/2026: nei corridoi e' troppo facile vederli. Cosi'
//  il laptop e le cuffie si trovano soltanto mentre cerchi i musicisti, aprendo
//  porte — sono una scoperta dentro il lavoro che stai gia' facendo, non un
//  oggetto che ti passa davanti mentre cammini.
//
//  Dopo l'uso rinasce SUBITO, in un'altra aula chiusa, mai quella dove l'avevi
//  trovato. Niente attesa e niente timer: il timer non aggiungeva nulla, solo
//  una manopola in piu' da regolare. Se non resta nessuna aula chiusa l'aiuto
//  non torna, e va bene — e' un aiuto, non un pezzo richiesto.
//
//  La regia e' esclusa, come per i pezzi: li' dentro non ci si nasconde niente.
//  IL CENTRO DELL'AULA, SE E' LIBERO. Le cuffie sono nate sopra un pianoforte
//  (Gianluca, 24/09/2026): con i mobili solidi non si potevano piu' prendere.
//  Si parte dal centro e si gira a spirale finche' si trova un punto dentro la
//  stessa aula, lontano da muri e mobili.
function postoInAula(i) {
  const c = centroAula(i);
  const va = (x, y) => aulaContenente(x, y) === i && libero(x, y, 8) && !toccaMobile(x, y, 10);
  if (va(c.x, c.y)) return c;
  for (let d = 4; d <= 120; d += 4)
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, x = c.x + d * Math.cos(a), y = c.y + d * Math.sin(a);
      if (va(x, y)) return { x, y };
    }
  return c;
}

function nascondiAiuto(a) {
  const chiuse = AULE.map((_, i) => i)
    .filter(i => i !== regia && i !== a.stanza && !stanze[i].scoperta);
  if (!chiuse.length) { a.preso = true; a.stanza = -1; return false; }

  //  Meglio un'aula tutta sua: un aiuto sul centro di un'aula che ha gia' un
  //  musicista si raccoglierebbe insieme a lui, e a vederli sarebbero due
  //  sagome sovrapposte. Se non ce ne sono, pazienza: prima viene la regola.
  const occupate = new Set(pezzi.map(p => p.stanza));
  for (const b of aiuti) if (b !== a && !b.preso) occupate.add(b.stanza);
  const sole = chiuse.filter(i => !occupate.has(i));
  const scelte = sole.length ? sole : chiuse;

  const i = scelte[Math.floor(Math.random() * scelte.length)];
  const c = postoInAula(i);
  a.stanza = i; a.x = c.x; a.y = c.y; a.preso = false;
  return true;
}

function prendiAiuto(a) {
  const A = CONFIG.aiuti;
  if (a.tipo === 'occlusione') {
    // l'ultimo suono che si sente per intero prima che il mondo cambi: parte
    // PRIMA della lavorazione, non insieme
    registra('aiuto_occlusione', audio.suona('aiuto_occlusione'));
    occlusione.attiva = true;
    occlusione.fino = tempo + A.occlusione.durata;
    setTimeout(() => { if (occlusione.attiva) audio.impostaMondo({ occlusione: true }); }, 260);
    return;
  }
  // rivela: apre il laptop. Due canali, due informazioni diverse — la mappa
  // dice dove stanno tutti, il suono dice da dove viene il piu' vicino di
  // quelli che servono davvero. Il suono resta spazializzato sul musicista
  // vero, cioe' su dove sta ADESSO: e' l'orecchio, non la pianta.
  apriLaptop();
  const mancanti = pezzi.filter(p => !p.esca && !p.conquistato && !p.consegnato);
  if (!mancanti.length) { registra('aiuto_rivela', audio.suona('aiuto_rivela')); return; }
  const p = mancanti.reduce((m, q) =>
    Math.hypot(q.x - giocatore.x, q.y - giocatore.y) < Math.hypot(m.x - giocatore.x, m.y - giocatore.y) ? q : m);
  laptop.id = p.id;
  registra('aiuto_rivela', audio.suona('aiuto_rivela', spaziale(p.x, p.y)), p.id);
}

//  Apre la mini-mappa. Il gioco NON si ferma: l'inseguitore continua a
//  camminare e da qui in avanti lo senti soltanto.
function apriLaptop() {
  laptop.aperto = tempo;
  laptop.fino = tempo + CONFIG.aiuti.rivela.durata;
}

function commutaOcclusione() {
  occlusione.attiva = !occlusione.attiva;
  occlusione.fino = occlusione.attiva ? tempo + 9999 : 0;
  audio.impostaMondo({ occlusione: occlusione.attiva });
}


// =============================================================================
//  CASELLA 8 — il luogo di raccolta finale
// =============================================================================
//  Chi ti segue suona a frammenti non sincronizzati fra loro: ingombrante,
//  fuori tempo, ti copre le orecchie. Arrivati in anfiteatro, gli stessi
//  suonano INSIEME. Nessuna nota nuova: cambia solo se stanno insieme.
// -----------------------------------------------------------------------------
function gestisciConsegna() {
  if (!nellaRaccolta(giocatore.x, giocatore.y)) return;
  if (!giocatore.portati.length) return;

  const arrivati = giocatore.portati.splice(0);
  arrivati.forEach(p => {
    p.consegnato = true;
    p.conquistato = false;
    //  Aspetta in proscenio, sparso: il semicerchio arriva solo col concerto.
    //  Ci arriva a piedi, da dove l'hai lasciato: prima compariva al posto
    //  suo nello stesso fotogramma, e si vedeva un teletrasporto (23/09/2026).
    p.meta = postoDiAttesa();
    p.r = giocatore.r; p.metaDa = tempo; p.aggiraFino = 0;
  });
  consegnati += arrivati.length;

  // tutti quelli gia' consegnati ripartono insieme: e' il concerto
  audio.allinea(pezzi.filter(p => p.consegnato).map(p => p.id));
  registra('interfaccia_conferma', audio.suona('interfaccia_conferma'),
           consegnati + '/' + richiesti);

  if (consegnati >= richiesti) {
    //  IL CONCERTO. Solo adesso salgono sul palco, e solo adesso si mettono in
    //  semicerchio: fino a un attimo prima erano gente che aspetta. Da qui in
    //  poi comanda la scena — vedi `avviaConcerto`.
    avviaConcerto();
  }
}


//  DALLA PORTA AL PROSCENIO — chi e' stato consegnato cammina fino al posto
//  dove aspetta. Stessa rotta e stesso passo degli altri personaggi, ma senza
//  fretta: e' gente che entra in sala e si cerca un posto.
//  Se in `CONSEGNA_MAX` secondi non e' arrivato (un corpo che si pianta, una
//  rotta che non c'e') si mette al posto suo: e' la rete, non il caso normale.
const CONSEGNA_PASSO = 62;     // px/s: la meta' del giocatore, si passeggia
const CONSEGNA_MAX = 12;
function muoviConsegnati(dt) {
  for (const p of pezzi) {
    if (!p.consegnato || !p.meta) continue;
    const m = p.meta;
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d <= 2 || tempo - p.metaDa > CONSEGNA_MAX) {
      p.x = m.x; p.y = m.y; p.meta = null; continue;
    }
    const b = rottaVerso(p, m, p.r * 0.75, 12, undefined, p.r * 0.75) || m;
    p.bx = b.x; p.by = b.y;
    avvicina(p, Math.min(d, CONSEGNA_PASSO * dt));
  }
}


// =============================================================================
//  DISEGNO — vettoriale
// =============================================================================
const C = {
  fondo: '#0b0d10', muro: '#171a20', corridoio: '#232830', stanza: '#2b313a',
  coperta: '#181c22', raccolta: '#252b34', bordo: '#3a424e',
  giocatore: '#e9e3d2', inseguitore: '#d4443c', sguardo: '#5fb0e0',
  //  Alba e' rosa acceso, ma il rosa non porta nessuna informazione: la si
  //  riconosce dai raggi e dal fatto che e' la cosa piu' chiara sullo schermo.
  //  Il trombettista si riconosce dalla campana e dall'alone che si trascina.
  trombettista: '#c4673c', alba: '#f58fc0',
};
const COLORI_PEZZO = ['#c98a3e', '#5fb0e0', '#7d5fc0', '#3f9e7a', '#c25f8a'];
const COLORE_ESCA = '#8f9aa8';
const COLORI_AIUTO = { occlusione: '#8f7fd0', rivela: '#d0a83f' };
const COLORE_OGGETTO = '#b08a4e';

const colorePezzo = p => p.esca ? COLORE_ESCA
  : COLORI_PEZZO[CONFIG.pezzi.findIndex(x => x.id === p.id) % COLORI_PEZZO.length];

function cerchio(x, y, r, riempi, traccia, spessore) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (riempi) { ctx.fillStyle = riempi; ctx.fill(); }
  if (traccia) { ctx.strokeStyle = traccia; ctx.lineWidth = spessore || 2; ctx.stroke(); }
}

// -----------------------------------------------------------------------------
//  Disegnare una pianta ricalcata
// -----------------------------------------------------------------------------
//  La pianta di Avellino viene dal ricalco della foto, e ogni zona e' un elenco
//  di ANELLI — spezzate chiuse, il primo il contorno e gli altri i buchi. Le
//  porte non sono un angolo: sono i varchi che il ricalco ha lasciato aperti.
function tracciaAnelli(anelli) {
  ctx.beginPath();
  for (const anello of anelli) {
    if (!anello || anello.length < 3) continue;
    ctx.moveTo(anello[0][0], anello[0][1]);
    for (let i = 1; i < anello.length; i++) ctx.lineTo(anello[i][0], anello[i][1]);
    ctx.closePath();
  }
}

//  `sigilla`: due zone dello stesso colore che si toccano senza muro in mezzo
//  (il portico accanto al foyer e il fuori, divisi solo a meta' della grande
//  apertura bianca) lasciano fra i due bordi un filo di sfondo, perche'
//  l'antialias di ciascun riempimento copre il pixel di confine solo a meta'.
//  In gioco era una riga sottile parallela alla vetrata, scambiata per un
//  avanzo della parete curva. Segnalata da Gianluca il 23/09/2026. Un tratto
//  sottile dello stesso colore sul bordo la chiude; sborda di un terzo di
//  pixel nel muro, invisibile.
function riempiAnelli(anelli, colore, sigilla) {
  if (!anelli || !anelli.length) return;
  tracciaAnelli(anelli);
  ctx.fillStyle = colore; ctx.fill('evenodd');
  if (sigilla) { ctx.strokeStyle = colore; ctx.lineWidth = 0.6; ctx.lineJoin = 'round'; ctx.stroke(); }
}

function bordaAnelli(anelli, colore, spessore) {
  if (!anelli || !anelli.length) return;
  tracciaAnelli(anelli);
  ctx.strokeStyle = colore; ctx.lineWidth = spessore || 1; ctx.stroke();
}

const PAVIMENTI = {
  corridoio:  '#232830',
  cortile:    '#3c4046',   // pavimentato: grigio, non verde
  anfiteatro: '#252b34',
  aula:       '#2b313a',
  esterno:    '#4a6b4f',   // prato: il piu' chiaro di tutti, non solo il piu' verde
};

// Da dove entra la luce. Il cortile e' l'unico cielo aperto dentro l'edificio e
// vince su tutto: i suoi tre lati di corridoio e il lato di aule ricevono luce
// da li'. La zona `Esterno` e' il riempimento di tutto cio' che nella pianta non
// ha un nome — comprende i corridoi interni — quindi conta solo quando dall'altra
// parte c'e' una stanza vera, cioe' sulle finestre del perimetro.
//  L'asse della finestra e la sua normale, dall'inclinazione misurata sulla
//  pianta. Sette finestre su settantasette stanno su pareti oblique — la linea
//  curva che abbraccia il foyer — e disegnate diritte erano storte rispetto al
//  muro da cui nascono. `ang` e' in gradi, e per le altre settanta vale
//  esattamente 0 o 90: quelle non cambiano di un pixel.
function asseFinestra(m) {
  const a = (m.ang === undefined ? (m.dir === 'h' ? 0 : 90) : m.ang) * Math.PI / 180;
  return { rad: a, asse: { x: Math.cos(a), y: Math.sin(a) },
                  normale: { x: -Math.sin(a), y: Math.cos(a) } };
}

function versoLuceFinestra(m) {
  const normale = asseFinestra(m).normale;
  const opposto = { x: -normale.x, y: -normale.y };
  const a = zonaContenente(m.x + opposto.x * 18, m.y + opposto.y * 18);
  const b = zonaContenente(m.x + normale.x * 18, m.y + normale.y * 18);
  const cortile = z => z && z.tipo === 'cortile';
  const generico = z => z && z.nome === 'Esterno';
  if (cortile(a) && !cortile(b)) return normale;
  if (cortile(b) && !cortile(a)) return opposto;
  if (generico(a) && !generico(b)) return normale;
  if (generico(b) && !generico(a)) return opposto;
  return normale;
}

function disegnaFinestre() {
  if (!finestre) return;
  for (const f of finestre) {
    const m = f.mappa, r = f.respiro;
    const mezzo = m.larghezza / 2;
    const g = asseFinestra(m);
    const asse = g.asse;
    const normale = versoLuceFinestra(m);

    // Il vetro lascia passare la luce anche da chiuso: resta una macchia corta
    // appoggiata alla finestra. Aprendosi diventa il cuneo che si legge con la
    // coda dell'occhio. Le porte, che luce non ne fanno passare, non hanno nulla.
    const fondo = 26 + 78 * r;
    const laterale = m.larghezza * (0.30 + r * 0.43);
    const punta = { x: m.x + normale.x * fondo, y: m.y + normale.y * fondo };
    const grad = ctx.createLinearGradient(m.x, m.y, punta.x, punta.y);
    grad.addColorStop(0, `rgba(218,237,198,${0.085 + 0.115 * r})`);
    grad.addColorStop(1, 'rgba(218,237,198,0)');
    ctx.beginPath();
    ctx.moveTo(m.x - asse.x * mezzo, m.y - asse.y * mezzo);
    ctx.lineTo(m.x + asse.x * mezzo, m.y + asse.y * mezzo);
    ctx.lineTo(punta.x + asse.x * laterale, punta.y + asse.y * laterale);
    ctx.lineTo(punta.x - asse.x * laterale, punta.y - asse.y * laterale);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

    // Chiusa: una lente sottile, non un'icona sovrapposta. Aprendosi, la lente
    // si ritrae fino a lasciare soltanto due labbra arrotondate ai lati.
    const chiusa = 1 - r;
    if (chiusa > 0.015) {
      ctx.save(); ctx.translate(m.x, m.y);
      ctx.rotate(g.rad);
      ctx.beginPath();
      ctx.moveTo(-mezzo, 0);
      ctx.bezierCurveTo(-mezzo * 0.34, -4.4 * chiusa, mezzo * 0.34, -4.4 * chiusa, mezzo, 0);
      ctx.bezierCurveTo(mezzo * 0.34, 4.4 * chiusa, -mezzo * 0.34, 4.4 * chiusa, -mezzo, 0);
      ctx.closePath();
      ctx.fillStyle = `rgba(122,160,168,${0.34 * chiusa})`; ctx.fill();
      ctx.strokeStyle = `rgba(178,208,208,${0.58 * chiusa})`; ctx.lineWidth = 0.85; ctx.stroke();
      ctx.restore();
    }
    // Stesso colore del contorno della mandorla: il colore dice soltanto
    // «questa e' una finestra». Aperta o chiusa lo dicono la forma — due cerchi
    // contro una mandorla — e la lunghezza della luce, non la tinta.
    if (r > 0.08) {
      const labbro = 2.2 + r * 1.4;
      for (const segno of [-1, 1]) {
        const x = m.x + asse.x * mezzo * segno, y = m.y + asse.y * mezzo * segno;
        cerchio(x, y, labbro, C.muro, 'rgba(178,208,208,.72)', 0.8);
      }
    }
  }
}

function disegna() {
  // la pausa e la schermata finale si disegnano fuori di qui, a schermo intero:
  // la trasformazione deve essere chiusa prima di uscire da questa funzione
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = C.fondo; ctx.fillRect(0, 0, cv.width, cv.height);

  aggiornaCamera();
  ctx.save();
  ctx.scale(zoomVista, zoomVista);
  ctx.translate(-camera.x, -camera.y);

  // Il muro e' tutto cio' che non e' pavimento: si annerisce il mondo intero e
  // poi si ritaglia dentro l'impronta dell'edificio.
  ctx.fillStyle = C.muro;
  ctx.fillRect(0, 0, MONDO_L, MONDO_A);
  riempiAnelli([...PAVIMENTO.contorno, ...PAVIMENTO.buchi], C.corridoio);

  for (const z of ZONE) {
    if (z.tipo === 'aula' || z.tipo === 'anfiteatro') continue;
    riempiAnelli(z.anelli, PAVIMENTI[z.tipo] || C.corridoio, true);
    if (z.scorciatoia) bordaAnelli(z.anelli, 'rgba(87,179,127,.35)', 1.4);
  }

  disegnaRaccolta();
  stanze.forEach(disegnaStanza);
  BAGNI.forEach(disegnaBagno);
  disegnaFinestre();

  for (const o of oggetti) if (!o.preso && !o.portato) disegnaOggetto(o);
  for (const a of aiuti) if (aiutoVisibile(a)) disegnaAiuto(a);
  for (const p of pezzi) disegnaPezzo(p);

  disegnaTrombettista();
  disegnaAlba();
  if (inseguitore.inGioco) disegnaInseguitore();
  disegnaColloquio();
  disegnaGiocatore();

  ctx.restore();
  //  Di notte il buio resta anche mentre Aluzzi ti porta via; si toglie
  //  solo per il concerto, che e' una festa.
  if (notte && !(scena && scena.tipo === 'concerto')) disegnaBuio();

  //  Fuori dalla trasformazione del mondo: la mini-mappa non e' una cosa che
  //  sta nel palazzo, e' uno schermo davanti agli occhi.
  disegnaMiniMappa();
}


// -----------------------------------------------------------------------------
//  IL BUIO DELLA NOTTE
// -----------------------------------------------------------------------------
//  Un velo nero su tutto lo schermo, bucato dove arriva la torcia: un cono
//  davanti a te nella direzione dello sguardo, e un po' di luce intorno ai
//  piedi. Il cono e' sei strati di apertura diversa, cosi' i bordi sfumano.
//  La luce passa i muri: in un prototipo basta, e i pezzi non si vedono
//  comunque — si sentono.
//  La mini-mappa del laptop si disegna dopo, sopra il buio: e' uno schermo.
// -----------------------------------------------------------------------------
//  La torcia non segue lo sguardo di colpo: con la tastiera lo sguardo salta
//  di 45 o 90 gradi, e il cono che scatta con lui rende la notte ingiocabile.
//  Qui gira verso lo sguardo per la via piu' corta, morbida (`T.morbidezza`
//  secondi per fare quasi tutto il giro), come si gira una torcia in mano.
//  L'angolo sta su chi porta la torcia, cosi' ogni partita nuova riparte dritta.
//
//  Di notte hanno una torcia anche Aluzzi e Alba (Gianluca, 25/09): nessuno
//  gira al buio, e il fascio che spunta da un angolo dice che stanno
//  arrivando prima di vederli. Piu' corta della tua, e colorata come loro.
//  Il trombettista no: ha le mani sullo strumento, e vaga al buio.
//  Il loro fascio segue il verso in cui camminano, non uno sguardo.
let veloBuio = null, oraTorcia = 0;
function angoloTorcia(e, meta, dt, morbidezza) {
  if (e.angTorcia === undefined || dt <= 0) return (e.angTorcia = meta);
  let d = meta - e.angTorcia;
  d = Math.atan2(Math.sin(d), Math.cos(d));          // la via piu' corta
  e.angTorcia += d * (1 - Math.exp(-dt / morbidezza));
  return e.angTorcia;
}
//  Verso di marcia di un personaggio, dallo spostamento fra un fotogramma e
//  l'altro: fermo, tiene l'ultimo.
function versoDiMarcia(e) {
  if (e.lx !== undefined) {
    const dx = e.x - e.lx, dy = e.y - e.ly;
    if (Math.hypot(dx, dy) > 0.2) e.marcia = Math.atan2(dy, dx);
  }
  e.lx = e.x; e.ly = e.y;
  return e.marcia ?? (e.dirx !== undefined ? Math.atan2(e.diry, e.dirx) : Math.PI / 2);
}
//  Chi porta una torcia, adesso: tu sempre, loro solo se sono in giro.
function torceAccese(dt) {
  const T = NOTTE.torcia, g = giocatore, P = NOTTE.torcePersonaggi;
  const out = [{ e: g, T, ang: angoloTorcia(g, Math.atan2(g.diry, g.dirx), dt, T.morbidezza) }];
  const loro = [[inseguitore, C.inseguitore], [alba, C.alba]];
  for (const [e, colore] of loro) {
    if (!e || !e.inGioco) continue;
    out.push({ e, T: P, colore, ang: angoloTorcia(e, versoDiMarcia(e), dt, P.morbidezza) });
  }
  return out;
}
function conoTorcia(b, x, y, R, ang, apertura, riempi) {
  for (const largo of [1.35, 1.18, 1, 0.84, 0.7, 0.56]) {
    b.fillStyle = riempi(x, y, R);
    b.beginPath(); b.moveTo(x, y);
    b.arc(x, y, R, ang - apertura / 2 * largo, ang + apertura / 2 * largo);
    b.closePath(); b.fill();
  }
}
function sfumato(b, colore, forza) {
  return (x, y, R) => {
    const sf = b.createRadialGradient(x, y, 0, x, y, R);
    sf.addColorStop(0, colore(forza));
    sf.addColorStop(0.55, colore(forza * 0.8));
    sf.addColorStop(1, colore(0));
    return sf;
  };
}
//  LE OMBRE (Gianluca, 25/09). Ogni torcia lancia un ventaglio di raggi: un
//  raggio si ferma sul primo muro, mobile o persona che incontra, e il cono si
//  disegna solo dentro il poligono dei punti d'arrivo. Dietro le cose resta
//  buio, e l'ombra gira con la torcia.
//  Il raggio attraversa la cosa che colpisce e si ferma sul suo lato lontano
//  (piu' `dentro` px): se si fermasse sulla superficie, il pianoforte stesso
//  resterebbe nero e si vedrebbe solo la sua ombra.
//  I muri si leggono dalla griglia della mappa, a passi di mezza cella.
let ostacoliArredi = null;
function arrediPerOmbre() {
  if (ostacoliArredi) return ostacoliArredi;
  ostacoliArredi = [];
  for (const g of AULE) for (const o of ARREDI.ingombri(g)) {
    const b = o.tipo === 'cerchio'
      ? [o.centro.x - o.r, o.centro.y - o.r, o.centro.x + o.r, o.centro.y + o.r]
      : [Math.min(...o.punti.map(p => p.x)), Math.min(...o.punti.map(p => p.y)), Math.max(...o.punti.map(p => p.x)), Math.max(...o.punti.map(p => p.y))];
    ostacoliArredi.push({ ...o, b });
  }
  return ostacoliArredi;
}
function ostacoliVicini(e, R) {
  const x = e.x, y = e.y, out = [];
  for (const o of arrediPerOmbre()) {
    if (o.b[2] < x - R || o.b[0] > x + R || o.b[3] < y - R || o.b[1] > y + R) continue;
    if (x >= o.b[0] && x <= o.b[2] && y >= o.b[1] && y <= o.b[3]) continue;   // ci sta dentro chi fa luce
    out.push(o);
  }
  const corpi = [giocatore, inseguitore, alba, trombettista, ...pezzi.filter(p => !p.portato)];
  for (const c of corpi) {
    if (!c || c === e || (c.inGioco === false) || Math.hypot(c.x - x, c.y - y) > R + 12) continue;
    out.push({ tipo: 'cerchio', centro: c, r: c.r || 6, persona: true });
  }
  return out;
}
function lunghezzaRaggio(x, y, ux, uy, R, ostacoli) {
  const O = NOTTE.ombre;
  let d = R;
  for (const o of ostacoli) {
    if (o.tipo === 'cerchio') {
      const cx = o.centro.x - x, cy = o.centro.y - y, t = cx * ux + cy * uy;
      if (t <= 0) continue;
      const q = cx * cx + cy * cy - t * t;
      if (q > o.r * o.r) continue;
      const w = Math.sqrt(o.r * o.r - q);
      if (t - w > 0 && t - w < d) d = t + w + O.dentro;
      continue;
    }
    //  entra e esce: la luce arriva fino al lato lontano del mobile
    const P = o.punti;
    let tin = Infinity, tout = 0;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const ex = P[i].x - P[j].x, ey = P[i].y - P[j].y;
      const den = ux * ey - uy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const wx = P[j].x - x, wy = P[j].y - y;
      const t = (wx * ey - wy * ex) / den, u = (wx * uy - wy * ux) / den;
      if (t > 0 && u >= 0 && u <= 1) { tin = Math.min(tin, t); tout = Math.max(tout, t); }
    }
    if (tin < d) d = tout + O.dentro;
  }
  const passo = CELLA / 2;
  for (let t = passo * 2; t < d; t += passo)
    if (!camminabile(x + ux * t, y + uy * t)) { d = sulMuro(x, y, ux, uy, t) + O.dentroMuro; break; }
  return d;
}
//  LA GRIGLIA E' A SCALINI, IL MURO NO. Il muro si trova sulla griglia (celle
//  di 3 px), ma fermarsi li' dentella ogni parete in diagonale: le stesse
//  scalette che si erano tolte dal disegno dei muri (segnalato da Gianluca,
//  25/09). Trovato il muro, si cerca vicino la linea vera del pavimento e ci
//  si ferma su quella. Se non c'e' una linea vicina, resta la griglia.
let lineeMuro = null;
const SECCHIO = 48;
function lineeVicine(x, y) {
  if (!lineeMuro) {
    lineeMuro = new Map();
    const anelli = [...PAVIMENTO.contorno, ...PAVIMENTO.buchi, ...ZONE.flatMap(z => z.anelli || [])];
    for (const a of anelli) {
      if (!a || a.length < 2) continue;
      for (let i = 0; i < a.length; i++) {
        const p = a[i], q = a[(i + 1) % a.length];
        const seg = [p[0], p[1], q[0], q[1]];
        const c0 = Math.floor(Math.min(p[0], q[0]) / SECCHIO), c1 = Math.floor(Math.max(p[0], q[0]) / SECCHIO);
        const r0 = Math.floor(Math.min(p[1], q[1]) / SECCHIO), r1 = Math.floor(Math.max(p[1], q[1]) / SECCHIO);
        for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) {
          const k = c + ',' + r;
          if (!lineeMuro.has(k)) lineeMuro.set(k, []);
          lineeMuro.get(k).push(seg);
        }
      }
    }
  }
  //  anche i secchi accanto: il punto trovato sulla griglia puo' stare di
  //  qua dal confine e la linea di la'
  const out = new Set();
  for (const dx of [-8, 8]) for (const dy of [-8, 8])
    for (const seg of lineeMuro.get(Math.floor((x + dx) / SECCHIO) + ',' + Math.floor((y + dy) / SECCHIO)) || []) out.add(seg);
  return out;
}
function sulMuro(x, y, ux, uy, tg) {
  const hx = x + ux * tg, hy = y + uy * tg;
  let meglio = tg, scarto = CELLA * 2.5;
  for (const [ax, ay, bx, by] of lineeVicine(hx, hy)) {
    const ex = bx - ax, ey = by - ay, den = ux * ey - uy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const wx = ax - x, wy = ay - y;
    const t = (wx * ey - wy * ex) / den, u = (wx * uy - wy * ux) / den;
    if (u < -0.01 || u > 1.01 || Math.abs(t - tg) >= scarto) continue;
    scarto = Math.abs(t - tg); meglio = t;
  }
  return meglio;
}
//  Il poligono illuminato, in coordinate dello schermo.
function poligonoLuce(e, ang, R, apertura) {
  const O = NOTTE.ombre, ost = ostacoliVicini(e, R), z = zoomVista;
  const meta = apertura * 0.68, n = O.raggi, pts = [];
  const sx = (e.x - camera.x) * z, sy = (e.y - camera.y) * z;
  pts.push([sx, sy]);
  for (let k = 0; k <= n; k++) {
    const a = ang - meta + 2 * meta * k / n, ux = Math.cos(a), uy = Math.sin(a);
    const d = lunghezzaRaggio(e.x, e.y, ux, uy, R, ost);
    pts.push([sx + ux * d * z, sy + uy * d * z]);
  }
  return pts;
}
function ritaglia(b, pts) {
  b.beginPath(); b.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) b.lineTo(pts[i][0], pts[i][1]);
  b.closePath(); b.clip();
}

const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;

//  Le soglie, calcolate una volta: TUTTI i passaggi di ogni stanza — verso
//  il corridoio, verso fuori e verso l'aula accanto (Gianluca 25/09: «su
//  tutte le porte e tutti i passaggi comunicanti»). Si scorre la griglia:
//  dove una cella di stanza tocca una cella camminabile d'altro tipo, li'
//  c'e' un pezzo di soglia, a meta' fra le due. I pezzi vicini fanno una
//  porta; ogni porta diventa il segmento fra i suoi due punti piu' lontani.
//  Le finestre non contano: sono varchi, non porte, e la striscia le
//  farebbe sembrare ingressi.
let SOGLIE_NOTTE = null;
function soglieNotte() {
  if (SOGLIE_NOTTE) return SOGLIE_NOTTE;
  const inFinestra = new Set(FINESTRE.flatMap(f => f.celle));
  //  Stanze sono le aule, la gradinata e i locali con un nome (bagni, caffe',
  //  palcoscenico, scale, ingresso, uscita); non i corridoi generici.
  const stanza = z => z && (z.tipo === 'aula' || z.tipo === 'anfiteatro'
    || (z.tipo === 'corridoio' && !/^corridoi/i.test(z.nome)));
  const oltre = z => !z || ['corridoio', 'esterno', 'aula', 'anfiteatro'].includes(z.tipo);
  const pezzi = [];
  for (let r = 0; r < ALT; r++)
    for (let c = 0; c < LARG; c++) {
      const k = r * LARG + c, i = CELLE[k];
      if (i <= 0 || !stanza(ZONE[i - 1])) continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c2 = c + dc, r2 = r + dr;
        if (c2 < 0 || r2 < 0 || c2 >= LARG || r2 >= ALT) continue;
        const k2 = r2 * LARG + c2, v = CELLE[k2];
        if (v < 0 || v === i || inFinestra.has(k2)) continue;
        const z2 = v === 0 ? null : ZONE[v - 1];
        if (!oltre(z2)) continue;
        //  fra due stanze il passaggio si conta una volta sola
        if (stanza(z2) && v < i) continue;
        pezzi.push({ x: (c + 0.5 + dc / 2) * CELLA, y: (r + 0.5 + dr / 2) * CELLA });
      }
    }
  //  porte: pezzi contigui, uniti come in `portaPiuLarga`
  const porte = [];
  for (const q of pezzi) {
    const vic = porte.filter(g => g.some(a => Math.abs(a.x - q.x) <= CELLA * 1.5
                                           && Math.abs(a.y - q.y) <= CELLA * 1.5));
    if (!vic.length) { porte.push([q]); continue; }
    vic[0].push(q);
    for (const g of vic.slice(1)) { vic[0].push(...g); porte.splice(porte.indexOf(g), 1); }
  }
  SOGLIE_NOTTE = [];
  for (const g of porte) {
    if (g.length < 3) continue;               // briciole del ricalco
    let m = [g[0], g[0]], d = -1;
    for (const a of g) for (const c of g) {
      const e = Math.hypot(a.x - c.x, a.y - c.y);
      if (e > d) { d = e; m = [a, c]; }
    }
    //  oltre questa misura non e' una porta, e' uno spazio aperto
    if (d > NOTTE.soglie.massima || d < 10) continue;   // sotto i 10 px e' un'altra briciola
    SOGLIE_NOTTE.push([m[0].x, m[0].y, m[1].x, m[1].y]);
  }
  return SOGLIE_NOTTE;
}

function disegnaBuio() {
  if (!veloBuio || veloBuio.width !== cv.width || veloBuio.height !== cv.height) {
    veloBuio = document.createElement('canvas');
    veloBuio.width = cv.width; veloBuio.height = cv.height;
  }
  const ora = performance.now() / 1000, dt = Math.min(0.1, ora - oraTorcia);
  oraTorcia = ora;
  const b = veloBuio.getContext('2d'), z = zoomVista;
  const torce = torceAccese(dt);
  b.globalCompositeOperation = 'source-over';
  b.clearRect(0, 0, cv.width, cv.height);
  //  Presi di notte con l'allarme: il lampo rosso solleva il buio a colpi.
  const allarme = scena && NOTTE.cattura === 'allarme';
  const lampo = allarme ? Math.pow(Math.max(0, Math.sin(ora * Math.PI * 2 * NOTTE.allarme.lampi)), 2) : 0;
  b.fillStyle = `rgba(0,0,0,${NOTTE.buio * (1 - NOTTE.allarme.schiarisce * lampo)})`;
  b.fillRect(0, 0, cv.width, cv.height);

  //  il velo si buca dove arriva ogni torcia
  b.globalCompositeOperation = 'destination-out';
  for (const t of torce) {
    const { e, T, ang } = t;
    const x = (e.x - camera.x) * z, y = (e.y - camera.y) * z;
    t.luce = poligonoLuce(e, ang, T.lunghezza, T.apertura);
    b.save(); ritaglia(b, t.luce);
    conoTorcia(b, x, y, T.lunghezza * z, ang, T.apertura, sfumato(b, a => `rgba(0,0,0,${a})`, 0.32));
    b.restore();
    const A = T.alone * z, pd = b.createRadialGradient(x, y, 0, x, y, A);
    pd.addColorStop(0, 'rgba(0,0,0,1)'); pd.addColorStop(1, 'rgba(0,0,0,0)');
    b.fillStyle = pd;
    b.beginPath(); b.arc(x, y, A, 0, Math.PI * 2); b.fill();
  }
  //  le strisce di luce sulle soglie delle aule
  b.save();
  b.setTransform(z, 0, 0, z, -camera.x * z, -camera.y * z);
  b.lineCap = 'round';
  for (const [x1, y1, x2, y2] of soglieNotte()) {
    for (const [largo, a] of [[NOTTE.soglie.largo * 2.6, 0.35], [NOTTE.soglie.largo, 1]]) {
      b.strokeStyle = `rgba(0,0,0,${NOTTE.soglie.luce * a})`;
      b.lineWidth = largo;
      b.beginPath(); b.moveTo(x1, y1); b.lineTo(x2, y2); b.stroke();
    }
  }
  b.restore();

  //  Le aule accese: dove hai trovato un musicista (Gianluca 25/09: la luce
  //  la vedi solo entrando, da fuori l'aula resta buia) e, se ti prendono,
  //  la regia dove ti stanno portando (anche con l'allarme: Gianluca 25/09,
  //  «tieni comunque la regia illuminata»).
  const accese = stanze.filter(s => s.musicista && s.scoperta)
                       .map(s => [s.indice, NOTTE.auleAccese]);
  if (scena && scena.tipo !== 'concerto' && regia >= 0) accese.push([regia, NOTTE.regiaAccesa]);
  if (accese.length) {
    b.save();
    b.setTransform(z, 0, 0, z, -camera.x * z, -camera.y * z);
    for (const [i, luce] of accese) {
      b.fillStyle = `rgba(0,0,0,${luce})`;
      b.beginPath();
      for (const an of AULE[i].anelli) {
        if (!an || an.length < 3) continue;
        b.moveTo(an[0][0], an[0][1]);
        for (let k = 1; k < an.length; k++) b.lineTo(an[k][0], an[k][1]);
        b.closePath();
      }
      b.fill('evenodd');
    }
    b.restore();
  }
  ctx.drawImage(veloBuio, 0, 0);
  if (lampo > 0) {
    ctx.fillStyle = `rgba(210,30,30,${NOTTE.allarme.rosso * lampo})`;
    ctx.fillRect(0, 0, cv.width, cv.height);
  }

  //  e sopra, il colore delle torce di Aluzzi e Alba
  for (const { e, T, ang, colore, luce } of torce) {
    if (!colore) continue;
    const x = (e.x - camera.x) * z, y = (e.y - camera.y) * z;
    ctx.save(); ritaglia(ctx, luce);
    conoTorcia(ctx, x, y, T.lunghezza * z, ang, T.apertura, sfumato(ctx, a => rgba(colore, a), T.colore));
    ctx.restore();
  }
}


// -----------------------------------------------------------------------------
//  LA MINI-MAPPA DEL LAPTOP
// -----------------------------------------------------------------------------
//  L'aiuto `rivela` non e' piu' il cerchietto che pulsa sul musicista piu'
//  vicino: e' la pianta del palazzo su uno schermo, aperta per 3,2 secondi.
//
//  IL VELO ACCECA. Per quei tre secondi il gioco sotto sparisce — ma non si
//  ferma: l'inseguitore cammina e da qui in avanti lo senti soltanto. E' il
//  doppio taglio, ed e' simmetrico a quello delle cuffie: il laptop ti toglie
//  gli occhi come le cuffie ti tolgono le orecchie. Guardare la mappa e' una
//  decisione, non un regalo.
//
//  Sempre la stessa inquadratura, tutta la pianta. A questa scala non si legge
//  QUALE aula: si legge la zona. La zona la da' la mappa, la stanza la danno le
//  orecchie.
//
//  ⚠️ I SETTE PALLINI SONO UNA FOTOGRAFIA DELL'INIZIO DELLA PARTITA.
//  Deciso da Gianluca il 13/09/2026. La mappa non dice dove sono i musicisti
//  adesso: dice dove stavano quando la partita e' cominciata. Si disegnano da
//  `p.x0, p.y0`, congelati alla nascita, e non si muovono mai — ne' dentro la
//  stessa apertura, ne' fra un'apertura e l'altra. E' per questo che i pezzi
//  conquistati, che nel mondo camminano dietro di te sulla scia, qui restano
//  fermi dove li hai trovati: cosi' non si ammucchiano sul tuo segno e la
//  mappa non diventa un tabellone che dice a che punto sei.
//
//  L'UNICO SEGNO LETTO DAL VIVO SEI TU. Gli altri sono sette pallini
//  identici — cinque richiesti e due esche, indistinguibili, e ci sono sempre
//  tutti e sette anche quelli gia' conquistati: parole di Gianluca,
//  «altrimenti e' troppo facile».
//
//  IL SEGNO DEL GIOCATORE si riconosce in quattro modi insieme, e nessuno dei
//  quattro e' il colore da solo: e' piu' GROSSO, ha un ANELLO intorno, ha il
//  TRATTINO dello sguardo, ed e' l'unica cosa AZZURRA su una pianta tutta
//  bianca e grigia. Chiesto da Gianluca il 13/09 — «il pallino del voi siete
//  qui». L'azzurro e' lo stesso dello sguardo nel gioco (`C.sguardo`): il
//  rosso su questo grigio si spegnerebbe, l'azzurro regge anche a chi
//  confonde rosso e verde.
// -----------------------------------------------------------------------------
function disegnaMiniMappa() {
  if (!laptop.fino) return;
  const R = CONFIG.aiuti.rivela;

  //  La busta: 0,25 s di salita, 2,45 s di tenuta, 0,5 s di discesa. La
  //  discesa e' essa stessa informazione — «sta andando via, guarda adesso».
  const a = Math.max(0, Math.min(1,
                     (tempo - laptop.aperto) / R.salita,
                     (laptop.fino - tempo) / R.discesa));
  if (a <= 0) return;

  const MARGINE = 26;
  const s = Math.min((cv.width  - MARGINE * 2) / MONDO_L,
                     (cv.height - MARGINE * 2) / MONDO_A);
  const px = 1 / s;                       // un pixel di schermo, in unita' di mondo

  ctx.save();
  ctx.globalAlpha = a;

  // il velo: quasi opaco, perche' deve accecare davvero
  ctx.fillStyle = '#07090c';
  ctx.fillRect(0, 0, cv.width, cv.height);

  ctx.translate((cv.width - MONDO_L * s) / 2, (cv.height - MONDO_A * s) / 2);
  ctx.scale(s, s);

  //  La pianta: il pavimento chiaro, i due cortili e il prato scavati dentro.
  //  Sono i vuoti a dare all'edificio la sua forma — senza di loro resta un
  //  rettangolo, perche' il contorno del ricalco e' il mondo intero.
  const impronta = [...PAVIMENTO.contorno, ...PAVIMENTO.buchi];
  riempiAnelli(impronta, '#39424e');
  for (const z of ZONE) {
    if (z.tipo === 'cortile' || z.tipo === 'esterno') riempiAnelli(z.anelli, '#10131a', true);
  }
  //  Si borda solo il PROFILO dell'edificio, cioe' i buchi del ricalco: il
  //  `contorno` e' il rettangolo del mondo intero e tracciarlo disegnerebbe
  //  una cornice che nel palazzo non esiste.
  bordaAnelli(PAVIMENTO.buchi, '#7d8b9c', px * 1.2);

  // i sette, fermi all'inizio della partita
  for (const p of pezzi) cerchio(p.x0, p.y0, px * 4.5, '#e8edf3');

  //  Tu, adesso. Resta letto dal vivo di proposito: per quei tre secondi sei
  //  cieco, e questo e' l'unico segno che ti dice se ti stai muovendo e da che
  //  parte guardi. Congelarlo spegnerebbe la mappa appena fai un passo.
  const g = giocatore;
  const AZZURRO = C.sguardo;
  cerchio(g.x, g.y, px * 11, null, AZZURRO + '55', px * 1.4);   // l'alone
  cerchio(g.x, g.y, px * 7,  AZZURRO, '#07090c', px * 1.6);     // il pallino, staccato dal fondo
  const n = Math.hypot(g.dirx, g.diry) || 1;
  ctx.strokeStyle = AZZURRO; ctx.lineWidth = px * 2.6;
  ctx.beginPath();
  ctx.moveTo(g.x + g.dirx / n * px * 8,  g.y + g.diry / n * px * 8);
  ctx.lineTo(g.x + g.dirx / n * px * 19, g.y + g.diry / n * px * 19);
  ctx.stroke();

  ctx.restore();
}

// Il punto di raccolta e' la GRADINATA SCOPERTA, in cima alla mappa: si
// riconosce da lontano dalle file di gradini, righe parallele dentro la sua
// sagoma, tagliate dal clip.
function disegnaRaccolta() {
  if (!RACCOLTA) return;
  riempiAnelli(RACCOLTA.anelli, C.raccolta);

  ctx.save();
  tracciaAnelli(RACCOLTA.anelli);
  ctx.clip('evenodd');
  ctx.strokeStyle = 'rgba(90,102,118,.30)'; ctx.lineWidth = 1.2;
  // Le file dell'anfiteatro sono un ventaglio, non righe: archi concentrici
  // intorno al centro ricalcato in mappa.js (punto 4 di avellino-gioco.md).
  // Il clip sopra le ritaglia gia' alla sagoma vera della zona.
  if (RACCOLTA.gradinate) {
    const { centro: gc, raggi: [rMin, rMax] } = RACCOLTA.gradinate;
    for (let r = rMin; r <= rMax; r += 12) {
      ctx.beginPath();
      ctx.arc(gc.x, gc.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();

  bordaAnelli(RACCOLTA.anelli, consegnati ? '#57b37f' : C.bordo, consegnati ? 1.8 : 1);
}

function disegnaStanza(s) {
  const g = AULE[s.indice];
  const c = centroAula(s.indice);
  //  La regia non ha coperchio: si vede dentro fin dal primo secondo. Non e' un
  //  posto da scoprire, e' la tana di Aluzzi — e li' dentro non ci va nessun
  //  musicista, quindi mostrarla non toglie niente a nessuno. Si riconoscera'
  //  dagli arredi invece che dal buio. Deciso il 13/09/2026.
  //  Scoperta, l'aula mostra pavimento, mobili e luci (`js/arredi.js`).
  if (s.scoperta || s.indice === regia) ARREDI.disegna(ctx, g);
  else riempiAnelli(g.anelli, C.coperta);
  bordaAnelli(g.anelli, C.bordo, 1);
  //  La regia non ha il punto interrogativo delle altre stanze: non e' un
  //  posto da esplorare, e' dove finisci se ti prendono: la si riconosce dal
  //  mixer e dal registratore a bobine, non da un simbolo.
  if (!s.scoperta && s.indice !== regia) {
    ctx.fillStyle = '#39414d'; ctx.font = '600 16px -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('?', c.x, c.y + 6); ctx.textAlign = 'left';
  }
}

//  Il bagno e' aperto solo mentre ci sei dentro: uscito, torna coperto e col
//  punto interrogativo, uguale a un'aula mai vista.
function disegnaBagno(z, i) {
  const dentro = i === bagnoCorrente;
  if (dentro) ARREDI.disegna(ctx, z);        // cabine, lavabi, piastrelle (`js/arredi.js`)
  else riempiAnelli(z.anelli, C.coperta);
  bordaAnelli(z.anelli, C.bordo, 1);
  if (!dentro) {
    ctx.fillStyle = '#39414d'; ctx.font = '600 16px -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('?', z.centro.x, z.centro.y + 6); ctx.textAlign = 'left';
  }
}

//  Un pezzo si vede solo dopo che si e' entrati nella sua stanza: prima si
//  trova a orecchio, e non c'e' nessun altro modo. Le esche si disegnano
//  identiche ai pezzi — l'occhio non le distingue, ed e' il punto.
function disegnaPezzo(p) {
  //  Il laptop non rende piu' visibile nessuno nel mondo: dice la ZONA sulla
  //  pianta, e la stanza te la danno le orecchie. E' la divisione del lavoro
  //  di tutto il gioco, e qui vale anche per l'aiuto.
  const visibile = p.consegnato || p.conquistato ||
                   (p.stanza !== undefined && stanze[p.stanza] && stanze[p.stanza].scoperta);
  if (!visibile) return;
  const col = colorePezzo(p);
  const s = audio.sorgenti ? audio.sorgenti[p.id] : null;
  const liv = s ? s.livello : 0;

  const R = 26;
  const alone = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, R);
  alone.addColorStop(0, col + Math.round(80 * liv + 26).toString(16).padStart(2, '0'));
  alone.addColorStop(1, col + '00');
  cerchio(p.x, p.y, R, alone);

  cerchio(p.x, p.y, 7, col);
  if (p.consegnato) cerchio(p.x, p.y, 11, null, '#57b37f', 1.6);
  else if (p.conquistato) cerchio(p.x, p.y, 10, null, col + 'aa', 1.2);

  // il pezzo che chiede una prova, quando la prova e' gia' stata scoperta
  if (chiedeOggetto(p)) disegnaRichiesta(p);
}

//  Quando un musicista sta ancora aspettando il suo oggetto. Vale per il
//  disegno nel mondo e per la riga sul foglio: una condizione sola, cosi' le
//  due cose non possono discordare.
const chiedeOggetto = p =>
  !!p.oggetto && p.scoperto && !p.conquistato && !p.consegnato;

//  Quello che il musicista chiede, disegnato sopra di lui.
//
//  Prima c'era un rettangolino vuoto, uguale per tutti e tre: diceva «chiede
//  qualcosa», non «chiede questo». Ora e' la sagoma dell'oggetto vero, la
//  stessa che si incontra nei corridoi — chi l'ha vista una volta la riconosce
//  senza impararla due volte, ed e' una FORMA, non un colore.
//
//  Il metronomo si disegna col pendolo appena storto e fermo: storto perche'
//  e' il pendolo di traverso a renderlo riconoscibile, fermo perche' qui non
//  e' un oggetto che suona, e' una richiesta scritta sopra una testa.
function disegnaRichiesta(p) {
  const forma = SAGOMA_OGGETTO[p.oggetto];
  if (!forma) return;
  const y = p.y - 25 - Math.sin(tempo * 2.2) * 1.5;     // galleggia appena
  if (forma === 'metronomo')
    SAGOME.metronomo(ctx, p.x, y, LATO_RICHIESTA, COLORE_OGGETTO, 0.12, 1);
  else
    SAGOME[forma](ctx, p.x, y, LATO_RICHIESTA, COLORE_OGGETTO);
}

//  I tre oggetti della prova hanno un nome vero anche se il file no: il nome
//  entra nel disegno, non nel .wav. L'ordine e' quello di CONFIG.oggetti.
const SAGOMA_OGGETTO = {
  oggetto_prova_01: 'diapason',
  oggetto_prova_02: 'metronomo',
  oggetto_prova_03: 'partiture',
};

//  Gli stessi tre nomi come si scrivono sul foglio del direttore, articolo
//  compreso: la riga dice «chiede il diapason», «chiede le partiture».
const NOME_OGGETTO = {
  oggetto_prova_01: 'il diapason',
  oggetto_prova_02: 'il metronomo',
  oggetto_prova_03: 'le partiture',
};

//  I due rimedi: le cuffie tolgono l'orecchio, il computer di Savarese mostra
//  la mappa. Sono tutti e due una forma, non un colore.
const SAGOMA_AIUTO = { occlusione: 'cuffie', rivela: 'laptop' };

const LATO_OGGETTO = 22;
//  Sopra la testa di un musicista l'oggetto e' un'etichetta, non una cosa da
//  raccogliere: piu' piccolo, cosi' non si confonde con l'oggetto vero che
//  sta nei corridoi.
const LATO_RICHIESTA = 16;

function disegnaOggetto(o) {
  const s = audio.sorgenti ? audio.sorgenti[o.id] : null;
  const acceso = s && s.sveglio;
  const forma = SAGOMA_OGGETTO[o.id];
  const col = acceso ? COLORE_OGGETTO : 'rgba(176,138,78,.35)';
  if (forma === 'metronomo') {
    // dormiente dondola piano, sveglio batte: si riconosce a orecchio spento
    SAGOME.metronomo(ctx, o.x, o.y, LATO_OGGETTO, col, tempo, acceso ? 2.2 : 0.7);
  } else if (forma) {
    SAGOME[forma](ctx, o.x, o.y, LATO_OGGETTO, col);
  } else {
    ctx.fillStyle = col; ctx.fillRect(o.x - 4, o.y - 4, 8, 8);
  }
  if (acceso) cerchio(o.x, o.y, 16 + Math.sin(tempo * 5) * 2, null, COLORE_OGGETTO + '99', 1.2);
}

//  Ogni aiuto ha la sua sagoma: da quando sono due, cuffie e laptop, non
//  esiste piu' un aiuto senza forma e non serve piu' il quadretto di traverso
//  che facevano da ripiego.
//  Un aiuto si vede solo dopo che si e' aperta la sua aula, esattamente come un
//  musicista: sta sotto il coperchio della stanza, e disegnarlo sopra lo
//  tradirebbe da mezza mappa di distanza.
const aiutoVisibile = a =>
  !a.preso && a.stanza >= 0 && stanze[a.stanza] && stanze[a.stanza].scoperta;

function disegnaAiuto(a) {
  SAGOME[SAGOMA_AIUTO[a.tipo]](ctx, a.x, a.y, LATO_OGGETTO, COLORI_AIUTO[a.tipo]);
}

function disegnaInseguitore() {
  const I = inseguitore;
  const sospeso = tempo < I.sospesoFino;
  if (I.vede) cerchio(I.x, I.y, I.r + 6, 'rgba(212,68,60,.18)');
  cerchio(I.x, I.y, I.r, sospeso ? '#5e86a8' : C.inseguitore);
  cerchio(I.x, I.y - I.r * 0.45, I.r * 0.42, 'rgba(0,0,0,.28)');
}

//  Il trombettista si vede da lontano perche' si porta dietro l'alone: e'
//  l'alone l'informazione, non lui. Il bordo tratteggiato dice esattamente
//  dove si comincia a rallentare, cosi' la frenata non sembra un difetto.
function disegnaTrombettista() {
  const e = trombettista;
  if (!e || !e.inGioco) return;
  const T = CONFIG.personaggi.trombettista;

  // L'alone non e' una macchia uniforme: e' denso addosso a lui e si assottiglia
  // in fretta, cosi' si vede dove comincia a pesare senza tingere mezza mappa.
  const g = ctx.createRadialGradient(e.x, e.y, 4, e.x, e.y, T.alone);
  g.addColorStop(0,    'rgba(196,103,60,.26)');
  g.addColorStop(0.45, 'rgba(196,103,60,.10)');
  g.addColorStop(1,    'rgba(196,103,60,0)');
  cerchio(e.x, e.y, T.alone, g);

  ctx.save();
  ctx.setLineDash([5, 7]);
  cerchio(e.x, e.y, T.alone, null, 'rgba(220,150,110,.34)', 1.1);
  ctx.restore();

  // fermo a studiare respira piano, camminando no: si vede quando riparte
  const studia = e.studia;
  const r = e.r + (studia ? Math.sin(e.fase * 2.6) * 1.1 : 0);
  cerchio(e.x, e.y, r, C.trombettista);

  // la campana: un cono corto nel verso in cui cammina, quanto basta a non
  // essere un pallino
  const ux = e.dirx, uy = e.diry;
  const nx = -uy, ny = ux;
  ctx.beginPath();
  ctx.moveTo(e.x + ux * 4, e.y + uy * 4);
  ctx.lineTo(e.x + ux * 15 + nx * 7, e.y + uy * 15 + ny * 7);
  ctx.lineTo(e.x + ux * 15 - nx * 7, e.y + uy * 15 - ny * 7);
  ctx.closePath();
  ctx.fillStyle = C.trombettista; ctx.fill();
}

//  Alba e' la cosa piu' chiara dello schermo, e ha i raggi: e' un'alba. Il
//  rosa e' un di piu' per chi lo vede — la forma basta da sola.
function disegnaAlba() {
  const e = alba;
  if (!e || !e.inGioco) return;
  figuraAlba(e.x, e.y, 1);
}

//  La figura sola, usata anche seduta in sala concerto: una figura, due posti.
function figuraAlba(cx, cy, s) {
  cerchio(cx, cy, 6.5 * s, C.alba);
  //  Raggi ricci, non dritti: Alba e' riccia, e il suo sole deve ricordarla
  //  senza farne un ritratto. Ogni raggio e' una doppia S: otto capelli, due
  //  onde intere ciascuno (Gianluca, 23/09: scelta «F» fra le prove, dopo due
  //  bocciature). Tutta rosa, e ferma: non gira su se stessa (Gianluca, 23/09).
  ctx.strokeStyle = C.alba; ctx.lineWidth = 1.4 * s; ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4;
    const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
    ctx.beginPath();
    for (let i = 0; i <= 32; i++) {
      const t = i / 32, r = (9 + t * 7) * s, o = Math.sin(t * Math.PI * 4) * 1.6 * s;
      const x = cx + ux * r + vx * o, y = cy + uy * r + vy * o;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
}

//  Mentre parlano, un anello che si allarga intorno ai due: e' la traduzione a
//  vista del suono del colloquio, per chi sta guardando invece di ascoltare.
function disegnaColloquio() {
  if (!colloquio || !colloquio.attivo) return;
  const f = (tempo * 0.8) % 1;
  cerchio(colloquio.x, colloquio.y, 20 + f * 34, null,
          `rgba(245,143,192,${(1 - f) * 0.5})`, 1.6);
}

function disegnaGiocatore() {
  const g = giocatore;
  // i pezzi al seguito camminano sulla scia, dietro
  g.portati.forEach(p => {
    const col = colorePezzo(p);
    cerchio(p.x, p.y, 5, col + 'cc');
  });
  cerchio(g.x, g.y, g.r + 1, C.giocatore);
  const n = Math.hypot(g.dirx, g.diry) || 1;
  ctx.strokeStyle = C.sguardo; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(g.x + g.dirx / n * 6, g.y + g.diry / n * 6);
  ctx.lineTo(g.x + g.dirx / n * 13, g.y + g.diry / n * 13);
  ctx.stroke();
}

//  Al telefono il canvas arriva a poco piu' di meta' della sua misura: le
//  scritte si disegnano piu' grandi, o a 12 px diventano 7 px sullo schermo.
//  Quanto piu' grandi lo dice la misura vera del canvas: sul tablet, dove il
//  canvas e' quasi a grandezza piena, restano come al computer.
const scritteTocco = () => window.TOCCO
  ? Math.max(1, Math.min(1.6, 0.95 * cv.width / (cv.clientWidth || cv.width))) : 1;
function velo(testo, sotto, colore) {
  const k = scritteTocco(), my = cv.height / 2 - (k - 1) * 30;
  ctx.fillStyle = 'rgba(11,13,16,.8)'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = colore || '#e8b04b';
  ctx.font = `300 ${34 * (1 + (k - 1) * 0.6)}px -apple-system, sans-serif`;
  ctx.fillText(testo, cv.width / 2, my - 4);
  ctx.fillStyle = '#c7cfd8'; ctx.font = `${15 * k}px -apple-system, sans-serif`;
  ctx.fillText(sotto, cv.width / 2, my + 30 * k);
  ctx.fillStyle = '#7d8794'; ctx.font = `${12 * k}px -apple-system, sans-serif`;
  ctx.fillText(`pezzi in anfiteatro ${consegnati}/${richiesti}  ·  ${window.TOCCO ? '↻' : 'R'} per ricominciare`,
               cv.width / 2, my + 58 * k);
  if (notteAperta()) {
    ctx.fillStyle = '#9aa5b1';
    ctx.fillText(window.TOCCO ? (notte ? '☀  per tornare di giorno' : '☾  per giocare di notte')
                              : (notte ? 'N per tornare di giorno' : '☾  N per giocare di notte'),
                 cv.width / 2, my + 82 * k);
  }
  ctx.textAlign = 'left';
}
// -----------------------------------------------------------------------------
//  IL FOGLIO DEL DIRETTORE — la prima cosa che si vede, e l'unica che si rilegge
// -----------------------------------------------------------------------------
//  Ci sono scritti i cinque strumenti da riportare sul palco, con il nome che
//  ha scelto lo studente che ha registrato: il gioco lo legge dalla coda del
//  nome del file e non lo sa prima di aprirlo.
//
//  Nella sala girano SETTE strumenti: questi cinque e due che nessuno ha
//  chiesto. A guardarli non si distinguono, e non e' una svista — l'unico modo
//  di riconoscere un'esca e' sentire che strumento e', foglio alla mano. E'
//  qui che il gioco smette di essere una caccia al suono e diventa una prova
//  di ascolto.
//
//  Niente e' affidato al colore: l'elenco e' numerato e i nomi sono scritti.
// -----------------------------------------------------------------------------
function disegnaConsegna(inPausa) {
  const richiesti = pezzi.filter(p => !p.esca);
  const nomi = richiesti.map(p => audio.nomeStrumento(p.id));
  //  Chi chiede un oggetto si porta dietro una riga in piu'. Compare quando
  //  l'oggetto e' stato scoperto, cioe' quando gli sei andato davanti e lui
  //  ti ha detto di no: da quel momento il foglio lo ricorda per te. Sparisce
  //  appena il musicista e' conquistato — un foglio che elenca cose fatte si
  //  legge peggio.
  const note = richiesti.map(p => chiedeOggetto(p) ? p.oggetto : null);

  ctx.fillStyle = 'rgba(11,13,16,.86)'; ctx.fillRect(0, 0, cv.width, cv.height);

  //  il foglio si adatta alla finestra: in aula il gioco gira anche su schermi
  //  piccoli, e un foglio a misura fissa ci finiva mezzo fuori
  const L = Math.min(440, cv.width - 48);
  const ALTO_NOTA = 21;
  const quanteNote = note.filter(Boolean).length;
  const A = Math.min(112 + nomi.length * 34 + quanteNote * ALTO_NOTA + 124,
                     cv.height - 48);
  const x = (cv.width - L) / 2, y = (cv.height - A) / 2;

  //  Al telefono il foglio si ingrandisce fin dove ci sta, lasciando sotto il
  //  posto per la riga che dice come si comincia.
  const kt = scritteTocco();
  const sf = kt > 1 ? Math.min(1.45, kt, (cv.height - 62) / A, (cv.width - 40) / L) : 1;
  ctx.save();
  if (sf !== 1) {
    ctx.translate(cv.width / 2, (cv.height - 46) / 2);
    ctx.scale(sf, sf);
    ctx.translate(-cv.width / 2, -cv.height / 2);
  }

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#efe9dc';
  ctx.fillRect(x, y, L, A);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#6d6455';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillText('CONSERVATORIO DI MUSICA · AVELLINO', x + L / 2, y + 30);

  ctx.strokeStyle = '#c3b8a4'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 34, y + 44); ctx.lineTo(x + L - 34, y + 44); ctx.stroke();

  ctx.fillStyle = '#2b2823';
  ctx.font = '300 21px -apple-system, sans-serif';
  ctx.fillText('Portami questi cinque strumenti', x + L / 2, y + 72);
  ctx.fillStyle = '#6d6455';
  ctx.font = 'italic 13px -apple-system, sans-serif';
  ctx.fillText('per il concerto', x + L / 2, y + 92);

  //  l'elenco: numerato a sinistra, nome a seguire. Allineato a sinistra
  //  perche' cinque nomi centrati si leggono peggio di cinque nomi in colonna.
  ctx.textAlign = 'left';
  let ry = y + 126;
  nomi.forEach((n, k) => {
    ctx.fillStyle = '#8a7f6c';
    ctx.font = '13px -apple-system, sans-serif';
    ctx.fillText((k + 1) + '.', x + 44, ry);
    ctx.fillStyle = '#2b2823';
    ctx.font = '500 17px -apple-system, sans-serif';
    ctx.fillText(n, x + 68, ry);
    ry += 34;
    //  La riga dell'oggetto: rientrata sotto il nome, in corsivo piccolo,
    //  col disegno di fianco. Sul foglio la sagoma sta a sinistra delle
    //  parole come su un'etichetta, e si legge insieme a esse.
    if (note[k]) {
      ry -= 9;
      const forma = SAGOMA_OGGETTO[note[k]];
      if (forma === 'metronomo')
        SAGOME.metronomo(ctx, x + 78, ry - 4, 15, '#8a7f6c', 0.12, 1);
      else
        SAGOME[forma](ctx, x + 78, ry - 4, 15, '#8a7f6c');
      ctx.fillStyle = '#6d6455';
      ctx.font = 'italic 13px -apple-system, sans-serif';
      ctx.fillText('chiede ' + NOME_OGGETTO[note[k]], x + 92, ry);
      ry += ALTO_NOTA + 9;
    }
  });

  //  LA FIRMA — «Max Head», che e' Massimo Testa tradotto: il direttore
  //  d'orchestra del Conservatorio di Avellino, storpiato quel tanto che basta
  //  perche' sia una battuta per chi lo conosce e un nome qualunque per tutti
  //  gli altri. Corsivo inclinato, e sotto il titolo in stampatello piccolo:
  //  a colpo d'occhio si legge come una firma vera su una comunicazione vera.
  ry += 52;
  ctx.save();
  ctx.translate(x + L - 52, ry);
  ctx.rotate(-0.055);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#2f3b52';
  ctx.font = 'italic 27px "Snell Roundhand", "Brush Script MT", "Segoe Script", cursive';
  ctx.fillText('Max Head', 0, 0);
  //  lo svolazzo di chiusura, quello che in una firma vera esce dall'ultima
  //  lettera e torna indietro
  ctx.strokeStyle = '#2f3b52'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-116, 7);
  ctx.bezierCurveTo(-86, 15, -40, 15, -4, 6);
  ctx.bezierCurveTo(-22, 14, -60, 19, -96, 13);
  ctx.stroke();
  ctx.restore();
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8a7f6c'; ctx.font = '11px -apple-system, sans-serif';
  //  la dicitura sta sotto lo svolazzo, non dentro: a +22 ci finiva in mezzo e
  //  non si leggeva piu' ne' l'una ne' l'altro
  ctx.fillText("il direttore d'orchestra", x + L - 52, ry + 38);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#9aa3ae';
  ctx.font = `${Math.round(12 * kt)}px -apple-system, sans-serif`;
  ctx.fillText(window.TOCCO
                 ? (inPausa ? 'tocca lo schermo per riprendere'
                            : 'tocca lo schermo per cominciare  ·  ❚❚ per rileggerlo')
                 : (inPausa ? 'P o ESC per riprendere'
                            : 'un tasto qualsiasi per cominciare  ·  ESC per rileggerlo'),
               cv.width / 2, sf !== 1 ? cv.height - 16 : y + A + 26);
  ctx.textAlign = 'left';
}

//  La schermata finale del concerto arriva DOPO la scena, e sotto ci resta la
//  sala piena: il velo e' semitrasparente e si vede l'orchestra sul palco.
//  Prima era l'unica cosa che si vedeva, ed era tutto il finale.
const disegnaFine = () => esito === 'presa'
  ? velo('GAME OVER', 'Aluzzi ti ha scovato e ti ha rinchiuso in regia.', '#d4443c')
  : velo('HAI VINTO', notte ? 'Sala piena, applausi lunghi per il concerto di mezzanotte.'
                           : 'Applausi in sala: il concerto è stato un successo.', '#5fb0e0');


// =============================================================================
//  PANNELLI
// =============================================================================
const elLog = document.getElementById('log');
const elLista = document.getElementById('listaFile');
let righeLog = [];

function registra(idEvento, esito, extra) {
  if (!esito) return;
  const p = esito.pan;
  const lato = Math.abs(p) < 0.08 ? 'C' : (p < 0 ? 'L' : 'R');
  righeLog.unshift(`<div class="nuovo">${idEvento}` +
    (extra ? ` <span class="pan">${extra}</span>` : '') +
    ` <span class="pan">${lato} ${p.toFixed(2)}</span></div>`);
  righeLog = righeLog.slice(0, 12);
  elLog.innerHTML = righeLog.join('');
  setTimeout(() => { const d = elLog.firstChild; if (d) d.className = ''; }, 160);
}

//  Il pannello delle sorgenti e' il banco d'ascolto: volume e posizione di
//  ogni loop, in tempo reale. E' l'unico posto in cui si vede quello che si
//  sente, e serve a capire in fretta se un loop e' troppo forte o se due si
//  mascherano a vicenda.
function preparaPannelli() {
  const righe = [...CONFIG.pezzi, ...CONFIG.oggetti];
  document.getElementById('listaSorgenti').innerHTML = righe.map(s => {
    const p = pezzi.find(x => x.id === s.id);
    const col = p ? colorePezzo(p) : COLORE_OGGETTO;
    return `
    <div class="riga-str" data-id="${s.id}">
      <span class="pallo" style="background:${col}"></span>
      <span class="nome" id="nm_${s.id}">${audio.nomeStrumento ? audio.nomeStrumento(s.id) : s.etichetta}</span>
      <span class="barra"><div id="bar_${s.id}" style="background:${col}"></div></span>
      <span class="val" id="pn_${s.id}">C</span>
    </div>`;
  }).join('');

  costruisciBanco();
  preparaCartella();
  preparaSegnalazioni();
  aggiornaListaFile();

  const dz = document.getElementById('dropzone');
  ['dragenter', 'dragover'].forEach(e => addEventListener(e, ev => { ev.preventDefault(); dz.classList.add('attivo'); }));
  addEventListener('dragleave', ev => ev.preventDefault());
  addEventListener('drop', async ev => {
    ev.preventDefault(); dz.classList.remove('attivo');
    for (const f of ev.dataTransfer.files) {
      const r = await audio.sostituisci(f);
      dz.innerHTML = r.ok ? `<b style="color:#57b37f">${f.name}</b><br>sostituito, ascolta`
                          : `<b style="color:#cc4b4b">${f.name}</b><br>${r.motivo}`;
    }
    aggiornaListaFile();
  });
}

// -----------------------------------------------------------------------------
//  Banco di missaggio: i bus e i singoli eventi.
//  Serve ad ascoltare un suono per volta, regolarlo, e poi rimetterlo nel mix.
//  Alcuni eventi capitano di rado: senza il tasto di prova non li si ascolta
//  quando servono.
// -----------------------------------------------------------------------------
const BUS = [['pezzi', 'PEZZI'], ['oggetti', 'OGGETTI'], ['personaggi', 'PERSONAGGI'],
             ['inseguitore', 'INSEGUITORE'],
             ['musica', 'MUSICA'], ['eventi', 'EVENTI'],
             ['ambienze', 'AMBIENZE'], ['riverbero', 'RIVERBERO']];

function costruisciBanco() {
  const b = document.getElementById('banco');
  const bottoni = (tipo, k, prova) =>
    (prova ? `<button class="mb prova" data-t="${tipo}" data-k="${k}" title="prova questo suono">&#9654;</button>` : '<span class="mb vuoto"></span>') +
    `<button class="mb m" data-t="${tipo}" data-k="${k}" data-c="muto">M</button>` +
    `<button class="mb s" data-t="${tipo}" data-k="${k}" data-c="solo">S</button>`;

  const FADER = [['generale', 'generale'], ['pezzi', 'pezzi'],
                 ['personaggi', 'personaggi'], ['musica', 'musica'],
                 ['eventi', 'eventi'], ['ambienze', 'ambienze']];

  b.innerHTML =
    FADER.map(([k, et]) => `
      <div class="fader">
        <span class="nm">${et}</span>
        <input type="range" min="0" max="200" step="5" value="${Math.round(audio.fader[k] * 100)}" data-f="${k}">
        <span class="pct" id="pct_${k}">${Math.round(audio.fader[k] * 100)}%</span>
      </div>`).join('') +
    '<div class="mix-sep">silenzia e isola</div>' +
    BUS.map(([k, et]) => `<div class="mix bus"><span class="nm">${et}</span>${bottoni('bus', k, false)}</div>`).join('') +
    '<div class="mix-sep">eventi, uno per uno</div>' +
    Object.keys(CONFIG.eventi).map(id =>
      `<div class="mix"><span class="nm">${id}</span>${bottoni('ev', id, true)}</div>`).join('');

  b.addEventListener('click', e => {
    const t = e.target.closest('.mb'); if (!t) return;
    if (t.classList.contains('prova')) {
      // 'forzato' scavalca muto e solo: il tasto prova deve suonare sempre
      audio.suona(t.dataset.k, { pan: 0, distanza: 1, forzato: true });
      return;
    }
    const acceso = audio.commutaMix(t.dataset.t, t.dataset.k, t.dataset.c);
    t.classList.toggle('on', acceso);
  });

  b.addEventListener('input', e => {
    const f = e.target.dataset.f; if (!f) return;
    const v = e.target.value / 100;
    audio.impostaFader(f, v);
    document.getElementById('pct_' + f).textContent = e.target.value + '%';
  });

  // Il portatile dello studente ha lo schermo touch: senza un bottone la
  // modalita libera esiste solo per chi ha una tastiera sotto le dita.
  document.getElementById('btnLibera').addEventListener('click', () => {
    commutaLibera();
    document.getElementById('btnLibera').blur();   // il fuoco torna al gioco
  });

  document.getElementById('azzeraMix').addEventListener('click', () => {
    audio.azzeraMix();
    audio.azzeraFader();
    b.querySelectorAll('.mb.on').forEach(x => x.classList.remove('on'));
    mostraCursori();
  });

  //  I cursori viaggiano con i suoni: si scarica `livelli.json` e lo si mette
  //  nella cartella `audio/`. «carica la cartella» lo rilegge.
  document.getElementById('salvaLivelli').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([audio.testoLivelli()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'livelli.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    document.getElementById('dropzone').innerHTML =
      '<b style="color:#57b37f">livelli.json scaricato</b><br>spostalo nella cartella audio/';
    document.getElementById('salvaLivelli').blur();
  });
}

//  I cursori del banco rimessi al valore che ha il motore audio.
function mostraCursori() {
  document.querySelectorAll('#banco input[data-f]').forEach(x => {
    const v = Math.round(audio.fader[x.dataset.f] * 100);
    x.value = v;
    document.getElementById('pct_' + x.dataset.f).textContent = v + '%';
  });
}

// -----------------------------------------------------------------------------
//  Caricare la cartella audio senza server.
//  Aprendo index.html con un doppio clic il browser vieta la lettura dei file
//  vicini, quindi la cartella audio/ resta invisibile. Qui l'utente la sceglie
//  a mano una volta e il gioco legge tutto: niente Python, niente terminale.
// -----------------------------------------------------------------------------
function preparaCartella() {
  const inp = document.getElementById('inputCartella');
  const bot = document.getElementById('scegliCartella');
  bot.addEventListener('click', () => inp.click());

  const svuota = document.getElementById('svuotaArchivio');
  const daArchivio = () => audio.elencoFile().filter(v => audio.stato[v.nome] === 'archivio').length;
  const n = daArchivio();
  if (n) bot.textContent = `${n} file ripresi dall'archivio · ricarica la cartella per aggiornarli`;
  svuota.hidden = !n;
  svuota.addEventListener('click', async () => {
    if (!confirm('Cancella i file audio memorizzati in questo browser. I file sulla tua cartella non vengono toccati. Procedo?')) return;
    try { await audio.archivioSvuota(); svuota.textContent = 'archivio svuotato — ricarica la pagina'; }
    catch (e) { svuota.textContent = 'archivio non svuotabile: ' + e; }
  });
  inp.addEventListener('change', async () => {
    const files = [...inp.files];
    if (!files.some(f => /\.(wav|mp3|m4a|aif|aiff|ogg|flac)$/i.test(f.name))) {
      bot.textContent = 'nessun file audio in quella cartella'; return;
    }
    const { messi, scartati, tolti, livelli } =
      await audio.caricaCartella(files, (n, t) => { bot.textContent = `carico… ${n}/${t}`; });
    inp.value = '';                  // la stessa cartella si puo' ricaricare
    aggiornaListaFile();
    if (livelli) mostraCursori();
    bot.textContent = `${messi} file caricati e memorizzati` +
      (tolti ? ` · ${tolti} di prima tolti` : '') +
      (livelli ? ' · livelli ripresi' : '') +
      (scartati.length ? ` · ${scartati.length} con nome non previsto` : '');
    document.getElementById('svuotaArchivio').hidden = false;
    if (scartati.length) {
      document.getElementById('dropzone').innerHTML =
        '<b style="color:#cc4b4b">nomi non previsti</b><br>' +
        scartati.slice(0, 6).join('<br>') +
        (scartati.length > 6 ? `<br>…e altri ${scartati.length - 6}` : '');
    }
  });
}

// -----------------------------------------------------------------------------
//  Segnalazione problemi: il contesto se lo raccoglie il gioco da solo.
//  Chi segnala descrive solo cosa stava facendo; tutto il resto e' gia' li',
//  ed e' proprio quello che manca sempre in una segnalazione fatta a voce.
// -----------------------------------------------------------------------------
function componiSegnalazione(descrizione) {
  const propri = audio.elencoFile().filter(v => audio.stato[v.nome] !== 'segnaposto');
  const muti = Object.entries(audio.mixEv).filter(([, v]) => v.muto).map(([k]) => k);
  const soli = Object.entries(audio.mixEv).filter(([, v]) => v.solo).map(([k]) => k);
  const busSpenti = BUS.map(([k]) => k).filter(b => !audio.busAudibile(b));
  const statoPezzi = pezzi.map(p => p.id +
    (p.consegnato ? ' [consegnato]' : p.conquistato ? ' [al seguito]' : p.esca ? ' [esca]' : ''));

  return [
    'SEGNALAZIONE — Avellino, le nove caselle', '',
    'DESCRIZIONE',
    (descrizione || '(non compilata)').trim(), '',
    'CONTESTO',
    'data                ' + new Date().toLocaleString('it-IT'),
    'browser             ' + navigator.userAgent,
    'indirizzo           ' + location.href,
    'schermo             ' + screen.width + '×' + screen.height,
    'audio               ' + (audio.ctx ? audio.ctx.state + ' · ' + audio.ctx.sampleRate + ' Hz' : 'non avviato'),
    '',
    'PARTITA',
    'tempo di gioco      ' + tempo.toFixed(0) + ' s' + (tempoScaduto ? ' — SCADUTO' : ''),
    'pezzi in anfiteatro ' + consegnati + '/' + richiesti,
    'al seguito          ' + giocatore.portati.length,
    'zona                ' + nomeZona(giocatore.x, giocatore.y) + ' · acustica ' + acusticaCorrente,
    'scorciatoia         ' + (inScorciatoia ? 'sì' : 'no'),
    'inseguitore         ' + (inseguitore.inGioco ? (inseguitore.vede ? 'ti vede' : 'in giro') : 'non in gioco'),
    'disturbo            ' + (disturbo.attivo ? 'attivo' : 'no'),
    'occlusione          ' + (occlusione.attiva ? 'attiva' : 'no'),
    'modalità libera     ' + (modalitaLibera ? 'sì' : 'no'),
    'mappa               ' + (verificaMappa().ok ? 'verificata' : 'PROBLEMA'),
    '',
    'PEZZI               ' + statoPezzi.join(', '),
    '',
    'BANCO DI MISSAGGIO',
    'bus spenti          ' + (busSpenti.join(', ') || 'nessuno'),
    'eventi mutati       ' + (muti.join(', ') || 'nessuno'),
    'eventi in solo      ' + (soli.join(', ') || 'nessuno'),
    '',
    'FILE PROPRI CARICATI (' + propri.length + '/' + audio.elencoFile().length + ')',
    propri.map(v => '  ' + v.nome).join('\n') || '  nessuno: tutti segnaposto',
    '',
    'ULTIMI EVENTI',
    righeLog.map(r => '  ' + r.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).join('\n') || '  nessuno',
  ].join('\n');
}

function preparaSegnalazioni() {
  const fin = document.getElementById('segnala');
  const testo = document.getElementById('testoSegnala');
  const esito = document.getElementById('esitoSegnala');

  document.getElementById('apriSegnala').addEventListener('click', () => {
    fin.hidden = false; esito.textContent = ''; testo.focus();
  });
  const chiudi = () => { fin.hidden = true; };
  document.getElementById('chiudiSegnala').addEventListener('click', chiudi);
  fin.addEventListener('click', e => { if (e.target === fin) chiudi(); });

  document.getElementById('copiaSegnala').addEventListener('click', async () => {
    const t = componiSegnalazione(testo.value);
    try {
      await navigator.clipboard.writeText(t);
      esito.textContent = 'copiato — incollalo nel documento condiviso';
    } catch (e) {
      // Safari nega gli appunti fuori da un gesto diretto: si ripiega sulla selezione
      testo.value = t; testo.select();
      esito.textContent = 'premi Cmd+C per copiare il testo qui sopra';
    }
  });

  document.getElementById('scaricaSegnala').addEventListener('click', () => {
    const t = componiSegnalazione(testo.value);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain' }));
    a.download = 'segnalazione ' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.txt';
    a.click();
    esito.textContent = 'scaricato — mettilo nella cartella condivisa';
  });
}

function aggiornaListaFile() {
  const gruppi = {};
  for (const v of audio.elencoFile()) (gruppi[v.gruppo] = gruppi[v.gruppo] || []).push(v);
  elLista.innerHTML = Object.entries(gruppi).map(([g, voci]) =>
    `<div class="gruppo">${g.toUpperCase()}</div>` + voci.map(v => {
      const s = audio.stato[v.nome] || 'segnaposto';
      return `<div class="file ${s !== 'segnaposto' ? 'sostituito' : ''}"><span class="pallino ${s}"></span>${v.nome}</div>`;
    }).join('')).join('');  //  il nome dello strumento viene dal file: cambiando cartella cambia anche qui
  for (const p of CONFIG.pezzi) {
    const el = document.getElementById('nm_' + p.id);
    if (el) el.textContent = audio.nomeStrumento(p.id);
  }
}

const mmss = s => Math.floor(Math.max(0, s) / 60) + ':' + String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0');

function aggiornaPannelli() {
  const resta = G.tempoLimite - tempo;
  const elT = document.getElementById('tempo');
  elT.textContent = tempoScaduto ? 'SCADUTO' : mmss(resta);
  elT.classList.toggle('allarme', !tempoScaduto && resta < G.avvisoTempo);
  elT.classList.toggle('scaduto', tempoScaduto);

  document.getElementById('punteggio').textContent = `${consegnati}/${richiesti}`;
  document.getElementById('seguito').textContent = giocatore.portati.length;
  document.getElementById('zona').textContent = nomeZona(giocatore.x, giocatore.y) +
    (inScorciatoia ? ' — scorciatoia' : '');

  const st = [];
  if (audio.musicaAccesa) st.push('musica');
  if (inseguitore.inGioco) st.push(inseguitore.vede ? 'ti vede' : 'inseguitore');
  if (disturbo.attivo) st.push('disturbo');
  if (occlusione.attiva) st.push('occlusione');
  if (tempo < inseguitore.sospesoFino) st.push('caccia sospesa');
  document.getElementById('stati').textContent = st.join(' · ');

  const btnLib = document.getElementById('btnLibera');
  if (btnLib) btnLib.classList.toggle('acceso', modalitaLibera);
  const lib = document.getElementById('libera');
  lib.hidden = !modalitaLibera;
  if (modalitaLibera) lib.textContent = 'MODALITÀ LIBERA — M musica · I inseguitore · O occlusione · U disturbo · T tempo · K concerto';

  if (!audio.sorgenti) return;
  for (const s of Object.values(audio.sorgenti)) {
    const bar = document.getElementById('bar_' + s.id);
    if (!bar) continue;
    bar.style.width = (s.livello * 100).toFixed(0) + '%';
    const p = s.pan.pan.value;
    document.getElementById('pn_' + s.id).textContent =
      (Math.abs(p) < 0.08 ? 'C' : (p < 0 ? 'L' : 'R')) + ' ' + Math.abs(p).toFixed(1);
  }
}
