// =====================================================================
//  GhostPixel engine: loads the C++ core (compiled to WebAssembly from
//  src/*.cpp by wasm/build_wasm.sh) and wraps it for the website.
//
//  Everything that matters runs in C++:
//    cipher.cpp  fnv1a, xorCipher
//    stego.cpp   capacity, hide, reveal, signature, LSB read/write
//    detect.cpp  RS analysis, chi-square, bands, heat map, score
//    bmp.cpp     BMP decode / encode
//  JavaScript only moves bytes in and out of WebAssembly memory.
//  PNG and ZIP handling (browser file formats the console tool does not
//  need) live in png-codec.js.
//
//  Images are { width, height, px } where px is a Uint8Array of B,G,R
//  bytes, top row first: the same layout as the C++ Image struct.
// =====================================================================
'use strict';

const GP = (() => {
  const WASM_URL = 'wasm/ghostpixel.wasm';
  const utf8 = new TextEncoder();
  const text = new TextDecoder();
  let ex = null;  // the WebAssembly exports

  // Memory can grow during a call, so always take a fresh view.
  const mem = () => new Uint8Array(ex.memory.buffer);
  function put(bytes) {
    const p = ex.gp_alloc(bytes.length);
    mem().set(bytes, p);
    return p;
  }
  const take = (ptr, len) => mem().slice(ptr, ptr + len);
  const output = () => take(ex.gp_out_ptr(), ex.gp_out_len());
  const lastError = () => text.decode(take(ex.gp_err_ptr(), ex.gp_err_len()));

  // Copy an image into WebAssembly memory, run fn(ptr), optionally copy the
  // (changed) pixels back, and always free the memory.
  function withImage(img, fn, writeBack = false) {
    const p = put(img.px);
    try {
      const result = fn(p);
      if (writeBack) img.px.set(mem().subarray(p, p + img.px.length));
      return result;
    } finally {
      ex.gp_free(p);
    }
  }
  function withBytes(list, fn) {
    const ptrs = list.map(put);
    try { return fn(...ptrs); } finally { ptrs.forEach(p => ex.gp_free(p)); }
  }
  const cloneImage = img => ({ width: img.width, height: img.height, px: Uint8Array.from(img.px) });

  // WASI functions the C++ runtime links to. GhostPixel never prints or
  // opens files in the browser, so each simply reports "not supported".
  function wasiStubs(module) {
    const imports = {};
    for (const imp of WebAssembly.Module.imports(module)) {
      imports[imp.module] = imports[imp.module] || {};
      if (imp.kind === 'function') imports[imp.module][imp.name] = () => 52;  // ENOSYS
    }
    return imports;
  }

  async function load() {
    if (location.protocol === 'file:') {
      throw new Error('Open GhostPixel through a web server (see README): browsers do not load WebAssembly from file:// pages.');
    }
    const res = await fetch(WASM_URL);
    if (!res.ok) throw new Error(`Could not load ${WASM_URL} (HTTP ${res.status}). Run wasm/build_wasm.sh first.`);
    const module = await WebAssembly.compile(await res.arrayBuffer());
    const instance = await WebAssembly.instantiate(module, wasiStubs(module));
    ex = instance.exports;
    if (ex._initialize) ex._initialize();  // C++ static constructors
    api.HEADER_BYTES = ex.gp_header_bytes();
    api.HEAT_THRESHOLD = ex.gp_heat_threshold();
  }

  // ---------------- cipher.cpp ----------------
  const fnv1a = bytes => withBytes([bytes], p => ex.gp_fnv1a(p, bytes.length) >>> 0);
  function xorCipher(data, password) {
    withBytes([data, password], (d, pw) => ex.gp_xor(d, data.length, pw, password.length));
    return output();
  }

  // ---------------- stego.cpp ----------------
  const capacityBytes = img => ex.gp_capacity(img.width, img.height) >>> 0;

  function hideMessage(img, message, password) {
    const out = cloneImage(img);
    const ok = withImage(out, p => withBytes([message, password],
      (m, pw) => ex.gp_hide(out.width, out.height, p, m, message.length, pw, password.length)), true);
    return ok ? { ok: true, image: out } : { ok: false, error: lastError() };
  }

  const findSignature = img => withImage(img, p => ex.gp_find_signature(img.width, img.height, p) >>> 0);

  const REVEAL = ['ok', 'no-message', 'damaged', 'wrong-or-damaged'];
  function revealMessage(img, password) {
    const code = withImage(img, p => withBytes([password],
      pw => ex.gp_reveal(img.width, img.height, p, pw, password.length)));
    const status = REVEAL[code];
    const r = { status, length: ex.gp_reveal_length() >>> 0 };
    if (status === 'ok') r.message = output();
    if (status === 'wrong-or-damaged') r.candidate = take(ex.gp_cand_ptr(), ex.gp_cand_len());
    return r;
  }

  function writeBytesToLsb(img, firstBit, bytes) {
    withImage(img, p => withBytes([bytes],
      b => ex.gp_write_lsb(img.width, img.height, p, firstBit, b, bytes.length)), true);
  }
  function readBytesFromLsb(img, firstBit, count) {
    withImage(img, p => ex.gp_read_lsb(img.width, img.height, p, firstBit, count));
    return output();
  }

  // randomByte: a function returning 0..255, used to pick the C++ seed.
  function embedRandomBits(img, fraction, randomByte) {
    const out = cloneImage(img);
    const seed = ((randomByte() << 24) | (randomByte() << 16) | (randomByte() << 8) | randomByte()) >>> 0;
    withImage(out, p => ex.gp_embed_random(out.width, out.height, p, fraction, seed), true);
    return out;
  }

  // ---------------- detect.cpp ----------------
  function analyzeImage(img) {
    withImage(img, p => ex.gp_analyze(img.width, img.height, p));
    const report = JSON.parse(text.decode(output()));
    const h = report.heat;
    h.raw = Float64Array.from(h.raw);
    h.cells = Float64Array.from(h.cells);
    h.at = (col, row) => h.cells[row * h.cols + col];
    return report;
  }

  // The C++ scan runs in one go (it takes milliseconds); this replays its
  // results step by step so the page can animate the bands and heat rows.
  function* analyzeSteps(img) {
    const report = analyzeImage(img);
    for (const band of report.bands) yield { kind: 'band', band };
    const h = report.heat;
    for (let row = 0; row < h.rows; row++) {
      yield { kind: 'heatRow', row, rows: h.rows, cols: h.cols, blockSize: h.blockSize, values: h.raw.slice(row * h.cols, (row + 1) * h.cols) };
    }
    return report;
  }

  function renderHeatMap(img) {
    const out = cloneImage(img);
    withImage(out, p => ex.gp_render_heatmap(out.width, out.height, p), true);
    return out;
  }
  const payloadPixels = (img, length) => ex.gp_payload_pixels(img.width, img.height, length) >>> 0;

  // ---------------- bmp.cpp ----------------
  function parseBmp(buffer) {
    const bytes = new Uint8Array(buffer);
    const ok = withBytes([bytes], p => ex.gp_decode_bmp(p, bytes.length));
    if (!ok) {
      const error = lastError();
      return { error, convertible: /bits per pixel|compressed/.test(error) };
    }
    return { image: { width: ex.gp_image_width(), height: ex.gp_image_height(), px: output() } };
  }
  function encodeBmp(img) {
    const ok = withImage(img, p => ex.gp_encode_bmp(img.width, img.height, p));
    if (!ok) throw new Error(lastError());
    return output();
  }

  const api = {
    utf8, HEADER_BYTES: 12, HEAT_THRESHOLD: 0.45,
    fnv1a, xorCipher, capacityBytes, hideMessage, findSignature, revealMessage,
    writeBytesToLsb, readBytesFromLsb, embedRandomBits, cloneImage,
    analyzeImage, analyzeSteps, renderHeatMap, payloadPixels, parseBmp, encodeBmp,
    // browser file formats (png-codec.js)
    encodePng: PngCodec.encodePng, decodePng: PngCodec.decodePng, zipOne: PngCodec.zipOne,
  };
  api.ready = load();
  return api;
})();
