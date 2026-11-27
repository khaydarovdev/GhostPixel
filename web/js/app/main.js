// GhostPixel - Team TriLogy
// Start-up: wait for the C++ engine, load the sample photos, make the demo ghost, open a station.
'use strict';

// Sample photos (scikit-image sample data), downscaled to 420 px wide, lossless PNG.
const SAMPLE_PNG = Object.fromEntries(SAMPLE_NAMES.map(n => [n, `assets/samples/${n}.png`]));

function bootError(message) {
  const box = document.createElement('div');
  box.className = 'booterr';
  box.innerHTML = `<b>GhostPixel could not start.</b><span>${esc(message)}</span>`;
  document.body.prepend(box);
  mood('dead');
}

(async () => {
  $$('[data-ghost]').forEach(makeGhost);
  paintSound();
  try {
    await GP.ready;  // the C++ core, compiled to WebAssembly
  } catch (e) {
    bootError(e.message || String(e));
    return;
  }
  for (const n of SAMPLE_NAMES) {
    const blob = await (await fetch(SAMPLE_PNG[n])).blob();
    const r = await GP.decodePng(await blob.arrayBuffer()).catch(() => null);
    S.samples[n] = r ? r.image : (await browserDecode(blob)).img;
  }
  const demoMsg = 'Boo! You found me. I live in the lowest bit of every colour, one step from where it should be. Nobody notices. Except the detector.';
  S.lastGhost = { img: GP.hideMessage(S.samples.cat, enc(demoMsg), enc('boo')).image, name: 'demo ghost', password: 'boo', message: demoMsg, demo: true };
  drawTo($('#heroA'), S.lastGhost.img); drawTo($('#heroB'), S.samples.coffee);
  show(location.hash.slice(1) || 'hide', !!location.hash.slice(1));
  setTimeout(() => say('Hi! I hide in photos. Poke around, or poke me.', 4200), 900);
})();
