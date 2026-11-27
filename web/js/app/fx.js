// GhostPixel - Team TriLogy
// Visual juice: pixel particles, flying sparks and screen shake.
'use strict';

// =====================================================================
//  Juice: pixel particles, flying sparks, screen shake.
// =====================================================================
const fx = $('#fx'), fxc = fx.getContext('2d');
let parts = [], fxRunning = false;
function fxSize() { const d = devicePixelRatio || 1; fx.width = innerWidth * d; fx.height = innerHeight * d; fxc.setTransform(d, 0, 0, d, 0, 0); }
fxSize(); addEventListener('resize', fxSize);
const COLORS = ['#ffb43d', '#ff4f5e', '#f4e8d8', '#9fe2b4', '#ffd98a'];
function burst(x, y, { n = 40, speed = 6, colors = COLORS, gravity = 0.22, life = 70, size = 6 } = {}) {
  if (RM.matches) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random());
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.5, g: gravity, life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.5 + Math.random() * 0.7), color: colors[i % colors.length] });
  }
  runFx();
}
function burstAt(el, opts) { const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, opts); }
// Sparks that fly from one element to another (the ghost diving into a photo).
function flyTo(fromEl, toEl, { n = 28, color = '#f1f6ee' } = {}) {
  if (RM.matches) return;
  const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    parts.push({ fly: true, t: -i * 0.025, sx: a.left + a.width / 2 + (Math.random() - 0.5) * 30, sy: a.top + a.height / 2 + (Math.random() - 0.5) * 30,
      ex: b.left + b.width * (0.1 + Math.random() * 0.8), ey: b.top + Math.min(b.height, 60) * Math.random(), bend: (Math.random() - 0.5) * 300,
      size: 4 + Math.random() * 5, color: i % 3 ? color : '#ffb43d' });
  }
  runFx();
}
function runFx() {
  if (fxRunning) return; fxRunning = true;
  const step = () => {
    fxc.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => {
      if (p.fly) {
        p.t += 0.022; if (p.t > 1) return false; if (p.t < 0) return true;
        const t = p.t, e = t * t * (3 - 2 * t);
        const x = p.sx + (p.ex - p.sx) * e + Math.sin(t * Math.PI) * p.bend * 0.3, y = p.sy + (p.ey - p.sy) * e - Math.sin(t * Math.PI) * 120;
        fxc.globalAlpha = 1 - t * 0.5; fxc.fillStyle = p.color; fxc.fillRect(x, y, p.size, p.size);
        return true;
      }
      p.vy += p.g; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.life--;
      if (p.life <= 0 || p.y > innerHeight + 40) return false;
      fxc.globalAlpha = Math.min(1, p.life / 25); fxc.fillStyle = p.color; fxc.fillRect(p.x, p.y, p.size, p.size);
      return true;
    });
    fxc.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(step); else { fxRunning = false; fxc.clearRect(0, 0, innerWidth, innerHeight); }
  };
  requestAnimationFrame(step);
}
function shake(el = $('#main')) { if (RM.matches) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
