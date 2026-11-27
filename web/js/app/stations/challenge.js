// GhostPixel - Team TriLogy
// Station: challenge mode, you versus the C++ detector, with shareable codes.
'use strict';

// =====================================================================
//  CHALLENGE: three prints, one ghost, you versus the detector
// =====================================================================
const LEVELS = [
  { name: 'Poltergeist', frac: 0.25, pts: 1, note: '25% of the photo' },
  { name: 'Phantom', frac: 0.02, pts: 2, note: '2%' },
  { name: 'Wisp', frac: 0.005, pts: 3, note: '0.5%' },
  { name: 'Whisper', frac: 0.001, pts: 5, note: '0.1%' },
];
const STORY = ['The cake is in the third drawer.', 'Meet at the library, fourth floor, at four.', 'The fox ran under the bridge at dawn.', 'Bring two lanterns and a map.',
  'The answer is behind the clock.', 'Nobody suspects the quiet pixel.', 'Leave the window open tonight.', 'The red door is a decoy.', 'Count the steps, then turn left.',
  'Our club meets when the moon is full.', 'The key is taped under the desk.', 'Do not trust the parrot.'];
const WORDS = ['pumpkin', 'lantern', 'specter', 'bishkek', 'phantom', 'midnight', 'cobweb', 'banshee', 'trilogy', 'wraith', 'candle', 'raven'];
const BOARD = Object.assign({ you: 0, bot: 0, streak: 0, best: 0, rounds: 0 }, (() => { try { return JSON.parse(store.get('board') || '{}'); } catch (e) { return {}; } })());
const C = { level: Number(store.get('level') || 1), round: null, state: 'idle', goggles: false };
function paintBoard() {
  $('#cBoard').innerHTML = `<div class="you"><b>${BOARD.you}</b><span>your points</span></div><div class="bot"><b>${BOARD.bot}</b><span>detector's points</span></div>
    <div><b>${BOARD.streak}</b><span>streak</span></div><div><b>${BOARD.best}</b><span>best streak</span></div>`;
  store.set('board', JSON.stringify(BOARD));
}
INIT.challenge = () => {
  paintBoard();
  $('#cLevel').innerHTML = LEVELS.map((l, i) => `<button data-l="${i}" aria-pressed="${i === C.level}">${l.name}<small>${l.note}, ${l.pts} pt${l.pts > 1 ? 's' : ''}</small></button>`).join('');
  $('#cLevel').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    C.level = Number(b.dataset.l); store.set('level', C.level); sfx('click');
    $$('#cLevel button').forEach(x => x.setAttribute('aria-pressed', x === b)); newRandomRound();
  });
  $('#cCards').innerHTML = [0, 1, 2].map(i => `<button class="card" data-i="${i}" aria-label="Print ${'ABC'[i]}"><div class="cv"><canvas></canvas><div class="scan"></div><span class="pop gw" data-mood="party">${ghostIcon()}</span></div><div class="foot"><span>Print ${'ABC'[i]}</span><span class="marks"></span><span class="sc"></span></div></button>`).join('');
  $('#cCards').addEventListener('click', e => { const b = e.target.closest('.card'); if (b) guess(Number(b.dataset.i)); });
  $('#cNext').addEventListener('click', () => { sfx('click'); newRandomRound(); });
  $('#cGoggles').addEventListener('click', () => {
    C.goggles = !C.goggles; $('#cGoggles').setAttribute('aria-pressed', C.goggles);
    if (C.goggles && C.state === 'guess') { C.round.goggles = true; say('Goggles on. Your points this round are halved.', 3200); }
    sfx('click'); paintCards();
  });
  $('#cCopy').addEventListener('click', () => C.round && copyText(C.round.code));
  $('#cPlayForm').addEventListener('submit', e => {
    e.preventDefault(); const r = parseCode($('#cPaste').value);
    if (!r) { setMsg($('#cPasteNote'), 'err', "That code doesn't look right. It starts with gp- followed by letters and numbers."); sfx('wrong'); return; }
    setMsg($('#cPasteNote'), 'ok', r.kind === 'm' ? "Your friend's own secret is in one of these prints. Find it." : 'Same round as your friend. Go.'); startRound(r);
    $('#v-challenge').scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth' });
  });
  $('#cmGo').addEventListener('click', makeCustom);
};
ON_SHOW.challenge = code => {
  if (code) { const r = parseCode(code); if (r) { startRound(r); return; } }
  if (!C.round) newRandomRound();
};
function newRandomRound() {
  const seed = (rnd(2 ** 31) % 60466176) >>> 0;   // 5 base-36 digits
  startRound({ kind: 'r', photo: rnd(3), level: C.level, pos: rnd(3), seed });
}
// Codes. Random rounds: gp-r<photo><level><shuffled pos><seed>. Custom rounds:
// gp-m<photo><shuffled pos><hex of the encrypted checksum + message>.
function makeCode(r) {
  if (r.kind === 'r') return `gp-r${r.photo}${r.level}${(r.pos + r.seed) % 3}${r.seed.toString(36)}`;
  const hex = Array.from(r.cipher, b => b.toString(16).padStart(2, '0')).join('');
  return `gp-m${r.photo}${(r.pos + r.cipher[0]) % 3}${hex}`;
}
function parseCode(s) {
  s = String(s || '').trim().toLowerCase().replace(/^#/, '').replace(/^gp-/, '');
  let m = /^r([0-2])([0-3])([0-2])([0-9a-z]{1,7})$/.exec(s);
  if (m) { const seed = parseInt(m[4], 36); return { kind: 'r', photo: +m[1], level: +m[2], pos: ((+m[3] - seed % 3) + 3) % 3, seed }; }
  m = /^m([0-2])([0-2])((?:[0-9a-f]{2}){5,320})$/.exec(s);
  if (m) { const cipher = new Uint8Array(m[3].match(/../g).map(h => parseInt(h, 16))); return { kind: 'm', photo: +m[1], pos: ((+m[2] - cipher[0] % 3) + 3) % 3, cipher }; }
  return null;
}
function startRound(r) {
  const img = S.samples[SAMPLE_NAMES[r.photo]];
  let carrier;
  if (r.kind === 'r') {
    const rng = mulberry32(r.seed), lv = LEVELS[r.level];
    r.password = pickR(WORDS, rng) + Math.floor(rng() * 90 + 10);
    const target = Math.max(8, Math.floor(img.px.length * lv.frac / 8) - GP.HEADER_BYTES);
    let t = ''; while (t.length < target) t += pickR(STORY, rng) + ' ';
    r.message = t.slice(0, target);
    carrier = GP.hideMessage(img, enc(r.message), enc(r.password)).image;
    r.bytes = target;
  } else {
    // rebuild the exact payload: plain "GPX1" + length, then the friend's ciphertext
    const len = r.cipher.length - 4;
    carrier = GP.cloneImage(img);
    GP.writeBytesToLsb(carrier, 0, cat(new Uint8Array([0x47, 0x50, 0x58, 0x31, ...u32(len)]), r.cipher));
    r.bytes = len;
  }
  r.code = makeCode(r);
  r.imgs = [0, 1, 2].map(i => (i === r.pos ? carrier : img));
  r.goggles = C.goggles; r.photoName = SAMPLE_NAMES[r.photo];
  C.round = r; C.state = 'guess';
  $('#cCode').textContent = r.code;
  $$('#cCards .card').forEach(c => { c.classList.remove('guess', 'carrier'); c.disabled = false; c.querySelector('.marks').innerHTML = ''; c.querySelector('.sc').textContent = ''; });
  paintCards();
  $('#cOutcome').textContent = 'Which print hides the ghost?';
  $('#cDetail').textContent = r.kind === 'r' ? `Level ${LEVELS[r.level].name}: the message fills ${LEVELS[r.level].note} of the colour bytes. All three prints look identical. Trust your gut, or put the goggles on.` : 'A custom challenge. Find the print, then use the password your friend gave you.';
  mood('hide');
}
function lsbPlane(img) {
  const o = { width: img.width, height: img.height, px: new Uint8Array(img.px.length) };
  for (let i = 0; i < img.px.length; i++) o.px[i] = (img.px[i] & 1) * 255;
  return o;
}
function paintCards() {
  if (!C.round) return;
  $$('#cCards canvas').forEach((cv, i) => drawTo(cv, C.goggles ? lsbPlane(C.round.imgs[i]) : C.round.imgs[i]));
}
async function guess(i) {
  if (C.state !== 'guess') return;
  const r = C.round; C.state = 'scan'; r.guess = i;
  const cards = $$('#cCards .card');
  cards.forEach(c => { c.disabled = true; }); cards[i].classList.add('guess'); cards[i].querySelector('.marks').innerHTML = '<span class="m-you">you</span>';
  sfx('click'); $('#cOutcome').textContent = 'Locked in. Now the detector scans all three…';
  mood('panic'); say('Eek, it is scanning!', 1800);
  const scores = [];
  for (let k = 0; k < 3; k++) {
    const sc = cards[k].querySelector('.scan');
    sc.style.display = 'block'; sc.style.transition = 'none'; sc.style.top = '0';
    void sc.offsetWidth; sc.style.transition = RM.matches ? 'none' : 'top .6s linear'; sc.style.top = 'calc(100% - 3px)';
    await sleep(80);
    scores[k] = GP.analyzeImage(r.imgs[k]).statisticalScore;
    await sleep(RM.matches ? 0 : 560); sfx('tick');
    sc.style.display = 'none'; cards[k].querySelector('.sc').textContent = scores[k];
  }
  // The detector flags the highest score, but only if it crosses its alarm line of 30.
  const max = Math.max(...scores), tops = [0, 1, 2].filter(k => scores[k] === max);
  const rng = mulberry32((r.seed || r.cipher[1] * 7919) ^ 0x9e3779b9);
  let bot, sure = true;
  if (max < 30) { bot = Math.floor(rng() * 3); sure = false; }
  else bot = tops[Math.floor(rng() * tops.length)];
  if (tops.length > 1 && max >= 30) sure = false;
  r.bot = bot; r.scores = scores;
  cards[bot].querySelector('.marks').innerHTML += '<span class="m-bot">detector</span>';
  await sleep(RM.matches ? 0 : 350);
  // the ghost pops out
  cards[r.pos].classList.add('carrier'); sfx('pop');
  const you = i === r.pos, botOk = bot === r.pos;
  const lv = r.kind === 'r' ? LEVELS[r.level] : { pts: 3 };
  const pts = r.goggles ? Math.max(1, Math.floor(lv.pts / 2)) : lv.pts;
  BOARD.rounds++;
  if (you) { BOARD.you += pts; BOARD.streak++; BOARD.best = Math.max(BOARD.best, BOARD.streak); } else BOARD.streak = 0;
  if (botOk) BOARD.bot += lv.pts;
  paintBoard();
  let head;
  if (you && !botOk) { head = `You beat the detector! +${pts}`; sfx('win'); mood('party', 2600); burstAt(cards[r.pos], { n: 90, speed: 9 }); say('You saw what the maths missed!'); }
  else if (you && botOk) { head = `You both found it. +${pts} for you, +${lv.pts} for the detector`; sfx('win'); mood('dead', 2200); burstAt(cards[r.pos], { n: 50 }); say('Caught twice. Not my day.'); }
  else if (!you && botOk) { head = 'The detector wins this one.'; sfx('lose'); shake(); mood('laugh', 2200); say('The robot knew. You did not. Hee hee.'); }
  else { head = 'The ghost fooled you both.'; sfx('lose'); shake(); mood('party', 2600); say('Two guesses, zero ghosts. I win!'); }
  $('#cOutcome').textContent = head;
  const scoreTxt = `Detector scores: A ${scores[0]}, B ${scores[1]}, C ${scores[2]}. ` + (sure ? `It flagged print ${'ABC'[bot]}.` : max < 30 ? 'Nothing crossed its alarm line of 30, so it guessed.' : 'Two prints tied at the top, so it guessed between them.');
  const det = $('#cDetail');
  if (r.kind === 'r') {
    const peek = GP.revealMessage(r.imgs[r.pos], enc(r.password));
    const txt = peek.status === 'ok' ? dec(peek.message) : '';
    det.innerHTML = `${esc(scoreTxt)} The ghost was in print ${'ABC'[r.pos]}, carrying ${fmt(r.bytes)} bytes. Its password was <b>${esc(r.password)}</b> and it began: <i>“${esc(txt.slice(0, 90))}${txt.length > 90 ? '…' : ''}”</i>`;
  } else {
    det.innerHTML = `${esc(scoreTxt)} The ghost was in print ${'ABC'[r.pos]}. Enter your friend's password to read it: <form class="row nw" id="cRead" style="margin-top:10px;max-width:440px"><input type="text" id="cReadPw" placeholder="password" autocomplete="off"><button class="btn small" type="submit">Read it</button></form><span id="cReadOut" class="hint"></span>`;
    $('#cRead').addEventListener('submit', e => {
      e.preventDefault(); const res = GP.revealMessage(r.imgs[r.pos], enc($('#cReadPw').value));
      if (res.status === 'ok') { $('#cReadOut').textContent = '“' + dec(res.message) + '”'; sfx('pop'); burstAt($('#cReadOut'), { n: 40 }); }
      else { $('#cReadOut').textContent = 'Wrong password. Ask your friend again.'; sfx('wrong'); shake($('#cRead')); }
    });
  }
  C.state = 'done';
}
function makeCustom() {
  const msg = $('#cmMsg').value, pw = $('#cmPw').value, note = $('#cmNote');
  if (!msg.trim()) { setMsg(note, 'err', 'Write a secret first.'); sfx('wrong'); return; }
  if (!pw) { setMsg(note, 'err', 'Pick a password. Tell it to your friend separately.'); sfx('wrong'); return; }
  const m = enc(msg); if (m.length > 316) { setMsg(note, 'err', 'Too long for a code. Keep it under 300 characters.'); return; }
  const cipher = GP.xorCipher(cat(new Uint8Array(u32(GP.fnv1a(m))), m), enc(pw));
  const r = { kind: 'm', photo: Number($('#cmPhoto').value), pos: rnd(3), cipher };
  const code = makeCode(r);
  setMsg(note, 'ok', 'Done. Copy the code below and send it. Your secret is inside, encrypted.');
  note.insertAdjacentHTML('beforeend', `<div class="code" style="margin-top:8px">${esc(code)}</div>`);
  copyText(code); sfx('pop'); burstAt($('#cmGo'), { n: 30 });
}
