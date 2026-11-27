// GhostPixel - Team TriLogy
// Station: break the cipher, two puzzles run on the C++ xorCipher and fnv1a.
'use strict';

// =====================================================================
//  BREAK THE CIPHER
// =====================================================================
const A_MSGS = ['meet me at the clock tower at nine', 'the key is under the third flowerpot', 'bring the lantern and wear the red scarf', 'the treasure is buried behind the old mill'];
const B_MSGS = ['the exam answers are in the blue folder', 'our teacher grades papers on friday nights', 'the ghost in room twelve loves jazz music', 'never trust a pumpkin that is smiling'];
const K = {};
INIT.crack = () => {
  newPair(); newOracle();
  $('#kGuess').addEventListener('input', () => { sfx('type'); paintPair(); });
  $('#kHintBtn').addEventListener('click', () => { K.hint = Math.min(K.hint + 1, 4); paintHint(); sfx('click'); });
  $('#kNew').addEventListener('click', () => { newPair(); sfx('click'); });
  $('#bForm').addEventListener('submit', e => { e.preventDefault(); tryOracle($('#bGuess').value.trim().toLowerCase()); });
  $('#bHintBtn').addEventListener('click', () => { K.bhint = Math.min(K.bhint + 1, 3); paintBHint(); sfx('click'); });
  $('#bBrute').addEventListener('click', brute);
  $('#bNew').addEventListener('click', () => { newOracle(); sfx('click'); });
};
// Encrypt like stego.cpp: checksum (4 bytes) + message, one XOR stream. Keep the message part.
const encPart = (m, pw) => GP.xorCipher(cat(new Uint8Array(u32(GP.fnv1a(enc(m)))), enc(m)), enc(pw)).slice(4);
function newPair() {
  const i = rnd(A_MSGS.length);
  K.a = A_MSGS[i]; const fits = B_MSGS.filter(b => b.length <= K.a.length); K.b = fits.length ? fits[rnd(fits.length)] : B_MSGS[rnd(B_MSGS.length)].slice(0, K.a.length);
  const pw = Array.from({ length: 10 }, () => 'abcdefghijklmnopqrstuvwxyz'[rnd(26)]).join('');
  K.cA = encPart(K.a, pw); K.cB = encPart(K.b, pw); K.hint = 0; K.won = false;
  $('#kGuess').value = ''; paintPair(); paintHint();
}
function paintPair() {
  const g = enc($('#kGuess').value);
  $('#kA').innerHTML = Array.from(K.cA, (b, i) => `<span class="${i < g.length ? 'k' : ''}">${b.toString(16).padStart(2, '0')}</span>`).join('');
  $('#kB').innerHTML = Array.from(K.cB, (b, i) => `<span class="${i < g.length ? 'k' : ''}">${b.toString(16).padStart(2, '0')}</span>`).join('');
  let out = '';
  for (let i = 0; i < K.cB.length; i++) {
    if (i < g.length && i < K.cA.length) {
      const c = K.cB[i] ^ K.cA[i] ^ g[i];
      out += c >= 32 && c < 127 ? esc(String.fromCharCode(c)) : '<span class="bad">▒</span>';
    } else out += '<span class="q">_</span>';
  }
  $('#kOut').innerHTML = out;
  if (!K.won && $('#kGuess').value === K.a) {
    K.won = true; sfx('win'); mood('party', 2400); burstAt($('#kOut'), { n: 80, speed: 8 });
    $('#kHint').textContent = 'Solved! You read ghost B without its password. This is why real ciphers never reuse a key stream: they add a random nonce to every message.';
    say('You read my mail! Without the password!', 3200);
  }
}
function paintHint() {
  const w = K.a.split(' ');
  const H = ['', "Ghost A is a note about where to meet or what to bring.", `It starts with "${w[0]}".`, `The first three words: "${w.slice(0, 3).join(' ')}". Watch ghost B make sense as you type.`, `The whole thing: "${K.a}".`];
  if (!K.won) $('#kHint').textContent = K.hint ? H[K.hint] : 'Tip: if ghost B turns into readable words, your guess for A is right so far.';
}
const PW3 = ['boo', 'bat', 'owl', 'fog', 'hex', 'imp', 'orb', 'urn', 'elm', 'yew', 'web', 'eek'];
const SECRETS3 = ['the crypt opens at dawn', 'leave the candle burning', 'nine ravens, one key', 'the attic is not empty'];
function newOracle() {
  K.pw = PW3[rnd(PW3.length)]; K.secret = SECRETS3[rnd(SECRETS3.length)];
  K.box = GP.xorCipher(cat(new Uint8Array(u32(GP.fnv1a(enc(K.secret)))), enc(K.secret)), enc(K.pw));
  K.bhint = 0; K.busy = false; K.cracked = false;
  $('#bTick').textContent = '???'; $('#bTick').style.color = ''; $('#bStat').textContent = ''; $('#bOut').textContent = ''; $('#bOut').className = 'secret'; $('#bGuess').value = '';
  paintBHint(); paintTable(null);
}
const oracle = pw => { const d = GP.xorCipher(K.box, enc(pw)); return GP.fnv1a(d.slice(4)) === ((d[0] | d[1] << 8 | d[2] << 16 | d[3] << 24) >>> 0) ? d.slice(4) : null; };
function paintBHint() { $('#bHint').textContent = ['', "It's a real English word.", "It's something spooky.", `It starts with "${K.pw[0]}".`][K.bhint] || ''; }
function cracked(pw, msg) {
  K.cracked = true; $('#bTick').textContent = pw; $('#bTick').style.color = 'var(--ok)';
  $('#bOut').className = 'secret live'; scramble($('#bOut'), dec(msg));
  sfx('win'); mood('dead', 2000); burstAt($('#bTick'), { n: 60 }); say('Three letters? I never stood a chance.');
}
function tryOracle(g) {
  if (!g || K.busy || K.cracked) return;
  const m = oracle(g);
  if (m) { cracked(g, m); $('#bStat').textContent = 'Right first time? Lucky, or very spooky.'; return; }
  $('#bTick').textContent = g; $('#bTick').style.color = 'var(--ember)'; sfx('wrong'); shake($('#bForm'));
  $('#bStat').textContent = 'The checksum says no, instantly. A program can ask that question millions of times.';
  $('#bGuess').select();
}
async function brute() {
  if (K.busy || K.cracked) return;
  K.busy = true; sfx('click'); mood('panic'); say('Wait, wait, not the brute force!', 2400);
  const L = 'abcdefghijklmnopqrstuvwxyz', t0 = performance.now(); let n = 0, found = null;
  outer: for (let a = 0; a < 26; a++) {
    for (let b = 0; b < 26; b++) {
      for (let c = 0; c < 26; c++) { const pw = L[a] + L[b] + L[c]; n++; const m = oracle(pw); if (m) { found = [pw, m]; break outer; } }
      $('#bTick').textContent = L[a] + L[b] + '?'; $('#bTick').style.color = '';
      if (b % 4 === 0) await frame();
    }
  }
  const secs = (performance.now() - t0) / 1000;
  // measure raw speed without drawing, for the table
  const t1 = performance.now(); let k = 0; while (performance.now() - t1 < 120) { for (let j = 0; j < 500; j++) oracle('zz' + L[j % 26]); k += 500; }
  const rate = k / ((performance.now() - t1) / 1000);
  K.busy = false;
  if (found) { cracked(found[0], found[1]); $('#bStat').textContent = `Found after ${fmt(n)} tries in ${secs.toFixed(2)} s, while also animating this page. Flat out, this browser checks about ${fmt(rate)} passwords a second.`; }
  paintTable(rate);
}
function paintTable(rate) {
  const rows = [['3 lowercase letters', 26 ** 3], ['6 lowercase letters', 26 ** 6], ['8 letters and digits', 36 ** 8], ['12 mixed-case letters and digits', 62 ** 12]];
  const t = s => { if (s < 1) return 'under a second'; const u = [['years', 31557600], ['days', 86400], ['hours', 3600], ['minutes', 60], ['seconds', 1]]; for (const [n, v] of u) if (s >= v) return (s / v >= 1e6 ? (s / v).toExponential(1) : fmt(s / v)) + ' ' + n; return ''; };
  $('#bTable tbody').innerHTML = rows.map(([n, c]) => `<tr><td>${n}</td><td class="n">${c >= 1e15 ? c.toExponential(1) : fmt(c)}</td><td class="n">${rate ? t(c / rate) : 'run the brute force'}</td></tr>`).join('');
}
