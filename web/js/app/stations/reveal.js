// GhostPixel - Team TriLogy
// Station: reveal a message, three tries (calls C++ revealMessage).
'use strict';

// =====================================================================
//  REVEAL
// =====================================================================
const RV = { img: null, name: '', tries: 3, locked: false, text: '' };
const NOPE = [
  "Nope. That's not the password. I'm still invisible.", 'Wrong key! The checksum just laughed at you.', "Ha. Checksums don't do 'close'.",
  'Not even warm. Well, I can\'t tell warm. It is just wrong.', 'Boo-hoo for you. Wrong password.',
];
INIT.reveal = () => {
  RV.picker = makePicker($('#rPick'), { title: 'Photo to read', onPick: (img, name, meta) => {
    RV.img = img; RV.name = name; RV.tries = 3; RV.locked = false; RV.text = '';
    drawTo($('#rCanvas'), img); paintTries();
    $('#rPw').disabled = false; $('#rGo').disabled = false; $('#rPw').value = '';
    const sig = GP.findSignature(img);
    $('#rInfo').textContent = `${fmt(img.width)} × ${fmt(img.height)} pixels. ` + (sig ? `A GPX1 signature is here, holding ${fmt(sig)} bytes. Something is hidden.` : 'No GPX1 signature in this one.');
    $('#rHint').textContent = meta.ghost ? (meta.ghost.demo ? 'This is the demo ghost. Its password is boo.' : 'This is the ghost you made in Hide. You know the password.') : '';
    const sec = $('#rSecret'); sec.className = 'secret'; sec.textContent = '';
    setMsg($('#rNote'), '', ''); $('#rCopy').disabled = $('#rSave').disabled = true;
  } });
  RV.picker.choose('ghost');
  $('#rForm').addEventListener('submit', e => { e.preventDefault(); doReveal(); });
  $('#rCopy').addEventListener('click', () => copyText(RV.text));
  $('#rSave').addEventListener('click', () => saveFile(RV.name + '-message.txt', RV.text));
};
ON_SHOW.reveal = () => { if (RV.picker.key === 'ghost' && RV.img !== S.lastGhost.img) RV.picker.choose('ghost'); };
function paintTries() { $('#rTries').innerHTML = [0, 1, 2].map(i => `<span class="${i < RV.tries ? '' : 'used'}" style="display:block;width:30px">${ghostIcon()}</span>`).join(''); }
const printable = bytes => Array.from(bytes, b => (b >= 32 && b < 127 ? String.fromCharCode(b) : '░')).join('');
function doReveal() {
  if (RV.locked || !RV.img) return;
  const pw = $('#rPw').value, note = $('#rNote'), sec = $('#rSecret');
  if (!pw) { setMsg(note, 'err', 'Type the password first.'); sfx('wrong'); $('#rPw').focus(); return; }
  const r = GP.revealMessage(RV.img, enc(pw));
  if (r.status === 'no-message') {
    setMsg(note, 'warn', 'No GhostPixel signature here. Either nothing is hidden, or the image was edited. That did not cost a try.');
    sfx('wrong'); mood('sad', 1800); say("There's no ghost in this one. Just a photo."); return;
  }
  if (r.status === 'damaged') { setMsg(note, 'err', 'The header is here but its length makes no sense: the image was damaged.'); sfx('wrong'); mood('dead', 1800); return; }
  if (r.status === 'wrong-or-damaged') {
    RV.tries--; paintTries(); shake(); sfx('wrong'); mood('laugh', 1600); say(NOPE[rnd(NOPE.length)]);
    sec.className = 'secret noise'; sec.textContent = printable(r.candidate.slice(0, 160)) + (r.candidate.length > 160 ? '…' : '');
    if (RV.tries <= 0) {
      RV.locked = true; $('#rPw').disabled = true; $('#rGo').disabled = true;
      setMsg(note, 'err', 'Locked after three wrong passwords, like the console app. Pick the photo again to start over.');
      setTimeout(() => { mood('dead', 2600); sfx('lose'); }, 700);
    } else setMsg(note, 'err', `Wrong password, or the image was edited: the checksum doesn't match. Above is what that password decrypts to. ${RV.tries} ${RV.tries === 1 ? 'try' : 'tries'} left.`);
    $('#rPw').select(); return;
  }
  RV.text = dec(r.message);
  setMsg(note, 'ok', 'The checksum matches. The ghost speaks:');
  sec.className = 'secret live'; scramble(sec, RV.text);
  $('#rCopy').disabled = $('#rSave').disabled = false;
  sfx('pop'); mood('pop', 600); setTimeout(() => mood('party', 1800), 600);
  burstAt(sec, { n: 50 }); say('You found me!');
}
// Letters materialise: random glyphs settle into the real text, left to right.
function scramble(el, text) {
  const GLY = '░▒▓#%&@$*+=?!<>/\\{}';
  const head = text.slice(0, 420), tail = text.slice(420);
  if (RM.matches) { el.textContent = text; return; }
  const D = 1300, t0 = performance.now(), at = Array.from(head, (_, i) => (i / Math.max(1, head.length)) * D * 0.75 + Math.random() * D * 0.25);
  const step = now => {
    const t = now - t0; let out = '', junk = '';
    for (let i = 0; i < head.length; i++) {
      const ch = head[i];
      if (t >= at[i] || /\s/.test(ch)) { if (junk) { out += `<span class="s">${esc(junk)}</span>`; junk = ''; } out += esc(ch); }
      else junk += GLY[(Math.random() * GLY.length) | 0];
    }
    if (junk) out += `<span class="s">${esc(junk)}</span>`;
    el.innerHTML = out;
    if (t < D) requestAnimationFrame(step); else el.textContent = text;
    if (t >= D && tail) el.textContent = text;
  };
  requestAnimationFrame(step);
}
