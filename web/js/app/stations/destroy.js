// GhostPixel - Team TriLogy
// Station: destroy the ghost with JPEG, resizing and cropping, then re-run C++ reveal.
'use strict';

// =====================================================================
//  DESTROY THE GHOST
// =====================================================================
const X = { src: null, token: 0, alive: true, queued: false };
INIT.destroy = () => {
  ['xJpeg', 'xSize', 'xCrop'].forEach(id => $('#' + id).addEventListener('input', queueDestroy));
  $('#xReset').addEventListener('click', () => { $('#xJpeg').value = 101; $('#xSize').value = 100; $('#xCrop').value = 0; sfx('click'); queueDestroy(); });
};
ON_SHOW.destroy = () => {
  if (X.src !== S.lastGhost) { X.src = S.lastGhost; X.alive = true; $('#xJpeg').value = 101; $('#xSize').value = 100; $('#xCrop').value = 0; }
  setMsg($('#xSrc'), 'warn', X.src.demo ? 'Working on the demo ghost (password boo). Hide your own message first to destroy that one instead.' : `Working on ${X.src.name}, the ghost you made in Hide.`);
  queueDestroy();
};
function queueDestroy() { if (X.queued) return; X.queued = true; requestAnimationFrame(() => { X.queued = false; runDestroy(); }); }
async function runDestroy() {
  const tok = ++X.token, g = X.src, q = Number($('#xJpeg').value), s = Number($('#xSize').value) / 100, crop = Number($('#xCrop').value);
  $('#xJpegV').textContent = q > 100 ? 'off' : q; $('#xSizeV').textContent = Math.round(s * 100) + '%'; $('#xCropV').textContent = crop + ' px';
  let cv = imgCanvas(g.img);
  if (crop > 0) { const c = document.createElement('canvas'); c.width = cv.width - crop; c.height = cv.height; c.getContext('2d').drawImage(cv, -crop, 0); cv = c; }
  if (s !== 1) {
    const c = document.createElement('canvas'); c.width = Math.max(8, Math.round(cv.width * s)); c.height = Math.max(8, Math.round(cv.height * s));
    const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(cv, 0, 0, c.width, c.height); cv = c;
  }
  if (q <= 100) {
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', q / 100));
    if (tok !== X.token) return;
    const bmp = await createImageBitmap(blob); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0); cv = c;
  }
  if (tok !== X.token) return;
  const img = fromCanvas(cv).img;
  drawTo($('#xCanvas'), img);
  $('#xCap').textContent = `${fmt(img.width)} × ${fmt(img.height)} pixels` + (q <= 100 ? `, JPEG quality ${q}` : ', lossless');
  const pw = enc(g.password), len = enc(g.message).length, total = (GP.HEADER_BYTES + len) * 8;
  let same = 0; for (let i = 0; i < total; i++) if (i < img.px.length && (img.px[i] & 1) === (g.img.px[i] & 1)) same++;
  const pct = same / total * 100;
  const res = GP.revealMessage(img, pw), alive = res.status === 'ok';
  const life = $('#xLife'); life.firstElementChild.style.width = pct.toFixed(1) + '%';
  life.className = 'life ' + (alive ? '' : pct > 75 ? 'dying' : 'dead');
  $('#xBits').textContent = `${fmt(same)} of ${fmt(total)} payload bits still match (${pct.toFixed(1)}%). Pure chance would match about half.`;
  const out = $('#xOut'), v = $('#xVerdict');
  if (alive) { out.className = 'garble alive'; out.textContent = dec(res.message).slice(0, 600); v.textContent = 'Alive'; v.className = 'verdict v-clean'; }
  else {
    out.className = 'garble dead'; v.textContent = 'Dead'; v.className = 'verdict v-sus';
    let raw = '';
    if (img.px.length >= 64 + (4 + len) * 8) raw = printable(GP.xorCipher(GP.readBytesFromLsb(img, 64, 4 + len), pw).slice(4, 420));
    out.textContent = (res.status === 'no-message' ? 'Reveal: no GPX1 signature, so "no message here".\n' : 'Reveal: wrong password or damaged image. The checksum fails.\n') + (raw ? 'Decrypting anyway gives: ' + raw : '');
  }
  if (alive !== X.alive) {
    X.alive = alive;
    if (alive) { sfx('pop'); mood('pop', 900); say("I'm back! Lossless again."); }
    else { sfx('lose'); mood('dead', 2400); say(q <= 100 ? 'JPEG got me. It rounds my bits away.' : crop ? 'You cropped my head off. Every bit shifted.' : 'Resizing blended me into my neighbours.', 3400); }
  }
}
