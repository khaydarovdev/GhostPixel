// =====================================================================
//  PNG and ZIP for the browser.
//
//  The C++ tool works with 24-bit BMP files. Browsers mostly share PNG, so
//  the website also reads and writes PNG. Both are written by hand here
//  (instead of letting a canvas re-encode the image) so nothing can ever
//  change the lowest bits that hold the message. The ZIP writer wraps BMP
//  downloads where a host only allows certain file types.
// =====================================================================
'use strict';

const PngCodec = (() => {
  const utf8 = new TextEncoder();

  // ---------- lossless PNG + ZIP (written by hand so no canvas re-encoding
  //            or browser "fingerprint noise" can ever touch the low bits) ----------

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes, crc = 0) {
    crc = ~crc >>> 0;
    for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return ~crc >>> 0;
  }
  function concat(parts) {
    const n = parts.reduce((s, p) => s + p.length, 0), out = new Uint8Array(n);
    let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  async function streamThrough(bytes, stream) {
    const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
  }
  // zlib wrapper with "stored" blocks — fallback when CompressionStream is missing
  function zlibStored(data) {
    const parts = [new Uint8Array([0x78, 0x01])];
    for (let i = 0; i < data.length || i === 0; i += 65535) {
      const chunk = data.subarray(i, Math.min(i + 65535, data.length));
      const last = i + 65535 >= data.length ? 1 : 0, len = chunk.length;
      parts.push(new Uint8Array([last, len & 255, len >> 8, ~len & 255, (~len >> 8) & 255]), chunk);
      if (data.length === 0) break;
    }
    let a = 1, b = 0;
    for (let i = 0; i < data.length; i++) { a = (a + data[i]) % 65521; b = (b + a) % 65521; }
    parts.push(new Uint8Array([b >> 8, b & 255, a >> 8, a & 255]));
    return concat(parts);
  }
  async function encodePng(img) {
    const { width: w, height: h, px } = img, rowLen = w * 3;
    const raw = new Uint8Array((rowLen + 1) * h);
    for (let y = 0; y < h; y++) {             // filter 2 ("Up") on every row, BGR -> RGB
      const o = y * (rowLen + 1); raw[o] = 2;
      for (let x = 0; x < w; x++) {
        const s = (y * w + x) * 3, u = s - rowLen;
        for (let c = 0; c < 3; c++) {
          const v = px[s + 2 - c], up = y ? px[u + 2 - c] : 0;
          raw[o + 1 + x * 3 + c] = (v - up) & 0xFF;
        }
      }
    }
    const idat = typeof CompressionStream === 'function'
      ? await streamThrough(raw, new CompressionStream('deflate')) : zlibStored(raw);
    const chunk = (type, data) => {
      const head = new Uint8Array(8), dv = new DataView(head.buffer);
      dv.setUint32(0, data.length); for (let i = 0; i < 4; i++) head[4 + i] = type.charCodeAt(i);
      const crc = new Uint8Array(4); new DataView(crc.buffer).setUint32(0, crc32(data, crc32(head.subarray(4))));
      return concat([head, data, crc]);
    };
    const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
    dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 2;   // 8-bit truecolour
    return concat([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))]);
  }
  // Decodes plain 8-bit PNGs exactly (grey, RGB, palette, +alpha, not interlaced).
  // Returns null for anything else so the page can fall back to the browser.
  async function decodePng(buffer) {
    const b = new Uint8Array(buffer), dv = new DataView(buffer);
    if (b.length < 33 || b[0] !== 137 || b[1] !== 80 || typeof DecompressionStream !== 'function') return null;
    let o = 8, w = 0, h = 0, depth = 0, type = 0, interlace = 0, palette = null, trns = null;
    const idat = [];
    while (o + 8 <= b.length) {
      const len = dv.getUint32(o), t = String.fromCharCode(...b.subarray(o + 4, o + 8)), d = b.subarray(o + 8, o + 8 + len);
      if (t === 'IHDR') { w = dv.getUint32(o + 8); h = dv.getUint32(o + 12); depth = d[8]; type = d[9]; interlace = d[12]; }
      else if (t === 'PLTE') palette = d;
      else if (t === 'tRNS') trns = d;
      else if (t === 'IDAT') idat.push(d);
      else if (t === 'IEND') break;
      o += 12 + len;
    }
    if (depth !== 8 || interlace !== 0 || ![0, 2, 3, 4, 6].includes(type) || !w || !h) return null;
    const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type], bpp = ch, rowLen = w * ch;
    const data = await streamThrough(concat(idat), new DecompressionStream('deflate'));
    if (data.length < (rowLen + 1) * h) return null;
    const cur = new Uint8Array(rowLen), prev = new Uint8Array(rowLen);
    const img = { width: w, height: h, px: new Uint8Array(w * h * 3) };
    let hasAlpha = false;
    for (let y = 0; y < h; y++) {
      const f = data[y * (rowLen + 1)], s = y * (rowLen + 1) + 1;
      for (let i = 0; i < rowLen; i++) {
        const a = i >= bpp ? cur[i - bpp] : 0, up = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
        let v = data[s + i];
        if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
        else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
        cur[i] = v & 0xFF;
      }
      for (let x = 0; x < w; x++) {
        let r, g, bl, al = 255;
        if (type === 2 || type === 6) { r = cur[x * ch]; g = cur[x * ch + 1]; bl = cur[x * ch + 2]; if (type === 6) al = cur[x * ch + 3]; }
        else if (type === 0 || type === 4) { r = g = bl = cur[x * ch]; if (type === 4) al = cur[x * ch + 1]; }
        else { const k = cur[x]; if (!palette || k * 3 + 2 >= palette.length) return null; r = palette[k * 3]; g = palette[k * 3 + 1]; bl = palette[k * 3 + 2]; if (trns && k < trns.length) al = trns[k]; }
        if (al < 255) hasAlpha = true;
        const p = (y * w + x) * 3; img.px[p] = bl; img.px[p + 1] = g; img.px[p + 2] = r;
      }
      prev.set(cur);
    }
    return { image: img, hasAlpha };
  }
  // A ZIP with one stored file — used for .bmp downloads where only .zip is allowed.
  function zipOne(name, data) {
    const nm = utf8.encode(name), crc = crc32(data);
    const local = new Uint8Array(30), ld = new DataView(local.buffer);
    ld.setUint32(0, 0x04034b50, true); ld.setUint16(4, 20, true); ld.setUint32(14, crc, true);
    ld.setUint32(18, data.length, true); ld.setUint32(22, data.length, true); ld.setUint16(26, nm.length, true);
    const central = new Uint8Array(46), cd = new DataView(central.buffer);
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true); cd.setUint16(28, nm.length, true);
    const end = new Uint8Array(22), ed = new DataView(end.buffer);
    const cdOffset = 30 + nm.length + data.length;
    ed.setUint32(0, 0x06054b50, true); ed.setUint16(8, 1, true); ed.setUint16(10, 1, true);
    ed.setUint32(12, 46 + nm.length, true); ed.setUint32(16, cdOffset, true);
    return concat([local, nm, data, central, nm, end]);
  }

  return { encodePng, decodePng, zipOne, crc32 };
})();
