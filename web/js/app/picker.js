// GhostPixel - Team TriLogy
// The photo picker used by every station (sample prints, your ghost, drag and drop).
'use strict';

// =====================================================================
//  The photo picker shared by every station.
// =====================================================================
const pickers = [];
function makePicker(host, { onPick, title = 'Photo', ghost = true }) {
  host.innerHTML = `<span class="f">${esc(title)}</span><div class="prints"></div>
    <label class="drop" style="margin-top:12px"><input type="file" accept="image/*,.bmp"><span>Drop a PNG, BMP or JPG here, or <u>browse</u></span></label>
    <div class="msg warn" style="margin-top:10px"></div>`;
  const prints = host.querySelector('.prints'), drop = host.querySelector('.drop'), input = host.querySelector('input'), warn = host.querySelector('.msg');
  const P = { key: null };
  P.refresh = () => {
    prints.innerHTML = SAMPLE_NAMES.map(n => `<button class="pr" data-k="${n}" aria-pressed="${P.key === n}"><img alt="" src="${SAMPLE_PNG[n]}"><span>${n}</span></button>`).join('') +
      (ghost && S.lastGhost ? `<button class="pr" data-k="ghost" aria-pressed="${P.key === 'ghost'}"><span class="gi">${ghostIcon()}</span><span>${esc(S.lastGhost.name)}</span></button>` : '');
  };
  P.choose = key => {
    P.key = key; P.refresh(); setMsg(warn, 'warn', '');
    if (key === 'ghost') onPick(S.lastGhost.img, S.lastGhost.name, { ghost: S.lastGhost });
    else onPick(S.samples[key], key, {});
  };
  async function useFile(file) {
    if (!file) return;
    try {
      const r = await loadImageFile(file);
      P.key = 'file'; P.refresh(); setMsg(warn, 'warn', r.warnings.join(' '));
      onPick(r.img, r.name, { file: true }); sfx('click');
    } catch (e) { setMsg(warn, 'err', e.message || String(e)); sfx('wrong'); }
  }
  prints.addEventListener('click', e => { const b = e.target.closest('.pr'); if (b) { sfx('click'); P.choose(b.dataset.k); } });
  input.addEventListener('change', () => { useFile(input.files[0]); input.value = ''; });
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => useFile(e.dataTransfer.files[0]));
  pickers.push(P); P.refresh();
  return P;
}
function setLastGhost(g) { S.lastGhost = g; pickers.forEach(p => p.refresh()); }
