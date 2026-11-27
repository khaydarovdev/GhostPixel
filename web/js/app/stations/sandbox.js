// GhostPixel - Team TriLogy
// Station: the LSB sandbox, flip single bits or whole bit planes.
'use strict';

// =====================================================================
//  LSB SANDBOX
// =====================================================================
const SB = { orig: null, work: null, x: 0, y: 0, planes: new Set() };
INIT.sandbox = () => {
  $('#sPlanes').innerHTML = [8, 7, 6, 5, 4, 3, 2, 1].map(b => `<button data-b="${b}" aria-pressed="false" title="Flip bit ${b} everywhere">${b}</button>`).join('');
  makePicker($('#sPick'), { title: 'Photo', onPick: img => {
    SB.orig = GP.cloneImage(img); SB.work = GP.cloneImage(img); SB.planes.clear();
    SB.x = Math.floor(img.width / 2); SB.y = Math.floor(img.height / 2);
    drawTo($('#sCanvas'), SB.work); paintPlanes(); paintPixel(); $('#sNote').textContent = '';
  } }).choose('cat');
  $('#sCanvas').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    SB.x = clamp(Math.floor((e.clientX - r.left) / r.width * SB.work.width), 0, SB.work.width - 1);
    SB.y = clamp(Math.floor((e.clientY - r.top) / r.height * SB.work.height), 0, SB.work.height - 1);
    sfx('click'); paintPixel();
  });
  $('#sBits').addEventListener('click', e => {
    const b = e.target.closest('.bit'); if (!b) return;
    const i = (SB.y * SB.work.width + SB.x) * 3 + Number(b.dataset.c), bit = Number(b.dataset.b);
    SB.work.px[i] ^= 1 << (bit - 1);
    const c = $('#sCanvas').getContext('2d'), d = new ImageData(1, 1), p = (SB.y * SB.work.width + SB.x) * 3;
    d.data.set([SB.work.px[p + 2], SB.work.px[p + 1], SB.work.px[p], 255]); c.putImageData(d, SB.x, SB.y);
    sfx('flip'); paintPixel(); bitNote(bit, false);
  });
  $('#sPlanes').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const bit = Number(b.dataset.b), m = 1 << (bit - 1);
    SB.planes.has(bit) ? SB.planes.delete(bit) : SB.planes.add(bit);
    for (let i = 0; i < SB.work.px.length; i++) SB.work.px[i] ^= m;
    drawTo($('#sCanvas'), SB.work); paintPlanes(); paintPixel(); sfx('flip'); bitNote(bit, true);
  });
  $('#sReset').addEventListener('click', () => { SB.work = GP.cloneImage(SB.orig); SB.planes.clear(); drawTo($('#sCanvas'), SB.work); paintPlanes(); paintPixel(); sfx('click'); $('#sNote').textContent = 'Back to the original.'; });
};
function paintPlanes() { $$('#sPlanes button').forEach(b => b.setAttribute('aria-pressed', SB.planes.has(Number(b.dataset.b)))); }
function bitNote(bit, everywhere) {
  const v = 1 << (bit - 1), where = everywhere ? 'every colour of every pixel' : 'this colour';
  let t;
  if (bit === 1) { t = `Bit 1 moves ${where} by just 1 out of 255. That is all GhostPixel ever does, and you can't see it.`; say('See? Invisible. That is my home.', 3000); }
  else if (bit <= 3) t = `Bit ${bit} moves ${where} by ${v}. Still very hard to spot.`;
  else if (bit <= 5) { t = `Bit ${bit} moves ${where} by ${v}. Now it starts to show.`; }
  else { t = `Bit ${bit} moves ${where} by ${v}. Impossible to miss. Nobody hides data up here.`; mood('panic', 1200); say('Yikes, that one shows!', 2200); }
  $('#sNote').textContent = t;
}
function paintPixel() {
  const w = SB.work.width, h = SB.work.height, p = (SB.y * w + SB.x) * 3;
  $('#sXY').textContent = `Pixel ${SB.x}, ${SB.y}`;
  const idx = (SB.y * w + SB.x) * 3;
  $('#sWhere').textContent = idx < 96 ? `This pixel's three colour bytes are numbers ${idx + 1} to ${idx + 3} in the image: inside the GhostPixel header area.` : `Colour bytes ${fmt(idx + 1)} to ${fmt(idx + 3)}. GhostPixel would reach them after ${fmt(Math.floor(idx / 8))} bytes of message.`;
  // loupe: 15 x 15 pixels, 10x each, the chosen one outlined
  const L = $('#sLoupe'); L.width = 150; L.height = 150; const lc = L.getContext('2d');
  lc.fillStyle = '#000'; lc.fillRect(0, 0, 150, 150);
  for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
    const x = SB.x + dx, y = SB.y + dy; if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const q = (y * w + x) * 3; lc.fillStyle = `rgb(${SB.work.px[q + 2]},${SB.work.px[q + 1]},${SB.work.px[q]})`; lc.fillRect((dx + 7) * 10, (dy + 7) * 10, 10, 10);
  }
  lc.strokeStyle = '#ffb43d'; lc.lineWidth = 3; lc.strokeRect(70, 70, 10, 10);
  // marker on the photo
  const M = $('#sMark'), r = M.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  M.width = Math.max(1, r.width * dpr); M.height = Math.max(1, r.height * dpr);
  const mc = M.getContext('2d'), sx = M.width / w, sy = M.height / h, cx = (SB.x + 0.5) * sx, cy = (SB.y + 0.5) * sy;
  mc.strokeStyle = '#ffb43d'; mc.lineWidth = 2 * dpr; mc.shadowColor = '#ffb43d'; mc.shadowBlur = 8 * dpr;
  mc.strokeRect(cx - 9 * dpr, cy - 9 * dpr, 18 * dpr, 18 * dpr);
  mc.beginPath(); mc.moveTo(cx, cy - 22 * dpr); mc.lineTo(cx, cy - 11 * dpr); mc.moveTo(cx, cy + 11 * dpr); mc.lineTo(cx, cy + 22 * dpr);
  mc.moveTo(cx - 22 * dpr, cy); mc.lineTo(cx - 11 * dpr, cy); mc.moveTo(cx + 11 * dpr, cy); mc.lineTo(cx + 22 * dpr, cy); mc.stroke();
  // bit grid: rows R, G, B (stored as bytes 2, 1, 0)
  const rows = [['R', 2], ['G', 1], ['B', 0]];
  $('#sBits').innerHTML = `<span></span>${[8, 7, 6, 5, 4, 3, 2, 1].map(b => `<span class="hd">bit ${b}</span>`).join('')}<span class="hd">value</span>` +
    rows.map(([n, c]) => {
      const v = SB.work.px[p + c], o = SB.orig.px[p + c];
      return `<span class="lab" style="color:${['#7da6ff', '#9fe2b4', '#ff6f6f'][c]}">${n}</span>` +
        [8, 7, 6, 5, 4, 3, 2, 1].map(b => { const on = (v >> (b - 1)) & 1, was = (o >> (b - 1)) & 1; return `<button class="bit ${on ? 'on' : ''} ${on !== was ? 'changed' : ''} ${b === 1 ? 'lsb' : ''}" data-c="${c}" data-b="${b}" aria-label="${n} bit ${b} is ${on}, flip it">${on}</button>`; }).join('') +
        `<span class="val">${v}</span>`;
    }).join('');
  const col = (img) => `rgb(${img.px[p + 2]},${img.px[p + 1]},${img.px[p]})`;
  $('#sSwA').style.background = col(SB.orig); $('#sSwB').style.background = col(SB.work);
  $('#sSwA span').textContent = `before ${SB.orig.px[p + 2]}, ${SB.orig.px[p + 1]}, ${SB.orig.px[p]}`;
  $('#sSwB span').textContent = `now ${SB.work.px[p + 2]}, ${SB.work.px[p + 1]}, ${SB.work.px[p]}`;
}
addEventListener('resize', () => { if (SB.work && current === 'sandbox') paintPixel(); });
