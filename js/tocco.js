// =============================================================================
//  COMANDI A DITO — per il telefono e il tablet
// =============================================================================
//  Si accende solo dove non c'e' un mouse (schermo a sfioramento, niente
//  puntatore sospeso). Al computer questo file non fa niente.
//
//  Non tocca il gioco: finge i tasti. La levetta preme W A S D, i pulsanti
//  premono ESC, R e N. Niente pulsanti per girare lo sguardo: al telefono lo
//  sguardo segue il passo (deciso con Gianluca il 30/09/2026). Cosi' il gioco ha un solo modo di
//  essere comandato — la tastiera — e tutto quello che vale per lei vale
//  anche per il dito: la pausa, il foglio che si chiude con un tasto
//  qualsiasi, l'audio che riparte dentro il gesto.
//
//  Le manopole del tecnico (modalita' libera, banco, pannelli) al telefono
//  non ci sono: deciso con Gianluca il 29/09/2026.
// =============================================================================
(function () {
  //  ?tocco li accende anche al computer, per provarli col mouse.
  const TOCCO = matchMedia('(hover: none) and (pointer: coarse)').matches ||
                /(^|[?&])tocco(=|&|$)/.test(location.search);
  window.TOCCO = TOCCO;
  if (!TOCCO) return;

  document.body.classList.add('tocco');
  mostraPannelli(false);

  // La schermata di avvio parla di tastiera e mouse: al telefono si dice altro.
  const comandi = document.querySelector('#avvio .comandi');
  if (comandi) comandi.innerHTML =
    '<b>pollice destro</b>: trascina per camminare<br>' +
    'lo sguardo segue il passo &nbsp;·&nbsp; <b>❚❚</b> pausa<br>' +
    'a fine partita <b>↻</b> ricomincia &nbsp;·&nbsp; nel concerto <b>✕</b> esce<br>' +
    'con le <b>cuffie</b> — e il telefono <b>non in silenzioso</b>, altrimenti Safari tace';
  const avvia = document.getElementById('btnAvvia');
  if (avvia) avvia.textContent = 'TOCCA PER INIZIARE';
  const micro = document.querySelector('#avvio .micro');
  if (micro) micro.textContent = 'Il telefono non fa partire l\'audio senza un tocco.';

  // ---------------------------------------------------------------------------
  //  Tasti finti
  // ---------------------------------------------------------------------------
  //  key e code come li manda una tastiera vera: il gioco legge l'uno o l'altro.
  const TASTO = { w: ['w', 'KeyW'], a: ['a', 'KeyA'], s: ['s', 'KeyS'], d: ['d', 'KeyD'],
                  r: ['r', 'KeyR'], n: ['n', 'KeyN'], enter: ['Enter', 'Enter'], escape: ['Escape', 'Escape'] };
  function tasto(tipo, k) {
    const [key, code] = TASTO[k];
    dispatchEvent(new KeyboardEvent(tipo, { key, code, bubbles: true, cancelable: true }));
  }
  const colpo = k => { tasto('keydown', k); tasto('keyup', k); };

  // ---------------------------------------------------------------------------
  //  Lo strato dei comandi
  // ---------------------------------------------------------------------------
  const strato = document.createElement('div');
  strato.id = 'tocco';
  strato.innerHTML =
    '<div id="levetta"><div id="pomello"></div></div>' +
    '<div id="pulsantiTocco">' +
      '<button data-f="pausa" aria-label="pausa">❚❚</button>' +
      '<button data-f="esci" aria-label="esci dal concerto">✕</button>' +
      '<button data-f="ricomincia" aria-label="ricomincia">↻</button>' +
      '<button data-f="notte" aria-label="gioca di notte">☾</button>' +
    '</div>' +
    '<div id="giraTelefono">Gira il telefono in orizzontale</div>';
  document.body.appendChild(strato);

  const levetta = document.getElementById('levetta');
  const pomello = document.getElementById('pomello');
  //  Piu' sensibile (Gianluca, 30/09/2026, due volte: «si deve muovere troppo il dito»):
  //  bastano 3 px per partire e l'anello segue il pollice gia' a 15 px, cosi'
  //  per cambiare direzione basta un gesto corto. TOCCO_FERMO resta piu'
  //  largo: un tocco appena tremolante deve contare ancora come tocco.
  const RAGGIO = 15, MORTA = 3, BORDO = 16, TOCCO_FERMO = 8;

  // Fuori dal gioco (avvio, finestra delle segnalazioni) lo strato non c'e'.
  const inGioco = () => !document.getElementById('app').hidden;

  //  Si vedono solo i pulsanti che in quel momento fanno qualcosa: R al
  //  gioco risponde solo a partita finita, N solo li', ESC nel concerto e'
  //  l'uscita e non la pausa. Un pulsante che non risponde sembra rotto.
  //  Lo stato si legge dalle variabili di gioco.js (stesso spazio globale).
  const B = {};
  strato.querySelectorAll('#pulsantiTocco button').forEach(b => B[b.dataset.f] = b);
  const vale = (nome, altrimenti) => { try { return eval(nome); } catch (e) { return altrimenti; } };
  function guardia() {
    strato.hidden = !inGioco();
    if (strato.hidden) return;
    const sc = vale('scena', null), fine = vale('partitaFinita', false);
    const pausa = vale('inPausa', false), diNotte = vale('notte', false);
    const concerto = sc && sc.tipo === 'concerto';
    const finale = fine && (!sc || sc.fase === 'fine');
    const notteAp = typeof notteAperta === 'function' && notteAperta();
    B.pausa.hidden = !!sc || fine;
    B.pausa.textContent = pausa ? '▶' : '❚❚';
    B.pausa.setAttribute('aria-label', pausa ? 'riprendi' : 'pausa');
    B.esci.hidden = !(concerto && sc.fase !== 'chiusura' && sc.fase !== 'fine');
    B.ricomincia.hidden = !(concerto || finale);
    B.notte.hidden = !(finale && notteAp);
    B.notte.textContent = diNotte ? '☀' : '☾';
    B.notte.setAttribute('aria-label', diNotte ? 'torna di giorno' : 'gioca di notte');
  }
  window.guardiaTocco = guardia;
  //  Dieci volte al secondo bastano per dei pulsanti: a ogni fotogramma era
  //  lavoro in piu' per il telefono, che scaldava (30/09/2026).
  setInterval(guardia, 100);

  // ---------------------------------------------------------------------------
  //  La levetta: nasce dove appoggi il pollice, nella meta' destra
  //  (a destra e non a sinistra: Gianluca, 30/09/2026)
  // ---------------------------------------------------------------------------
  //  Otto direzioni, come la tastiera: il gioco cammina a scatti di 45° e una
  //  levetta analogica prometterebbe una finezza che il passo non ha.
  let dito = null, ox = 0, oy = 0, premuti = new Set(), mosso = false;
  const tocchi = new Set();      // dita appoggiate fuori dalla levetta

  function direzione(dx, dy) {
    const d = Math.hypot(dx, dy);
    if (d < MORTA) return new Set();
    const ottavo = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));   // 0 = destra, 2 = giu'
    const MAPPA = { 0: 'd', 1: 'ds', 2: 's', 3: 'as', 4: 'a', '-4': 'a', '-3': 'aw', '-2': 'w', '-1': 'dw' };
    return new Set(MAPPA[ottavo].split(''));
  }
  function applica(nuovi) {
    for (const k of premuti) if (!nuovi.has(k)) tasto('keyup', k);
    for (const k of nuovi) if (!premuti.has(k)) tasto('keydown', k);
    premuti = nuovi;
  }

  //  Un tocco senza trascinare fa quello che fa un tasto qualsiasi (chiude il
  //  foglio del direttore); in pausa riprende, come dice il foglio.
  function tocco() {
    if (vale('inPausa', false) && !vale('consegnaAperta', false) && !vale('scena', null)) colpo('escape');
    else colpo('enter');
  }
  strato.addEventListener('pointerdown', ev => {
    if (ev.target.closest('button')) return;
    ev.preventDefault();
    if (dito !== null || ev.clientX < innerWidth / 2) { tocchi.add(ev.pointerId); return; }
    dito = ev.pointerId; mosso = false;
    //  L'anello non nasce mai a cavallo del bordo: vicino al bordo il pollice
    //  non avrebbe dove spingere e finirebbe fuori dallo schermo.
    const m = RAGGIO + BORDO;
    ox = Math.min(innerWidth - m, Math.max(m, ev.clientX));
    oy = Math.min(innerHeight - m, Math.max(m, ev.clientY));
    try { strato.setPointerCapture(dito); } catch (e) {}
    levetta.style.left = ox + 'px'; levetta.style.top = oy + 'px';
    levetta.classList.add('attiva');
    pomello.style.transform = 'translate(-50%, -50%)';
  });
  strato.addEventListener('pointermove', ev => {
    if (ev.pointerId !== dito) return;
    let dx = ev.clientX - ox, dy = ev.clientY - oy;
    const d = Math.hypot(dx, dy);
    //  Oltre il raggio l'anello segue il pollice invece di restare indietro:
    //  cosi' per cambiare direzione basta un piccolo gesto, e il dito non
    //  deve mai scivolare lontano (Gianluca, 30/09/2026: usciva dallo schermo).
    if (d > RAGGIO) {
      ox += dx * (1 - RAGGIO / d); oy += dy * (1 - RAGGIO / d);
      levetta.style.left = ox + 'px'; levetta.style.top = oy + 'px';
      dx *= RAGGIO / d; dy *= RAGGIO / d;
    }
    if (d > TOCCO_FERMO) mosso = true;
    pomello.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    applica(direzione(dx, dy));
  });
  //  Il tocco scatta quando il dito si alza e non quando si appoggia: su iOS
  //  l'audio si riprende solo dentro touchend/click, non dentro touchstart.
  function lascia(ev) {
    if (tocchi.delete(ev.pointerId)) { if (ev.type === 'pointerup') tocco(); return; }
    if (ev.pointerId !== dito) return;
    dito = null;
    applica(new Set());
    levetta.classList.remove('attiva');
    if (!mosso && ev.type === 'pointerup') tocco();
  }
  strato.addEventListener('pointerup', lascia);
  strato.addEventListener('pointercancel', lascia);

  // ---------------------------------------------------------------------------
  //  I pulsanti
  // ---------------------------------------------------------------------------
  //  ESC e non P per la pausa: nel concerto finale ESC e' l'uscita, e cosi'
  //  lo stesso pulsante fa la cosa giusta in tutti e due i momenti.
  const FUNZIONI = {
    pausa:      () => colpo('escape'),
    esci:       () => colpo('escape'),
    ricomincia: () => colpo('r'),
    //  N anche dopo il concerto: il gioco lo ascolta pure a scena in 'fine'
    //  (corretto il 30/09/2026), quindi basta il tasto finto.
    notte:      () => colpo('n'),
  };
  //  Anche qui si agisce al rilascio (click), per la stessa ragione: ▶ deve
  //  poter riaccendere l'audio su iOS.
  strato.querySelectorAll('#pulsantiTocco button').forEach(b => {
    b.addEventListener('pointerdown', ev => ev.stopPropagation());
    b.addEventListener('click', ev => {
      ev.preventDefault(); ev.stopPropagation();
      FUNZIONI[b.dataset.f]();
      guardia();
    });
  });

  // ---------------------------------------------------------------------------
  //  Tutto lo schermo
  // ---------------------------------------------------------------------------
  //  Il canvas nasce 900x620 (circa 1,45), un iPhone in orizzontale e' circa
  //  2,16. Invece di stirare o tagliare si allarga la finestra sul mondo:
  //  l'altezza resta 620, la larghezza segue lo schermo, e ai lati si vede un
  //  po' piu' di mappa. La telecamera legge cv.width a ogni fotogramma.
  function adatta() {
    const r = innerWidth / Math.max(1, innerHeight);
    const l = Math.round(CONFIG.vista.finestra.altezza * Math.min(2.4, Math.max(1.2, r)));
    if (cv.width !== l) cv.width = l;
  }
  adatta();
  addEventListener('resize', adatta);
  addEventListener('orientationchange', () => setTimeout(adatta, 250));

  // Il telefono non deve scorrere ne' ingrandire sotto le dita.
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());
})();
