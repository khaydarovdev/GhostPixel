// GhostPixel - Team TriLogy
// Station: our measured results, plus a live check with the C++ detector.
'use strict';

// =====================================================================
//  OUR RESULTS
// =====================================================================
const MEASURED = [{ lab: 'Clean photos', sub: 'nothing hidden', n: 0 }, { lab: '5% hidden', sub: 'random bits from the top', n: 17 }, { lab: '25% hidden', sub: '', n: 18 }, { lab: '100% hidden', sub: '', n: 18 }];
INIT.results = () => {
  $('#resChart').innerHTML = MEASURED.map(m => `<div class="r"><div class="lab">${m.lab}${m.sub ? `<small>${m.sub}</small>` : ''}</div><div class="track">${m.n ? `<i style="--n:${m.n}"></i>` : '<span class="zero">none flagged</span>'}</div><div class="num" data-n="${m.n}">0</div></div>`).join('');
  liveResults();
};
ON_SHOW.results = () => {
  $$('#resChart .track i').forEach(i => { i.style.width = '0'; });
  $$('#resChart .num').forEach(n => { n.textContent = '0'; });
  setTimeout(() => {
    $$('#resChart .r').forEach(r => { const i = r.querySelector('.track i'), n = r.querySelector('.num'), v = Number(n.dataset.n); if (i) i.style.width = (v / 19 * 100) + '%'; countUp(n, v); });
  }, 120);
};
function countUp(el, to) { const t0 = performance.now(); const st = now => { const t = Math.min(1, (now - t0) / 1100); el.textContent = Math.round(to * (1 - (1 - t) ** 3)) + (t === 1 ? '/19' : ''); if (t < 1) requestAnimationFrame(st); }; requestAnimationFrame(st); }
async function liveResults() {
  const tb = $('#resLive tbody'); tb.innerHTML = '';
  for (const n of SAMPLE_NAMES) {
    const img = S.samples[n], tr = document.createElement('tr'); tr.innerHTML = `<td>${n}</td><td class="n">…</td><td class="n">…</td><td class="n">…</td><td class="n">…</td>`; tb.append(tr);
    const cells = tr.querySelectorAll('td.n'), byte = () => rnd(256);
    const vals = [GP.analyzeImage(img).statisticalScore];
    for (const f of [0.05, 0.25, 1]) { await frame(); vals.push(GP.analyzeImage(GP.embedRandomBits(img, f, byte)).statisticalScore); }
    vals.forEach((v, i) => { cells[i].textContent = v; cells[i].style.color = v >= 70 ? 'var(--ember)' : v >= 30 ? 'var(--amber)' : 'var(--ok)'; });
  }
}
