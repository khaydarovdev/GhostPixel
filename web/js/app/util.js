// GhostPixel - Team TriLogy
// Small helpers shared by every file: DOM lookups, text encoding, timing, seeded random numbers, storage, toasts and the shared state S.
'use strict';

// ---------- tiny helpers ----------
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const enc = s => GP.utf8.encode(s);
const dec = b => new TextDecoder().decode(b);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const frame = () => new Promise(r => requestAnimationFrame(() => r()));
const fmt = n => Math.round(n).toLocaleString('en-US');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rnd = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
const u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
const cat = (a, b) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const store = {
  get(k) { try { return localStorage.getItem('gp2.' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('gp2.' + k, v); } catch (e) { /* storage may be blocked */ } },
};
// Seeded random numbers, so a shared challenge rebuilds the exact same round.
function mulberry32(seed) {
  return () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pickR = (arr, r) => arr[Math.floor(r() * arr.length)];
function setMsg(el, kind, text) { el.className = 'msg ' + (kind || ''); el.textContent = text || ''; }
let toastT = 0;
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200); }

const S = { samples: {}, lastGhost: null, sound: store.get('sound') !== 'off' };
const SAMPLE_NAMES = ['coffee', 'cat', 'rocket'];
