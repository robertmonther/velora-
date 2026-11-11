/* Velora upload pages: "Upload a song" (#/upload) and "My songs" (#/studio).
   Loaded only when someone opens them. The sound tools are in studio-audio.js, the server calls in backend.js.

   The upload is a short walk in 8 steps, modelled on LANDR's release form (see docs/UPLOAD-STUDIO.md):
     1 Song file · 2 Song details · 3 Credits and AI · 4 Lyrics (with syncing) · 5 Cover · 6 Mastering · 7 Rights · 8 Artist and publish
   Nothing is sent to the server before Publish. What you fill in stays while this page is open. */
window.VeloraStudio = (function () {
  "use strict";
  let ctx = null, st = null, myArtists = null, myArtistsFor = "", raf = 0;
  const A = () => window.VeloraAudio, T = () => window.VELORA_TAXONOMY || { genres: [], moods: [], languages: ["English"] };
  const U = () => Object.assign({ maxFileMB: 250, minSeconds: 30, maxSeconds: 1200, mp3Kbps: 192, coverMin: 1500, coverMax: 6000, coverMinOwn: 600, coverStore: 1200, masterLufs: -14, masterPeakDb: -1, tapDelay: 0.18 }, (ctx.CFG && ctx.CFG.upload) || {});
  const $ = s => ctx.main.querySelector(s), $$ = s => [...ctx.main.querySelectorAll(s)];
  const esc = s => ctx.esc(s == null ? "" : s), icon = (n, c) => ctx.icon(n, c || ""), fmt = t => ctx.fmt(t), len = d => ctx.fmt(Math.round(d || 0));
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const fmtT = t => { const m = Math.floor(t / 60), sec = t - m * 60; return m + ":" + (sec < 10 ? "0" : "") + sec.toFixed(1); };   // a lyric line's moment, to a tenth of a second
  const mb = b => (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + " MB";
  const lufs = v => (v <= -69 ? "silent" : v.toFixed(1) + " LUFS");
  const slug = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  const STEPS = [["file", "Song file"], ["details", "Song details"], ["credits", "Credits and AI"], ["lyrics", "Lyrics"], ["cover", "Cover"], ["sound", "Mastering"], ["rights", "Rights"], ["publish", "Artist and publish"]];
  const VERSIONS = ["", "Slowed", "Sped Up", "Remix", "Radio Edit", "Extended", "Instrumental", "Acoustic", "Live", "Demo", "Remastered", "Other"];
  const ROLES = ["Composer", "Lyricist", "Producer", "Co-producer", "Mixing", "Mastering", "Vocals", "Background vocals", "Guitar", "Piano", "Drums", "Arranger", "Other"];

  // ---------- What was chosen last time (so the next upload is mostly filled in) ----------
  const LAST = "velora_studio_last";
  const lastChoices = () => { try { const v = JSON.parse(localStorage.getItem(LAST) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } };
  function remember(artistId) {
    const f = st.f;
    try { localStorage.setItem(LAST, JSON.stringify({ artistId: artistId || f.artistId, label: f.label, publisher: f.publisher, cOwner: f.cOwner, pOwner: f.pOwner, genre: f.genre, subgenre: f.subgenre, moods: f.moods, language: f.language, lyricist: f.lyricist, composer: f.composer, producer: f.producer, aiUsed: f.aiUsed, ai: f.ai, aiTool: f.aiTool, style: st.master.style, masterOn: st.master.on })); } catch (e) {}
  }
  function fresh() {
    const l = lastChoices(), me = ctx.Backend.name || "";
    return {
      step: 0, seen: 0, busy: "", file: null, name: "", size: 0, kind: "", wav: null, origHash: "", buffer: null, duration: 0, loud: null, outline: null, best: 0, bestSet: false, url: "", found: [],
      f: { title: "", version: "", versionOther: "", artistId: l.artistId || "", artistNew: "", featured: "", genre: l.genre || "", subgenre: l.subgenre || "", moods: Array.isArray(l.moods) ? l.moods.slice(0, 3) : [], language: l.language || "English",
        explicit: false, adult: false, release: today(), created: "", lyricist: l.lyricist || me, composer: l.composer || me, producer: l.producer || me, extra: [],
        aiUsed: l.aiUsed !== false, ai: Object.assign({ music: true, vocals: true, lyrics: false, artwork: false }, l.ai || {}), aiTool: l.aiTool || "Suno", lyricsText: "", noLyrics: false,
        label: l.label || "", publisher: l.publisher || "", isrc: "", cOwner: l.cOwner || me, cYear: "", pOwner: l.pOwner || me, pYear: "" },
      moreOpen: false,
      lines: [], syncing: false, skipSync: false,
      cover: { src: null, url: "", w: 0, h: 0, type: "", crop: false, allowSmall: false, color: "", name: "" },
      master: { on: l.masterOn !== false, style: l.style || "balanced", res: null, key: "", working: false, err: "" },
      rights: { own: false, clean: false, record: false, cover: false },
      artist: { tagline: "", bio: "", photo: null, photoUrl: "", loadedFor: "" },
      pub: { running: false, log: [], error: "", song: null }
    };
  }

  // ---------- Small page helpers ----------
  const field = (id, label, input, hint) => `<div class="field"><label for="${id}">${label}</label>${input}${hint ? `<small class="hint">${hint}</small>` : ""}</div>`;
  const opt = (v, label, sel) => `<option value="${esc(v)}"${sel ? " selected" : ""}>${esc(label)}</option>`;
  const tick = (id, on, label) => `<label class="tick"><input type="checkbox" id="${id}"${on ? " checked" : ""}><span>${label}</span></label>`;
  const checkRow = (ok, textOk, textBad, kind) => `<div class="chk ${ok ? "ok" : kind || "bad"}">${icon(ok ? "check" : "close")}<span>${ok ? textOk : textBad}</span></div>`;
  function msg(t) { const m = $("#stMsg"); if (m) m.textContent = t || ""; }
  function stopSound() {
    const a = $("#stAudio"); if (a) a.pause();
    if (st && st.ab && st.ab.node) { try { st.ab.node.stop(); } catch (e) {} st.ab.node = null; st.ab.playing = false; }
    cancelAnimationFrame(raf);
  }
  const artistList = () => {                     // my artist names from the server, then the site's own artists
    const mine = Array.isArray(myArtists) ? myArtists : [], out = mine.map(a => ({ id: a.id, name: a.name, tagline: a.tagline || "", bio: a.bio || "", image: a.image ? ctx.Backend.mediaUrl(a.image) : "", mine: true }));
    for (const a of ctx.artists()) if (a.bundled && !out.some(x => x.id === a.id)) out.push({ id: a.id, name: a.name, tagline: a.tagline || "", bio: a.bio || "", image: a.image ? ctx.mediaOf(a.image) : "", bundled: true });
    return out;
  };
  const chosenArtist = () => { const f = st.f; if (f.artistId === "+") { const n = f.artistNew.trim(); return n ? { id: slug(n), name: n, isNew: true, tagline: "", bio: "" } : null; } return artistList().find(a => a.id === f.artistId) || null; };
  const fullTitle = () => { const f = st.f, v = f.version === "Other" ? f.versionOther.trim() : f.version; return f.title.trim() + (v ? " (" + v + ")" : ""); };
  const isAdult = () => st.f.explicit || st.f.adult || st.f.moods.some(m => (T().moods.find(x => x.name === m) || {}).adult);

  // ============================================================
  // Step 1: the song file
  // ============================================================
  async function takeFile(file) {
    const u = U(), Au = A();
    if (!file) return;
    if (file.size > u.maxFileMB * 1048576) { msg(`This file is ${mb(file.size)}. The limit is ${u.maxFileMB} MB.`); return; }
    stopSound(); if (st.url) URL.revokeObjectURL(st.url);
    Object.assign(st, { file, name: file.name, size: file.size, busy: "Opening the file…", buffer: null, loud: null, outline: null, found: [], url: "", origHash: "" });
    st.master.res = null; st.master.key = ""; render();
    try {
      const buf = await file.arrayBuffer();
      st.kind = Au.kind(buf, file.name);
      const tags = Au.readTags(buf); st.wav = tags.wav;
      st.origHash = await Au.sha256(buf);
      st.busy = "Listening to the whole song…"; render();
      const audio = await Au.decode(buf);
      if (audio.duration < u.minSeconds) throw new Error(`This song is ${fmt(audio.duration)} long. The shortest allowed is ${u.minSeconds} seconds.`);
      if (audio.duration > u.maxSeconds) throw new Error(`This song is ${fmt(audio.duration)} long. The longest allowed is ${Math.round(u.maxSeconds / 60)} minutes.`);
      const m = Au.loudness(Au.channels(audio), audio.sampleRate);
      Object.assign(st, { buffer: audio, duration: audio.duration, loud: { lufs: m.lufs, peakDb: m.peakDb }, outline: Au.outline(m.hops, 120), url: URL.createObjectURL(file), busy: "" });
      if (!st.bestSet) st.best = Au.bestPart(m.hops, audio.duration);
      // Fill in what the file already knows.
      const f = st.f;
      if (!f.title) { f.title = (tags.title || file.name.replace(/\.[a-z0-9]+$/i, "").replace(/^[0-9a-f]{8}-/i, "").replace(/[_]+/g, " ")).trim().slice(0, 120); if (tags.title) st.found.push("title"); }
      if (!f.lyricsText && tags.lyrics) { f.lyricsText = tags.lyrics.slice(0, 20000); st.lines = parseLyrics(f.lyricsText); st.found.push("lyrics"); }
      if (!f.created && tags.created) { f.created = tags.created; st.found.push("date"); }
      if (/slowed/i.test(file.name) && !f.version) f.version = "Slowed";
      if (f.version && new RegExp("\\s*[\\(\\[]?\\b" + f.version + "\\b[\\)\\]]?\\s*$", "i").test(f.title)) f.title = f.title.replace(new RegExp("\\s*[\\(\\[]?\\b" + f.version + "\\b[\\)\\]]?\\s*$", "i"), "").trim() || f.title;
      st.embedded = tags.cover || null;
    } catch (e) {
      Object.assign(st, { file: null, busy: "", buffer: null }); render(); msg(e && e.message ? e.message : "This file could not be opened."); return;
    }
    render();
  }
  function drawOutline(cv, pos) {
    if (!cv || !st.outline) return; const x = cv.getContext("2d"), W = cv.width, H = cv.height, n = st.outline.length, bw = W / n;
    x.clearRect(0, 0, W, H);
    for (let i = 0; i < n; i++) { const h = Math.max(2, st.outline[i] * (H - 4)); x.fillStyle = (i / n) < pos ? "#e0a9b0" : "rgba(255,255,255,.32)"; x.fillRect(i * bw + 1, (H - h) / 2, Math.max(1, bw - 2), h); }
    const bx = st.duration ? st.best / st.duration * W : 0; x.fillStyle = "#efe4d2"; x.fillRect(bx, 0, 2, H);
  }
  function stepFile() {
    const u = U();
    if (st.busy) return `<div class="st-card center" role="status"><div class="spin"></div><b>${esc(st.busy)}</b><span class="muted small">${esc(st.name)} · ${mb(st.size)}</span></div>`;
    if (!st.file) return `<label class="drop" id="drop" for="fileIn">${icon("music")}<b>Choose the song file</b><span>or drop it here</span></label>
      <input type="file" id="fileIn" class="sr" accept="audio/*,.wav,.mp3,.flac,.m4a,.aif,.aiff">
      <ul class="plain small"><li>Best: WAV, 16-bit, 44.1 kHz or higher. MP3, FLAC and M4A work too.</li><li>From ${u.minSeconds} seconds to ${Math.round(u.maxSeconds / 60)} minutes, up to ${u.maxFileMB} MB.</li><li>Nothing leaves your device until you press Publish.</li></ul>`;
    const w = st.wav, tech = st.kind + (w ? ` · ${w.bits}-bit · ${(w.sampleRate / 1000).toFixed(1).replace(".0", "")} kHz · ${w.channels === 1 ? "mono" : "stereo"}` : "");
    return `<div class="st-card"><div class="filehead"><span class="fileico">${icon("music")}</span><div><b>${esc(st.name)}</b><small>${esc(tech)} · ${mb(st.size)}</small></div></div>
      <div class="wave"><button type="button" class="round-play sm" id="fPlay" aria-label="Play">${icon("play")}</button><canvas id="fWave" width="640" height="64" aria-hidden="true"></canvas><span class="time" id="fTime">${len(st.duration)}</span></div>
      <div class="facts st-facts"><div class="fact"><b>Length</b>${len(st.duration)}</div><div class="fact"><b>Loudness</b>${lufs(st.loud.lufs)}</div><div class="fact"><b>Peak</b>${st.loud.peakDb.toFixed(1)} dB</div></div>
      ${w && (w.bits < 16 || w.sampleRate < 44100) ? `<div class="chk warn">${icon("close")}<span>This WAV is below CD quality (16-bit, 44.1 kHz). It will work here; stores like LANDR ask for at least that.</span></div>` : ""}
      ${st.kind === "MP3" ? `<div class="chk warn">${icon("close")}<span>An MP3 works here. For the best sound, and for stores later, keep the WAV too.</span></div>` : ""}
      ${st.found.length ? `<p class="muted small" style="margin:10px 0 0">Read from the file: ${st.found.join(", ")}.</p>` : ""}
      <button type="button" class="linkbtn" id="fOther">Choose another file</button></div>
      <input type="file" id="fileIn" class="sr" accept="audio/*,.wav,.mp3,.flac,.m4a,.aif,.aiff"><audio id="stAudio" src="${esc(st.url)}" preload="auto"></audio>`;
  }
  function wireFile() {
    const inp = $("#fileIn"); if (inp) inp.onchange = () => takeFile(inp.files[0]);
    const drop = $("#drop");
    if (drop) { ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); })); ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); })); drop.addEventListener("drop", e => takeFile(e.dataTransfer.files[0])); }
    const o = $("#fOther"); if (o) o.onclick = () => inp.click();
    const a = $("#stAudio"), cv = $("#fWave"), pb = $("#fPlay");
    if (a && cv) {
      const paint = () => { drawOutline(cv, a.duration ? a.currentTime / a.duration : 0); $("#fTime").textContent = a.paused && !a.currentTime ? len(st.duration) : fmt(a.currentTime); if (!a.paused) raf = requestAnimationFrame(paint); };
      pb.onclick = () => { if (a.paused) { ctx.stopMusic(); a.play().catch(() => {}); } else a.pause(); };
      a.onplay = () => { pb.innerHTML = icon("pause"); pb.setAttribute("aria-label", "Pause"); paint(); }; a.onpause = () => { pb.innerHTML = icon("play"); pb.setAttribute("aria-label", "Play"); paint(); };
      cv.onclick = e => { const r = cv.getBoundingClientRect(); a.currentTime = (e.clientX - r.left) / r.width * (a.duration || st.duration); paint(); };
      paint();
    }
  }

  // ============================================================
  // Step 2: song details
  // ============================================================
  function stepDetails() {
    const f = st.f, tx = T(), g = tx.genres.find(x => x.name === f.genre), arts = artistList(), lockAdult = f.explicit || f.moods.some(m => (tx.moods.find(x => x.name === m) || {}).adult);
    return `${field("dTitle", "Song title", `<input id="dTitle" type="text" maxlength="120" value="${esc(f.title)}" autocomplete="off">`, "Only the title. No extra words such as “Original Mix” or “Explicit version”.")}
     <div class="two">${field("dVersion", "Version <span class=\"muted\">(optional)</span>", `<select id="dVersion">${VERSIONS.map(v => opt(v, v || "None: the original", f.version === v)).join("")}</select>`)}
       ${f.version === "Other" ? field("dVersionOther", "Version name", `<input id="dVersionOther" type="text" maxlength="40" value="${esc(f.versionOther)}">`) : ""}</div>
     ${field("dArtist", "Artist name", `<select id="dArtist"><option value=""${f.artistId ? "" : " selected"} disabled>Choose…</option>${arts.map(a => opt(a.id, a.name, f.artistId === a.id)).join("")}${opt("+", "+ New artist name", f.artistId === "+")}</select>`, "The name listeners see. Use the same spelling on every song.")}
     ${f.artistId === "+" ? field("dArtistNew", "New artist name", `<input id="dArtistNew" type="text" maxlength="80" value="${esc(f.artistNew)}" autocomplete="off">`) : ""}
     ${field("dFeat", "Featured artists <span class=\"muted\">(optional)</span>", `<input id="dFeat" type="text" maxlength="200" value="${esc(f.featured)}" placeholder="Separate names with commas" autocomplete="off">`)}
     <div class="two">${field("dGenre", "Genre", `<select id="dGenre"><option value=""${f.genre ? "" : " selected"} disabled>Choose…</option>${tx.genres.map(x => opt(x.name, x.name, f.genre === x.name)).join("")}</select>`)}
       ${field("dSub", "Sub-genre", `<select id="dSub"><option value="">${g && g.sub.length ? "None" : "Choose a genre first"}</option>${g ? g.sub.map(x => opt(x, x, f.subgenre === x)).join("") : ""}</select>`)}</div>
     <div class="field"><label id="dMoodL">Mood <span class="muted">(up to 3; the first is the main one)</span></label><div class="chips pick" role="group" aria-labelledby="dMoodL">${tx.moods.map(m => `<button type="button" class="chip${f.moods.includes(m.name) ? " on" : ""}" data-mood="${esc(m.name)}" aria-pressed="${f.moods.includes(m.name)}">${esc(m.name)}</button>`).join("")}</div></div>
     <div class="two">${field("dLang", "Language of the lyrics", `<select id="dLang">${tx.languages.map(x => opt(x, x, f.language === x)).join("")}</select>`)}
       <div class="field"><label id="dExpL">Lyrics</label><div class="seg wide" role="group" aria-labelledby="dExpL"><button type="button" data-exp="0" class="${f.explicit ? "" : "on"}" aria-pressed="${!f.explicit}">Clean</button><button type="button" data-exp="1" class="${f.explicit ? "on" : ""}" aria-pressed="${f.explicit}">Explicit</button></div></div></div>
     <label class="tick${lockAdult ? " locked" : ""}"><input type="checkbox" id="dAdult"${lockAdult || f.adult ? " checked" : ""}${lockAdult ? " disabled" : ""}><span><b>For adults (sensual)</b><small>Adults only, behind the age question.${lockAdult ? " Switched on because the song is explicit or sensual." : ""}</small></span></label>
     <div class="two">${field("dRelease", "Release date", `<input id="dRelease" type="date" value="${esc(f.release)}" max="2099-12-31">`)}
       ${field("dCreated", "Made on <span class=\"muted\">(optional)</span>", `<input id="dCreated" type="date" value="${esc(f.created)}" max="${today()}">`, "The day the song was made, if you know it.")}</div>`;
  }
  function wireDetails() {
    const f = st.f, bind = (id, key, re) => { const el = $("#" + id); if (el) el.oninput = el.onchange = () => { f[key] = el.value; if (re) render(); }; };
    bind("dTitle", "title"); bind("dVersion", "version", true); bind("dVersionOther", "versionOther"); bind("dArtistNew", "artistNew"); bind("dFeat", "featured");
    bind("dLang", "language"); bind("dRelease", "release"); bind("dCreated", "created"); bind("dSub", "subgenre");
    $("#dArtist").onchange = e => { f.artistId = e.target.value; st.artist.loadedFor = ""; render(); if (f.artistId === "+") { const n = $("#dArtistNew"); if (n) n.focus(); } };
    $("#dGenre").onchange = e => { f.genre = e.target.value; f.subgenre = ""; render(); };
    $$("[data-mood]").forEach(b => b.onclick = () => { const m = b.dataset.mood, i = f.moods.indexOf(m); if (i >= 0) f.moods.splice(i, 1); else if (f.moods.length >= 3) { msg("Up to 3 moods."); return; } else f.moods.push(m); render(); });
    $$("[data-exp]").forEach(b => b.onclick = () => { f.explicit = b.dataset.exp === "1"; render(); });
    const ad = $("#dAdult"); if (ad) ad.onchange = () => { f.adult = ad.checked; };
  }

  // ============================================================
  // Step 3: credits and AI
  // ============================================================
  function stepCredits() {
    const f = st.f;
    return `<p class="muted small" style="margin-top:0">Real names for the people who made the song. These show under “Credits”, like on Spotify.</p>
     <div class="two">${field("cLyr", "Lyrics by", `<input id="cLyr" type="text" maxlength="80" value="${esc(f.lyricist)}" autocomplete="name">`)}${field("cComp", "Music by <span class=\"muted\">(composer)</span>", `<input id="cComp" type="text" maxlength="80" value="${esc(f.composer)}" autocomplete="off">`)}</div>
     ${field("cProd", "Produced by", `<input id="cProd" type="text" maxlength="80" value="${esc(f.producer)}" autocomplete="off">`)}
     <div id="cExtra">${f.extra.map((c, i) => `<div class="two extra"><div class="field"><label for="cRole${i}">Role</label><select id="cRole${i}" data-xr="${i}">${ROLES.map(r => opt(r, r, c.role === r)).join("")}</select></div><div class="field"><label for="cName${i}">Name</label><div class="withx"><input id="cName${i}" data-xn="${i}" type="text" maxlength="80" value="${esc(c.name)}" autocomplete="off"><button type="button" class="icon-btn" data-xd="${i}" aria-label="Remove this credit">${icon("close")}</button></div></div></div>`).join("")}</div>
     <button type="button" class="btn ghost sm" id="cAdd">Add another credit</button>
     <h3 class="st-h">Was AI used to make this song?</h3>
     <div class="seg wide" role="group" aria-label="AI used"><button type="button" data-ai="1" class="${f.aiUsed ? "on" : ""}" aria-pressed="${f.aiUsed}">Yes</button><button type="button" data-ai="0" class="${f.aiUsed ? "" : "on"}" aria-pressed="${!f.aiUsed}">No</button></div>
     ${f.aiUsed ? `<div class="st-card soft"><p class="small" style="margin:0 0 8px">What did the AI make?</p>
        <div class="ticks">${tick("aiMusic", f.ai.music, "The music (instruments)")}${tick("aiVocals", f.ai.vocals, "The voice")}${tick("aiLyrics", f.ai.lyrics, "The lyrics")}${tick("aiArt", f.ai.artwork, "The cover")}</div>
        ${field("aiTool", "Which tool?", `<input id="aiTool" type="text" maxlength="60" value="${esc(f.aiTool)}" placeholder="Suno" autocomplete="off">`)}</div>` : ""}
     <p class="muted small">Listeners see this on the song, in plain words. Being open about AI is part of the Velora promise.</p>
     <details class="st-more" id="cMore"${st.moreOpen ? " open" : ""}><summary>Release details for stores <span class="muted">(optional)</span></summary>
      <p class="muted small" style="margin-top:0">LANDR and the stores ask for these. Velora keeps them with the song, ready for the day it goes to stores.</p>
      <div class="two">${field("rLabel", "Label name", `<input id="rLabel" type="text" maxlength="80" value="${esc(f.label)}" placeholder="Often the artist name" autocomplete="off">`)}${field("rPub", "Publisher", `<input id="rPub" type="text" maxlength="80" value="${esc(f.publisher)}" placeholder="If the song has one" autocomplete="off">`)}</div>
      <div class="two">${field("rCO", "Composition owner (©)", `<input id="rCO" type="text" maxlength="80" value="${esc(f.cOwner)}" autocomplete="off">`, "Who owns the song as written: music and lyrics.")}${field("rCY", "Year written", `<input id="rCY" type="text" inputmode="numeric" maxlength="4" value="${esc(f.cYear)}" placeholder="${yearOf()}" autocomplete="off">`)}</div>
      <div class="two">${field("rPO", "Recording owner (℗)", `<input id="rPO" type="text" maxlength="80" value="${esc(f.pOwner)}" autocomplete="off">`, "Who owns this recording.")}${field("rPY", "Year recorded", `<input id="rPY" type="text" inputmode="numeric" maxlength="4" value="${esc(f.pYear)}" placeholder="${yearOf()}" autocomplete="off">`)}</div>
      ${field("rIsrc", "ISRC code", `<input id="rIsrc" type="text" maxlength="15" value="${esc(f.isrc)}" placeholder="NL-A01-26-00001" autocomplete="off" autocapitalize="characters">`, "The song's code in stores. Leave it empty if the song has none: a distributor such as LANDR gives one when it sends the song out.")}
     </details>`;
  }
  const yearOf = () => String((st.f.created || st.f.release || today()).slice(0, 4));
  const ISRC = /^[A-Z]{2}-?[A-Z0-9]{3}-?\d{2}-?\d{5}$/;
  // What is kept for stores: only what was filled in, plus the kind of release.
  function releaseOut() {
    const f = st.f, y = v => { const n = parseInt(v, 10); return n >= 1900 && n <= 2100 ? n : +yearOf(); }, o = { type: "single" };
    if (f.label.trim()) o.label = f.label.trim().slice(0, 80); if (f.publisher.trim()) o.publisher = f.publisher.trim().slice(0, 80);
    if (f.isrc.trim()) o.isrc = f.isrc.trim().toUpperCase().replace(/-/g, "");
    if (f.cOwner.trim()) { o.c_owner = f.cOwner.trim().slice(0, 80); o.c_year = y(f.cYear); }
    if (f.pOwner.trim()) { o.p_owner = f.pOwner.trim().slice(0, 80); o.p_year = y(f.pYear); }
    return o;
  }
  function wireCredits() {
    const f = st.f, bind = (id, key) => { const el = $("#" + id); if (el) el.oninput = () => { f[key] = el.value; }; };
    bind("cLyr", "lyricist"); bind("cComp", "composer"); bind("cProd", "producer"); bind("aiTool", "aiTool");
    bind("rLabel", "label"); bind("rPub", "publisher"); bind("rCO", "cOwner"); bind("rCY", "cYear"); bind("rPO", "pOwner"); bind("rPY", "pYear"); bind("rIsrc", "isrc");
    const more = $("#cMore"); if (more) more.ontoggle = () => { st.moreOpen = more.open; };
    $("#cAdd").onclick = () => { if (f.extra.length >= 12) return; f.extra.push({ role: "Composer", name: "" }); render(); };
    $$("[data-xr]").forEach(el => el.onchange = () => { f.extra[+el.dataset.xr].role = el.value; });
    $$("[data-xn]").forEach(el => el.oninput = () => { f.extra[+el.dataset.xn].name = el.value; });
    $$("[data-xd]").forEach(el => el.onclick = () => { f.extra.splice(+el.dataset.xd, 1); render(); });
    $$("[data-ai]").forEach(b => b.onclick = () => { f.aiUsed = b.dataset.ai === "1"; render(); });
    [["aiMusic", "music"], ["aiVocals", "vocals"], ["aiLyrics", "lyrics"], ["aiArt", "artwork"]].forEach(([id, k]) => { const el = $("#" + id); if (el) el.onchange = () => { f.ai[k] = el.checked; }; });
  }
  function creditsList(artistName) {
    const f = st.f, out = [], add = (group, name, role) => { name = String(name || "").trim().slice(0, 80); if (!name) return; const e = out.find(c => c.name === name && c.group === group); if (e) { if (!e.roles.includes(role) && e.roles.length < 6) e.roles.push(role); } else out.push({ group, name, roles: [role] }); };
    add("Artist", artistName, "Main Artist");
    f.featured.split(",").map(x => x.trim()).filter(Boolean).slice(0, 10).forEach(n => add("Artist", n, "Featured Artist"));
    add("Composition and lyrics", f.lyricist, "Lyricist"); add("Composition and lyrics", f.composer, "Composer");
    add("Production", f.producer, "Producer");
    f.extra.forEach(c => add(/Composer|Lyricist|Arranger/.test(c.role) ? "Composition and lyrics" : /Producer|Mixing|Mastering/.test(c.role) ? "Production" : "Performance", c.name, c.role));
    if (f.aiUsed && f.aiTool.trim()) { const parts = [f.ai.music && "music", f.ai.vocals && "voice", f.ai.lyrics && "lyrics", f.ai.artwork && "cover"].filter(Boolean); add("Production", f.aiTool, "AI-made: " + (parts.join(", ") || "parts of the song")); }
    return out.slice(0, 30);
  }

  // ============================================================
  // Step 4: lyrics, and syncing them to the music
  // ============================================================
  const SECTION = /^(intro|verse|pre[- ]?chorus|post[- ]?chorus|final chorus|chorus|hook|refrain|bridge|drop|break ?down|break|interlude|instrumental|solo|build[- ]?up|build|outro|end|coda)\b/i;
  function parseLyrics(text) {
    const lines = []; let sec = null;
    for (const raw of String(text || "").split(/\r?\n/)) {
      const l = raw.trim(); if (!l) continue;
      const m = /^\[(.+)\]$/.exec(l);
      if (m) { if (SECTION.test(m[1].trim())) sec = m[1].trim().replace(/\s+/g, " ").replace(/\b[a-z]/g, c => c.toUpperCase()).slice(0, 40); continue; }   // other [notes] are stage directions: left out
      lines.push({ text: l.slice(0, 300), sec, t: null }); sec = null;
      if (lines.length >= 400) break;
    }
    return lines;
  }
  function reparse() {                                  // keep the times when only spelling changed
    const old = st.lines, now = parseLyrics(st.f.lyricsText);
    if (old.length === now.length) now.forEach((l, i) => { l.t = old[i].t; });
    else for (let i = 0; i < Math.min(old.length, now.length) && old[i].text === now[i].text; i++) now[i].t = old[i].t;   // lines added or removed: keep the start that is the same
    st.lines = now;
  }
  const timed = () => st.lines.filter(l => l.t != null).length;
  function stepLyrics() {
    const f = st.f;
    if (st.syncing) return syncHTML();
    return `${tick("lNone", f.noLyrics, "This song has no lyrics (instrumental)")}
     ${f.noLyrics ? "" : `${field("lText", "Lyrics", `<textarea id="lText" rows="12" maxlength="20000" spellcheck="true" placeholder="Paste the lyrics here, one line per line.">${esc(f.lyricsText)}</textarea>`, "A line in square brackets such as [Chorus] or [Verse 2] becomes a part of the song map, not a lyric line. Other notes in brackets are left out.")}
      <div class="st-card soft" id="lCard">${syncCard()}</div>`}`;
  }
  function syncCard() {
    const n = st.lines.length, done = n > 0 && timed() === n;
    return `<div class="synchead"><div><b>${done ? "Synced to the music" : "Sync the lyrics to the music"}</b><small>${n ? (done ? `All ${n} lines have their moment. They will light up as the song plays.` : `${timed()} of ${n} lines timed. Play the song and tap as each line starts.`) : "Add the lyrics first."}</small></div>${done ? `<span class="okdot">${icon("check")}</span>` : ""}</div>
       <div class="row"><button type="button" class="btn ${done ? "ghost" : "primary"} sm" id="lSync"${n ? "" : " disabled"}>${done ? "Check or redo" : timed() ? "Continue syncing" : "Start syncing"}</button>${tick("lSkip", st.skipSync, "Skip for now: show the lyrics without timing")}</div>`;
  }
  function wireLyrics() {
    if (st.syncing) { wireSync(); return; }
    const f = st.f, none = $("#lNone"); none.onchange = () => { f.noLyrics = none.checked; render(); };
    const card = () => {
      const s = $("#lSync"); if (s) s.onclick = () => { reparse(); if (!st.lines.length) return; st.syncing = true; st.skipSync = false; render(); };
      const k = $("#lSkip"); if (k) k.onchange = () => { st.skipSync = k.checked; };
    };
    const t = $("#lText"); if (t) t.oninput = () => { f.lyricsText = t.value; reparse(); const c = $("#lCard"); if (c) { c.innerHTML = syncCard(); card(); } };
    card();
  }
  function syncHTML() {
    return `<div class="sync"><div class="sync-top"><button type="button" class="round-play sm" id="syPlay" aria-label="Play">${icon("play")}</button><span class="time" id="syTime">0:00 / ${len(st.duration)}</span>
       <button type="button" class="btn ghost sm" id="syBack">Back 5 s</button><button type="button" class="btn ghost sm" id="sySpeed" aria-pressed="false">Slower</button></div>
     <ol class="sync-list" id="syList">${st.lines.map((l, i) => `<li data-i="${i}">${l.sec ? `<em>${esc(l.sec)}</em>` : ""}<button type="button" class="sy-line" data-redo="${i}" title="Redo from this line"><span class="sy-t"></span><span class="sy-x">${esc(l.text)}</span></button></li>`).join("")}</ol>
     <button type="button" class="sync-tap" id="syTap"><b></b><span id="syNext"></span></button>
     <div class="row sync-actions"><button type="button" class="btn ghost sm" id="syUndo">Undo last</button><button type="button" class="btn ghost sm" id="syClear">Start over</button><button type="button" class="btn primary sm" id="syDone"></button></div>
     <p class="muted small" style="margin:8px 0 0">Tip: on a computer the space bar taps too. A tap that came late? Tap that line in the list to redo from there.</p>
     <audio id="stAudio" src="${esc(st.url)}" preload="auto"></audio></div>`;
  }
  function wireSync() {
    const a = $("#stAudio"), list = $("#syList"), u = U(), items = $$("#syList li"), tapB = $("#syTap"), pb = $("#syPlay"), clock = $("#syTime");
    const cur = () => st.lines.findIndex(l => l.t == null);
    const mark = () => {                               // which line is being sung now
      cancelAnimationFrame(raf); if (!a.isConnected) return;
      const t = a.currentTime; let on = -1; st.lines.forEach((l, i) => { if (l.t != null && l.t <= t + 0.05) on = i; });
      items.forEach((li, i) => li.classList.toggle("on", i === on));
      clock.textContent = fmt(t) + " / " + len(st.duration);
      if (!a.paused) raf = requestAnimationFrame(mark);
    };
    const follow = () => { const li = list.querySelector("li.cur") || list.querySelector("li.on"); if (li) list.scrollTo({ top: Math.max(0, li.offsetTop - list.clientHeight * 0.35), behavior: "smooth" }); };
    const paint = () => {                              // the panel is updated in place: the song plays on without a gap
      const c = cur(), n = st.lines.length, k = timed();
      items.forEach((li, i) => { const l = st.lines[i]; li.classList.toggle("done", l.t != null); li.classList.toggle("cur", i === c); li.querySelector(".sy-t").textContent = l.t != null ? fmtT(l.t) : "–:––"; });
      tapB.disabled = c < 0; tapB.querySelector("b").textContent = c < 0 ? "All lines are timed" : "Tap when this line starts";
      $("#syNext").textContent = c < 0 ? "Play to check; tap a line to redo from there." : st.lines[c].text;
      $("#syUndo").disabled = !k; $("#syClear").disabled = !k; $("#syDone").textContent = c < 0 ? "Done" : `Done for now (${k} of ${n})`;
      follow(); mark();
    };
    const play = () => { ctx.stopMusic(); a.play().catch(() => {}); };
    const tap = () => {
      const i = cur(); if (i < 0) return;
      if (a.paused) { play(); if (i === 0 && a.currentTime < 0.3) return; }     // the first tap just starts the song
      const prev = i > 0 ? st.lines[i - 1].t : -1;
      st.lines[i].t = Math.round(Math.max(prev + 0.05, a.currentTime - u.tapDelay * a.playbackRate, 0) * 100) / 100;   // a finger is always a little late
      paint();
    };
    pb.onclick = () => { if (a.paused) play(); else a.pause(); };
    a.onplay = () => { pb.innerHTML = icon("pause"); pb.setAttribute("aria-label", "Pause"); mark(); };
    a.onpause = () => { pb.innerHTML = icon("play"); pb.setAttribute("aria-label", "Play"); };
    a.onseeked = mark;
    $("#syBack").onclick = () => { a.currentTime = Math.max(0, a.currentTime - 5); };
    $("#sySpeed").onclick = e => { a.playbackRate = a.playbackRate < 1 ? 1 : 0.75; e.currentTarget.textContent = a.playbackRate < 1 ? "Normal speed" : "Slower"; e.currentTarget.setAttribute("aria-pressed", String(a.playbackRate < 1)); };
    tapB.onclick = tap;
    $("#syUndo").onclick = () => { for (let i = st.lines.length - 1; i >= 0; i--) if (st.lines[i].t != null) { st.lines[i].t = null; a.currentTime = Math.max(0, (i > 0 ? st.lines[i - 1].t : 0) - 1); break; } paint(); };
    $("#syClear").onclick = () => { st.lines.forEach(l => { l.t = null; }); a.pause(); a.currentTime = 0; paint(); };
    list.onclick = e => {                              // tap a line: time it again from there
      const b = e.target.closest("[data-redo]"); if (!b) return; const i = +b.dataset.redo;
      if (st.lines[i].t == null && i !== cur()) return;
      for (let k = i; k < st.lines.length; k++) st.lines[k].t = null;
      a.currentTime = Math.max(0, (i > 0 ? st.lines[i - 1].t : 0) - 2); paint(); play();
    };
    $("#syDone").onclick = () => { a.pause(); st.syncing = false; render(); };
    st.onKey = e => { if ((e.code === "Space" || e.key === "Enter") && !/INPUT|TEXTAREA|SELECT|BUTTON/.test((e.target.tagName || ""))) { e.preventDefault(); tap(); } };
    paint();
  }
  // What goes to the server: timed lines, the parts of the song, and the best part.
  function lyricsOut() {
    const f = st.f; if (f.noLyrics || !st.lines.length) return { lyrics: null, synced: true, sections: [{ name: "Start", start: 0 }] };
    const n = st.lines.length, all = timed() === n;
    if (!all) {                                         // not synced: spread the lines evenly, only to keep their order
      const a = Math.min(8, st.duration * 0.05), b = st.duration * 0.95;
      return { lyrics: st.lines.map((l, i) => [Math.round((a + (b - a) * i / Math.max(1, n - 1)) * 10) / 10, l.text]), synced: false, sections: [{ name: "Start", start: 0 }] };
    }
    const secs = []; st.lines.forEach(l => { if (l.sec) secs.push({ name: l.sec, start: Math.max(0, Math.floor(l.t - 0.3)) }); });
    for (let i = secs.length - 1; i > 0; i--) if (secs[i].start <= secs[i - 1].start) secs.splice(i, 1);
    if (!secs.length) secs.push({ name: "Start", start: 0 }); else if (secs[0].start > 2) secs.unshift({ name: "Intro", start: 0 }); else secs[0].start = 0;
    return { lyrics: st.lines.map(l => [l.t, l.text]), synced: true, sections: secs.slice(0, 40) };
  }

  // ============================================================
  // Step 5: the cover
  // ============================================================
  async function takeCover(file) {
    const c = st.cover; msg("");
    if (!file) return;
    if (!/^image\/(jpeg|png)$/.test(file.type)) { msg("Use a JPG or PNG image."); return; }
    if (file.size > 30 * 1048576) { msg("This image is over 30 MB. Use a smaller file."); return; }
    let bmp; try { bmp = await createImageBitmap(file); } catch (e) { msg("This image could not be opened."); return; }
    if (c.url) URL.revokeObjectURL(c.url);
    Object.assign(c, { src: bmp, w: bmp.width, h: bmp.height, type: file.type === "image/png" ? "PNG" : "JPG", name: file.name || "cover", crop: false, allowSmall: false, url: "", color: "" });
    await coverPreview(); render();
  }
  // Draw the cover as it will be stored: centre square, at most coverStore pixels, JPEG.
  async function coverBlob(size) {
    const c = st.cover, side = Math.min(c.w, c.h), out = Math.min(size, side), cv = document.createElement("canvas"); cv.width = cv.height = out;
    const x = cv.getContext("2d"); x.imageSmoothingQuality = "high"; x.fillStyle = "#141418"; x.fillRect(0, 0, out, out);
    x.drawImage(c.src, (c.w - side) / 2, (c.h - side) / 2, side, side, 0, 0, out, out);
    return new Promise(res => cv.toBlob(res, "image/jpeg", 0.9));
  }
  async function coverPreview() {
    const c = st.cover, b = await coverBlob(480); if (c.url) URL.revokeObjectURL(c.url); c.url = URL.createObjectURL(b);
    // the cover's main colour, for the player background
    try { const cv = document.createElement("canvas"); cv.width = cv.height = 32; const x = cv.getContext("2d"); const side = Math.min(c.w, c.h); x.drawImage(c.src, (c.w - side) / 2, (c.h - side) / 2, side, side, 0, 0, 32, 32);
      const d = x.getImageData(0, 0, 32, 32).data, B = {}; for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], bl = d[i + 2], mx = Math.max(r, g, bl) / 255, mn = Math.min(r, g, bl) / 255, L = (mx + mn) / 2; if (L < .12 || L > .88) continue; const sat = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * L - 1)), k = (r >> 5) + "-" + (g >> 5) + "-" + (bl >> 5), o = B[k] || (B[k] = { n: 0, r: 0, g: 0, b: 0, s: 0 }); o.n++; o.r += r; o.g += g; o.b += bl; o.s += sat; }
      let best = null, sc = -1; for (const k in B) { const o = B[k], v = o.n * ((o.s / o.n) ** 2 + 0.01); if (v > sc) { sc = v; best = o; } }
      c.color = best ? "#" + [best.r, best.g, best.b].map(v => Math.round(v / best.n).toString(16).padStart(2, "0")).join("") : "";
    } catch (e) { c.color = ""; }
  }
  function coverState() {
    const c = st.cover, u = U(), side = Math.min(c.w, c.h), square = c.w === c.h;
    return { has: !!c.src, square, squareOk: square || c.crop, side, store: side >= u.coverMin, big: side > u.coverMax, tiny: side < u.coverMinOwn,
      ok: !!c.src && (square || c.crop) && side >= u.coverMinOwn && (side >= u.coverMin || c.allowSmall) };
  }
  function stepCover() {
    const c = st.cover, u = U(), s = coverState();
    const rule = `<ul class="plain small"><li><b>The rule (same as LANDR):</b> a perfect square, JPG or PNG, from ${u.coverMin} × ${u.coverMin} to ${u.coverMax} × ${u.coverMax} pixels. 3000 × 3000 is ideal.</li><li>Only the title, the artist name and your own art. No web addresses, social handles or brand logos.</li><li>Sharp, not blurry or stretched. Art you made or have the right to use.</li></ul>`;
    if (!s.has) return `<label class="drop" id="cDrop" for="coverIn">${icon("image")}<b>Choose the cover image</b><span>or drop it here</span></label><input type="file" id="coverIn" class="sr" accept="image/jpeg,image/png">${rule}`;
    return `<div class="coverrow"><div class="coverprev" style="background-image:url('${esc(c.url)}')" role="img" aria-label="Cover preview"></div>
      <div class="coverchecks"><b>${esc(c.name)}</b><small class="muted">${c.w} × ${c.h} pixels · ${c.type}</small>
       ${checkRow(true, c.type + " format", "")}
       ${checkRow(s.squareOk, s.square ? "Perfect square" : "Cropped to a square (the middle)", `Not a square (${c.w} × ${c.h}).`)}
       ${!s.squareOk ? `<button type="button" class="btn sm" id="cCrop">Crop to a square</button>` : ""}
       ${s.tiny ? checkRow(false, "", `Too small. Velora needs at least ${u.coverMinOwn} × ${u.coverMinOwn}.`) : s.store ? checkRow(true, s.big ? `Larger than ${u.coverMax} × ${u.coverMax}: it will be made smaller` : "Big enough for stores", "") : checkRow(c.allowSmall, `Used on Velora only (${s.side} × ${s.side}; stores need ${u.coverMin} × ${u.coverMin})`, `Too small for stores: ${s.side} × ${s.side}. LANDR and Spotify need ${u.coverMin} × ${u.coverMin} or more.`, "warn")}
       ${s.squareOk && !s.tiny && !s.store && !c.allowSmall ? `<button type="button" class="btn sm" id="cAllow">Use it on Velora anyway</button>` : ""}
       <button type="button" class="linkbtn" id="cOther">Choose another image</button></div></div>
      <input type="file" id="coverIn" class="sr" accept="image/jpeg,image/png">${rule}`;
  }
  function wireCover() {
    const inp = $("#coverIn"); inp.onchange = () => takeCover(inp.files[0]);
    const drop = $("#cDrop"); if (drop) { ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); })); ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); })); drop.addEventListener("drop", e => takeCover(e.dataTransfer.files[0])); }
    const o = $("#cOther"); if (o) o.onclick = () => inp.click();
    const cr = $("#cCrop"); if (cr) cr.onclick = async () => { st.cover.crop = true; await coverPreview(); render(); };
    const al = $("#cAllow"); if (al) al.onclick = () => { st.cover.allowSmall = true; render(); };
  }

  // ============================================================
  // Step 6: mastering, and the best part
  // ============================================================
  const STYLES = [["warm", "Warm", "A little more body, a softer top"], ["balanced", "Balanced", "The tone stays as it is"], ["open", "Open", "A little more air and clarity"]];
  async function runMaster() {
    const m = st.master, u = U(), key = m.style + "|" + u.masterLufs + "|" + u.masterPeakDb;
    if (!m.on || !st.buffer || m.working || (m.res && m.key === key)) return;
    m.working = true; m.err = ""; if (st.step === 5) render();
    try { await new Promise(r => setTimeout(r, 30)); m.res = await A().master(st.buffer, { style: m.style, lufs: u.masterLufs, peakDb: u.masterPeakDb }); m.key = key; st.ab = null; }
    catch (e) { m.err = "Mastering did not work in this browser. You can publish with “Keep my sound”."; m.res = null; }
    m.working = false; if (st.step === 5) render();
  }
  function stepSound() {
    const m = st.master, u = U(), r = m.res;
    return `<p class="muted small" style="margin-top:0">Now: <b>${lufs(st.loud.lufs)}</b>, loudest peak ${st.loud.peakDb.toFixed(1)} dB.</p>
     <div class="opts" role="radiogroup" aria-label="Mastering">
      <label class="opt"><input type="radio" name="mOn" value="1"${m.on ? " checked" : ""}><div><b>Master it <span class="tag">free</span></b><span class="muted small">Sets the loudness streaming services use (${u.masterLufs} LUFS), so every song on Velora plays at the same level, and keeps the peaks safe.</span></div></label>
      <label class="opt"><input type="radio" name="mOn" value="0"${m.on ? "" : " checked"}><div><b>Keep my sound</b><span class="muted small">Nothing is changed. Right when the song is already mastered.</span></div></label></div>
     ${m.on ? `<div class="field"><label id="mStyleL">Style</label><div class="seg three" role="group" aria-labelledby="mStyleL">${STYLES.map(s => `<button type="button" data-style="${s[0]}" class="${m.style === s[0] ? "on" : ""}" aria-pressed="${m.style === s[0]}" title="${esc(s[2])}">${s[1]}</button>`).join("")}</div><small class="hint">${esc(STYLES.find(s => s[0] === m.style)[2])}.</small></div>
      <div class="st-card soft">${m.working ? `<div class="center" role="status"><div class="spin"></div><b>Mastering…</b><span class="muted small">A few seconds.</span></div>` : m.err ? `<div class="chk bad">${icon("close")}<span>${esc(m.err)}</span></div>` : r ? `<div class="abrow"><button type="button" class="round-play sm" id="abPlay" aria-label="Play">${icon("play")}</button><div class="seg ab" role="group" aria-label="Which version"><button type="button" data-ab="0" aria-pressed="false">Before</button><button type="button" data-ab="1" class="on" aria-pressed="true">After</button></div></div>
        <p class="small" style="margin:10px 0 0">After mastering: <b>${lufs(r.after.lufs)}</b>, loudest peak ${r.after.peakDb.toFixed(1)} dB <span class="muted">(${r.gainDb >= 0 ? "+" : ""}${r.gainDb.toFixed(1)} dB)</span>. Listen to both; they switch at the same spot.</p>` : ""}</div>` : ""}
     <h3 class="st-h">The best part</h3>
     <p class="muted small" style="margin-top:-6px">Where “Jump to the best part” lands. Velora picked the strongest moment; move it if you know better.</p>
     <div class="bestrow"><button type="button" class="btn ghost sm" data-best="-5">−5 s</button><button type="button" class="btn ghost sm" data-best="-1">−1 s</button><b id="bestAt">${fmt(st.best)}</b><button type="button" class="btn ghost sm" data-best="1">+1 s</button><button type="button" class="btn ghost sm" data-best="5">+5 s</button><button type="button" class="btn sm" id="bestPlay">${icon("play")}Hear it</button></div>`;
  }
  function abPlay(which, at) {
    const Au = A(), c = Au.context(), ab = st.ab || (st.ab = { which: 1, node: null, playing: false, offset: Math.max(0, st.best - 2), started: 0, buf: {} });
    if (which != null) ab.which = which;
    const pos = at != null ? at : ab.playing ? ab.offset + (c.currentTime - ab.started) : ab.offset;
    if (ab.node) { try { ab.node.onended = null; ab.node.stop(); } catch (e) {} ab.node = null; }
    const r = st.master.res, useAfter = ab.which === 1 && r && st.master.on;
    if (useAfter && !ab.buf.after) ab.buf.after = Au.toBuffer(r.L, r.R, r.sampleRate);
    const n = c.createBufferSource(); n.buffer = useAfter ? ab.buf.after : st.buffer; n.connect(c.destination);
    ab.offset = Math.min(Math.max(0, pos), Math.max(0, st.duration - 0.5)); ab.started = c.currentTime; ab.node = n; ab.playing = true;
    n.onended = () => { if (ab.node === n) { ab.playing = false; ab.node = null; const b = $("#abPlay"); if (b) { b.innerHTML = icon("play"); b.setAttribute("aria-label", "Play"); } } };
    ctx.stopMusic(); if (c.state === "suspended") c.resume(); n.start(0, ab.offset);
  }
  function abStop() { const ab = st.ab; if (!ab || !ab.node) return; const c = A().context(); ab.offset += c.currentTime - ab.started; try { ab.node.onended = null; ab.node.stop(); } catch (e) {} ab.node = null; ab.playing = false; }
  function wireSound() {
    const m = st.master;
    $$("input[name=mOn]").forEach(el => el.onchange = () => { abStop(); m.on = el.value === "1"; render(); if (m.on) runMaster(); });
    $$("[data-style]").forEach(b => b.onclick = () => { if (m.working) return; abStop(); m.style = b.dataset.style; render(); runMaster(); });
    const p = $("#abPlay"); if (p) p.onclick = () => { const ab = st.ab; if (ab && ab.playing) { abStop(); p.innerHTML = icon("play"); p.setAttribute("aria-label", "Play"); } else { abPlay(); p.innerHTML = icon("pause"); p.setAttribute("aria-label", "Pause"); } };
    $$("[data-ab]").forEach(b => b.onclick = () => { const w = +b.dataset.ab; $$("[data-ab]").forEach(x => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", String(on)); }); if (st.ab && st.ab.playing) abPlay(w); else { (st.ab || (st.ab = { which: w, node: null, playing: false, offset: Math.max(0, st.best - 2), started: 0, buf: {} })).which = w; } });
    $$("[data-best]").forEach(b => b.onclick = () => { st.best = Math.min(Math.max(0, st.best + (+b.dataset.best)), Math.max(0, Math.floor(st.duration) - 5)); st.bestSet = true; $("#bestAt").textContent = fmt(st.best); });
    $("#bestPlay").onclick = () => { abPlay(null, st.best); const pb = $("#abPlay"); if (pb) { pb.innerHTML = icon("pause"); pb.setAttribute("aria-label", "Pause"); } setTimeout(() => { if (st.ab && st.ab.playing && st.step === 5) { abStop(); const b2 = $("#abPlay"); if (b2) { b2.innerHTML = icon("play"); b2.setAttribute("aria-label", "Play"); } } }, 12000); };
    if (m.on && !m.res && !m.working && !m.err) runMaster();
  }

  // ============================================================
  // Step 7: rights
  // ============================================================
  const RIGHTS_TEXT = "I made this song or I own the rights to it: the recording, the lyrics and the cover. It contains no samples, melodies or lyrics from other people's work that I have no permission for. It is my own song, not a cover of someone else's song.";
  function stepRights() {
    const r = st.rights, me = ctx.Backend.name || "you";
    return `<div class="field"><label id="rCovL">Is this a cover of someone else's song?</label><div class="seg wide" role="group" aria-labelledby="rCovL"><button type="button" data-cov="0" class="${r.cover ? "" : "on"}" aria-pressed="${!r.cover}">No, my own song</button><button type="button" data-cov="1" class="${r.cover ? "on" : ""}" aria-pressed="${!!r.cover}">Yes, a cover</button></div></div>
     ${r.cover ? `<div class="chk bad">${icon("close")}<span>Velora takes original songs only for now. A cover needs a licence from the owner of the original song.</span></div>` : ""}
     <div class="ticks big">${tick("rOwn", r.own, "<b>I made this song or I own the rights to it</b><small>The recording, the lyrics and the cover.</small>")}
      ${tick("rClean", r.clean, "<b>Nothing in it is taken from someone else without permission</b><small>No samples, melodies or lyrics from other people's work.</small>")}
      ${tick("rRec", r.record, "<b>Keep a dated record that this song is mine</b><small>The song stays on Velora until I take it off the list. The record stays for good.</small>")}</div>
     <div class="st-card soft"><b>What the ownership record holds</b>
      <dl class="recdl"><dt>Song</dt><dd>${esc(fullTitle() || "–")}</dd><dt>Rights holder</dt><dd>${esc(me)}</dd><dt>Date and time</dt><dd>Set by the server at the moment you publish</dd>
       <dt>Fingerprints</dt><dd>Of your original file <span class="mono">${esc(st.origHash.slice(0, 16))}…</span>, of the streamed file, the cover and the lyrics</dd></dl>
      <p class="muted small" style="margin:10px 0 0">A fingerprint is a short code that only this exact file produces. Anyone holding the file can check it against the record. The records are chained: none can be changed or removed later without it showing.</p></div>
     <p class="muted small">This record is evidence of what you uploaded and when. It is not a copyright registration and not legal advice.</p>`;
  }
  function wireRights() {
    [["rOwn", "own"], ["rClean", "clean"], ["rRec", "record"]].forEach(([id, k]) => { const el = $("#" + id); el.onchange = () => { st.rights[k] = el.checked; }; });
    $$("[data-cov]").forEach(b => b.onclick = () => { st.rights.cover = b.dataset.cov === "1"; render(); });
  }

  // ============================================================
  // Step 8: the artist profile, then Publish
  // ============================================================
  function loadArtistCard() {
    const a = chosenArtist(), c = st.artist; if (!a || c.loadedFor === a.id) return;
    Object.assign(c, { loadedFor: a.id, tagline: a.tagline || "", bio: a.bio || "", photo: null, photoUrl: "" });
  }
  async function takePhoto(file) {
    if (!file) return; if (!/^image\/(jpeg|png)$/.test(file.type)) { msg("Use a JPG or PNG photo."); return; }
    let bmp; try { bmp = await createImageBitmap(file); } catch (e) { msg("This photo could not be opened."); return; }
    const side = Math.min(bmp.width, bmp.height); if (side < 400) { msg("This photo is too small. Use one of at least 400 × 400 pixels."); return; }
    const out = Math.min(800, side), cv = document.createElement("canvas"); cv.width = cv.height = out; const x = cv.getContext("2d"); x.imageSmoothingQuality = "high";
    x.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, out, out);
    const b = await new Promise(res => cv.toBlob(res, "image/jpeg", 0.88)), c = st.artist; if (c.photoUrl) URL.revokeObjectURL(c.photoUrl);
    c.photo = b; c.photoUrl = URL.createObjectURL(b); render();
  }
  function stepPublish() {
    const f = st.f, a = chosenArtist(), c = st.artist, p = st.pub, lo = lyricsOut(), adult = isAdult();
    if (p.song) return doneHTML();
    if (p.running || p.error) return `<div class="st-card"><b>${p.error ? "Publishing stopped" : "Publishing…"}</b><ol class="publog">${p.log.map(l => `<li class="${l.state}">${l.state === "done" ? icon("check") : l.state === "now" ? '<span class="spin sm"></span>' : l.state === "bad" ? icon("close") : "<i></i>"}<span>${esc(l.text)}${l.pct != null && l.state === "now" ? ` <b>${Math.round(l.pct * 100)}%</b>` : ""}</span></li>`).join("")}</ol>
       ${p.error ? `<p class="formmsg" role="alert">${esc(p.error)}</p><div class="row"><button type="button" class="btn primary" id="pRetry">Try again</button></div>` : `<p class="muted small" style="margin:10px 0 0">Keep this page open. A long song takes a little while on a phone.</p>`}</div>`;
    const img = c.photoUrl || (a && a.image) || "";
    return `<div class="st-card artistcard"><label class="aphoto" for="aPhoto" style="${img ? `background-image:url('${esc(img)}')` : ""}" title="Choose a photo">${img ? "" : icon("user")}<span>${img ? "Change" : "Add a photo"}</span></label><input type="file" id="aPhoto" class="sr" accept="image/jpeg,image/png">
       <div class="abody"><small class="muted">Artist profile${a && a.isNew ? " · new" : ""}</small><b class="aname">${esc(a ? a.name : "")}</b>
        ${field("aTag", "Tagline <span class=\"muted\">(optional)</span>", `<input id="aTag" type="text" maxlength="120" value="${esc(c.tagline)}" placeholder="One short line" autocomplete="off">`)}
        ${field("aBio", "About the artist <span class=\"muted\">(optional)</span>", `<textarea id="aBio" rows="3" maxlength="1500" placeholder="A few sentences listeners see on the artist page.">${esc(c.bio)}</textarea>`)}</div></div>
      <h3 class="st-h">Ready to publish</h3>
      <div class="st-card summary"><div class="sumcover" style="background-image:url('${esc(st.cover.url)}')"></div><div class="sumbody"><b>${esc(fullTitle())}</b><span>${esc(a ? a.name : "")}${f.featured.trim() ? " · feat. " + esc(f.featured.trim()) : ""}</span>
        <small>${esc(f.genre)}${f.subgenre ? " · " + esc(f.subgenre) : ""} · ${esc(f.moods.join(", "))} · ${len(st.duration)}</small>
        <div class="sumtags">${f.explicit ? '<span class="e-badge">E</span>' : ""}${adult ? '<span class="a18">18+</span>' : ""}<span class="tag">${lo.lyrics ? (lo.synced ? "Synced lyrics" : "Lyrics, not timed") : "No lyrics"}</span><span class="tag">${st.master.on ? "Mastered" : "Original sound"}</span>${f.aiUsed ? '<span class="tag">AI disclosed</span>' : ""}</div></div></div>
      <p class="muted small">Publish makes the song live at once for everyone${adult ? " who confirmed they are 18 or older" : ""}, and writes its ownership record.</p>`;
  }
  function wirePublish() {
    const c = st.artist, p = st.pub;
    if (p.song) { wireDone(); return; }
    const rt = $("#pRetry"); if (rt) rt.onclick = () => publish();
    const ph = $("#aPhoto"); if (ph) ph.onchange = () => takePhoto(ph.files[0]);
    const t = $("#aTag"); if (t) t.oninput = () => { c.tagline = t.value; };
    const b = $("#aBio"); if (b) b.oninput = () => { c.bio = b.value; };
  }
  async function publish() {
    const p = st.pub, B = ctx.Backend, Au = A(), u = U(), f = st.f, a = chosenArtist();
    if (p.running) return;
    stopSound(); abStop();
    const log = [{ text: st.master.on ? "Mastering the sound" : "Preparing the sound" }, { text: "Making the streaming file" }, { text: "Sending the song" }, { text: "Sending the cover" }, { text: "Saving the artist profile" }, { text: "Publishing and writing the ownership record" }];
    log.forEach(l => { l.state = "wait"; }); Object.assign(p, { running: true, error: "", log }); render();
    const step = async (i, fn) => { log[i].state = "now"; render(); try { const r = await fn(l => { log[i].pct = l; const el = $(".publog li.now b"); if (el) el.textContent = Math.round(l * 100) + "%"; }); log[i].state = "done"; render(); return r; } catch (e) { log[i].state = "bad"; throw e; } };
    try {
      const uid = B.user.id;
      const id = p.id || (p.id = await B.rpc("reserve_song"));
      const sound = await step(0, async () => {
        if (st.master.on) { if (!st.master.res) await runMasterNow(); const r = st.master.res; if (r) return { L: r.L, R: r.R, fs: r.sampleRate, loud: { before: +st.loud.lufs.toFixed(1), after: +r.after.lufs.toFixed(1), peak: +r.after.peakDb.toFixed(1), style: st.master.style }, mastered: true }; }
        const ch = Au.channels(st.buffer); return { L: ch[0], R: ch[1], fs: st.buffer.sampleRate, loud: { before: +st.loud.lufs.toFixed(1), peak: +st.loud.peakDb.toFixed(1) }, mastered: false };
      });
      const mp3 = p.mp3 && p.mp3Key === (sound.mastered ? st.master.key : "raw") ? p.mp3 : await step(1, async prog => { const b = await Au.encodeMp3(sound.L, sound.R, sound.fs, u.mp3Kbps, prog, ctx.VER); p.mp3 = b; p.mp3Key = sound.mastered ? st.master.key : "raw"; p.mp3Hash = await Au.sha256(b); return b; });
      log[1].state = "done";
      if (mp3.size > 50 * 1048576) throw new Error("The streaming file came out larger than 50 MB. Use a shorter song.");
      const audioPath = `${uid}/${id}/audio-${p.mp3Hash.slice(0, 16)}.mp3`;
      await step(2, () => B.upload(audioPath, mp3, "audio/mpeg"));
      const cover = p.cover || (p.cover = await coverBlob(u.coverStore)); const coverHash = p.coverHash || (p.coverHash = await Au.sha256(cover));
      const coverPath = `${uid}/${id}/cover-${coverHash.slice(0, 16)}.jpg`;
      await step(3, () => B.upload(coverPath, cover, "image/jpeg"));
      const saved = await step(4, async () => {
        const body = { id: a.id, name: a.name, tagline: st.artist.tagline.trim(), bio: st.artist.bio.trim(), color: st.cover.color || "" };
        if (st.artist.photo) { const h = await Au.sha256(st.artist.photo), path = `${uid}/artists/${a.id}-${h.slice(0, 16)}.jpg`; await B.upload(path, st.artist.photo, "image/jpeg"); body.image_path = path; }
        return B.rpc("save_artist", { p: body });
      });
      const lo = lyricsOut(), lyrHash = lo.lyrics ? await Au.sha256(new TextEncoder().encode(lo.lyrics.map(l => l[1]).join("\n")).buffer) : "";
      const version = f.version === "Other" ? f.versionOther.trim() : f.version;
      const song = await step(5, () => B.rpc("publish_song", { p: {
        id, title: f.title.trim(), version, artist_id: a.id, genre: f.genre, subgenre: f.subgenre, moods: f.moods, language: f.language, explicit: f.explicit, adult: isAdult(),
        duration: Math.round(st.duration * 10) / 10, best_part: st.best, audio_path: audioPath, cover_path: coverPath, color: st.cover.color || "",
        lyrics: lo.lyrics, lyrics_synced: lo.synced, sections: lo.sections, credits: creditsList(a.name), featured: f.featured.split(",").map(x => x.trim()).filter(Boolean).slice(0, 10),
        ai: f.aiUsed ? { used: true, music: !!f.ai.music, vocals: !!f.ai.vocals, lyrics: !!f.ai.lyrics, artwork: !!f.ai.artwork, tool: f.aiTool.trim().slice(0, 60) } : { used: false },
        release_date: f.release || today(), created_on: f.created || "", rights_confirmed: true, rights_statement: RIGHTS_TEXT,
        original_name: st.name, original_bytes: st.size, original_sha256: st.origHash, audio_sha256: p.mp3Hash, cover_sha256: coverHash, lyrics_sha256: lyrHash,
        mastered: sound.mastered, loudness: sound.loud, release: releaseOut() } }));
      // The song is live: put it into the catalogue of this page right away.
      const fix = x => x ? B.mediaUrl(x) : x;
      song.audio = fix(song.audio); song.art = fix(song.art);
      const art = { id: saved.id, name: saved.name, tagline: saved.tagline || "", bio: saved.bio || "", color: saved.color, image: saved.image ? fix(saved.image) : undefined };
      ctx.addSongs({ songs: [song], artists: [art] });
      if (Array.isArray(myArtists)) { const i = myArtists.findIndex(x => x.id === saved.id); if (i < 0) myArtists.push(saved); else myArtists[i] = Object.assign(myArtists[i], saved); }
      remember(saved.id); p.song = song; p.running = false; render(); window.scrollTo(0, 0);
    } catch (e) {
      p.running = false; p.error = (e && e.message) || "Something went wrong."; render();
    }
  }
  async function runMasterNow() { const m = st.master; while (m.working) await new Promise(r => setTimeout(r, 120)); if (!m.res) await runMaster(); }
  function doneHTML() {
    const s = st.pub.song, r = s.record || {};
    return `<div class="st-done"><div class="donecover" style="background-image:url('${esc(st.cover.url)}')"></div><span class="okdot big">${icon("check")}</span>
      <h2>Your song is live</h2><p class="muted">${esc(s.title)} is on Velora now.</p>
      <div class="row center"><a class="btn primary" href="#/song/${encodeURIComponent(s.id)}">${icon("play")}Open the song</a><button type="button" class="btn" id="dShare">${icon("share")}Copy the link</button></div>
      <div class="st-card soft rec"><b>Ownership record${r.id ? " no. " + esc(r.id) : ""}</b><dl class="recdl"><dt>Recorded</dt><dd>${r.at ? esc(ctx.longDateTime(r.at)) : "now"}</dd><dt>Fingerprint</dt><dd class="mono">${esc(String(r.hash || "").slice(0, 32))}…</dd></dl></div>
      <div class="row center"><button type="button" class="btn ghost" id="dAgain">${icon("upload")}Upload another song</button><a class="btn ghost" href="#/studio">My songs</a></div></div>`;
  }
  function wireDone() {
    const s = st.pub.song, link = location.href.split("#")[0] + "#/song/" + encodeURIComponent(s.id);
    $("#dShare").onclick = async () => { try { if (navigator.share) { await navigator.share({ title: s.title, url: link }); return; } await navigator.clipboard.writeText(link); ctx.toast("Link copied."); } catch (e) { if (!e || e.name !== "AbortError") ctx.toast(link); } };
    $("#dAgain").onclick = () => { cleanup(); st = fresh(); st.uid = ctx.Backend.user.id; render(); window.scrollTo(0, 0); };
  }

  // ============================================================
  // The frame around the steps: what must be filled in, moving on, drawing
  // ============================================================
  function problem(i) {
    const f = st.f, u = U();
    if (i === 0) return st.buffer ? "" : "Choose the song file first.";
    if (i === 1) {
      if (!f.title.trim()) return "Give the song its title.";
      if (f.version === "Other" && !f.versionOther.trim()) return "Name the version, or choose “None”.";
      const a = chosenArtist(); if (!a) return f.artistId === "+" ? "Type the new artist name." : "Choose the artist name.";
      if (a.isNew && a.id.length < 2) return "The artist name needs at least two letters or numbers.";
      if (a.isNew && artistList().some(x => x.id === a.id)) return "You already have an artist with this name. Choose it from the list.";
      if (!f.genre) return "Choose a genre."; if (!f.moods.length) return "Choose at least one mood."; if (!f.language) return "Choose the language.";
      if (!f.release) return "Choose the release date.";
      return "";
    }
    if (i === 2) { if (!f.lyricist.trim() && f.language !== "Instrumental (no lyrics)" && !f.noLyrics) return "Say who wrote the lyrics."; if (!f.producer.trim()) return "Say who produced the song."; if (f.extra.some(c => !c.name.trim())) return "Fill in the name of each added credit, or remove it."; if (f.aiUsed && !(f.ai.music || f.ai.vocals || f.ai.lyrics || f.ai.artwork)) return "Tick what the AI made, or choose “No”.";
      const more = why => { st.moreOpen = true; return why; }, yr = v => !v.trim() || (/^\d{4}$/.test(v.trim()) && +v >= 1900 && +v <= new Date().getFullYear() + 1);
      if (f.isrc.trim() && !ISRC.test(f.isrc.trim().toUpperCase())) return more("The ISRC code has 12 letters and numbers, like NL-A01-26-00001. Or leave it empty.");
      if (!yr(f.cYear) || !yr(f.pYear)) return more("A year has four numbers, like " + yearOf() + ".");
      return ""; }
    if (i === 3) { if (f.noLyrics) return ""; if (!st.lines.length) return "Paste the lyrics, or tick that the song has none."; if (timed() < st.lines.length && !st.skipSync) return "Sync the lyrics, or tick “Skip for now”."; return ""; }
    if (i === 4) { const s = coverState(); if (!s.has) return "Choose the cover image."; if (!s.squareOk) return "The cover must be a square. Press “Crop to a square”."; if (s.tiny) return `The cover is too small (at least ${u.coverMinOwn} × ${u.coverMinOwn}).`; if (!s.store && !st.cover.allowSmall) return "The cover is below the store size. Choose a bigger one, or press “Use it on Velora anyway”."; return ""; }
    if (i === 5) return st.master.on && st.master.working ? "One moment, the mastering is finishing." : "";
    if (i === 6) return st.rights.cover ? "Velora takes original songs only for now, not covers." : st.rights.own && st.rights.clean && st.rights.record ? "" : "Tick all three boxes to continue.";
    return "";
  }
  function goStep(i) {
    stopSound(); abStop(); st.syncing = false; st.onKey = null;
    st.step = Math.max(0, Math.min(STEPS.length - 1, i)); st.seen = Math.max(st.seen, st.step);
    if (st.step === 7) loadArtistCard();
    render(); window.scrollTo(0, 0);
    const h = $(".st-title"); if (h) try { h.focus({ preventScroll: true }); } catch (e) {}
  }
  function next() {
    const open = st.moreOpen, p = problem(st.step); if (p) { if (st.moreOpen !== open) render(); msg(p); return; }
    if (st.step === STEPS.length - 1) { for (let i = 0; i < STEPS.length - 1; i++) { const q = problem(i); if (q) { goStep(i); msg(q); return; } } publish(); return; }
    goStep(st.step + 1);
  }
  const BODY = [stepFile, stepDetails, stepCredits, stepLyrics, stepCover, stepSound, stepRights, stepPublish];
  const WIRE = [wireFile, wireDetails, wireCredits, wireLyrics, wireCover, wireSound, wireRights, wirePublish];
  function render() {
    if (!st) return;
    const i = st.step, last = i === STEPS.length - 1, p = st.pub, locked = p.running || !!p.song || !!st.busy;
    ctx.main.innerHTML = `<div class="st${st.syncing ? " syncing" : ""}">
      <div class="st-head"><button type="button" class="icon-btn" id="stClose" aria-label="Leave the upload">${icon("close")}</button>
        <div class="st-where"><small>${p.song ? "Done" : `Step ${i + 1} of ${STEPS.length}`}</small><h1 class="st-title" tabindex="-1">${p.song ? "Published" : STEPS[i][1]}</h1></div></div>
      <ol class="st-dots" aria-label="Steps">${STEPS.map((s, k) => `<li class="${k === i ? "now" : k < i || p.song ? "done" : ""}"><button type="button" data-go="${k}"${k <= st.seen && !locked ? "" : " disabled"} aria-current="${k === i ? "step" : "false"}"><i>${k < i || p.song ? icon("check") : k + 1}</i><span>${s[1]}</span></button></li>`).join("")}</ol>
      <div class="st-body">${BODY[i]()}</div>
      ${p.song || p.running || p.error || st.syncing ? "" : `<div class="st-foot"><p class="formmsg" id="stMsg" role="alert"></p><div class="st-nav">${i > 0 ? `<button type="button" class="btn ghost" id="stPrev">Back</button>` : "<span></span>"}<button type="button" class="btn primary" id="stNext"${st.busy ? " disabled" : ""}>${last ? icon("upload") + "Publish" : "Continue"}</button></div></div>`}
    </div>`;
    WIRE[i]();
    const nx = $("#stNext"); if (nx) nx.onclick = next;
    const pv = $("#stPrev"); if (pv) pv.onclick = () => goStep(i - 1);
    $$("[data-go]").forEach(b => b.onclick = () => goStep(+b.dataset.go));
    $("#stClose").onclick = leaveAsk;
  }
  function leaveAsk() {
    if (!st.file || st.pub.song) { ctx.go("#/"); return; }
    ctx.openModal(`<h2 id="mTitle">Leave the upload?</h2><p>What you filled in stays while this page is open, so you can come back to it. Reloading the page clears it.</p><div class="row"><button type="button" class="btn primary" id="lvStay">Keep working</button><button type="button" class="btn ghost" id="lvGo">Leave for now</button><button type="button" class="btn ghost" id="lvDrop">Discard this upload</button></div>`);
    document.getElementById("lvStay").onclick = ctx.closeM;
    document.getElementById("lvGo").onclick = () => { ctx.closeM(); ctx.go("#/"); };
    document.getElementById("lvDrop").onclick = () => { ctx.closeM(); cleanup(); st = null; ctx.go("#/"); };
  }
  function cleanup() { if (!st) return; stopSound(); abStop(); [st.url, st.cover.url, st.artist.photoUrl].forEach(u => { if (u) URL.revokeObjectURL(u); }); }

  // ============================================================
  // The doors: who may upload; My songs
  // ============================================================
  function gate(then) {
    const B = ctx.Backend, m = ctx.main;
    if (!B.enabled) { m.innerHTML = `<h1 class="pagetitle">Upload a song</h1><div class="panel"><h3>Uploads open soon</h3><p class="muted small" style="margin:0">The upload server is not connected yet.</p></div>`; return; }
    m.innerHTML = `<p class="muted" style="margin-top:24px" role="status">One moment…</p>`;
    B.init().then(async () => {
      if (!/^#\/(upload|studio)/.test(location.hash)) return;
      if (!B.user) {
        m.innerHTML = `<div class="st-intro"><h1 class="pagetitle">Upload your song</h1><p class="lead">Add a song to Velora in a few minutes: the file, the details, the lyrics that move with the music, the cover. It is live the moment you publish, with a dated record that it is yours.</p>
          <ul class="st-points"><li>${icon("check")}Synced lyrics, made here</li><li>${icon("check")}Mastering included</li><li>${icon("check")}Listed for good, with an ownership record</li></ul></div><div id="stAuth"></div>
          <p class="muted small" style="max-width:460px">Uploading is open to the owner's account for now. Accounts for other creators come later.</p>`;
        ctx.authPanel(document.getElementById("stAuth"), () => { if (/^#\/(upload|studio)/.test(location.hash)) gate(then); });
        return;
      }
      if (!B.canUpload()) { m.innerHTML = `<h1 class="pagetitle">Upload a song</h1><div class="panel"><h3>This account can't upload yet</h3><p class="muted small">Signed in as ${esc(B.user.email)}. Uploading is open to the owner's account for now; accounts for other creators come later.</p><button type="button" class="btn ghost sm" id="gOut">Sign out</button></div>`; document.getElementById("gOut").onclick = () => B.signOut().then(() => gate(then)); return; }
      if (myArtists === null || myArtistsFor !== B.user.id) { try { myArtists = await B.rpc("my_artists"); } catch (e) { myArtists = []; } myArtistsFor = B.user.id; }
      then();
    }).catch(e => { m.innerHTML = `<h1 class="pagetitle">Upload a song</h1><p class="muted">${esc(e && e.message || "The server can't be reached right now.")}</p><button type="button" class="btn primary" id="gRetry">Try again</button>`; document.getElementById("gRetry").onclick = () => gate(then); });
  }
  async function mySongs() {
    const B = ctx.Backend, m = ctx.main;
    m.innerHTML = `<div class="row-head"><h1 class="pagetitle" style="margin:0">My songs</h1><a class="btn primary sm" href="#/upload">${icon("upload")}Upload a song</a></div><div id="msList"><p class="muted" role="status">One moment…</p></div>`;
    let list; try { list = await B.rpc("my_songs"); } catch (e) { document.getElementById("msList").innerHTML = `<p class="muted">${esc(e.message)}</p>`; return; }
    const box = document.getElementById("msList"); if (!box) return;
    if (!list || !list.length) { box.innerHTML = `<div class="panel"><h3>No songs yet</h3><p class="muted small">The songs you upload show here, with their ownership records.</p><a class="btn primary" href="#/upload">${icon("upload")}Upload your first song</a></div>`; return; }
    box.innerHTML = `<p class="muted small">${list.length} song${list.length === 1 ? "" : "s"} uploaded from this account.</p><div class="mslist">${list.map(s => `<div class="msrow" data-id="${esc(s.id)}"><span class="mscover" style="background-image:url('${esc(s.art ? B.mediaUrl(s.art) : "")}')"></span>
       <div class="msbody"><b>${esc(s.title)}</b><small>${esc(s.artist || "")} · ${len(s.duration)} · ${s.status === "published" ? "Live" : "Off the list"}${s.published_at ? " · " + esc(ctx.longDateTime(s.published_at)) : ""}</small></div>
       <div class="msact">${s.status === "published" ? `<a class="btn sm" href="#/song/${encodeURIComponent(s.id)}">Open</a>` : ""}<button type="button" class="btn ghost sm" data-rec="${esc(s.id)}">Record</button><button type="button" class="btn ghost sm" data-list="${esc(s.id)}" data-on="${s.status === "published" ? "0" : "1"}">${s.status === "published" ? "Take off the list" : "Put back"}</button></div></div>`).join("")}</div>`;
    box.onclick = async e => {
      const l = e.target.closest("[data-list]"), r = e.target.closest("[data-rec]");
      if (l) { l.disabled = true; try { await B.rpc("set_song_listed", { p_song: l.dataset.list, p_listed: l.dataset.on === "1" }); const d = await B.catalogue(); if (d) ctx.addSongs(d); ctx.toast(l.dataset.on === "1" ? "The song is back on the list." : "The song is off the list. Its record stays."); mySongs(); } catch (err) { ctx.toast(err.message); l.disabled = false; } }
      if (r) { try { const rows = await B.rpc("my_records", { p_song: r.dataset.rec }); ctx.openModal(`<h2 id="mTitle">Ownership record</h2>${(rows || []).map(x => `<div class="st-card soft rec"><b>No. ${esc(x.id)} · ${esc(x.kind)}</b><dl class="recdl"><dt>Song</dt><dd>${esc(x.title)}</dd><dt>Artist</dt><dd>${esc(x.artist || "–")}</dd><dt>Rights holder</dt><dd>${esc(x.holder || "–")}</dd><dt>Recorded</dt><dd>${esc(ctx.longDateTime(x.at))}</dd>${x.details && x.details.original_sha256 ? `<dt>Original file</dt><dd class="mono">${esc(x.details.original_sha256)}</dd>` : ""}${x.details && x.details.audio_sha256 ? `<dt>Streamed file</dt><dd class="mono">${esc(x.details.audio_sha256)}</dd>` : ""}<dt>Record fingerprint</dt><dd class="mono">${esc(x.hash)}</dd></dl></div>`).join("") || `<p class="muted">No record found.</p>`}`); } catch (err) { ctx.toast(err.message); } }
    };
  }

  // ---------- The two entry points the app calls ----------
  function onKey(e) { if (st && st.onKey && st.syncing) st.onKey(e); }
  function warn(e) { if (st && st.file && !st.pub.song) { e.preventDefault(); e.returnValue = ""; } }
  return {
    open(path, params, c) {
      ctx = c;
      if (!this.bound) { this.bound = true; document.addEventListener("keydown", onKey); window.addEventListener("beforeunload", warn); }
      gate(() => {
        const uid = ctx.Backend.user.id;
        if (st && (st.pub.song || st.uid !== uid)) { cleanup(); st = null; }      // a finished upload, or another account: start clean
        if (path === "/studio") { mySongs(); return; }
        if (!st) { st = fresh(); st.uid = uid; }
        render();
      });
    },
    leave() { if (st) { stopSound(); abStop(); st.syncing = false; } },
    _state: () => st
  };
})();
