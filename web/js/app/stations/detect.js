// GhostPixel - Team TriLogy
// Station: detect hidden data, gauge, verdict and the animated scan (calls C++ analyzeImage).
'use strict';

// =====================================================================
//  DETECT
// =====================================================================
const D = { img: null, name: '', busy: false, g: 0 };
INIT.detect = () => {
  drawGauge(0);
  D.picker = makePicker($('#dPick'), { title: 'Photo to scan', onPick: (img, name) => {
    if (D.busy) return;
    D.img = img; D.name = name; drawTo($('#dCanvas'), img);
    heatReset(img);
    $('#dBand').style.display = $('#dLine').style.display = 'none';
    $('#dBands').innerHTML = ''; $('#dSum').textContent = ''; setVerdict('Not scanned yet', 'v-idle'); animGauge(0);
  } });
  D.picker.choose('ghost');
  $('#dGo').addEventListener('click', scan);
  heatTipInit();
};
ON_SHOW.detect = () => { if (!D.busy && D.picker.key === 'ghost' && D.img !== S.lastGhost.img) D.picker.choose('ghost'); };
const GC = { cx: 120, cy: 128, r: 98 };
const gpt = (v, r = GC.r) => { const a = Math.PI * (1 - v / 100); return [GC.cx + r * Math.cos(a), GC.cy - r * Math.sin(a)]; };
const garc = (a, b, r = GC.r) => { const [x1, y1] = gpt(a, r), [x2, y2] = gpt(b, r); return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
function drawGauge(v) {
  const col = v >= 70 ? 'var(--ember)' : v >= 30 ? 'var(--amber)' : 'var(--ok)';
  const [nx, ny] = gpt(v, GC.r - 26);
  $('#dGauge').innerHTML = `
    <path d="${garc(0, 30)}" stroke="#9fe2b4" stroke-width="18" fill="none" opacity=".18"/>
    <path d="${garc(30, 70)}" stroke="#ffb43d" stroke-width="18" fill="none" opacity=".18"/>
    <path d="${garc(70, 100)}" stroke="#ff4f5e" stroke-width="18" fill="none" opacity=".18"/>
    ${v > 0.5 ? `<path d="${garc(0, Math.min(v, 99.9))}" stroke="${col}" stroke-width="18" fill="none" style="filter:drop-shadow(0 0 6px ${col})"/>` : ''}
    <line x1="${GC.cx}" y1="${GC.cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#f4e8d8" stroke-width="5"/>
    <rect x="${GC.cx - 7}" y="${GC.cy - 7}" width="14" height="14" fill="#f4e8d8"/>
    <text class="num" x="${GC.cx}" y="${GC.cy - 34}" text-anchor="middle">${Math.round(v)}</text>
    <text class="lbl" x="${GC.cx}" y="${GC.cy + 20}" text-anchor="middle">suspicion, 0 to 100</text>
    <text class="lbl" x="14" y="146">0</text><text class="lbl" x="226" y="146" text-anchor="end">100</text>`;
}
function animGauge(to) {
  const from = D.g, t0 = performance.now(); D.g = to;
  if (RM.matches) { drawGauge(to); return; }
  const st = now => { const t = Math.min(1, (now - t0) / 380), e = 1 - (1 - t) ** 3; drawGauge(from + (to - from) * e); if (t < 1) requestAnimationFrame(st); };
  requestAnimationFrame(st);
}
function setVerdict(text, cls, stamp) {
  const v = $('#dVerdict'); v.textContent = text; v.className = 'verdict ' + cls;
  if (stamp) { void v.offsetWidth; v.classList.add('stamp'); }
}
const pctLabel = f => (f * 100 < 1 ? (f * 100).toFixed(1) : Math.round(f * 100)) + '%';

async function scan() {
  if (D.busy || !D.img) return;
  D.busy = true; $('#dGo').disabled = true;
  const img = D.img, band = $('#dBand'), line = $('#dLine');
  heatReset(img);
  band.style.display = line.style.display = 'block'; band.style.height = '0'; line.style.top = '0';
  $('#dBands').innerHTML = `<div class="b hd"><span>Band</span><span>RS estimate</span><span>χ² p-value</span><span>Both</span></div>`;
  setVerdict('Scanning…', 'v-idle'); animGauge(0); mood('idle');
  const statsOnly = $('#dStats').checked;
  const it = GP.analyzeSteps(img); let step, best = 0, panicked = false;
  while (!(step = it.next()).done) {
    const s = step.value;
    if (s.kind === 'band') {
      const b = s.band, h = b.rows / img.height * 100;
      band.style.height = h + '%'; line.style.top = h + '%';
      const row = document.createElement('div'); row.className = 'b';
      row.innerHTML = b.skipped ? `<span>${pctLabel(b.fraction)}</span><span class="muted" style="grid-column:span 3">too few pixels to judge</span>`
        : `<span>${pctLabel(b.fraction)}</span><div class="mbar"><i style="width:${(b.rs * 100).toFixed(1)}%"></i></div><div class="mbar e"><i style="width:${(b.chi * 100).toFixed(1)}%"></i></div><span class="${b.suspicion >= 0.5 ? 'yes' : 'no'}">${b.suspicion >= 0.5 ? 'yes' : 'no'}</span>`;
      $('#dBands').append(row);
      if (!b.skipped) best = Math.max(best, b.suspicion);
      animGauge(best * 100); sfx('tick');
      if (best >= 0.5 && !panicked) { panicked = true; mood('panic'); sfx('alarm'); say('Uh oh. It smells me.', 2200); }
      await sleep(RM.matches ? 0 : 280);
    } else {
      // heat map: each block row appears as the scan line passes it
      band.style.display = 'none';
      if (!HEAT.vals) heatStart(s.cols, s.rows, s.blockSize);
      HEAT.vals.set(s.values, s.row * s.cols); HEAT.done = s.row + 1;
      paintHeat(HEAT.vals);
      line.style.top = ((s.row + 1) / s.rows * 100) + '%';
      if (Math.max(...s.values) >= GP.HEAT_THRESHOLD) sfx('tick');
      await sleep(RM.matches ? 0 : clamp(1400 / s.rows, 12, 90));
    }
  }
  const rep = step.value;
  line.style.display = 'none';
  await heatSettle(rep);
  const useSig = rep.signatureFound && !statsOnly;
  const score = useSig ? 100 : rep.statisticalScore;
  const verdict = useSig ? 'GhostPixel message found' : score >= 70 ? 'Suspicious' : score >= 30 ? 'Uncertain' : 'Looks clean';
  animGauge(score);
  $('#dStage').classList.toggle('hot', useSig || score >= 30);
  setVerdict(verdict, useSig || score >= 70 ? 'v-sus' : score >= 30 ? 'v-unc' : 'v-clean', true); sfx('stamp');
  const parts = [];
  if (rep.signatureFound) parts.push(statsOnly ? `A GPX1 signature is present (${fmt(rep.signatureLength)} bytes), but you told the scan to ignore it.` : `GPX1 signature found: ${fmt(rep.signatureLength)} hidden bytes. That alone settles it.`);
  parts.push(`Statistical score ${rep.statisticalScore}. Hottest band: RS estimate ${(rep.rsStartRegion * 100).toFixed(0)}%, chi-square p ${rep.chiStartP.toFixed(2)}.`);
  if (rep.estimatedPayloadPercent > 0) parts.push(`Both tests agree on roughly the first ${pctLabel(rep.estimatedPayloadPercent / 100)} of the image.`);
  $('#dSum').textContent = parts.join(' ');
  if (useSig || score >= 70) { mood('dead', 2600); say(useSig ? 'Busted. My own header gave me away.' : 'Busted. The statistics saw me.'); }
  else if (score >= 30) { mood('panic', 1500); say('Hmm. It is not sure. Neither am I.'); }
  else { mood('party', 1800); say('Phew. Clean as far as it can tell.'); }
  D.busy = false; $('#dGo').disabled = false;
}
