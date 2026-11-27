// GhostPixel - Team TriLogy
// The thermal heat map drawn from the C++ detector's block scores.
'use strict';

// ---------- heat map: a thermal view over the dimmed photo ----------
// Every block is drawn: a faint green wash below detect.cpp's threshold
// (0.45), amber to red above it, white-hot at 0.8 and over. The canvas is
// drawn at screen resolution so block gaps and glows stay crisp.
const HEAT = { img: null, cv: null, ctx: null, s: 1, bs: 0, cols: 0, rows: 0, vals: null, done: 0, final: null, sig: 0 };
function heatReset(img) {
  const cv = $('#dHeat'), st = $('#dStage');
  HEAT.img = img; HEAT.cv = cv; HEAT.vals = null; HEAT.final = null; HEAT.done = 0; HEAT.sig = 0;
  HEAT.s = clamp(960 / img.width, 0.25, 6);
  cv.width = Math.max(1, Math.round(img.width * HEAT.s)); cv.height = Math.max(1, Math.round(img.height * HEAT.s));
  HEAT.ctx = cv.getContext('2d'); HEAT.ctx.clearRect(0, 0, cv.width, cv.height);
  st.classList.remove('thermal', 'hot');
  const tip = $('#dTip'); if (tip) tip.hidden = true;
}
function heatStart(cols, rows, bs) {
  HEAT.cols = cols; HEAT.rows = rows; HEAT.bs = bs;
  HEAT.vals = new Float64Array(cols * rows); HEAT.done = 0;
  $('#dStage').classList.add('thermal');
}
function heatColor(v) {
  const T = GP.HEAT_THRESHOLD;
  if (v < T) return { rgb: [159, 226, 180], a: 0.05 + 0.17 * (v / T), glow: 0 };
  const t = clamp((v - T) / (0.8 - T), 0, 1);
  return { rgb: [255, Math.round(180 - 101 * t), Math.round(61 + 33 * t)], a: 0.42 + 0.43 * t, glow: 6 + 18 * t };
}
function paintHeat(vals) {
  const { ctx: c, cv, s, bs, cols, img } = HEAT;
  c.clearRect(0, 0, cv.width, cv.height);
  const gap = Math.max(1, Math.round(s));
  for (let r = 0; r < HEAT.done; r++) {
    for (let k = 0; k < cols; k++) {
      const v = vals[r * cols + k], { rgb, a, glow } = heatColor(v);
      const x = Math.round(k * bs * s), y = Math.round(r * bs * s);
      const w = Math.round(Math.min(bs, img.width - k * bs) * s), h = Math.round(Math.min(bs, img.height - r * bs) * s);
      c.shadowBlur = glow * s * 0.6; c.shadowColor = `rgba(${rgb},0.9)`;
      c.fillStyle = `rgba(${rgb},${a.toFixed(3)})`; c.fillRect(x + gap, y + gap, w - 2 * gap, h - 2 * gap);
      if (v >= 0.8) { c.shadowBlur = 0; c.fillStyle = 'rgba(255,236,214,.55)'; c.fillRect(x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.4); }
    }
  }
  c.shadowBlur = 0;
  if (HEAT.sig) paintPayload();
}
// The exact GhostPixel payload: the first N pixels, row by row from the top-left.
function paintPayload() {
  const { ctx: c, s, img } = HEAT, n = GP.payloadPixels(img, HEAT.sig), w = img.width;
  const full = Math.floor(n / w), rest = n % w;
  const pad = Math.round(4 * s), minH = Math.round(9 * s);
  const fullH = full ? Math.max(full * s, minH) : 0, restH = rest ? (full ? Math.max(s, Math.round(3 * s)) : minH) : 0;
  const box = (x, y, bw, bh) => {
    c.fillStyle = 'rgba(13,10,9,.9)'; c.fillRect(x - 3, y - 3, bw + 6, bh + 6);       // dark edge so it never melts into the frame
    c.shadowColor = 'rgba(244,232,216,.95)'; c.shadowBlur = 12 * s * 0.5;
    c.fillStyle = '#f4e8d8'; c.fillRect(x, y, bw, bh); c.shadowBlur = 0;
    c.fillStyle = 'rgba(255,180,61,.55)';                                              // stripes: one per 8 pixels of payload
    for (let sx = x; sx < x + bw; sx += 8 * s * 2) c.fillRect(sx, y, Math.max(1, 8 * s), bh);
  };
  c.save();
  if (full) box(pad, pad, w * s - 2 * pad, fullH - pad);
  if (rest) box(pad, full ? fullH : pad, Math.max(4, rest * s - pad), restH);
  c.shadowBlur = 0;
  const label = `GPX1 payload: ${fmt(HEAT.sig)} bytes, first ${fmt(n)} pixels`;
  const fs = Math.round(HEAT.cv.width / 34);
  c.font = `${fs}px "Jersey 15", monospace`;
  const tw = c.measureText(label).width, ly = pad + (full ? fullH : 0) + restH + 10;
  c.fillStyle = 'rgba(13,10,9,.9)'; c.fillRect(pad, ly, tw + 20, fs + 12);
  c.fillStyle = '#f4e8d8'; c.fillRect(pad, ly, 4, fs + 12);
  c.textBaseline = 'top'; c.fillText(label, pad + 13, ly + 6);
  c.restore();
}
// After the scan: blend the raw block scores into detect.cpp's smoothed ones.
async function heatSettle(rep) {
  const hm = rep.heat;
  if (!HEAT.vals) { heatStart(hm.cols, hm.rows, hm.blockSize); HEAT.vals.set(hm.raw); }
  HEAT.done = hm.rows;
  const from = Float64Array.from(HEAT.vals), to = hm.cells, cur = new Float64Array(to.length);
  if (!RM.matches) {
    const t0 = performance.now();
    await new Promise(res => {
      const st = now => {
        const t = Math.min(1, (now - t0) / 650), e = t * t * (3 - 2 * t);
        for (let i = 0; i < cur.length; i++) cur[i] = from[i] + (to[i] - from[i]) * e;
        paintHeat(cur); if (t < 1) requestAnimationFrame(st); else res();
      };
      requestAnimationFrame(st);
    });
  }
  HEAT.final = to; HEAT.sig = rep.signatureFound ? rep.signatureLength : 0;
  paintHeat(to);
}
// Hover (or tap) a block to read its score.
function heatTipInit() {
  const st = $('#dStage'), tip = document.createElement('div');
  tip.id = 'dTip'; tip.className = 'htip'; tip.hidden = true; st.append(tip);
  const showAt = e => {
    if (!HEAT.final) { tip.hidden = true; return; }
    const r = st.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * HEAT.img.width, py = (e.clientY - r.top) / r.height * HEAT.img.height;
    const k = Math.floor(px / HEAT.bs), row = Math.floor(py / HEAT.bs);
    if (k < 0 || row < 0 || k >= HEAT.cols || row >= HEAT.rows) { tip.hidden = true; return; }
    const v = HEAT.final[row * HEAT.cols + k];
    tip.textContent = `Block ${k + 1}, ${row + 1}: ${Math.round(v * 100)}${v >= 0.8 ? ', very suspicious' : v >= GP.HEAT_THRESHOLD ? ', suspicious' : ', looks clean'}`;
    tip.hidden = false;
    const x = e.clientX - r.left, y = e.clientY - r.top;
    tip.style.left = clamp(x + 14, 4, r.width - tip.offsetWidth - 4) + 'px';
    tip.style.top = (y > r.height - 50 ? y - tip.offsetHeight - 10 : y + 16) + 'px';
  };
  st.addEventListener('pointermove', showAt);
  st.addEventListener('pointerdown', showAt);
  st.addEventListener('pointerleave', () => { tip.hidden = true; });
}
