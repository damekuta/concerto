// =============================================================================
//  ARREDI DELLE AULE — pianta tecnica alla Door Kickers
// =============================================================================
//  Portati qui il 23/09/2026 da `prova_arredi.html`, approvata da Gianluca.
//  Scala: 20 px del mondo = 1 metro, TRANNE sedie e leggii (`SEDIA`), fuori
//  scala di proposito perche' reggano il pallino di un musicista.
//
//  I mobili sono SOLO DISEGNO: ci si cammina sopra, e i percorsi di Alba e
//  dell'inseguitore restano quelli di prima. Deciso il 23/09. Se non convince,
//  la strada pensata e' tenere gli inseguitori fuori dalle aule.
//
//  L'arredo e' FISSO: ogni aula ha sempre gli stessi mobili, cosi' la pianta
//  si impara. Per questo ogni aula si disegna UNA volta sola su un ritaglio
//  (`ritaglio`) e poi a ogni fotogramma si incolla e basta: 43 aule con
//  ombre, motivi e luci rifatte sessanta volte al secondo scalderebbero il
//  computer per niente.
//
//  Le tipologie: A pianoforte, B teoria, C musica d'insieme, D percussioni,
//  E camerino, F regia (solo aula 49). Le aule non elencate in `TIPO` la
//  prendono dalla superficie: piccole A, medie B o D a turno, grandi C.
//  Chi ha una ricetta in `RICETTE` ha anche i mobili; le altre per ora hanno
//  solo pavimento e luce — il riempimento e' il lavoro che restava a Codex.
// =============================================================================
const ARREDI = (function () {
  const M = 20;
  const T = {
    muro: '#101216', ombra: 'rgba(0,0,0,0.45)',
    legno: '#6e5a45', legnoScuro: '#4d3f31', nero: '#16181c', laccato: '#1d1f24',
    tessuto: '#4f5968', tessutoChiaro: '#6b7584', metallo: '#8a929c', bianco: '#d8d4c8',
    tasti: '#e6e2d6', pelle: '#8c6f55', verde: '#2f4a3e',
  };
  
  // --- pavimenti -------------------------------------------------------------
  function motivo(tipo) {
    const c = document.createElement('canvas'), x = c.getContext('2d');
    if (tipo === 'parquet') {            // listoni 1 m x 12 cm, a correre sfalsati
      c.width = 40; c.height = 24;
      const tinte = ['#3b322a', '#40362d', '#372f28', '#3e342b'];
      for (let r = 0; r < 6; r++) {
        const off = (r % 2) * 20;
        for (let k = -1; k < 2; k++) {
          x.fillStyle = tinte[(r + k + 4) % 4]; x.fillRect(off + k * 20, r * 4, 20, 4);
          x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(off + k * 20, r * 4, 0.6, 4);
        }
        x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, r * 4 + 3.6, 40, 0.4);
      }
    } else if (tipo === 'linoleum') {    // quadrotte 30 cm, due toni appena diversi
      c.width = c.height = 12;
      x.fillStyle = '#2f353d'; x.fillRect(0, 0, 12, 12);
      x.fillStyle = '#333a43'; x.fillRect(0, 0, 6, 6); x.fillRect(6, 6, 6, 6);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, 12, 0.4); x.fillRect(0, 0, 0.4, 12);
    } else if (tipo === 'moquette') {    // regia: fibra scura, rumore fitto
      c.width = c.height = 16;
      x.fillStyle = '#23262e'; x.fillRect(0, 0, 16, 16);
      for (let i = 0; i < 60; i++) { x.fillStyle = Math.random() < .5 ? '#272b34' : '#1f2229'; x.fillRect(Math.random()*16, Math.random()*16, 1, 1); }
    } else if (tipo === 'gomma') {       // percussioni: gomma a bolli
      c.width = c.height = 8;
      x.fillStyle = '#2a2d31'; x.fillRect(0, 0, 8, 8);
      x.fillStyle = '#33373c'; x.beginPath(); x.arc(2, 2, 1, 0, 7); x.arc(6, 6, 1, 0, 7); x.fill();
    } else if (tipo === 'graniglia') {   // camerini e corridoi: graniglia
      c.width = c.height = 20;
      x.fillStyle = '#34363a'; x.fillRect(0, 0, 20, 20);
      for (let i = 0; i < 40; i++) { x.fillStyle = ['#3d3f43','#2c2e31','#44403a'][i%3]; x.fillRect(Math.random()*20, Math.random()*20, 1.2, 1.2); }
      x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, 0, 20, 0.4); x.fillRect(0, 0, 0.4, 20);
    } else if (tipo === 'piastrelle') {  // bagni: piastrelle chiare da 30 cm, fuga scura
      c.width = c.height = 6;
      x.fillStyle = '#4a5157'; x.fillRect(0, 0, 6, 6);
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 0, 6, 0.35); x.fillRect(0, 0, 0.35, 6);
    }
    return c;
  }
  
  // --- primitive -------------------------------------------------------------
  let ax;   // il contesto del ritaglio che si sta disegnando
  // Registro separato dal disegno. Le ombre e i dettagli decorativi non vi
  // entrano: qui conta soltanto lo spazio che un mobile occupa davvero.
  let registro = [], regM = [1, 0, 0, 1, 0, 0], registra = true;
  function puntoReg(x, y) { return { x: regM[0] * x + regM[2] * y + regM[4], y: regM[1] * x + regM[3] * y + regM[5] }; }
  function molReg(a, b) { return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]]; }
  function ingombro(nome, x, y, w, h, a = 0) {
    if (!registra) return;
    const c = Math.cos(a), s = Math.sin(a), q = [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
    registro.push({ nome, tipo: 'rettangolo', punti: q.map(([u,v]) => puntoReg(x + c*u - s*v, y + s*u + c*v)) });
  }
  // Ingombro spostato dal punto di rotazione del mobile: lo spostamento ruota
  // con lui. Prima si ruotava il rettangolo sul proprio centro, e un banco
  // girato di 180 gradi aveva l'ingombro dalla parte opposta alla sedia.
  function ingombroA(nome, x, y, dx, dy, w, h, a) { const c = Math.cos(a), s = Math.sin(a); ingombro(nome, x + c*dx - s*dy, y + s*dx + c*dy, w, h, a); }
  function ingombroTondo(nome, x, y, r) { if (registra) registro.push({ nome, tipo: 'cerchio', centro: puntoReg(x, y), r }); }
  // La sedia appena registrata appartiene a un tavolo (cattedra, bancone del
  // trucco): gli sta accostata di proposito, e la verifica non la conta come urto.
  function sediaDi(nome) { if (registra && registro.length) registro[registro.length - 1].sediaDi = nome; }
  function senzaIngombro(fn) { const prima = registra; registra = false; try { fn(); } finally { registra = prima; } }
  function conOmbra(fn) {   // ogni mobile getta un'ombra corta in basso a destra
    ax.save(); ax.translate(1.6, 1.6); ax.globalCompositeOperation = 'source-over';
    ax.fillStyle = T.ombra; ax.strokeStyle = T.ombra;
    fn(true); ax.restore(); fn(false);
  }
  function rett(x, y, w, h, col, bordo) {
    conOmbra(o => { ax.fillStyle = o ? T.ombra : col; ax.fillRect(x, y, w, h);
      if (!o && bordo !== false) { ax.strokeStyle = 'rgba(0,0,0,.6)'; ax.lineWidth = .5; ax.strokeRect(x, y, w, h); } });
  }
  function tondo(x, y, r, col) {
    conOmbra(o => { ax.beginPath(); ax.arc(x, y, r, 0, 7); ax.fillStyle = o ? T.ombra : col; ax.fill();
      if (!o) { ax.strokeStyle = 'rgba(0,0,0,.6)'; ax.lineWidth = .5; ax.stroke(); } });
  }
  function ruota(x, y, a, fn) { const prima = regM; regM = molReg(regM, [Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),x,y]); ax.save(); ax.translate(x, y); ax.rotate(a); fn(); ax.restore(); regM = prima; }
  
  // --- mobili (misure vere, in metri * M) ------------------------------------
  // Sedie e leggii NON sono in scala vera: un musicista nel gioco e' un pallino di
  // 14 px (raggio 7, `disegnaPezzo`), e la sedia deve poterlo reggere. Detto da
  // Gianluca il 23/09: a 45 cm veri sembravano sedie per bambini.
  const SEDIA = 1.6;
  function sedia(x, y, a = 0, col = T.tessuto) { ingombro('sedia', x, y, 9 * SEDIA, 10 * SEDIA, a); ruota(x, y, a, () => { ax.scale(SEDIA, SEDIA);
    rett(-4.5, -4.5, 9, 9, col); rett(-4.5, 3, 9, 2.4, T.nero); }); }
  function leggio(x, y, a = 0) { ingombroA('leggio', x, y, 0, -3 * SEDIA, 11 * SEDIA, 3 * SEDIA, a); ruota(x, y, a, () => { ax.scale(SEDIA, SEDIA);
    ax.strokeStyle = T.ombra; ax.lineWidth = 1.4; ax.beginPath(); ax.moveTo(-5, -2); ax.lineTo(5, -2); ax.stroke();
    ax.strokeStyle = T.metallo; ax.lineWidth = 1.1; ax.beginPath(); ax.moveTo(-5.5, -3); ax.lineTo(5.5, -3); ax.stroke();
    ax.fillStyle = T.metallo; ax.beginPath(); ax.arc(0, -1.5, .9, 0, 7); ax.fill(); }); }
  function banco(x, y, a = 0) { ingombro('banco', x, y, 18, 12, a); ruota(x, y, a, () => { rett(-9, -6, 18, 12, T.legno); sedia(0, 14, 0); sediaDi('banco'); }); }
  function coda(x, y, a = 0) { ingombroA('coda', x, y, 0, -4.5, 31, 53, a); ruota(x, y, a, () => {   // 1,55 x 2,10 m
    //  Chi suona sta dalla parte della panchetta: il lato lungo e dritto (i bassi)
    //  gli resta a SINISTRA, la curva corta a destra. Corretto il 24/09 su
    //  indicazione di Gianluca: prima era allo specchio.
    conOmbra(o => { ax.beginPath();
      ax.moveTo(15.5, -21); ax.lineTo(-15.5, -21); ax.lineTo(-15.5, -2);
      ax.bezierCurveTo(-15.5, 8, -4, 10, -2, 16); ax.bezierCurveTo(0, 21, 8, 22, 12, 20);
      ax.bezierCurveTo(15.5, 18, 15.5, 14, 15.5, 8); ax.closePath();
      ax.fillStyle = o ? T.ombra : T.laccato; ax.fill();
      if (!o) { ax.strokeStyle = '#3a3d44'; ax.lineWidth = .7; ax.stroke(); } });
    ax.strokeStyle = 'rgba(255,255,255,.12)'; ax.lineWidth = .6;       // il coperchio aperto
    ax.beginPath(); ax.moveTo(14, -17); ax.lineTo(-13, 10); ax.stroke();
    ax.fillStyle = T.tasti; ax.fillRect(-14, -24, 28, 3.4);             // tastiera
    ax.fillStyle = T.nero; for (let i = -13; i < 14; i += 1.9) if ((Math.round(i*10)%7) !== 0) ax.fillRect(i, -24, .8, 2);
    rett(-6, -31, 12, 5, T.pelle);                                        // panchetta
  }); }
  function verticale(x, y, a = 0, scala = 1, registroStorico = false) {
    // L'Aula 9 e' gia' approvata: mantiene il registro storico; le nuove
    // correzioni registrano invece l'ingombro nello stesso sistema del disegno.
    if (registroStorico) ingombro('verticale', x, y + 6 * scala, 30 * scala, 24 * scala, a);
    else ruota(x, y, a, () => ingombro('verticale', 0, 6 * scala, 30 * scala, 24 * scala, 0));
    ruota(x, y, a, () => { ax.scale(scala, scala);   // 1,50 x 0,60 m, contro il muro
    rett(-15, -6, 30, 12, T.laccato); ax.fillStyle = T.tasti; ax.fillRect(-13, 6, 26, 3);
    ax.fillStyle = T.nero; for (let i = -12; i < 13; i += 1.8) ax.fillRect(i, 6, .7, 1.8);
    rett(-6, 13, 12, 5, T.pelle); }); }
  function timpano(x, y, r) { ingombroTondo('timpano', x, y, r); tondo(x, y, r, '#8a6a3c'); ax.fillStyle = '#d9d0b8'; ax.beginPath(); ax.arc(x, y, r - 1.6, 0, 7); ax.fill();
    ax.strokeStyle = 'rgba(0,0,0,.25)'; ax.lineWidth = .4; ax.beginPath(); ax.arc(x, y, r*0.35, 0, 7); ax.stroke(); }
  function piatto(x, y, r = 4) { // piatto sospeso: circa 40 cm, su asta sottile
    ingombroTondo('piatto', x, y, r); ax.strokeStyle = T.metallo; ax.lineWidth = .9;
    ax.beginPath(); ax.moveTo(x, y + r); ax.lineTo(x, y + r + 9); ax.stroke();
    ax.beginPath(); ax.arc(x, y, r, 0, 7); ax.strokeStyle = '#b39a55'; ax.lineWidth = 1.1; ax.stroke();
    ax.fillStyle = '#d8c46d'; ax.beginPath(); ax.arc(x, y, 1.1, 0, 7); ax.fill();
  }
  //  Le lamine lunghe (i bassi) stanno a -x: con a = 0 il suonatore sta a +y e le
  //  ha alla sua sinistra. Contro il muro in basso si usa a = Math.PI.
  function marimba(x, y, a = 0) { ingombro('marimba', x, y, 50, 16, a); ruota(x, y, a, () => {    // 2,50 x 0,80 m
    rett(-25, -8, 50, 16, T.legnoScuro);
    for (let i = 0; i < 26; i++) { const h = 14 - i * 0.28; ax.fillStyle = i % 2 ? '#9a7048' : '#a57a50'; ax.fillRect(-24 + i * 1.88, -h / 2, 1.5, h); } }); }
  function batteria(x, y) { ingombro('batteria', x - 1, y - 2.5, 34, 31); // include piatti e sgabello
    tondo(x, y, 5.5, '#2a2c33'); tondo(x - 7, y - 6, 3.2, '#d8d4c8'); tondo(x + 3, y - 8, 3.2, '#d8d4c8'); tondo(x + 9, y + 1, 4, '#d8d4c8');
    [[-12, -1, 5], [10, -9, 5.5], [-6, -12, 4.5]].forEach(([dx, dy, r]) => { ax.strokeStyle = '#b39a55'; ax.lineWidth = .8; ax.beginPath(); ax.arc(x + dx, y + dy, r, 0, 7); ax.stroke(); });
    tondo(x + 1, y + 9, 3, T.nero);
  }
  function lavagna(x, y, w, a = 0) { ingombro('lavagna', x, y, w, 4, a); ruota(x, y, a, () => { rett(-w / 2, -1.5, w, 3, T.verde); ax.fillStyle = T.metallo; ax.fillRect(-w / 2, 1.5, w, .8); }); }
  function cattedra(x, y, a = 0) {
    // Piano da -7 a +7; la sedia profonda 16 sta ora a -16, con un vero
    // varco di 1 px. Registro separato di piano e sedia: entrambi entrano
    // nel percorso, senza trasformare il vuoto fra loro in un falso ostacolo.
    ingombro('cattedra', x, y, 28, 14, a);
    ruota(x, y, a, () => { rett(-14, -7, 28, 14, T.legno); sedia(0, -16, Math.PI); sediaDi('cattedra'); });
  }
  function podio(x, y, a = 0) { ingombro('podio', x, y, 12, 6, a); ruota(x, y, a, () => rett(-6, -3, 12, 6, T.legno)); }
  function trucco(x, y, w, a = 0) { ingombroA('trucco', x, y, 0, 3, w, 10, a); ruota(x, y, a, () => {  // bancone con specchio e lampadine
    rett(-w / 2, -2, w, 10, T.bianco); ax.fillStyle = '#9fb3c0'; ax.fillRect(-w / 2 + 1, -2, w - 2, 1.4);
    //  senza sedie: nei camerini stretti chiudevano il passaggio (Gianluca, 09/2026)
    for (let i = -w / 2 + 3; i < w / 2 - 1; i += 5) { ax.fillStyle = '#f5e7b8'; ax.beginPath(); ax.arc(i, -2.6, 1, 0, 7); ax.fill(); } }); }
  function stender(x, y, w, a = 0) { ingombro('stender', x, y, w, 10, a); ruota(x, y, a, () => {
    ax.fillStyle = T.metallo; ax.fillRect(-w / 2, -.5, w, 1);
    for (let i = -w / 2 + 2; i < w / 2; i += 2.6) { rett(i - .5, -5, 1.2, 10, ['#5a4b6e','#6e4b4b','#3e5160','#4b4b4b'][Math.floor(i+50)%4], false); } }); }
  function divano(x, y, w, a = 0, col = T.tessuto) { ingombro('divano', x, y, w, 16, a); ruota(x, y, a, () => {
    rett(-w / 2, -8, w, 16, col); rett(-w / 2, -8, w, 4, T.nero); rett(-w / 2, -8, 3, 16, T.nero); rett(w / 2 - 3, -8, 3, 16, T.nero);
    ax.strokeStyle = 'rgba(0,0,0,.4)'; ax.lineWidth = .5; for (let i = 1; i < 3; i++) { const cx = -w / 2 + 3 + i * (w - 6) / 3; ax.beginPath(); ax.moveTo(cx, -4); ax.lineTo(cx, 8); ax.stroke(); } }); }
  function mixer(x, y, w, a = 0) { ingombro('mixer', x, y, w + 8, 20, a); ruota(x, y, a, () => {
    rett(-w / 2 - 4, -10, w + 8, 20, T.legnoScuro); rett(-w / 2, -8, w, 13, '#2b2e35');
    for (let i = -w / 2 + 2; i < w / 2 - 1; i += 2.4) { ax.fillStyle = '#4a4f59'; ax.fillRect(i, -7, 1.2, 11); ax.fillStyle = '#c8c2b0'; ax.fillRect(i - .2, -1 + Math.sin(i) * 3, 1.6, 1.4); }
    rett(-8, 5.5, 16, 3, '#1c1e22'); }); }
  function cassa(x, y, a = 0) { ingombro('cassa', x, y, 8, 10, a); ruota(x, y, a, () => { rett(-4, -5, 8, 10, T.nero); ax.fillStyle = '#3a3d44'; ax.beginPath(); ax.arc(0, 1, 2.6, 0, 7); ax.fill(); rett(-4, 3.8, 8, 1.2, '#8a8f99', false); }); }   // il fronte (striscia chiara) guarda a +y
  function rack(x, y, a = 0) { ingombro('rack', x, y, 12, 24, a); ruota(x, y, a, () => { rett(-6, -12, 12, 24, T.nero); ax.fillStyle = '#3a3d44'; for (let i = -10; i < 11; i += 3) ax.fillRect(-5, i, 10, 1.6);
    ax.fillStyle = '#7fd08f'; ax.fillRect(3, -9, .8, .8); }); }
  function bobine(x, y, a = 0) { ingombro('bobine', x, y, 18, 14, a); ruota(x, y, a, () => {   // registratore a bobine da studio, 0,90 x 0,70 m
    rett(-9, -7, 18, 14, '#b9b4a6'); rett(-9, 3, 18, 4, '#2a2c31');
    for (const dx of [-4.5, 4.5]) { tondo(dx, -1.5, 4.2, '#8f949b'); ax.fillStyle = '#5a4636'; ax.beginPath(); ax.arc(dx, -1.5, 3, 0, 7); ax.fill();
      ax.fillStyle = '#c9c4b6'; ax.beginPath(); ax.arc(dx, -1.5, 1, 0, 7); ax.fill(); }
    ax.strokeStyle = '#3a2c20'; ax.lineWidth = .5; ax.beginPath(); ax.moveTo(-4.5, 2.7); ax.lineTo(4.5, 2.7); ax.stroke();
    ax.fillStyle = '#c8c2b0'; for (let i = -7; i < 8; i += 2.4) ax.fillRect(i, 4.5, 1.2, 1.2); }); }
  function laptop(x, y, a = 0) { ingombro('laptop', x, y, 6.6, 4.6, a); ruota(x, y, a, () => {    // aperto, 33 x 23 cm
    rett(-3.3, -1, 6.6, 4.6, '#9aa0a8'); ax.fillStyle = '#5b6068'; ax.fillRect(-2.8, -.4, 5.6, 2.2);
    rett(-3.3, -2.2, 6.6, 1.2, '#2c3038'); ax.fillStyle = '#6fa8d0'; ax.fillRect(-2.9, -2, 5.8, .5); }); }
  function poltrona(x, y) { ingombroTondo('poltrona', x, y, 5.5); tondo(x, y, 5.5, T.nero); tondo(x, y + 1, 4.2, '#34373e'); }
  function pianta(x, y) { ingombroTondo('pianta', x, y, 5); tondo(x, y, 5, '#5a4636'); ax.fillStyle = '#4e6b4a'; for (let i = 0; i < 7; i++) { const a = i * .9; ax.beginPath(); ax.ellipse(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 3, 1.5, a, 0, 7); ax.fill(); } }
  function wc(x, y, a = 0) { ruota(x, y, a, () => {       // 0,40 x 0,70 m, cassetta contro il muro
    rett(-4, -7, 8, 3, T.bianco);
    conOmbra(o => { ax.beginPath(); ax.ellipse(0, 0.5, 3.4, 4.6, 0, 0, 7); ax.fillStyle = o ? T.ombra : T.bianco; ax.fill();
      if (!o) { ax.strokeStyle = 'rgba(0,0,0,.5)'; ax.lineWidth = .4; ax.stroke(); } });
    ax.fillStyle = '#aab4ba'; ax.beginPath(); ax.ellipse(0, 1, 2.1, 3, 0, 0, 7); ax.fill(); }); }
  function lavabo(x, y, a = 0) { ruota(x, y, a, () => {    // vasca da 0,45 m incassata nel piano
    ax.fillStyle = '#aab4ba'; ax.beginPath(); ax.ellipse(0, 0.5, 3.4, 2.6, 0, 0, 7); ax.fill();
    ax.fillStyle = T.metallo; ax.fillRect(-0.5, -3.6, 1, 2); }); }
  function armadio(x, y, w, a = 0) { ingombro('armadio', x, y, w, 12, a); ruota(x, y, a, () => { rett(-w / 2, -6, w, 12, T.legnoScuro); ax.strokeStyle = 'rgba(0,0,0,.4)'; ax.lineWidth = .5; ax.beginPath(); ax.moveTo(0, -6); ax.lineTo(0, 6); ax.stroke(); }); }

  // --- le aule gia' arredate -------------------------------------------------
  //  b e' il rettangolo che contiene l'aula (x, y, w, h). La regia e' ruotata
  //  e si arreda lungo il suo asse, con coordinate assolute.
  const RICETTE = (() => {
    // Impianti delle aule aggiunte nel secondo giro. Le coordinate restano nel
    // rettangolo utile dell'aula, con arredi distanziati e angoli ortogonali.
    //  Un posto da musicista: sedia e leggio davanti, rivolti verso (vx, vy).
    //  Il davanti della sedia e' il suo -y; il leggio sta 8 px piu' avanti,
    //  sulla stessa direzione. Prima il leggio si metteva sempre 8 px piu' in
    //  su, qualunque fosse il verso della sedia: gli archi sembravano a caso.
    function posto(x, y, vx, vy) { const a = Math.atan2(vx - x, -(vy - y));
      sedia(x, y, a); leggio(x + Math.sin(a) * 8, y - Math.cos(a) * 8, a); }
    //  Il podio e intorno, su un arco di raggio R, i posti agli angoli dati
    //  (gradi: 0 a est, 90 a sud), tutti rivolti al direttore.
    function arco(px, py, R, gradi) { podio(px, py);
      for (const g of gradi) { const t = g * Math.PI / 180; posto(px + Math.cos(t) * R, py + Math.sin(t) * R, px, py); } }
    function studio(b, codaGrande = false, variante = 0, posto) {
      if (posto) { verticale(posto[0], posto[1], posto[2]); return; }
      const x = b.x, y = b.y, w = b.w, h = b.h, cx = x + w / 2;
      // Le due stanze basse richiedono un impianto proprio: coda e posto di
      // studio su meta' opposte, senza coprire sedia, leggio o porta.
      if (codaGrande && variante === 2) {
        coda(x + w - 25, y + 33, 0);
        leggio(x + 22, y + 25, 0); sedia(x + 22, y + 45, 0);
      } else if (codaGrande && variante === 1) {
        coda(x + w - 25, y + 31, 0);
        leggio(x + 22, y + 18, 0); sedia(x + 22, y + 38, 0);
      } else if (codaGrande) coda(cx, y + Math.min(30, h * .42), 0);
      else verticale(cx, y + 10, 0);
      if (!(codaGrande && (variante === 1 || variante === 2))) {
        leggio(cx - 10, y + h - 24, 0); sedia(cx - 10, y + h - 13, 0);
      }
      if (w >= 62 && h >= 62) armadio(x + (variante ? w - 18 : 18), y + h - 12, 22, 0);
    }
    function teoria(b, posto) {
      if (posto) {
        lavagna(posto[0], posto[1], 36, posto[2]); cattedra(posto[3], posto[4], posto[5]);
        for (const [x, y, a] of posto[6]) sedia(x, y, a);
        return;
      }
      const x = b.x, y = b.y, w = b.w, h = b.h, cx = x + w / 2;
      lavagna(cx, y + 9, Math.max(32, w - 26), 0);
      cattedra(cx, y + 24, 0);
      const n = w >= 105 ? 4 : w >= 78 ? 3 : 2, passo = n === 4 ? (w - 34) / 3 : n === 3 ? (w - 34) / 2 : 28;
      for (let k = 0; k < n; k++) banco(x + 17 + k * passo, y + h - 22, Math.PI);
      if (h >= 78) verticale(x + w - 10, y + h / 2, Math.PI / 2);
    }
    function insieme(b, stretto = false, posto) {
      if (posto) {
        verticale(posto[0], posto[1], posto[2]); podio(posto[3], posto[4]);
        for (const [x, y, a] of posto[5]) { sedia(x, y, a); leggio(x, y - 8, a); }
        return;
      }
      const x = b.x, y = b.y, w = b.w, h = b.h;
      // L'impianto approvato di Aula 6: arco largo, sei sedie e leggii
      // tangenti, tutti rivolti verso il podio. Aula 37 ruota lo stesso arco
      // nella sua stanza stretta e lunga, con quattro soli posti.
      const cx = stretto ? x + 20 : x + w / 2;
      const cy = stretto ? y + h / 2 : y + 19;
      const R = 46, n = stretto ? 4 : 6;
      rett(cx - 6, cy - 8, 12, 6, T.legno); leggio(cx, cy + 2, stretto ? -Math.PI / 2 : Math.PI);
      for (let i = 0; i < n; i++) {
        const a = (stretto ? -Math.PI / 2 : 0) + Math.PI * (.12 + .76 * i / (n - 1));
        const sx = cx + Math.cos(a) * R, sy = cy + Math.sin(a) * R;
        sedia(sx, sy, a - Math.PI / 2);
        leggio(cx + Math.cos(a) * (R - 14), cy + Math.sin(a) * (R - 14), a - Math.PI / 2);
      }
      coda(stretto ? x + w - 20 : x + 25, y + h - (stretto ? 31 : 28), 0);
    }
    function percussioni(b, variante = 0, posto) {
      if (posto) {
        for (const p of posto) {
          if (p[0] === 't') timpano(p[1], p[2], p[3]);
          if (p[0] === 'm') marimba(p[1], p[2], p[3] || 0);
          if (p[0] === 'b') batteria(p[1], p[2]);
          if (p[0] === 'a') armadio(p[1], p[2], p[3], p[4] || 0);
          if (p[0] === 'p') verticale(p[1], p[2], p[3], p[4] || 1);
        }
        return;
      }
      const x = b.x, y = b.y, w = b.w, h = b.h;
      if (variante === 6) {             // Aula 55: stanza diagonale, lontano dal muro alto-sinistro
        timpano(x + 44, y + 39, 11); timpano(x + 68, y + 36, 10);
      } else if (variante === 5) {      // Aula 52: l'angolo alto-sinistro e' obliquo
        timpano(x + 37, y + 34, 11);
      } else {
        timpano(x + 20, y + 18, 11); if (variante % 2 === 0) timpano(x + 46, y + 18, 10);
      }
      if (variante === 9) {             // Aula 40: marimba lunga e batteria su due lati diversi
        marimba(x + 18, y + h - 36, Math.PI / 2);
        batteria(x + w - 18, y + 27);
        return;
      }
      if (w < 100) {                    // Aule 4 e 52: marimba in verticale, separata dalla batteria
        marimba(x + 18, y + h - 28, Math.PI / 2);
        batteria(x + w - 28, y + h - 34);
        return;
      }
      marimba(x + Math.min(w - 28, 38), y + h - 18, 0);
      batteria(x + w - 24, y + h - 24);
      if (w >= 76) rett(x + w - 12, y + 22, 8, 22, T.legnoScuro);
    }
    return {
    'Aula 8'(b) {
      coda(b.x + 62, b.y + 62, 0.35); leggio(b.x + 88, b.y + 100, -0.4);
      sedia(b.x + 92, b.y + 108, -0.4); armadio(b.x + 60, b.y + 124, 40, 0); pianta(b.x + 104, b.y + 14); },
    'Aula 18'(b) { studio(b, false, 0, [741.3, 1241.3, 0]); },
    'Aula 9'(b) {
      // Il verticale segue il muro obliquo alto: dorso a 2 px e tastiera in aula.
      verticale(166.25, 870.75, 0.53, 1, true);
      lavagna(b.x + 55, b.y + 157.25, 70, 0); cattedra(b.x + 60, b.y + 127, Math.PI);
      for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) banco(b.x + 32 + k * 27, b.y + 80 + r * 31, Math.PI); },
    'Aula 6'(b) {
      const cx = b.x + 98, cy = b.y + 22;
      rett(cx - 6, cy - 8, 12, 6, T.legno); leggio(cx, cy + 2, Math.PI);   // podio e leggio del direttore
      const R = 46, n = 6;              // sei posti al massimo: i musicisti restano i protagonisti
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (0.12 + 0.76 * i / (n - 1)); const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
        if (y > b.y + b.h - 8) continue;
        sedia(x, y, a - Math.PI / 2); leggio(cx + Math.cos(a) * (R - 14), cy + Math.sin(a) * (R - 14), a - Math.PI / 2); }
      coda(b.x + 24, b.y + 69, Math.PI); },   // tastiera verso il muro basso, lato lungo sul muro sinistro
    'Aula 49'() {
      ruota(400, 205, -0.93, () => {    // nel suo verso e' larga 60 px (3 m) e lunga 100 (5 m)
        mixer(0, -10, 40, 0); cassa(-22, -30, -0.52); cassa(22, -30, 0.52); poltrona(0, 8);   // monitor puntati sulla poltrona (Gianluca, 24/09)
        rett(-36, 16, 10, 24, T.legnoScuro); laptop(-31, 26, Math.PI / 2);   // tavolino, bobine e rack contro i muri (24/09)
        bobine(28, 20, -Math.PI / 2); rack(28, 47, 0); divano(-4, 52, 30, Math.PI, T.tessutoChiaro);
      }); },
    //  I camerini sono ruotati come la regia e si arredano lungo il loro asse.
    //  Centro e angolo vengono dal rettangolo piu' stretto che contiene l'aula;
    //  nei commenti le misure nel suo verso e il lato della porta, da lasciare libero.
    'Aula 46'() {
      ruota(464.3, 64.7, -0.92, () => {   // 100 x 40 px (5 x 2 m), porta sul lato corto a x -60
        stender(-21, -17, 14, 0); trucco(15, -21, 42, 0);   // stender al posto dell'armadio: prima chiudeva la finestra (Gianluca, 24/09)
      }); },
    'Aula 47'() {
      ruota(507.6, 122.3, 0.73, () => {
        divano(-20, 24, 28, Math.PI); stender(22, -8, 14, Math.PI / 2);   // divano con lo schienale al muro sud-ovest, accanto alla porta (Gianluca, 24/09)
        trucco(39, -3, 20, Math.PI / 2);
      }); },
    'Aula 48'() {
      ruota(589.6, 199.7, -0.78, () => {
        trucco(-29, 18, 40, -Math.PI / 2); divano(5, -49, 26, 0);
        pianta(12, -30); stender(10, 22, 30, Math.PI / 2);
      }); },
    //  I due bagni sono uno lo specchio dell'altro: una L con il braccio largo
    //  (le cabine) e il braccio stretto (i lavabi, poi la porta sul corridoio).
    //  Nel primo il braccio largo sta in alto, nel secondo in basso: `d` e' la
    //  distanza dal muro di fondo delle cabine, e `Y(d)` la porta nel mondo.
    'BAGNI'(b) {
      const giu = b.y > 1400, Y = d => giu ? b.y + b.h - d : b.y + d;
      const fascia = (x, d1, d2, w, col) => rett(x, Math.min(Y(d1), Y(d2)), w, Math.abs(d2 - d1), col);
      const verso = giu ? Math.PI : 0, L = 22, x0 = b.x + 3, PARETE = '#5d6670';
      for (let k = 0; k < 5; k++) {                         // cinque cabine da 1,10 m
        const x = x0 + k * L;
        wc(x + L / 2, Y(5), verso);
        if (k) fascia(x - .6, 0, 30, 1.2, PARETE);          // tramezzi
        fascia(x + 1, 29.4, 30.6, 5, PARETE); fascia(x + L - 5, 29.4, 30.6, 5, PARETE);
        ruota(x + L - 5, Y(30), giu ? 0.5 : -0.5, () => rett(-11, -.6, 11, 1.2, PARETE));   // porta socchiusa
      }
      fascia(b.x + 62.5, 60, 108, 10, '#8f8a80');            // piano dei lavabi sul muro interno
      ax.fillStyle = '#9fb3c0'; ax.fillRect(b.x + 62.5, Math.min(Y(62), Y(106)), 1.2, 44);   // specchio
      for (const d of [70, 84, 98]) lavabo(b.x + 68, Y(d), -Math.PI / 2);
      tondo(b.x + b.w - 10, Y(64), 3, T.metallo);            // cestino
    },
    'Aula 34'(b) { percussioni(b, 0, [['t', 772, 1765, 9], ['t', 800, 1765, 9], ['m', 792, 1800, Math.PI]]); },   // secondo timpano scostato dalla finestra (24/09)

    //  A pianoforte: piccoli studi, liberi davanti alla porta.
    'Aula 3'(b) { verticale(795.5, 642.5, 0); }, 'Aula 20'(b) { verticale(371.5, 1265, Math.PI / 2); }, 'Aula 25'(b) { verticale(371.5, 1495, Math.PI / 2); },
    'Aula 27'(b) { verticale(761.5, 1498.5, Math.PI / 2); }, 'Aula 28'(b) { verticale(807, 1522.75, Math.PI); }, 'Aula 35'(b) { verticale(180, 1858.25, Math.PI); },

    //  B teoria: lavagna laterale, cattedra e banchi rivolti verso di lei.
    'Aula 1'() { lavagna(628.5, 606.3, 42, -0.159); cattedra(628.5, 638, -0.159); banco(608, 674, 0); banco(634, 674, 0); },
    'Aula 7'() { lavagna(622, 715.5, 38, 0); cattedra(622, 747, 0); banco(608, 783, 0); banco(634, 783, 0); },
    'Aula 10'() { lavagna(777, 950, 70, 0); cattedra(777, 979, 0); sedia(758, 999, 0); sedia(796, 999, 0); },
    'Aula 13'() { lavagna(202, 1090.5, 70, 0); cattedra(202, 1120, 0); sedia(180, 1144, 0); sedia(210, 1144, 0); },
    'Aula 21'() {   // insegnante a est, allievi a ovest: in mezzo resta il passaggio dalla porta alle finestre sul cortile.
      // Fra finestre e porta la cattedra non ci sta: l'insegnante ha un banco.
      lavagna(663, 1261, 50, Math.PI / 2); banco(636, 1261, -Math.PI / 2); sedia(543, 1257, Math.PI / 2); sedia(543, 1279, Math.PI / 2); },
    'Aula 26'() { verticale(539.5, 1496, -Math.PI / 2); },
    'Aula 31'() { lavagna(180, 1606, 46, 0); cattedra(180, 1635, 0); sedia(215, 1630, -0.9); },   // un allievo solo, di lato: sotto la cattedra si passa fino alla finestra (24/09)
    'Aula 33'() { lavagna(178, 1753.5, 46, 0); banco(178, 1780.5, Math.PI); sedia(226, 1774, 0); },   // fra finestra e porta la cattedra non ci sta: banco per l'insegnante
    'Aula 51'() { verticale(695.6, 435, -1.883); },   // sul muro ovest obliquo: quello est ha solo finestre

    //  C musica d'insieme: direttore, semicerchio di sei posti e pianoforte.
    // Ogni gruppo guarda il podio da un arco: le coordinate sono i posti,
    // non una fila raddrizzata; le aule strette hanno raggio e numero ridotti.
    'Aula 12'() { verticale(800, 1027.5, 0); arco(745, 1040, 46, [30, 65, 100]); },
    'Aula 17'() { verticale(515, 1265, Math.PI/2); arco(475, 1330, 40, [-140, -90, -40]); }, 'Aula 23'() { verticale(190.5, 1425.75, Math.PI/2); arco(100, 1425, 46, [20, 60, 100]); },
    'Aula 24'() { verticale(515, 1480, Math.PI / 2); arco(400, 1505, 44, [-90, -50, -10]); },
    'Aula 30'() { verticale(829.75, 1675, Math.PI/2); arco(772, 1735, 42, [-145, -90, -35]); },   // trio a sud, lontano dalla porta
    'Aula 37'() { verticale(187.5, 2042.5, Math.PI); arco(191, 1885, 44, [75, 112]); },
    'Aula 38'() { verticale(779, 1900.5, 0); arco(768, 2040, 44, [-140, -90, -40]); },
    'Aula 42'() { coda(650, 1999, Math.PI); arco(550, 1995, 40, [-70, -20, 30]); },   // coda col lato dritto sul muro est

    //  D percussioni: combinazioni diverse, con strumenti distanziati.
    'Aula 4'() { timpano(777, 728, 9); timpano(803, 728, 9); timpano(790, 754, 9); piatto(812, 780); }, 'Aula 11'(b) { percussioni(b, 0, [['p',190,1026.25,0]]); },
    'Aula 14'() { marimba(769.25, 1170.75, 0); timpano(788, 1262, 9); timpano(809, 1262, 9); },   // vicini, nella parte bassa: il varco fra le due parti resta libero (24/09)
    'Aula 16'() { coda(155, 1275, 0); posto(187, 1270, 150, 1270); },
    'Aula 32'() {   // timpani e piatto a semicerchio intorno allo sgabello del suonatore
      const px = 205, py = 1722; sedia(px, py, 0);
      [-170, -120, -60].forEach(g => timpano(px + Math.cos(g * Math.PI / 180) * 24, py + Math.sin(g * Math.PI / 180) * 24, 8));
      piatto(px + Math.cos(-10 * Math.PI / 180) * 24, py + Math.sin(-10 * Math.PI / 180) * 24); },
    'Aula 41'() {   // lavagna sulla parete est, l'unica senza porta ne' finestra; allievi rivolti a est
      lavagna(519.5, 1995, 40, Math.PI / 2); cattedra(490.5, 2010, Math.PI / 2); sedia(472, 1972, Math.PI / 2); },   // un allievo solo: fra lui e la cattedra si passa fino alla finestra (24/09)
    'Aula 52'() { posto(731, 561, 775, 576); posto(734, 591, 775, 576); },   // duo a V sul lato ovest: il passaggio fra le due porte corre a est
    'Aula 55'(b) { percussioni(b, 0, [['p',212,742,-Math.PI / 3]]); }, 'Aula 57'(b) { percussioni(b, 0, [['p',786,1548.25,0]]); },
    'Aula 36'(b) { percussioni(b, 0, [['m',790,1874,Math.PI],['t',752,1872,9]]); }, 'Aula 40'() { verticale(444.5, 1985, Math.PI / 2); },
  }; })();

  //  Le pozze di luce misurate a mano nella prova. Le altre aule ne hanno una
  //  al centro, due se superano i 30 m².
  const LUCI = {
    'Aula 8': [[770, 850], [790, 900]], 'Aula 18': [[741, 1262]], 'Aula 9': [[180, 910], [220, 955], [200, 990]],
    'Aula 6': [[440, 760], [535, 760]], 'Aula 49': [[400, 200]],
    'Aula 34': [[760, 1780], [805, 1780]],
  };

  // Ritagli con muri diagonali o con varchi ricostruiti a mano: gli arredi
  // restano nel disegno e sono ricontrollati con le loro coordinate, ma non
  // trasformiamo in falsi rettangoli gli elementi che il registro non sa
  // descrivere (arco, trucco e coda hanno sagome non rettangolari).
  const RITAGLI_COMPLESSI = new Set([
    'Aula 46', 'Aula 47', 'Aula 48', 'Aula 51', 'Aula 52', 'Aula 1', 'Aula 10',
    'Aula 12', 'Aula 21', 'Aula 16', 'Aula 24', 'Aula 26', 'Aula 27', 'Aula 33',
    'Aula 35', 'Aula 37', 'Aula 38', 'Aula 40', 'Aula 42',
  ]);

  const TIPO = { 'Aula 8': 'A', 'Aula 18': 'A', 'Aula 9': 'B', 'Aula 6': 'C', 'Aula 46': 'E', 'Aula 47': 'E', 'Aula 48': 'E', 'Aula 49': 'F', 'Aula 34': 'D' };
  //  I camerini sono la 46, la 47 e la 48, accanto alla regia (Gianluca,
  //  23/09). Danno sulla platea e non sul palco, e va bene cosi': con la
  //  regia fanno del ramo in alto il retroscena, e la zona si riconosce.
  //  Il camerino della prova (sull'aula 57) resta in `prova_arredi.html`
  //  come modello: queste tre sono ruotate e vanno arredate lungo il loro asse.
  const PAVIMENTO = { A: 'parquet', B: 'linoleum', C: 'parquet', D: 'gomma', E: 'graniglia', F: 'moquette' };

  const superficie = z => Math.abs(z.anelli.reduce((t, r) => t + r.reduce((s, p, i) => {
    const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0), 0) / 2) / (M * M);

  //  Piccole (fino a 15 m²) pianoforte, grandi (oltre 30) musica d'insieme,
  //  le medie teoria e percussioni a turno, nell'ordine della mappa.
  let turno = 0;
  const tipi = new Map();
  for (const z of AULE) {
    let t = TIPO[z.nome];
    if (!t) { const m2 = superficie(z); t = m2 <= 15 ? 'A' : m2 > 30 ? 'C' : (turno++ % 2 ? 'D' : 'B'); }
    tipi.set(z, t);
  }

  function percorso(anelli) { ax.beginPath(); for (const a of anelli) { a.forEach(([x, y], i) => i ? ax.lineTo(x, y) : ax.moveTo(x, y)); ax.closePath(); } }

  //  Il ritaglio si fa a 3 pixel per pixel del mondo: con lo zoom del gioco
  //  resta nitido, e i 43 ritagli insieme pesano pochi megabyte.
  const RIS = 3, BORDO = 4;
  const motivi = {}, ritagli = new Map(), ingombriPerAula = new Map();
  function ritaglio(z) {
    if (ritagli.has(z)) return ritagli.get(z);
    const t = tipi.get(z), x0 = z.x - BORDO, y0 = z.y - BORDO, w = z.w + 2 * BORDO, h = z.h + 2 * BORDO;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(w * RIS); cv.height = Math.ceil(h * RIS);
    ax = cv.getContext('2d');
    ax.scale(RIS, RIS); ax.translate(-x0, -y0);
    ax.save(); percorso(z.anelli); ax.clip();
    const pav = t ? PAVIMENTO[t] : 'piastrelle';          // senza tipologia e' un bagno
    ax.fillStyle = ax.createPattern(motivi[pav] || (motivi[pav] = motivo(pav)), 'repeat');
    ax.fillRect(x0, y0, w, h);
    registro = []; regM = [1, 0, 0, 1, 0, 0]; registra = true;
    if (RICETTE[z.nome]) {
      // Anche le stanze sagomate devono passare dal registro: altrimenti una
      // sedia o un mobile nel collo fra due parti della stanza resta invisibile
      // ai controlli di passaggio e di finestra.
      RICETTE[z.nome]({ x: z.x, y: z.y, w: z.w, h: z.h });
    }
    ingombriPerAula.set(z, registro.map(o => ({ ...o, punti: o.punti && o.punti.map(p => ({ ...p })), centro: o.centro && { ...o.centro } })));
    const luci = LUCI[z.nome] || (superficie(z) > 30
      ? [[z.centro.x - z.w / 5, z.centro.y], [z.centro.x + z.w / 5, z.centro.y]] : [[z.centro.x, z.centro.y]]);
    for (const [lx, ly] of luci) {                    // pozze di luce
      const g = ax.createRadialGradient(lx, ly, 2, lx, ly, 55);
      g.addColorStop(0, 'rgba(255,236,200,0.16)'); g.addColorStop(1, 'rgba(255,236,200,0)');
      ax.fillStyle = g; ax.fillRect(x0, y0, w, h); }
    ax.strokeStyle = 'rgba(0,0,0,0.5)'; ax.lineWidth = 7; percorso(z.anelli); ax.stroke();   // ombra dei muri
    ax.restore();
    const r = { cv, x: x0, y: y0, w, h };
    ritagli.set(z, r);
    return r;
  }

  return {
    //  Incolla l'aula arredata sul contesto del gioco, gia' nel sistema del mondo.
    disegna(g, z) { const r = ritaglio(z); g.drawImage(r.cv, r.x, r.y, r.w, r.h); },
    tipo: z => tipi.get(z),
    ingombri(z) { ritaglio(z); return ingombriPerAula.get(z) || []; },
  };
})();
