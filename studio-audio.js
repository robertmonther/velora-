/* Velora upload: the sound tools. Everything here runs in the uploader's own browser; no file leaves the device
   until Publish. Loaded only with the upload page.

   What is here: reading the tags inside a song file (title, lyrics, date), decoding, measuring loudness the way
   streaming services do (LUFS, ITU-R BS.1770), finding the best part, mastering (tone style + even loudness +
   a safety limiter), fingerprints (SHA-256), and making the MP3 that is stored and streamed (in a worker). */
window.VeloraAudio = (function () {
  "use strict";
  const A = {};
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const db = x => 20 * Math.log10(Math.max(x, 1e-9));

  // ---------- Fingerprint ----------
  A.sha256 = async function (data) {
    const buf = data instanceof Blob ? await data.arrayBuffer() : data;
    const h = await crypto.subtle.digest("SHA-256", buf);
    return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, "0")).join("");
  };

  // ---------- What kind of file is it ----------
  A.kind = function (buf, name) {
    const b = new Uint8Array(buf, 0, Math.min(16, buf.byteLength)), s = String.fromCharCode(...b);
    if (s.startsWith("RIFF") && s.slice(8, 12) === "WAVE") return "WAV";
    if (s.startsWith("fLaC")) return "FLAC";
    if (s.startsWith("FORM") && /AIF[FC]/.test(s.slice(8, 12))) return "AIFF";
    if (s.slice(4, 8) === "ftyp") return "M4A";
    if (s.startsWith("OggS")) return "OGG";
    if (s.startsWith("ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "MP3";
    const ext = (String(name || "").split(".").pop() || "").toUpperCase();
    return /^(WAV|MP3|FLAC|M4A|AAC|OGG|AIFF|AIF)$/.test(ext) ? ext : "audio";
  };

  // ---------- Tags inside the file (ID3 in MP3; INFO and ID3 chunks in WAV) ----------
  function text(bytes, enc) {
    try {
      if (enc === 1 || enc === 2) {
        let be = enc === 2, off = 0;
        if (bytes.length >= 2) { if (bytes[0] === 0xff && bytes[1] === 0xfe) { be = false; off = 2; } else if (bytes[0] === 0xfe && bytes[1] === 0xff) { be = true; off = 2; } }
        return new TextDecoder(be ? "utf-16be" : "utf-16le").decode(bytes.subarray(off));
      }
      return new TextDecoder(enc === 3 ? "utf-8" : "iso-8859-1").decode(bytes);
    } catch (e) { return ""; }
  }
  const clean = s => String(s || "").replace(/\u0000+$/g, "").replace(/\u0000/g, " ").trim();
  // Position just after the terminator of a described field (1 zero byte, or 2 for UTF-16).
  function afterZero(bytes, from, enc) {
    if (enc === 1 || enc === 2) { for (let i = from; i + 1 < bytes.length; i += 2) if (bytes[i] === 0 && bytes[i + 1] === 0) return i + 2; return bytes.length; }
    for (let i = from; i < bytes.length; i++) if (bytes[i] === 0) return i + 1;
    return bytes.length;
  }
  function id3(bytes, out) {
    if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return;
    const ver = bytes[3], safe = (o) => ((bytes[o] & 0x7f) << 21) | ((bytes[o + 1] & 0x7f) << 14) | ((bytes[o + 2] & 0x7f) << 7) | (bytes[o + 3] & 0x7f);
    if (ver !== 3 && ver !== 4) return;
    const end = Math.min(bytes.length, 10 + safe(6));
    let p = 10;
    if (bytes[5] & 0x40) p += ver === 4 ? safe(10) : 4 + (((bytes[10] << 24) | (bytes[11] << 16) | (bytes[12] << 8) | bytes[13]) >>> 0);   // extended header
    while (p + 10 <= end) {
      const id = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const size = ver === 4 ? safe(p + 4) : (((bytes[p + 4] << 24) | (bytes[p + 5] << 16) | (bytes[p + 6] << 8) | bytes[p + 7]) >>> 0);
      const start = p + 10; p = start + size;
      if (size <= 0 || p > end) break;
      const f = bytes.subarray(start, start + size), enc = f[0];
      if (id === "TIT2") out.title = out.title || clean(text(f.subarray(1), enc));
      else if (id === "TPE1") out.artist = out.artist || clean(text(f.subarray(1), enc));
      else if (id === "TDRC" || id === "TYER" || id === "TDAT") out.date = out.date || clean(text(f.subarray(1), enc));
      else if (id === "USLT" && size > 5) out.lyrics = out.lyrics || clean(text(f.subarray(afterZero(f, 4, enc)), enc));
      else if (id === "COMM" && size > 5) out.comment = (out.comment ? out.comment + " " : "") + clean(text(f.subarray(afterZero(f, 4, enc)), enc));
      else if (id === "TXXX") { const z = afterZero(f, 1, enc), k = clean(text(f.subarray(1, z), enc)).toLowerCase(), v = clean(text(f.subarray(z), enc)); if (/lyric/.test(k)) out.lyrics = out.lyrics || v; else if (/comment|description/.test(k)) out.comment = (out.comment ? out.comment + " " : "") + v; }
      else if (id === "APIC" && size > 12 && !out.cover) {
        const z1 = afterZero(f, 1, 0), mime = clean(text(f.subarray(1, z1), 0)).toLowerCase(), z2 = afterZero(f, z1 + 1, enc);
        if (/^image\/(jpe?g|png)$/.test(mime) && z2 < f.length) out.cover = new Blob([f.slice(z2)], { type: mime.replace("jpg", "jpeg") });
      }
    }
  }
  A.readTags = function (buf) {
    const out = { title: "", artist: "", lyrics: "", comment: "", date: "", cover: null, wav: null };
    try {
      const bytes = new Uint8Array(buf), dv = new DataView(buf);
      if (bytes.length > 12 && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF") {
        let p = 12;
        while (p + 8 <= bytes.length) {
          const id = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]), size = dv.getUint32(p + 4, true), body = p + 8;
          if (id === "fmt " && size >= 16) out.wav = { channels: dv.getUint16(body + 2, true), sampleRate: dv.getUint32(body + 4, true), bits: dv.getUint16(body + 14, true) };
          else if (id === "LIST" && String.fromCharCode(bytes[body], bytes[body + 1], bytes[body + 2], bytes[body + 3]) === "INFO") {
            let q = body + 4; const stop = Math.min(bytes.length, body + size);
            while (q + 8 <= stop) {
              const k = String.fromCharCode(bytes[q], bytes[q + 1], bytes[q + 2], bytes[q + 3]), n = dv.getUint32(q + 4, true), v = clean(text(bytes.subarray(q + 8, Math.min(stop, q + 8 + n)), 3));
              if (k === "INAM") out.title = out.title || v; else if (k === "IART") out.artist = out.artist || v; else if (k === "ICMT") out.comment = (out.comment ? out.comment + " " : "") + v; else if (k === "ICRD") out.date = out.date || v;
              q += 8 + n + (n & 1);
            }
          } else if (id.toLowerCase() === "id3 ") id3(bytes.subarray(body, Math.min(bytes.length, body + size)), out);
          if (id === "data" && size > bytes.length) break;
          p = body + size + (size & 1);
        }
      } else id3(bytes, out);
    } catch (e) {}
    // The date the song was made, when the file says so (Suno writes "created=2026-06-16T…" in the comment).
    const m = /created=(\d{4}-\d{2}-\d{2})/.exec(out.comment) || /^(\d{4}-\d{2}-\d{2})/.exec(out.date);
    out.created = m ? m[1] : "";
    delete out.comment;                       // the comment can hold a private song ID: never keep it
    return out;
  };

  // ---------- Decode to 44.1 kHz ----------
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  A.RATE = 44100;
  A.decode = function (buf) {
    return new Promise((res, rej) => {
      if (!OC) { rej(new Error("This browser can't open audio files here.")); return; }
      const oc = new OC(2, 2, A.RATE), copy = buf.slice(0);
      const fail = () => rej(new Error("This file could not be opened as audio. Try a WAV or MP3."));
      try { const p = oc.decodeAudioData(copy, res, fail); if (p && p.catch) p.catch(fail); } catch (e) { fail(); }
    });
  };
  // Left and right as plain arrays (a mono file gives the same array twice).
  A.channels = buf => [buf.getChannelData(0), buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)];

  // ---------- Loudness: integrated LUFS (ITU-R BS.1770-4) and sample peak ----------
  function kWeights(fs) {
    let K = Math.tan(Math.PI * 1681.974450955533 / fs); const Vh = Math.pow(10, 3.999843853973347 / 20), Vb = Math.pow(Vh, 0.4996667741545416), Q1 = 0.7071752369554196;
    let a0 = 1 + K / Q1 + K * K;
    const s = { b0: (Vh + Vb * K / Q1 + K * K) / a0, b1: 2 * (K * K - Vh) / a0, b2: (Vh - Vb * K / Q1 + K * K) / a0, a1: 2 * (K * K - 1) / a0, a2: (1 - K / Q1 + K * K) / a0 };
    K = Math.tan(Math.PI * 38.13547087602444 / fs); const Q2 = 0.5003270373238773; a0 = 1 + K / Q2 + K * K;
    const h = { b0: 1, b1: -2, b2: 1, a1: 2 * (K * K - 1) / a0, a2: (1 - K / Q2 + K * K) / a0 };
    return [s, h];
  }
  A.loudness = function (chs, fs) {
    const n = chs[0].length, hop = Math.round(fs * 0.1), nb = Math.floor(n / hop), sums = new Float64Array(Math.max(1, nb)), [s, h] = kWeights(fs);
    let peak = 0;
    const same = chs.length > 1 && chs[0] === chs[1];
    for (let c = 0; c < chs.length; c++) {
      if (c === 1 && same) { for (let i = 0; i < nb; i++) sums[i] *= 2; break; }
      const x = chs[c]; let x1 = 0, x2 = 0, y1 = 0, y2 = 0, u1 = 0, u2 = 0, v1 = 0, v2 = 0, acc = 0, k = 0, bi = 0;
      for (let i = 0; i < n; i++) {
        const xi = x[i], ax = xi < 0 ? -xi : xi; if (ax > peak) peak = ax;
        const y = s.b0 * xi + s.b1 * x1 + s.b2 * x2 - s.a1 * y1 - s.a2 * y2; x2 = x1; x1 = xi; y2 = y1; y1 = y;
        const v = h.b0 * y + h.b1 * u1 + h.b2 * u2 - h.a1 * v1 - h.a2 * v2; u2 = u1; u1 = y; v2 = v1; v1 = v;
        acc += v * v;
        if (++k === hop) { if (bi < nb) sums[bi++] += acc / hop; acc = 0; k = 0; }
      }
    }
    // 400 ms blocks, 75% overlap: each block is the mean of 4 hops.
    const blocks = [];
    for (let i = 0; i + 3 < nb; i++) blocks.push((sums[i] + sums[i + 1] + sums[i + 2] + sums[i + 3]) / 4);
    const L = z => -0.691 + 10 * Math.log10(Math.max(z, 1e-12));
    let kept = blocks.filter(z => L(z) > -70);
    if (!kept.length) return { lufs: -70, peakDb: db(peak), hops: sums };
    const rel = L(kept.reduce((a, b) => a + b, 0) / kept.length) - 10;
    kept = kept.filter(z => L(z) > rel);
    const lufs = kept.length ? L(kept.reduce((a, b) => a + b, 0) / kept.length) : -70;
    return { lufs, peakDb: db(peak), hops: sums };
  };

  // ---------- The shape of the song (for the little picture) and its best part ----------
  A.outline = function (hops, n) {
    const out = new Float32Array(n), per = hops.length / n; let max = 1e-9;
    for (let i = 0; i < n; i++) { let a = 0, c = 0; for (let j = Math.floor(i * per); j < Math.max(Math.floor(i * per) + 1, Math.floor((i + 1) * per)) && j < hops.length; j++) { a += hops[j]; c++; } out[i] = Math.sqrt(c ? a / c : 0); if (out[i] > max) max = out[i]; }
    for (let i = 0; i < n; i++) out[i] /= max;
    return out;
  };
  // The start of the strongest 12 seconds, not in the first 10 seconds and not in the last 20.
  A.bestPart = function (hops, duration) {
    const win = 120, from = 100, to = Math.max(from + 1, hops.length - 200 - win);
    if (hops.length < from + win + 10) return 0;
    let acc = 0; for (let i = from; i < from + win; i++) acc += hops[i];
    let best = acc, at = from;
    for (let i = from + 1; i <= to; i++) { acc += hops[i + win - 1] - hops[i - 1]; if (acc > best * 1.02) { best = acc; at = i; } }
    return clamp(Math.round(at / 10), 0, Math.max(0, Math.floor(duration) - 5));
  };

  // ---------- Safety limiter: no sample goes above the ceiling; the gain moves smoothly (5 ms look-ahead) ----------
  A.limit = function (L, R, ceiling, fs) {
    const n = L.length, W = Math.max(8, Math.round(fs * 0.005)), rc = 1 - Math.exp(-1 / (fs * 0.08));
    let over = false;
    for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > ceiling) { over = true; break; } }
    if (!over) return false;
    const need = i => { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); return a > ceiling ? ceiling / a : 1; };
    const qi = new Int32Array(W + 2), qv = new Float32Array(W + 2), ring = new Float32Array(W).fill(1);
    let head = 0, tail = 0, size = 0, rel = 1, sum = W, rp = 0;
    const cap = W + 2;
    for (let m = 0; m < n + W; m++) {
      if (m < n) {                                   // the newest sample enters the look-ahead window
        const v = need(m);
        while (size > 0 && qv[(tail - 1 + cap) % cap] >= v) { tail = (tail - 1 + cap) % cap; size--; }
        qi[tail] = m; qv[tail] = v; tail = (tail + 1) % cap; size++;
      }
      const k = m - W; if (k < 0) continue;          // sample k leaves: its gain is ready
      while (size > 0 && qi[head] < k) { head = (head + 1) % cap; size--; }
      const gmin = size > 0 ? qv[head] : 1;
      rel = Math.min(gmin, rel + (1 - rel) * rc);
      sum += rel - ring[rp]; ring[rp] = rel; rp = (rp + 1) % W;
      const g = sum / W;
      if (g < 0.99999) { L[k] *= g; if (R !== L) R[k] *= g; }
    }
    return true;
  };

  // ---------- Mastering ----------
  // style: "balanced" (no tone change), "warm" (a little more body, softer top) or "open" (a little more air).
  // Then the loudness is set to o.lufs and the limiter keeps every peak under o.peakDb.
  A.master = async function (buf, o) {
    const fs = buf.sampleRate, n = buf.length, oc = new OC(2, n, fs), src = oc.createBufferSource();
    src.buffer = buf; let node = src;
    const add = (type, freq, gain, q) => { const f = oc.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (gain != null) f.gain.value = gain; if (q != null) f.Q.value = q; node.connect(f); node = f; };
    add("highpass", 25, null, 0.707);
    if (o.style === "warm") { add("lowshelf", 120, 1.2); add("highshelf", 9000, -0.6); }
    else if (o.style === "open") { add("peaking", 300, -0.6, 0.9); add("highshelf", 9500, 1.4); }
    node.connect(oc.destination); src.start(0);
    const out = await oc.startRendering();
    const L = out.getChannelData(0), R = out.getChannelData(1), ceiling = Math.pow(10, o.peakDb / 20);
    const m1 = A.loudness([L, R], fs);
    let gainDb = clamp(o.lufs - m1.lufs, -24, 12), limited = false;
    const apply = g => { for (let i = 0; i < n; i++) { L[i] *= g; R[i] *= g; } };
    apply(Math.pow(10, gainDb / 20)); limited = A.limit(L, R, ceiling, fs);
    let after = A.loudness([L, R], fs);
    for (let round = 0; round < 2 && limited && o.lufs - after.lufs > 0.3; round++) {   // the limiter took some loudness: give a little back (twice at most, so the sound is never squashed)
      const extra = clamp(o.lufs - after.lufs, 0, 2); apply(Math.pow(10, extra / 20)); A.limit(L, R, ceiling, fs); gainDb += extra; after = A.loudness([L, R], fs);
    }
    return { L, R, sampleRate: fs, length: n, gainDb, limited, after: { lufs: after.lufs, peakDb: after.peakDb } };
  };

  // ---------- The MP3 that is stored and streamed (made in a worker so the page stays responsive) ----------
  A.encodeMp3 = function (L, R, fs, kbps, onProgress, ver) {
    return new Promise((res, rej) => {
      let w;
      try { w = new Worker("encoder-worker.js" + (ver ? "?v=" + ver : "")); } catch (e) { rej(new Error("This browser can't make the streaming file.")); return; }
      w.onmessage = e => {
        const d = e.data || {};
        if (d.progress != null && onProgress) onProgress(d.progress);
        if (d.error) { w.terminate(); rej(new Error("Making the streaming file failed.")); }
        if (d.done) { w.terminate(); res(new Blob(d.done, { type: "audio/mpeg" })); }
      };
      w.onerror = () => { w.terminate(); rej(new Error("Making the streaming file failed.")); };
      const l = new Float32Array(L), r = R === L ? l : new Float32Array(R);          // copies, handed over to the worker
      w.postMessage({ left: l, right: r, same: R === L, sampleRate: fs, kbps }, r === l ? [l.buffer] : [l.buffer, r.buffer]);
    });
  };

  // ---------- Playing a prepared sound (before/after listening) ----------
  let ctxA = null;
  A.context = function () { if (!ctxA) { const C = window.AudioContext || window.webkitAudioContext; ctxA = new C(); } return ctxA; };
  A.toBuffer = function (L, R, fs) { const b = A.context().createBuffer(2, L.length, fs); b.copyToChannel(L, 0); b.copyToChannel(R, 1); return b; };

  A.db = db;
  return A;
})();
