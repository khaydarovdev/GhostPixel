// GhostPixel - Team TriLogy
// Moving images between canvases, files and the C++ engine; loading and saving files.
'use strict';

// =====================================================================
//  Images: the page keeps B,G,R bytes like the C++ Image struct.
// =====================================================================
function toImageData(img) {
  const d = new ImageData(img.width, img.height), px = img.px, o = d.data;
  for (let i = 0, j = 0; i < px.length; i += 3, j += 4) { o[j] = px[i + 2]; o[j + 1] = px[i + 1]; o[j + 2] = px[i]; o[j + 3] = 255; }
  return d;
}
function drawTo(cv, img) { cv.width = img.width; cv.height = img.height; cv.getContext('2d').putImageData(toImageData(img), 0, 0); }
function fromCanvas(cv) {
  const { width: w, height: h } = cv;
  const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const img = { width: w, height: h, px: new Uint8Array(w * h * 3) };
  let hasAlpha = false;
  for (let i = 0, j = 0; j < d.length; i += 3, j += 4) { img.px[i] = d[j + 2]; img.px[i + 1] = d[j + 1]; img.px[i + 2] = d[j]; if (d[j + 3] < 255) hasAlpha = true; }
  return { img, hasAlpha };
}
const imgCanvas = img => { const c = document.createElement('canvas'); drawTo(c, img); return c; };
const TRANSPARENCY = 'This image had see-through pixels. Browsers change their colours, which corrupts hidden bits, so it was made fully opaque.';
async function browserDecode(blob) {
  let bmp;
  try { bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }); }
  catch (e) {
    bmp = await new Promise((res, rej) => {
      const im = new Image(), url = URL.createObjectURL(blob);
      im.onload = () => { URL.revokeObjectURL(url); res(im); };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file is not an image this browser can read.')); };
      im.src = url;
    });
  }
  if (bmp.width * bmp.height > 40e6) throw new Error('That image is over 40 megapixels, too big for the browser.');
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d', { willReadFrequently: true }).drawImage(bmp, 0, 0);
  return fromCanvas(c);
}
// BMP and plain PNG are decoded by our own code, byte for byte. Anything else
// goes through the browser with an honest warning. JPG gets a loud one.
async function loadImageFile(file) {
  const buf = await file.arrayBuffer(), b = new Uint8Array(buf), warnings = [];
  const name = (file.name || 'image').replace(/\.[^.]+$/, '');
  if (b[0] === 0x42 && b[1] === 0x4D) {
    const r = GP.parseBmp(buf);
    if (r.image) return { img: r.image, name, warnings };
    if (!r.convertible) throw new Error(r.error);
    warnings.push(r.error + ' The browser converted it for you.');
  } else if (b[0] === 137 && b[1] === 80) {
    const r = await GP.decodePng(buf).catch(() => null);
    if (r) { if (r.hasAlpha) warnings.push(TRANSPARENCY); return { img: r.image, name, warnings }; }
    warnings.push('Unusual PNG (16-bit or interlaced): the browser decoded it, so colours may shift slightly.');
  } else if (b[0] === 0xFF && b[1] === 0xD8) {
    warnings.push('JPG is lossy. It works as a cover photo, but a JPG that already carried a message has probably lost it. Save results as PNG or BMP, never JPG.');
  } else warnings.push('The browser converted this file. Save results as PNG or BMP.');
  const { img, hasAlpha } = await browserDecode(file);
  if (hasAlpha) warnings.push(TRANSPARENCY);
  return { img, name, warnings };
}
// Saving: inside Claude the viewer is asked through the "downloads"
// capability (BMP travels inside a .zip there); opened as a file, a plain link works.
let DL = null;
(async () => { try { if (window.claude && window.claude.use) DL = await window.claude.use('downloads'); } catch (e) { DL = null; } })();
async function saveFile(name, data) {
  if (DL) {
    try { await DL.save({ filename: name, data: typeof data === 'string' ? data : data.slice() }); toast('Saved ' + name); }
    catch (e) { if (!(e && e.code === 'declined')) toast('Could not save here: ' + ((e && e.message) || e)); }
    return;
  }
  const url = URL.createObjectURL(new Blob([data])), a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000); toast('Saved ' + name);
}
async function savePng(img, name) { saveFile(name + '.png', await GP.encodePng(img)); }
function saveBmp(img, name) { const b = GP.encodeBmp(img); if (DL) saveFile(name + '.bmp.zip', GP.zipOne(name + '.bmp', b)); else saveFile(name + '.bmp', b); }
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copied'); return true; } catch (e) { toast('Copy blocked here: select the text and copy it by hand'); return false; }
}
