/* Velora upload: makes the MP3 that is stored and streamed. Runs in a background worker so the page stays smooth.
   The encoder is LAME (lame.sourceforge.net) in its JavaScript form, lamejs, used unchanged under the LGPL
   (vendor/lame.min.js). */
importScripts("vendor/lame.min.js");
self.onmessage = function (e) {
  try {
    const d = e.data, L = d.left, R = d.same ? d.left : d.right, n = L.length, STEP = 1152 * 32;
    const enc = new lamejs.Mp3Encoder(2, d.sampleRate, d.kbps), out = [], l16 = new Int16Array(STEP), r16 = new Int16Array(STEP);
    let last = -1;
    for (let i = 0; i < n; i += STEP) {
      const m = Math.min(STEP, n - i);
      for (let j = 0; j < m; j++) {
        let a = L[i + j], b = R[i + j];
        a = a < -1 ? -1 : a > 1 ? 1 : a; b = b < -1 ? -1 : b > 1 ? 1 : b;
        l16[j] = a < 0 ? a * 32768 : a * 32767; r16[j] = b < 0 ? b * 32768 : b * 32767;
      }
      const chunk = enc.encodeBuffer(m === STEP ? l16 : l16.subarray(0, m), m === STEP ? r16 : r16.subarray(0, m));
      if (chunk.length) out.push(new Uint8Array(chunk).buffer);
      const p = Math.floor((i + m) / n * 100);
      if (p !== last) { last = p; self.postMessage({ progress: p / 100 }); }
    }
    const end = enc.flush();
    if (end.length) out.push(new Uint8Array(end).buffer);
    self.postMessage({ done: out }, out);
  } catch (err) {
    self.postMessage({ error: String(err && err.message || err) });
  }
};
