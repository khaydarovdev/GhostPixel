// GhostPixel - Team TriLogy
// The pixel ghost mascot: sprite, moods, eyes that follow the pointer, speech bubble.
'use strict';

// =====================================================================
//  The ghost mascot: a 16 x 15 pixel sprite drawn as SVG rects.
//  X = outline, O = body. Eyes, mouths and the sweat drop are separate
//  groups that CSS switches on and off with data-mood.
// =====================================================================
const SPRITE = [
  '....XXXXXXXX....',
  '..XXOOOOOOOOXX..',
  '.XOOOOOOOOOOOOX.',
  '.XOOOOOOOOOOOOX.',
  'XOOOOOOOOOOOOOOX', 'XOOOOOOOOOOOOOOX', 'XOOOOOOOOOOOOOOX', 'XOOOOOOOOOOOOOOX',
  'XOOOOOOOOOOOOOOX', 'XOOOOOOOOOOOOOOX', 'XOOOOOOOOOOOOOOX', 'XOOOOOOOOOOOOOOX',
  'XOOOOOOOOOOOOOOX',
  'XOOX.XOOOOX.XOOX',
  '.XX...XXXX...XX.',
];
const R = (x, y, w = 1, h = 1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const SPRITE_SVG = (() => {
  let ol = '', bd = '', sh = '';
  SPRITE.forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      const c = row[x];
      if (c === 'X') ol += R(x, y);
      else if (c === 'O') { if (x >= 12 && y >= 4) sh += R(x, y); else bd += R(x, y); }
    }
  });
  return `<svg class="ghost" viewBox="-1 -1 20 17" shape-rendering="crispEdges" aria-hidden="true">
    <g class="ol">${ol}</g><g class="bd">${bd}</g><g class="sh">${sh}</g><g class="hl">${R(3, 3)}${R(4, 2, 2, 1)}</g>
    <g class="ck">${R(2, 9, 2, 1)}${R(12, 9, 2, 1)}</g>
    <g class="look">
      <g class="ey e-n">${R(4, 6, 2, 3)}${R(10, 6, 2, 3)}</g>
      <g class="e-w"><g class="ey">${R(3, 5, 3, 4)}${R(10, 5, 3, 4)}</g><g class="hl">${R(4, 6)}${R(11, 6)}</g></g>
    </g>
    <g class="ey e-x">${R(3, 6)}${R(5, 6)}${R(4, 7)}${R(3, 8)}${R(5, 8)}${R(10, 6)}${R(12, 6)}${R(11, 7)}${R(10, 8)}${R(12, 8)}</g>
    <g class="ey e-h">${R(3, 8)}${R(4, 7)}${R(5, 8)}${R(10, 8)}${R(11, 7)}${R(12, 8)}</g>
    <g class="ey m-o">${R(7, 10, 2, 2)}</g>
    <g class="ey m-s">${R(6, 10)}${R(7, 11, 2, 1)}${R(9, 10)}</g>
    <g class="ey m-w">${R(6, 11)}${R(7, 10, 2, 1)}${R(9, 11)}</g>
    <g class="sw">${R(17, 1)}${R(16, 2, 3, 2)}${R(17, 4)}</g>
  </svg>`;
})();
const ghostIcon = () => SPRITE_SVG;
const GHOSTS = [];
function makeGhost(el) { el.innerHTML = `<span class="bob" style="display:block">${SPRITE_SVG}</span>`; el.dataset.mood = 'idle'; GHOSTS.push(el); }
let moodT = 0;
function mood(m, ms) {
  clearTimeout(moodT);
  GHOSTS.forEach(g => { g.dataset.mood = m; });
  if (ms) moodT = setTimeout(() => GHOSTS.forEach(g => { g.dataset.mood = 'idle'; }), ms);
}
// The eyes follow the pointer.
let lookPending = false, lastPt = null;
addEventListener('pointermove', e => {
  lastPt = e; if (lookPending) return; lookPending = true;
  requestAnimationFrame(() => {
    lookPending = false;
    for (const g of GHOSTS) {
      const r = g.getBoundingClientRect(); if (!r.width) continue;
      const dx = clamp((lastPt.clientX - (r.left + r.width / 2)) / 160, -1, 1);
      const dy = clamp((lastPt.clientY - (r.top + r.height * 0.4)) / 160, -1, 1);
      const look = g.querySelector('.look'); if (look) look.setAttribute('transform', `translate(${(dx * 1.2).toFixed(2)} ${(dy * 0.9).toFixed(2)})`);
    }
  });
}, { passive: true });
let bubbleT = 0;
function say(text, ms = 3800) {
  const b = $('#bubble'); b.textContent = text; b.classList.add('show');
  clearTimeout(bubbleT); bubbleT = setTimeout(() => b.classList.remove('show'), ms);
}
