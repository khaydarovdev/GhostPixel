// GhostPixel - Team TriLogy
// Station switching with the #hash, and the ghost in the corner.
'use strict';

// =====================================================================
//  Stations and the #hash router.
// =====================================================================
const VIEWS = ['hide', 'reveal', 'detect', 'challenge', 'sandbox', 'destroy', 'crack', 'results'];
const INIT = {}, ON_SHOW = {}, started = {};
let current = null;
function show(name, scroll) {
  let code = null;
  if (name && name.startsWith('gp-')) { code = name; name = 'challenge'; }
  if (!VIEWS.includes(name)) name = 'hide';
  VIEWS.forEach(v => { const el = $('#v-' + v); if (v === name) { el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); } else el.classList.remove('on'); });
  $$('#tabs button').forEach(b => b.dataset.v === name ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  if (!started[name]) { started[name] = true; INIT[name] && INIT[name](); }
  ON_SHOW[name] && ON_SHOW[name](code);
  if (current && current !== name) mood('pop', 700);
  current = name;
  const t = $('#tabs button[aria-current=page]'); t && t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  if (scroll) $('#v-' + name).scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'start' });
}
function go(name) { sfx('click'); if (location.hash.slice(1) === name) show(name, true); else location.hash = name; }
$('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) go(b.dataset.v); });
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
addEventListener('hashchange', () => { if (S.samples.coffee) show(location.hash.slice(1), true); });  // after start-up
$('#brand').addEventListener('click', () => { sfx('boo'); scrollTo({ top: 0, behavior: RM.matches ? 'auto' : 'smooth' }); });
$('#soundBtn').addEventListener('click', () => { S.sound = !S.sound; store.set('sound', S.sound ? 'on' : 'off'); paintSound(); sfx('pop'); });

// The ghost in the corner talks when poked.
const LINES = [
  "I live in the last bit. It's quiet there.", 'Psst. The demo password is boo.', 'Try the challenge. I hide, you seek.',
  'Flip bit 8 in the sandbox, then look at the cat.', 'JPEG is my natural predator.', 'One step out of 255. You will never see me.',
  'The detector found me again. Rude.', 'Our cipher is for learning. Please do not hide bank codes in me.',
];
let lineI = rnd(LINES.length);
function boop() { sfx('boo'); mood('pop', 800); say(LINES[lineI++ % LINES.length]); burstAt($('#dock'), { n: 14, speed: 4, colors: ['#f1f6ee', '#ffb43d'] }); }
$('#dock').addEventListener('click', boop);
$('#heroGhost').addEventListener('click', boop);
