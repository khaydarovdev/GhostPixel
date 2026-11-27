// GhostPixel - Team TriLogy
// Station: hide a message (calls C++ hideMessage).
'use strict';

// =====================================================================
//  HIDE
// =====================================================================
const H = { cover: null, name: '', stego: null, split: 50, glow: false, lastCells: 0 };
function hideInit() {
  $('#hMeter').innerHTML = '<i></i>'.repeat(32);
  makePicker($('#hPick'), { title: 'Cover photo', ghost: false, onPick: (img, name) => {
    H.cover = img; H.name = name; H.stego = null;
    drawTo($('#hBefore'), img); drawTo($('#hAfter'), img);
    setGlow(false); $('#hGhostBtn').disabled = true; $('#hAfterBox').hidden = true; $('#hLoupeBox').hidden = true;
    $('#hCap').textContent = 'Hide something, then drag across the photo to compare.'; setMsg($('#hNote'), '', '');
    hideMeter();
  } }).choose('coffee');
  // before / after slider
  const st = $('#hStage');
  const setSplit = v => { H.split = clamp(v, 0, 100); $('#hAfter').style.clipPath = `inset(0 0 0 ${H.split}%)`; $('#hHandle').style.left = H.split + '%'; st.setAttribute('aria-valuenow', Math.round(H.split)); };
  const fromEv = e => { const r = st.getBoundingClientRect(); setSplit((e.clientX - r.left) / r.width * 100); };
  st.addEventListener('pointerdown', e => { st.setPointerCapture(e.pointerId); fromEv(e); st.onpointermove = fromEv; });
  st.addEventListener('pointerup', () => { st.onpointermove = null; });
  st.tabIndex = 0; st.setAttribute('role', 'slider'); st.setAttribute('aria-label', 'Compare original and photo with secret');
  st.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') setSplit(H.split - 5); if (e.key === 'ArrowRight') setSplit(H.split + 5); });
  setSplit(50);
  let typeT = 0;
  $('#hMsg').addEventListener('input', () => { hideMeter(true); const n = performance.now(); if (n - typeT > 70) { sfx('type'); typeT = n; } });
  $('#hFill').addEventListener('click', fillBrim);
  $('#hPwShow').addEventListener('click', e => { const on = $('#hPw').type === 'password'; $('#hPw').type = on ? 'text' : 'password'; e.currentTarget.setAttribute('aria-pressed', on); e.currentTarget.textContent = on ? 'Hide' : 'Show'; });
  $('#hGo').addEventListener('click', doHide);
  $('#hGhostBtn').addEventListener('click', () => { setGlow(!H.glow); sfx(H.glow ? 'boo' : 'click'); if (H.glow) say('There I am. Only a thin strip, because your message is short. Try "Fill to the brim".', 5200); });
  $('#hPng').addEventListener('click', () => H.stego && savePng(H.stego, H.name + '-ghost'));
  $('#hBmp').addEventListener('click', () => H.stego && saveBmp(H.stego, H.name + '-ghost'));
}
INIT.hide = hideInit;
function hideMeter(spark) {
  if (!H.cover) return;
  const bytes = enc($('#hMsg').value).length, cap = GP.capacityBytes(H.cover);
  const over = bytes > cap, cells = bytes ? clamp(Math.ceil(bytes / cap * 32), 1, 32) : 0;
  const cs = $$('#hMeter i');
  cs.forEach((c, i) => c.classList.toggle('on', i < cells));
  $('#hMeter').classList.toggle('over', over);
  if (spark && cells && cs[cells - 1]) { const c = cs[cells - 1]; c.classList.remove('spark'); void c.offsetWidth; c.classList.add('spark'); }
  const pixels = Math.ceil((GP.HEADER_BYTES + bytes) * 8 / 3);
  $('#hMeterTxt').textContent = over
    ? `${fmt(bytes)} bytes: too long. This photo holds ${fmt(cap)}. Trim the message or pick a bigger photo.`
    : `${fmt(bytes)} of ${fmt(cap)} bytes (${(bytes / cap * 100).toFixed(bytes / cap < 0.01 ? 2 : 1)}%), spread over the first ${fmt(pixels)} pixels.`;
}
function fillBrim() {
  if (!H.cover) return;
  const cap = GP.capacityBytes(H.cover);
  const base = ($('#hMsg').value.trim() || 'Boo.') + ' ';
  let s = base.repeat(Math.ceil(cap / Math.max(1, enc(base).length)) + 1);
  let bytes = enc(s).slice(0, cap); s = new TextDecoder().decode(bytes).replace(/\uFFFD+$/, '');
  while (enc(s).length > cap) s = s.slice(0, -1);
  $('#hMsg').value = s; hideMeter(true); sfx('pop');
  say('Filled to the brim. Now hide it and press "See the ghost".', 4200);
}
function doHide() {
  const msg = enc($('#hMsg').value), pw = enc($('#hPw').value), note = $('#hNote');
  if (!H.cover) return;
  if (!pw.length) { setMsg(note, 'err', 'Choose a password first. Your friend will need it to read the message.'); sfx('wrong'); shake($('#hGo').parentElement); $('#hPw').focus(); return; }
  const r = GP.hideMessage(H.cover, msg, pw);
  if (!r.ok) { setMsg(note, 'err', r.error); sfx('wrong'); shake(); return; }
  H.stego = r.image; drawTo($('#hAfter'), r.image);
  const bits = (GP.HEADER_BYTES + msg.length) * 8;
  let changed = 0; for (let i = 0; i < bits; i++) if (r.image.px[i] !== H.cover.px[i]) changed++;
  $('#hFacts').innerHTML = [
    [fmt(bits), 'bits written'], [fmt(changed), 'values changed; the rest already matched'],
    ['1 of 255', 'biggest change to any colour'], [(bits / H.cover.px.length * 100).toFixed(bits / H.cover.px.length < 0.01 ? 3 : 1) + '%', 'of the photo carries data'],
  ].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');
  $('#hAfterBox').hidden = false; $('#hGhostBtn').disabled = false;
  if (H.glow) renderGlow();
  $('#hCap').textContent = 'Drag across the photo: the two sides look the same.';
  setMsg(note, 'ok', 'Hidden. The new photo is ready to save, reveal or scan.');
  setLastGhost({ img: r.image, name: H.name + '-ghost', password: $('#hPw').value, message: $('#hMsg').value });
  // the ghost dives into the photo
  sfx('hide'); flyTo($('#dock'), $('#hStage')); mood('hide', 2600);
  setTimeout(() => say("I'm in. Bet you can't see me.", 3000), 900);
}
function setGlow(on) {
  H.glow = on && !!H.stego;
  $('#hGhostBtn').setAttribute('aria-pressed', H.glow); $('#hGhostBtn').textContent = H.glow ? 'Hide the ghost' : 'See the ghost';
  $('#hGlow').classList.toggle('on', H.glow); $('#hLoupeBox').hidden = !H.glow;
  $('#hAfterTag').textContent = H.glow ? 'The ghost, amplified' : 'With secret';
  if (H.glow) renderGlow();
}
// Amplify: dark photo, every changed pixel lit amber, with a soft glow around it.
function renderGlow() {
  const a = H.cover, b = H.stego, w = a.width, h = a.height;
  const base = new ImageData(w, h), lit = new ImageData(w, h);
  const pay = Math.ceil((GP.HEADER_BYTES + enc(lastMsgFor()).length) * 8 / 3);
  for (let p = 0; p < w * h; p++) {
    const i = p * 3, j = p * 4;
    const ch = a.px[i] !== b.px[i] || a.px[i + 1] !== b.px[i + 1] || a.px[i + 2] !== b.px[i + 2];
    const g = (0.299 * a.px[i + 2] + 0.587 * a.px[i + 1] + 0.114 * a.px[i]) * 0.16;
    if (ch) { base.data.set([255, 196, 90, 255], j); lit.data.set([255, 170, 50, 255], j); }
    else if (p < pay) base.data.set([70, 42, 12, 255], j);
    else base.data.set([g, g * 0.92, g * 0.85, 255], j);
  }
  const cv = $('#hGlow'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); c.putImageData(base, 0, 0);
  const t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').putImageData(lit, 0, 0);
  c.globalCompositeOperation = 'lighter'; c.filter = 'blur(3px)'; c.drawImage(t, 0, 0); c.drawImage(t, 0, 0); c.filter = 'none'; c.globalCompositeOperation = 'source-over';
  // loupe: the top-left 64 x 8 pixels, 10x
  const lw = Math.min(64, w), lh = Math.min(8, h), L = $('#hLoupe'); L.width = lw * 10; L.height = lh * 10;
  const lc = L.getContext('2d');
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
    const i = (y * w + x) * 3, ch = a.px[i] !== b.px[i] || a.px[i + 1] !== b.px[i + 1] || a.px[i + 2] !== b.px[i + 2];
    lc.fillStyle = `rgb(${b.px[i + 2] * 0.45},${b.px[i + 1] * 0.45},${b.px[i] * 0.45})`; lc.fillRect(x * 10, y * 10, 10, 10);
    if (ch) { lc.fillStyle = '#ffb43d'; lc.fillRect(x * 10 + 2, y * 10 + 2, 6, 6); }
  }
}
const lastMsgFor = () => (S.lastGhost && S.lastGhost.img === H.stego ? S.lastGhost.message : $('#hMsg').value);
