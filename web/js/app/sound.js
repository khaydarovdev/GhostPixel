// GhostPixel - Team TriLogy
// Sound effects, synthesised with Web Audio (no audio files).
'use strict';

// =====================================================================
//  Sound: tiny square-wave chiptunes made with Web Audio (no files).
// =====================================================================
let AC = null;
function tone(f, dur, { type = 'square', vol = 0.05, at = 0, to = null } = {}) {
  const t = AC.currentTime + at, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
}
const SFX = {
  click: () => tone(720, 0.05, { vol: 0.03 }),
  tick: () => tone(1800, 0.02, { vol: 0.015 }),
  type: () => tone(1100 + Math.random() * 400, 0.02, { vol: 0.012 }),
  flip: () => tone(990, 0.05, { vol: 0.03, type: 'triangle' }),
  hide: () => { tone(900, 0.5, { type: 'triangle', to: 90, vol: 0.06 }); tone(1300, 0.3, { type: 'sine', to: 300, vol: 0.03, at: 0.05 }); },
  pop: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, { at: i * 0.07, vol: 0.04 })),
  wrong: () => { tone(160, 0.22, { vol: 0.06 }); tone(110, 0.3, { at: 0.12, vol: 0.06 }); },
  alarm: () => [880, 660, 880].forEach((f, i) => tone(f, 0.1, { at: i * 0.11, vol: 0.03 })),
  win: () => [523, 659, 784, 1046, 1318, 1046, 1318].forEach((f, i) => tone(f, 0.14, { at: i * 0.08, vol: 0.04 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.2, { at: i * 0.14, vol: 0.045, type: 'triangle' })),
  boo: () => tone(220, 0.45, { type: 'sine', to: 520, vol: 0.06 }),
  stamp: () => { tone(90, 0.15, { vol: 0.08 }); tone(60, 0.2, { at: 0.02, vol: 0.06, type: 'triangle' }); },
};
function sfx(name) {
  if (!S.sound) return;
  try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); SFX[name](); } catch (e) { /* audio is optional */ }
}
const ICON_ON = '<svg viewBox="0 0 24 24" fill="currentColor" shape-rendering="crispEdges"><path d="M3 9h4l5-4h2v14h-2l-5-4H3z"/><path d="M17 8h2v2h-2zM17 14h2v2h-2zM19 10h2v4h-2z"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" fill="currentColor" shape-rendering="crispEdges"><path d="M3 9h4l5-4h2v14h-2l-5-4H3z"/><path d="M16 9h2v2h-2zM20 9h2v2h-2zM18 11h2v2h-2zM16 13h2v2h-2zM20 13h2v2h-2z"/></svg>';
function paintSound() { const b = $('#soundBtn'); b.innerHTML = S.sound ? ICON_ON : ICON_OFF; b.setAttribute('aria-label', S.sound ? 'Sound on' : 'Sound off'); }
