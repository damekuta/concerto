// =============================================================================
//  SAGOME — gli oggetti che si raccolgono, disegnati a mano
// =============================================================================
//  Nel gioco un oggetto e' alto una ventina di pixel. A quella misura una
//  figura dettagliata diventa una macchia: quello che si riconosce e' il
//  PROFILO. Quindi niente ombre, niente sfumature, niente scritte — solo il
//  contorno piu' netto possibile, e nessuna informazione affidata al colore.
//
//  Ogni sagoma si disegna dentro un quadrato di lato `s` centrato su (x, y).
//  `colore` fa da riempimento e da tratto: la differenza fra un oggetto e
//  l'altro sta tutta nella forma.
// =============================================================================

const SAGOME = {

  // Cuffie — l'archetto e i due padiglioni. Vista di fronte.
  cuffie(ctx, x, y, s, colore) {
    const u = s / 20;
    ctx.strokeStyle = colore; ctx.fillStyle = colore;
    ctx.lineWidth = 2.4 * u; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y - u, 7 * u, Math.PI * 1.06, Math.PI * 1.94);   // archetto
    ctx.stroke();
    for (const lato of [-1, 1]) {                                // padiglioni
      ctx.beginPath();
      ctx.ellipse(x + lato * 7 * u, y + 3.6 * u, 2.7 * u, 4.4 * u, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Laptop aperto, di tre quarti: lo schermo largo e la base piu' stretta.
  laptop(ctx, x, y, s, colore) {
    const u = s / 20;
    ctx.strokeStyle = colore; ctx.fillStyle = colore;
    ctx.lineWidth = 1.8 * u; ctx.lineJoin = 'round';
    ctx.beginPath();                                             // schermo
    ctx.moveTo(x - 6 * u, y - 7 * u); ctx.lineTo(x + 6 * u, y - 7 * u);
    ctx.lineTo(x + 6 * u, y + u);     ctx.lineTo(x - 6 * u, y + u);
    ctx.closePath(); ctx.stroke();
    ctx.beginPath();                                             // base
    ctx.moveTo(x - 9 * u, y + 6 * u); ctx.lineTo(x - 5.2 * u, y + 1.4 * u);
    ctx.lineTo(x + 5.2 * u, y + 1.4 * u); ctx.lineTo(x + 9 * u, y + 6 * u);
    ctx.closePath(); ctx.fill();
  },

  // Metronomo — la piramide col pendolo di traverso: e' il pendolo storto a
  // renderlo riconoscibile, non il corpo.
  //
  // `fase` fa oscillare il pendolo: e' un numero che cresce nel tempo (basta
  // passargli `tempo`). A metronomo fermo (`fase` a 0) il pendolo sta dritto
  // al centro. Dormiente oscilla piano, sveglio batte.
  metronomo(ctx, x, y, s, colore, fase = 0, battiti = 1) {
    const u = s / 20;
    // oscilla simmetrico attorno alla verticale, come un metronomo vero:
    // a fase 0 il seno vale 0, quindi da fermo il pendolo e' dritto
    const dondolo = Math.sin(fase * battiti * Math.PI) * 0.36;
    ctx.strokeStyle = colore; ctx.fillStyle = colore;
    ctx.lineWidth = 1.8 * u; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();                                             // corpo
    ctx.moveTo(x - 5.6 * u, y + 8 * u); ctx.lineTo(x - 2 * u, y - 6 * u);
    ctx.lineTo(x + 2 * u, y - 6 * u);   ctx.lineTo(x + 5.6 * u, y + 8 * u);
    ctx.closePath(); ctx.stroke();
    // il pendolo ruota attorno al perno, in basso: il pesetto lo segue
    ctx.save();
    ctx.translate(x - 0.4 * u, y + 5 * u);
    ctx.rotate(dondolo);
    ctx.beginPath();                                             // pendolo
    ctx.moveTo(0, 0); ctx.lineTo(0, -13.6 * u);
    ctx.stroke();
    ctx.beginPath();                                             // pesetto
    ctx.rect(-1.6 * u, -9.5 * u, 3.2 * u, 2.2 * u);
    ctx.fill();
    ctx.restore();
  },

  // Diapason — due rebbi lunghi e il gambo corto. E' la sagoma piu' facile
  // di tutte: non somiglia a niente altro nel gioco.
  diapason(ctx, x, y, s, colore) {
    const u = s / 20;
    ctx.strokeStyle = colore;
    ctx.lineWidth = 2.2 * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 4 * u, y - 8 * u);                            // rebbio sinistro
    ctx.lineTo(x - 4 * u, y + 1.6 * u);
    ctx.quadraticCurveTo(x - 4 * u, y + 4 * u, x, y + 4 * u);    // curva
    ctx.quadraticCurveTo(x + 4 * u, y + 4 * u, x + 4 * u, y + 1.6 * u);
    ctx.lineTo(x + 4 * u, y - 8 * u);                            // rebbio destro
    ctx.stroke();
    ctx.beginPath();                                             // gambo
    ctx.moveTo(x, y + 4 * u); ctx.lineTo(x, y + 8.4 * u);
    ctx.stroke();
  },

  // Partiture — due fogli sfalsati col pentagramma. Le righe orizzontali
  // sono il segno che si legge anche quando il foglio e' grande otto pixel.
  partiture(ctx, x, y, s, colore) {
    const u = s / 20;
    ctx.strokeStyle = colore; ctx.fillStyle = colore;
    ctx.lineWidth = 1.4 * u; ctx.lineJoin = 'round';
    ctx.beginPath();                                             // foglio dietro
    ctx.rect(x - 4 * u, y - 8.4 * u, 11 * u, 14 * u);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.beginPath();                                             // foglio davanti
    ctx.rect(x - 7.6 * u, y - 5.6 * u, 11 * u, 14 * u);
    ctx.stroke();
    ctx.lineWidth = 1.1 * u;                                     // pentagramma
    for (let i = 0; i < 4; i++) {
      const yy = y - 2.6 * u + i * 2.4 * u;
      ctx.beginPath();
      ctx.moveTo(x - 5.8 * u, yy); ctx.lineTo(x + 1.6 * u, yy);
      ctx.stroke();
    }
  },
};

if (typeof module !== 'undefined') module.exports = { SAGOME };
