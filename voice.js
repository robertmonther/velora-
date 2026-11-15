/* Velora voice: tap a microphone and say a song, a mood or a command, in English or Arabic.

   Two halves in this file:
   1. Understanding: what was heard -> what to do. Plain text in, a small object out; it needs no page,
      so the checks (tests/voice.mjs) run it on its own.
   2. The microphone in the page: the buttons, the listening sheet, and the two ways of hearing
      (the browser's own speech service on the web, the phone's inside the app).

   The words it knows live in data/voice-words.js (English and Arabic). What the sheet SAYS is English only,
   like the rest of the site. Speech is turned into text by the browser or the phone;
   this file only ever sees the text. Velora records nothing, stores nothing and sends nothing. */
(function (root) {
"use strict";

// ======================================================================================================
// 1. Understanding
// ======================================================================================================
const AR = /[\u0600-\u06ff]/;

// One spelling for everything: lower case, no accents, no Arabic vowel marks, one form of alef / ya / ta marbuta.
function norm(s){
  return String(s == null ? "" : s).toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640\u0621]/g, "")                       // vowel marks, the long dash between letters, a lone hamza
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")                        // every alef -> plain alef
    .replace(/\u0649/g, "\u064a").replace(/\u0629/g, "\u0647")               // alef maqsura -> ya, ta marbuta -> ha
    .replace(/\u0624/g, "\u0648").replace(/\u0626/g, "\u064a")               // hamza on waw / on ya
    .replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06f0-\u06f9]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\br\s*(?:&|and|n|'n'|\+)\s*b\b/g, "rnb").replace(/\bhip[\s-]*hop\b/g, "hiphop").replace(/\blo[\s-]*fi\b/g, "lofi")
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}
// For comparing titles: "she s" = "shes", "three" = "3", no "and", no "the" in front.
const NUM = { zero:"0", one:"1", two:"2", three:"3", four:"4", five:"5", six:"6", seven:"7", eight:"8", nine:"9", ten:"10" };
function canon(s){
  let t = " " + s + " ";
  t = t.replace(/ ([a-z]+) (s|m|re|ll|ve|d|t)(?= )/g, " $1$2");
  t = t.replace(/ (zero|one|two|three|four|five|six|seven|eight|nine|ten)(?= )/g, (m, w) => " " + NUM[w]);
  t = t.replace(/ and(?= )/g, "").replace(/\s+/g, " ").trim();
  return t.replace(/^(?:the|a|an|\u0630\u0627|\u0630\u064a|\u0632\u0627|\u062f\u0627) (?=.)/, "");            // also "the" written in Arabic letters
}
// How many letters must change to turn one text into the other.
function lev(a, b){
  if(a === b) return 0; const m = a.length, n = b.length; if(!m) return n; if(!n) return m;
  let prev = new Array(n + 1), cur = new Array(n + 1); for(let j = 0; j <= n; j++) prev[j] = j;
  for(let i = 1; i <= m; i++){
    cur[0] = i; const ca = a.charCodeAt(i - 1);
    for(let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca === b.charCodeAt(j - 1) ? 0 : 1));
    const t = prev; prev = cur; cur = t;
  }
  return prev[n];
}
const sim = (a, b) => { const L = Math.max(a.length, b.length); return L ? 1 - lev(a, b) / L : 0; };

// A rough "how it sounds" key, the same for Latin and Arabic letters: a title said in English and written
// by the phone in Arabic letters still finds its song. Vowels all become "a" and weigh little.
const AR_SOUND = { "\u0628":"b", "\u067e":"b", "\u062a":"t", "\u0637":"t", "\u062b":"T", "\u062c":"j", "\u062d":"h", "\u0647":"h", "\u062e":"h",
  "\u062f":"d", "\u0636":"d", "\u0630":"T", "\u0638":"T", "\u0631":"r", "\u0632":"s", "\u0633":"s", "\u0635":"s", "\u0634":"S", "\u063a":"k",
  "\u0641":"f", "\u06a4":"f", "\u0642":"k", "\u0643":"k", "\u06af":"k", "\u0644":"l", "\u0645":"m", "\u0646":"n",
  "\u0627":"a", "\u0648":"a", "\u064a":"a", "\u0639":"a" };
function soundWord(w){
  if(AR.test(w)){
    let o = ""; w = w.replace(/\u062a\u0634/g, "\u0634").replace(/\u0647$/, "\u0627");   // "t+sh" is how Arabic writes "ch"; a last "h" is a vowel
    for(const ch of w) o += AR_SOUND[ch] || (ch >= "0" && ch <= "9" ? ch : "");
    return o;
  }
  if(w.length > 3) w = w.replace(/([^aeiou])e$/, "$1");                                 // the silent "e" of "live", "late", "vibe"
  return w.replace(/tion|sion/g, "Sn").replace(/tch|sch|ch|sh/g, "S").replace(/ph/g, "f").replace(/th/g, "T").replace(/ck/g, "k").replace(/ght/g, "t")
    .replace(/^kn/, "n").replace(/^wr/, "r").replace(/qu/g, "k").replace(/x/g, "ks").replace(/c(?=[eiy])/g, "s").replace(/[cqg]/g, "k")
    .replace(/p/g, "b").replace(/v/g, "f").replace(/z/g, "s").replace(/[aeiouyw]+/g, "a");
}
const SAY = Object.keys(NUM).reduce((o, w) => { o[NUM[w]] = w; return o; }, {});          // a number is said as a word: "3" sounds like "three"
const sound = s => s.split(" ").map(w => soundWord(SAY[w] || w)).join("").replace(/(.)\1+/g, "$1");
const NEAR = { Ts:.4, Tt:.4, Td:.4, jk:.5, Ss:.6, Sj:.6, dt:.7 };                        // sounds that people and phones mix up
const wOf = c => c === "a" ? .35 : c === "h" ? .5 : 1;
const weight = k => { let w = 0; for(const c of k) w += wOf(c); return w; };
function soundSim(a, b){
  const m = a.length, n = b.length; if(!m || !n) return 0;
  let prev = new Array(n + 1), cur = new Array(n + 1); prev[0] = 0; for(let j = 1; j <= n; j++) prev[j] = prev[j - 1] + wOf(b[j - 1]);
  for(let i = 1; i <= m; i++){
    const x = a[i - 1]; cur[0] = prev[0] + wOf(x);
    for(let j = 1; j <= n; j++){
      const y = b[j - 1]; let sub = 0; if(x !== y){ const near = NEAR[x < y ? x + y : y + x]; sub = near === undefined ? 1 : near; }
      cur[j] = Math.min(prev[j] + wOf(x), cur[j - 1] + wOf(y), prev[j - 1] + sub);
    }
    const t = prev; prev = cur; cur = t;
  }
  return 1 - prev[n] / Math.max(weight(a), weight(b));
}

// How well does what was said fit a title? 0 to 100.
const wordSim = (a, b) => a === b ? 1 : (a.length < 4 || b.length < 4) ? 0 : sim(a, b);
function titleScore(q, t){
  if(!q || !t) return 0; if(q === t) return 100;
  const qs = " " + q + " ", ts = " " + t + " ", qn = q.split(" "), tn = t.split(" ");
  if(qs.includes(ts)) return tn.length >= 2 || t.length >= 6 ? 94 : 62;                 // the title inside a longer sentence
  if(ts.includes(qs)){ const cover = q.length / t.length, first = ts.startsWith(qs) ? 6 : 0; return Math.round(qn.length >= 2 || q.length >= 5 ? 68 + first + 24 * cover : 38 + first + 30 * cover); }   // a part of the title
  let hit = 0; const used = [];
  for(const a of qn){ let bi = -1, bs = 0; for(let i = 0; i < tn.length; i++){ if(used[i]) continue; const s = wordSim(a, tn[i]); if(s > bs){ bs = s; bi = i; } } if(bs >= .74){ used[bi] = 1; hit += bs; } }
  const p = hit / qn.length, r = hit / tn.length, f = p && r ? 2 * p * r / (p + r) : 0;
  const a = q.replace(/ /g, ""), b = t.replace(/ /g, ""), whole = Math.min(a.length, b.length) * 2 >= Math.max(a.length, b.length) ? sim(a, b) : 0;
  return Math.round(100 * Math.max(f * .92, whole * .9));
}
// "Just Friends (Slowed)" is also found as "Just Friends"; "Tip (Let Me Watch)" also as "Let Me Watch".
const VERSION = /^(?:slowed|sped up|speed up|remix|live|acoustic|instrumental|radio edit|edit|reverb|slowed reverb|slowed down|extended|version|demo|remaster|remastered|clean|explicit|deluxe|bonus track|interlude|intro|outro)(?: version| mix| edit)?$/;
function titleForms(title){
  const out = [], add = (text, w) => { const t = canon(norm(text)); if(t && !out.some(f => f.t === t)){ const k = sound(t); out.push({ t, k, kw: weight(k), w }); } };
  const inner = [], outer = String(title).replace(/[(\[]([^)\]]*)[)\]]/g, (m, x) => { inner.push(x); return " "; });
  add(title, 1); add(outer, 1);
  for(const x of inner) if(!VERSION.test(norm(x))) add(x, .96);
  return out;
}

function createMatcher(opt){
  const W = opt.words || {}, get = { songs: opt.songs, cats: opt.cats, artists: opt.artists || (() => []) }, rnd = opt.random || Math.random;
  const both = o => [].concat((o && o.en) || [], (o && o.ar) || []).map(norm).filter(Boolean), byLen = (a, b) => b.length - a.length;
  const POLITE = both(W.polite).sort(byLen), VERBS = both(W.verbs).sort(byLen);
  const FILLER = new Set(both(W.filler)), HINT = new Set(both(W.moodHint)), STATION = new Set(both(W.station)), OBJ = new Set(both(W.objects));
  const ALONE_NO = new Set((W.notAlone || []).map(norm)), LEAD = both(W.lyricLead).sort(byLen);
  const CMD = new Map(); for(const k of Object.keys(W.commands || {})) for(const p of both(W.commands[k])) if(!CMD.has(p)) CMD.set(p, k);
  // Arabic glues "the", "for the", "this" onto the word: look the word up without them too.
  const bare = w => AR.test(w) ? w.replace(/^(?:\u0648\u0627\u0644|\u0628\u0627\u0644|\u0647\u0627\u0644|\u0644\u0644|\u0627\u0644)(?=..)/, "") : w;
  const isFiller = t => FILLER.has(t) || FILLER.has(bare(t));
  const inCat = (s, c) => s.genre === c.name || (s.tags || []).indexOf(c.name) >= 0;

  // The catalogue, prepared once (and again when songs arrive or are hidden).
  let I = null;
  function index(){
    const songs = get.songs() || [], cats = get.cats() || [], arts = get.artists() || [];
    const key = songs.length + "|" + cats.length + "|" + arts.length + "|" + (songs[0] && songs[0].id) + "|" + (songs.length && songs[songs.length - 1].id);
    if(I && I.key === key && I.songs === songs) return I;
    const titles = songs.map(s => ({ s, forms: titleForms(s.title) })), exact = new Set(); for(const e of titles) for(const f of e.forms) exact.add(f.t);
    const byName = new Map(cats.map(c => [c.name, c])), trig = new Map();
    const hear = (p, k) => { p = norm(p); if(!p) return; const l = trig.get(p) || []; if(l.indexOf(k) < 0){ l.push(k); trig.set(p, l); } };
    for(const c of cats){                                                               // every category answers to its own name and search words
      const k = { id: "cat:" + c.id, play: [c] }, name = norm(c.name), parts = name.split(" ");
      hear(name, k);
      for(const w of norm(c.words || "").split(" ").concat(parts.length > 1 ? parts : [])) if(w.length > 1 && !ALONE_NO.has(w) && !FILLER.has(w)) hear(w, k);
    }
    const curated = (m, said) => { const play = (m.play || []).map(n => byName.get(n)).filter(Boolean); if(!play.length) return; const k = { id: m.id || "own", play, all: !!m.all, clean: !!m.clean, name: m.name ? String(m.name) : "" }; for(const p of said) hear(p, k); };
    for(const m of (W.moods || [])) curated(m, both(m));
    for(const m of (opt.extra || [])) if(m && m.say) curated({ play: m.play, all: m.all !== false, clean: m.clean, name: m.name }, String(m.say).split(","));
    const artists = arts.map(a => { const t = norm(a.name), k = sound(t); return { a, t, k, kw: weight(k) }; }).filter(x => x.t);
    return (I = { key, songs, titles, exact, trig, artists });
  }

  function strip(str, phrases){ let s = " " + str + " "; for(const p of phrases){ const x = " " + p + " "; let i; while((i = s.indexOf(x)) >= 0) s = s.slice(0, i) + " " + s.slice(i + x.length); } return s.replace(/\s+/g, " ").trim(); }
  function cutVerb(str){ for(const v of VERBS){ if(str === v) return ""; if(str.startsWith(v + " ")) return str.slice(v.length + 1); } return null; }
  function findCmd(list){ for(const s of list){ if(!s) continue; const c = CMD.get(s) || CMD.get(s.split(" ").filter(t => !OBJ.has(t)).join(" ")); if(c) return c; } return null; }

  // Which moods or genres were named, and which words are left over.
  function moodsIn(toks){
    const groups = [], rest = []; let hint = false;
    for(let i = 0; i < toks.length;){
      let found = null, len = 0;
      for(let n = Math.min(3, toks.length - i); n >= 1 && !found; n--){
        let l = I.trig.get(toks.slice(i, i + n).join(" ")); if(!l && n === 1) l = I.trig.get(bare(toks[i]));
        if(l){ found = l; len = n; }
      }
      if(found){ groups.push({ said: toks.slice(i, i + len).join(" "), list: found }); i += len; continue; }
      const t = toks[i]; if(HINT.has(t) || HINT.has(bare(t))) hint = true;
      if(!isFiller(t) && !STATION.has(t) && !STATION.has(bare(t))) rest.push(t);
      i++;
    }
    return { groups, rest, hint };
  }
  // The songs for the moods that were named. When a mood has few songs (or none yet), its neighbours fill the row.
  function moodIntent(groups){
    const songs = I.songs, MIN = 5, per = []; let names = [], clean = false, asked = "", got = [];
    for(const g of groups){
      const score = new Map(), used = [], named = g.list.find(k => k.name), first = g.list[0];
      for(const k of g.list){
        if(k.clean) clean = true;
        let depth = k.play.length - 1;
        if(!k.all){ const seen = new Set(); for(depth = 0; depth < k.play.length - 1; depth++){ for(const s of songs) if(inCat(s, k.play[depth])) seen.add(s); if(seen.size >= MIN) break; } }
        for(let i = 0; i <= depth; i++){
          const c = k.play[i], w = i === 0 ? 3 : i === 1 ? 2 : 1; let any = false;
          for(const s of songs) if(inCat(s, c)){ any = true; if((score.get(s) || 0) < w) score.set(s, w); }
          if(any && used.indexOf(c.name) < 0) used.push(c.name);
        }
      }
      per.push(score);
      names.push(named ? named.name : first.play[0].name);
      if(!named && groups.length === 1 && !songs.some(s => inCat(s, first.play[0]))){ asked = first.play[0].name; got = used; }
    }
    const all = new Set(); for(const m of per) m.forEach((v, s) => { if(!(clean && s.explicit)) all.add(s); });
    names = names.filter((n, i, a) => a.indexOf(n) === i);
    let list = Array.from(all); if(!list.length) return { type: "empty", name: names.join(" + ") };
    const rank = new Map(list.map(s => { let hit = 0, sum = 0; for(const m of per){ const v = m.get(s) || 0; if(v){ hit++; sum += v; } } return [s, hit * 100 + sum + rnd() * .9]; }));
    list.sort((a, b) => rank.get(b) - rank.get(a));                                      // the best fit first; equals in a new order every time
    if(per.length > 1){ const every = list.filter(s => per.every(m => m.get(s))); if(every.length >= 3) list = every; }
    const named = groups.length === 1 && groups[0].list.find(k => k.name);
    const label = asked ? "Closest to " + asked : named ? named.name : names.length === 1 ? names[0] + " Radio" : names.join(" + ");
    return { type: "mood", songs: list, label, names, closest: asked ? { asked, got } : null };
  }
  function titleHits(forms){
    const out = [];
    for(const e of I.titles){
      let best = 0;
      for(const q of forms) for(const v of e.forms){
        let s = titleScore(q.t, v.t);
        if(s < 97 && q.k && v.k && Math.min(q.k.length, v.k.length) * 2 >= Math.max(q.k.length, v.k.length)){
          let p = soundSim(q.k, v.k) * (q.ar ? 90 : 88);
          if(Math.min(q.kw, v.kw) < 3.2) p = q.k.replace(/a/g, "") === v.k.replace(/a/g, "") && p >= 70 ? 60 : 0;   // very short sounds fit too many things: offer, never play
          if(p > s) s = p;
        }
        if(s < 60 && q.k.length >= 5 && v.k.length > q.k.length * 1.4){                     // the start of a long title, by sound
          let ps = 0; for(let n = q.k.length; n <= q.k.length + 2; n++) ps = Math.max(ps, soundSim(q.k, v.k.slice(0, n)));
          const p = ps * (62 + 20 * q.k.length / v.k.length); if(p > s) s = p;
        }
        s *= v.w * q.w; if(s > best) best = s;
      }
      if(best >= 42) out.push({ song: e.s, score: best });
    }
    return out.sort((a, b) => b.score - a.score);
  }
  function artistHit(forms){
    let best = null;
    for(const x of I.artists) for(const q of forms){
      let s = q.t === x.t ? 100 : (" " + q.t + " ").includes(" " + x.t + " ") ? 92 : 90 * sim(q.t.replace(/ /g, ""), x.t.replace(/ /g, ""));
      const p = soundSim(q.k, x.k) * (q.ar ? 90 : 86) * (Math.min(q.kw, x.kw) < 3.2 ? .75 : 1); if(p > s) s = p;
      if(!best || s > best.score) best = { artist: x.a, score: s };
    }
    return best;
  }
  function lyricHits(list){
    const out = [];
    for(const q of list){
      if(!q || (q.split(" ").length < 3 && q.length < 12)) continue;
      for(const e of I.titles){
        if(e.lyr === undefined) e.lyr = " " + norm((e.s.lyrics || []).map(l => (l && l[1]) || "").join(" ")) + " ";
        if(e.lyr.includes(" " + q + " ") && out.indexOf(e.s) < 0) out.push(e.s);
      }
      if(out.length) break;
    }
    return out;
  }

  // One sentence -> what to do.
  function one(text){
    index(); const orig = norm(text), base = { heard: String(text == null ? "" : text).trim() };
    if(!orig) return Object.assign({ type: "none", conf: 0, near: [] }, base);
    const raw = strip(orig, POLITE); let noVerb = raw, verb = false;
    for(let i = 0; i < 2; i++){ if(I.exact.has(canon(noVerb))) break; const c = cutVerb(noVerb); if(c === null) break; verb = true; noVerb = c; }   // "Play With Us" is a title, not "play: with us"
    // A command ("stop", "next", "the radio")? A title said after "play" wins over a command of the same name.
    const cmd = findCmd([orig, raw, verb ? noVerb : ""]);
    if(cmd && !(verb && noVerb && I.exact.has(canon(noVerb)))) return Object.assign({ type: cmd, conf: .98 }, base);
    const toks = noVerb ? noVerb.split(" ") : [], M = moodsIn(toks), bareStr = toks.filter(t => !isFiller(t)).join(" ");
    const forms = [];
    for(const s of [orig, raw, noVerb, bareStr]){ const t = canon(s); if(t && !forms.some(f => f.t === t)){ const k = sound(t); forms.push({ t, k, kw: weight(k), ar: AR.test(t), w: s === bareStr && s !== noVerb ? .97 : 1 }); } }
    const T = titleHits(forms), top = T[0], margin = top ? top.score - (T[1] ? T[1].score : 0) : 0, full = M.groups.length > 0 && M.rest.length === 0;
    const song = conf => Object.assign({ type: "song", song: top.song, others: T.slice(1, 4).filter(x => x.score >= 55).map(x => x.song), conf }, base);
    if(top && top.score >= 97 && !(full && M.hint)) return song(top.score / 100);
    // Only "play", or "play" and small words ("play some music"): carry on with the music, or start it.
    if(!bareStr && !M.groups.length) return verb || toks.length ? Object.assign({ type: "play", conf: verb ? .95 : .6 }, base) : Object.assign({ type: "none", conf: 0, near: [] }, base);
    if(full){ const m = moodIntent(M.groups); return Object.assign(m, { conf: m.type === "mood" ? .9 : .6 }, base); }
    const A = artistHit(forms);
    if(A && A.score >= 84 && (!top || A.score >= top.score)) return Object.assign({ type: "artist", artist: A.artist, conf: A.score / 100 }, base);
    if(top && ((top.score >= 78 && margin >= 4) || (top.score >= 66 && margin >= 18))) return song(top.score / 100);
    // A line of the lyrics ("the one that goes ..."): when exactly one song has it, that is the song.
    const line = strip(noVerb, LEAD), L = !top || top.score < 60 || line !== noVerb ? lyricHits([line, noVerb, bareStr]) : [];
    if(L.length === 1) return Object.assign({ type: "song", song: L[0], others: [], conf: .75, byLyric: true }, base);
    if(M.groups.length && M.rest.length <= 2 && !(top && top.score >= 60)){ const m = moodIntent(M.groups); if(m.type === "mood") return Object.assign(m, { conf: .7 }, base); }
    const list = L.length > 1 ? L.slice(0, 4) : T.filter(x => x.score >= 55).slice(0, 4).map(x => x.song);
    if(list.length) return Object.assign({ type: "choices", songs: list, conf: .5 }, base);
    if(M.groups.length){ const m = moodIntent(M.groups); return Object.assign(m, { conf: .55 }, base); }
    return Object.assign({ type: "none", conf: 0, near: T.filter(x => x.score >= 50).slice(0, 3).map(x => x.song) }, base);
  }
  // The phone often gives a few guesses of what it heard: take the one that makes the most sense.
  function understand(alts){
    const list = (Array.isArray(alts) ? alts : [alts]).map(x => String(x == null ? "" : x).trim()).filter(Boolean).slice(0, 6);
    if(!list.length) return { type: "none", conf: 0, heard: "", near: [] };
    let best = null;
    list.forEach((t, i) => { const r = one(t); r.conf = (r.conf || 0) * (1 - .03 * i); if(!best || r.conf > best.conf) best = r; });
    best.said = list[0];
    return best;
  }
  // Moods that have songs, biggest first (for the "pick a mood" chips).
  function moods(n){
    const songs = get.songs() || [];
    return (get.cats() || []).filter(c => c.kind !== "genre").map(c => [c, songs.filter(s => inCat(s, c)).length]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, n || 6).map(x => x[0]);
  }
  return { understand, moods };
}

// ======================================================================================================
// 2. The microphone in the page
// ======================================================================================================
let X = null, M = null, WORDS = {}, on = false;                 // what app.js lends us, the matcher, the dictionary
let lang = "en", place = "off";
let isOpen = false, closing = false, wasPlaying = false, live = null, turn = 0, unlocked = false;
const LANGS = ["en", "ar"], PLACES = ["fab", "pill", "top", "off"];
const $ = s => document.querySelector(s);
const T = () => WORDS.text || {};                                 // the sheet's own words: English only, like the rest of the site
const langName = l => (T().langs && T().langs[l]) || l;
const fill = (s, x, y) => String(s || "").replace("{x}", x == null ? "" : x).replace("{y}", y == null ? "" : y);
const cfg = () => (X && X.CFG && X.CFG.voice) || {};
// What the browser or phone is asked to listen for. The first code is tried first.
const codes = l => { const own = cfg().langs && cfg().langs[l]; return (l === "ar" ? [own, "ar-LB", "ar-SA", "ar"] : [own, "en-US", "en-GB", "en"]).filter((c, i, a) => c && a.indexOf(c) === i); };
// A browser listens in one language at a time. Until the person has chosen (or a request has worked), start with the
// first of English or Arabic in the phone's or browser's own list of languages.
const deviceLang = () => { for(const l of [].concat(navigator.languages || [], navigator.language || [])){ if(/^ar\b/i.test(l)) return "ar"; if(/^en\b/i.test(l)) return "en"; } return "en"; };
const other = () => lang === "ar" ? "en" : "ar";

function init(ctx){
  X = ctx; WORDS = root.VELORA_VOICE_WORDS || {};
  if(cfg().enabled === false || !WORDS.text) return;
  M = createMatcher({ words: WORDS, songs: ctx.songs, cats: ctx.cats, artists: ctx.artists, extra: cfg().words });
  const savedLang = ctx.store.get("velora_voice_lang", ""), savedPlace = ctx.store.get("velora_voice_place", "");
  lang = LANGS.indexOf(savedLang) >= 0 ? savedLang : deviceLang();
  place = PLACES.indexOf(savedPlace) >= 0 ? savedPlace : PLACES.indexOf(cfg().place) >= 0 ? cfg().place : "off";
  on = true; document.documentElement.classList.add("voice-on"); paintPlace();
  document.addEventListener("click", e => { const b = e.target.closest("[data-voice]"); if(b){ e.preventDefault(); open(); } });
  // The sheet lives in the site's own window (#modal). When that closes, for whatever reason, stop listening.
  const body = $("#mBody");
  if(body) new MutationObserver(() => { if(isOpen && !document.getElementById("vx")) closed(); }).observe(body, { childList: true });
}
function paintPlace(){ const h = document.documentElement; for(const p of PLACES) h.classList.toggle("voice-p-" + p, p === place); }
function setLang(l){ if(LANGS.indexOf(l) < 0) return; lang = l; X.store.set("velora_voice_lang", l); }
function setPlace(p){ if(PLACES.indexOf(p) < 0) return; place = p; X.store.set("velora_voice_place", p); paintPlace(); }

// Which ears do we have? "web": the browser's speech service. "native": the phone's, inside the app. "none": typing only.
function engine(){
  if(X.NATIVE){ const c = root.Capacitor; if(!c || typeof c.nativePromise !== "function") return "none";
    try{ if(c.Plugins && c.Plugins.SpeechRecognition) return "native"; if(Array.isArray(c.PluginHeaders)) return c.PluginHeaders.some(h => h && h.name === "SpeechRecognition") ? "native" : "none"; }catch(e){}
    return "native"; }
  return root.SpeechRecognition || root.webkitSpeechRecognition ? "web" : "none";
}

// ---------- The sheet ----------
function tips(){
  const songs = X.songs() || [], pick = songs.find(s => !s.explicit && !s.adult && /^[\w' ]{6,22}$/.test(s.title)) || songs.find(s => !s.explicit) || songs[0];
  return ((WORDS.tips && WORDS.tips[lang]) || []).map(t => t.indexOf("{song}") < 0 ? t : pick ? t.replace("{song}", pick.title) : "").filter(Boolean);
}
function sheet(){
  const t = T(), e = X.esc;
  return `<div class="vx" id="vx" data-lang="${lang}">
    <h2 id="mTitle" class="sr">${e(t.title)}</h2>
    <div class="vx-langs" role="group" aria-label="${e(t.langLabel)}">${LANGS.map(l => `<button type="button" class="chip${l === lang ? " on" : ""}" data-vlang="${l}" aria-pressed="${l === lang}">${e(langName(l))}</button>`).join("")}</div>
    <button type="button" class="vx-mic" id="vxMic" aria-label="${e(t.tap)}"><i></i><i></i>${X.icon("mic")}</button>
    <p class="vx-state" id="vxState" role="status" aria-live="polite"></p>
    <p class="vx-heard" id="vxHeard" dir="auto"></p>
    <div class="vx-res" id="vxRes"></div>
    <div class="vx-tips" id="vxTips"><span class="muted small">${e(t.tryLabel)}</span><div class="chips">${tips().map(x => `<button type="button" class="chip" data-vsay="${e(x)}" dir="auto">${e(x)}</button>`).join("")}</div></div>
    <form class="vx-type" id="vxForm" autocomplete="off"><label class="sr" for="vxText">${e(t.typeLabel)}</label><input id="vxText" type="text" maxlength="80" enterkeyhint="go" placeholder="${e(t.type)}" dir="auto"><button type="submit" class="btn sm">${e(t.go)}</button></form>
  </div>`;
}
function setState(s, msg){
  const b = $("#vxMic"), st = $("#vxState"), t = T(); if(!b || !st) return;
  b.classList.toggle("on", s === "listening"); b.classList.toggle("wait", s === "starting" || s === "thinking"); b.disabled = s === "typeonly";
  b.setAttribute("aria-label", s === "listening" ? t.stop : t.tap); b.dataset.state = s;
  st.textContent = msg !== undefined ? msg : s === "listening" ? fill(t.listening, langName(lang)) : s === "starting" ? t.starting : s === "thinking" ? t.thinking : t.tap;
}
const heard = txt => { const h = $("#vxHeard"); if(h) h.textContent = txt ? "“" + txt + "”" : ""; };
const results = html => { const r = $("#vxRes"); if(r) r.innerHTML = html || ""; };
const showTips = yes => { const t = $("#vxTips"); if(t) t.hidden = !yes; };
const rows = list => list.map(s => `<button type="button" class="srow" data-vpick="${X.esc(s.id)}">${X.row(s)}${X.icon("play", "srow-i")}</button>`).join("");
// After a miss: listen again in the other language, in one tap (an Arabic sentence heard as English is noise).
const otherBtn = cls => `<button type="button" class="btn ${cls} vx-other" data-vother>${X.icon("mic")}${X.esc(fill(T().other, langName(other())))}</button>`;
const moodChips = () => `<div class="chips">${M.moods(6).map(c => `<button type="button" class="chip" data-vsay="${X.esc(c.name)}">${X.esc(c.name)}</button>`).join("")}</div>`;

function open(){
  if(isOpen || !on) return;
  const a = X.audio; wasPlaying = !!X.current() && !a.paused && !a.ended;
  if(wasPlaying) a.pause();                                     // so the microphone hears the person, not the song
  isOpen = true; closing = false; unlock();
  X.openModal(sheet()); wire();
  try{ $("#vxMic").focus({ preventScroll: true }); }catch(e){}
  listen();
}
function wire(){
  const box = $("#vx"); if(!box) return;
  box.addEventListener("click", e => {
    const l = e.target.closest("[data-vlang]"), o = e.target.closest("[data-vother]"), s = e.target.closest("[data-vsay]"), p = e.target.closest("[data-vpick]");
    if(l){ if(l.dataset.vlang !== lang) switchLang(l.dataset.vlang); return; }
    if(o){ switchLang(other()); return; }
    if(s){ say(s.dataset.vsay); return; }
    if(p){ const song = (X.songs() || []).find(x => x.id === p.dataset.vpick); if(song) finish(() => { X.playSong(song); X.toast(fill(T().song, song.title)); }); return; }
    if(e.target.closest("#vxMic")){ const st = $("#vxMic").dataset.state; if(st === "listening" || st === "starting"){ if(live && live.stop) live.stop(); } else listen(); }
  });
  $("#vxForm").addEventListener("submit", e => { e.preventDefault(); const v = $("#vxText").value.trim(); if(v) say(v); });
}
// Another language: draw the sheet again in it, then listen again.
function switchLang(l){
  setLang(l); stopEars(); X.openModal(sheet()); wire(); try{ $("#vxMic").focus({ preventScroll: true }); }catch(_){}
  const my = turn; setState("starting"); setTimeout(() => { if(my === turn && document.getElementById("vx")) listen(); }, 300);   // give the old ear a moment to let go
}
// The sheet closed by itself (the X, Escape, a tap outside, another page): stop listening, give the music back.
function closed(){ isOpen = false; stopEars(); if(!closing && wasPlaying && X.current()) X.audio.play().catch(() => {}); closing = false; }
// We close it ourselves and then do what was asked.
function finish(then){ closing = true; stopEars(); X.closeM(); isOpen = false; if(then) then(); }
const resume = () => { if(wasPlaying && X.current()) X.audio.play().catch(() => {}); };
function stopEars(){ turn++; if(live){ try{ live.abort(); }catch(e){} live = null; } }

// ---------- Listening ----------
function listen(){
  stopEars(); const my = turn, kind = engine();
  heard(""); results(""); showTips(true);
  if(kind === "none"){ setState("typeonly", T()[X.NATIVE ? "unavailable" : "unsupported"]); try{ $("#vxText").focus(); }catch(e){} return; }
  setState("starting");
  const cb = {
    start: () => { if(my === turn) setState("listening"); },
    interim: txt => { if(my === turn) heard(txt); },
    final: alts => { if(my !== turn) return; live = null; if(alts && alts.length) answer(alts, true); else fail("silent"); },
    error: code => { if(my !== turn) return; live = null; fail(code); }
  };
  live = kind === "web" ? hearWeb(codes(lang), cb, 0) : hearNative(codes(lang), cb);
}
function fail(code){
  const t = T(), msg = code === "blocked" ? (X.NATIVE ? t.blockedApp : t.blocked) : t[code] || t.failed;
  if(code === "unavailable" || code === "unsupported"){ setState("typeonly", msg); try{ $("#vxText").focus(); }catch(e){} } else setState("idle", msg);
}
// The web: the browser's own speech service (Chrome, Edge, Safari, Samsung Internet).
function hearWeb(list, cb, at){
  const R = root.SpeechRecognition || root.webkitSpeechRecognition, r = new R();
  let done = false, last = "", err = "", quiet = null, guard = null;
  const clear = () => { clearTimeout(quiet); clearTimeout(guard); };
  const me = { stop(){ try{ r.stop(); }catch(e){} }, abort(){ done = true; clear(); try{ r.abort(); }catch(e){} } };
  const finishWith = alts => { if(done) return; done = true; clear(); cb.final(alts.map(x => String(x || "").trim()).filter(Boolean)); };
  r.lang = list[at]; r.interimResults = true; r.maxAlternatives = 5; r.continuous = false;
  r.onstart = () => { if(!done) cb.start(); };
  r.onresult = e => {
    if(done) return; const res = e.results, end = res[res.length - 1]; let whole = "";
    for(let j = 0; j < res.length; j++) whole += (j ? " " : "") + res[j][0].transcript;
    last = whole.trim() || last; cb.interim(last);
    if(end && end.isFinal){ const alts = []; if(res.length === 1) for(let j = 0; j < end.length; j++) alts.push(end[j].transcript); else alts.push(last); finishWith(alts); try{ r.stop(); }catch(_){} }
    else { clearTimeout(quiet); quiet = setTimeout(() => { try{ r.stop(); }catch(_){} }, 1800); }       // some browsers never say "that was all"
  };
  r.onerror = e => { err = (e && e.error) || "failed"; };
  r.onend = () => {
    if(done) return; clear();
    if(last){ finishWith([last]); return; }
    done = true;
    if(err === "language-not-supported" && list[at + 1]){ const nx = hearWeb(list, cb, at + 1); me.stop = nx.stop; me.abort = nx.abort; return; }
    cb.error(err === "not-allowed" || err === "service-not-allowed" ? "blocked" : err === "network" ? "offline" : !err || err === "no-speech" || err === "aborted" ? "silent" : "failed");
  };
  guard = setTimeout(() => { try{ r.stop(); }catch(_){} }, 15000);
  try{ r.start(); }catch(e){ done = true; clear(); setTimeout(() => cb.error("failed"), 0); }
  return me;
}
// Inside the app: the phone's own speech service, through the app's speech plugin (see app/README.md).
function hearNative(list, cb){
  const C = root.Capacitor, P = (m, o) => C.nativePromise("SpeechRecognition", m, o || {}); let gone = false;
  const within = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("timeout")), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
  const words = e => String((e && (e.message || e.errorMessage)) || e || "");
  const why = m => /permission/i.test(m) ? "blocked" : /no match|no speech|didn.?t understand/i.test(m) ? "silent" : /network/i.test(m) ? "offline" : /not available|unavailable|unable to find|not implemented|timeout/i.test(m) ? "unavailable" : "failed";
  (async () => {
    try{
      const a = await within(P("available"), 5000); if(a && a.available === false){ if(!gone) cb.error("unavailable"); return; }
      let p = await within(P("checkPermissions"), 5000);
      if(!p || p.speechRecognition !== "granted") p = await P("requestPermissions");                   // the phone asks the first time
      if(gone) return;
      if(!p || p.speechRecognition !== "granted"){ cb.error("blocked"); return; }
      cb.start();
      let r = null, bad = null;
      for(let i = 0; i < list.length && !gone; i++){
        try{ r = await P("start", { language: list[i], maxResults: 5, partialResults: false, popup: false }); bad = null; break; }
        catch(e){ bad = e; if(!/language|locale|not supported|code: 1[23]\b/i.test(words(e))) break; }   // this phone does not know that language code: try the next
      }
      if(gone) return;
      if(bad){ cb.error(why(words(bad))); return; }
      cb.final((r && Array.isArray(r.matches) ? r.matches : []).map(x => String(x || "").trim()).filter(Boolean));
    }catch(e){ if(!gone) cb.error(why(words(e))); }
  })();
  return { stop(){ try{ P("stop").catch(() => {}); }catch(e){} }, abort(){ gone = true; try{ P("stop").catch(() => {}); }catch(e){} } };
}
// iPhone Safari only lets a song start from a tap. The answer comes seconds after the tap, so the tap itself
// wakes the player with a quarter second of silence. (Not needed inside the app, nor once a song has played.)
function unlock(){
  const ua = navigator.userAgent || "", ios = /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if(!ios || X.NATIVE || unlocked || X.current()) return; unlocked = true;
  try{
    const n = 2000, b = new Uint8Array(44 + n), v = new DataView(b.buffer), put = (o, s) => { for(let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
    put(0, "RIFF"); v.setUint32(4, 36 + n, true); put(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); put(36, "data"); v.setUint32(40, n, true); b.fill(128, 44);
    const a = X.audio, u = URL.createObjectURL(new Blob([b], { type: "audio/wav" })), clean = () => { if(!X.current()){ a.pause(); a.removeAttribute("src"); a.load(); } URL.revokeObjectURL(u); };
    a.src = u; const p = a.play(); if(p && p.then) p.then(clean, clean); else clean();
  }catch(e){}
}

// ---------- From the words to the music ----------
function say(txt){ stopEars(); heard(txt); setState("thinking"); answer([txt], false); }
function answer(alts, spoken){
  const it = M.understand(alts), t = T(), c = X, cur = c.current();
  if(spoken && it.type !== "none" && it.type !== "choices") setLang(lang);   // this language worked: start with it next time
  heard(it.said || it.heard || alts[0]);
  const isLive = () => c.mode() === "radio" || c.adOn();
  const blockedByAd = () => { if(!c.adOn()) return false; finish(() => { resume(); c.toast(t.ad); }); return true; };
  switch(it.type){
    case "pause": return finish(() => { c.audio.pause(); c.toast(t.paused); });
    case "play": return finish(() => { if(cur){ c.audio.play().catch(() => {}); c.toast(t.playing); } else c.shuffleAll(); });
    case "next": return finish(() => { if(!cur) return c.shuffleAll(); if(isLive()){ resume(); return c.toast(c.adOn() ? t.ad : t.live); } c.next(); c.toast(t.next); });
    case "prev": return finish(() => { if(!cur) return c.toast(t.nothing); if(isLive()){ resume(); return c.toast(c.adOn() ? t.ad : t.live); } c.prev(); c.audio.play().catch(() => {}); c.toast(t.prev); });
    case "restart": return finish(() => { if(!cur) return c.toast(t.nothing); if(isLive()){ resume(); return c.toast(c.adOn() ? t.ad : t.live); } c.audio.currentTime = 0; c.audio.play().catch(() => {}); c.toast(t.restart); });
    case "best": return finish(() => { if(!cur) return c.toast(t.nothing); if(isLive()){ resume(); return c.toast(c.adOn() ? t.ad : t.live); } c.bestPart(); });
    case "radio": return blockedByAd() || finish(() => { c.startRadio(); c.toast(t.radio); });
    case "stream": return blockedByAd() || finish(() => { c.shuffleAll(); c.toast(t.shuffle); });
    case "what": return finish(() => { resume(); c.toast(cur && !c.adOn() ? fill(t.nowPlaying, cur.title, c.by(cur)) : t.nothing); });
    case "lyrics": return finish(() => { resume(); if(cur) c.openNP(); else c.toast(t.nothing); });
    case "louder": case "quieter": return finish(() => {
      resume(); const a = c.audio, want = Math.min(1, Math.max(.1, Math.round((a.volume + (it.type === "louder" ? .25 : -.25)) * 100) / 100));
      try{ a.volume = want; }catch(e){}
      c.toast(Math.abs(a.volume - want) > .01 ? t.volumePhone : fill(t.volume, Math.round(a.volume * 100))); });
    case "similar": return blockedByAd() || finish(() => { if(!cur) return c.shuffleAll(); const more = c.suggestions(cur, 12); if(!more.length){ resume(); return; } c.playList(more, "Similar to " + cur.title); c.toast(fill(t.similar, cur.title)); });
    case "song": return blockedByAd() || finish(() => { c.playSong(it.song); c.toast(fill(t.song, it.song.title)); });
    case "artist": return blockedByAd() || finish(() => { const list = c.shuffle(c.songsBy(it.artist)); c.playList(list, it.artist.name); c.toast(fill(list.length === 1 ? t.mixOne : t.mix, it.artist.name, list.length)); });
    case "mood": return blockedByAd() || finish(() => {
      c.playList(it.songs, it.label); const name = it.names.join(" + "), n = it.songs.filter(c.playable).length;
      c.toast(it.closest ? fill(t.closest, it.closest.asked, it.closest.got.slice(0, 3).join(", ")) : fill(n === 1 ? t.mixOne : t.mix, name, n)); });
    case "choices": setState("idle", t.choices); showTips(false); return results(rows(it.songs) + `<div class="vx-again">${otherBtn("ghost sm")}</div>`);
    case "empty": setState("idle", fill(t.empty, it.name)); showTips(false); return results(`<p class="muted small">${c.esc(t.pickMood)}</p>${moodChips()}`);
    default: {
      setState("idle", fill(t.none, it.heard)); heard(""); showTips(false); const near = it.near || [];
      return results(`<div class="vx-again">${otherBtn("light")}</div>` + (near.length ? `<p class="muted small">${c.esc(t.closestTitle)}</p>${rows(near)}` : "") + `<p class="muted small">${c.esc(t.pickMood)}</p>${moodChips()}`);
    }
  }
}

// ---------- Settings (the Voice panel on the Settings page) ----------
function settingsHTML(){
  if(!on) return ""; const e = X.esc, P = [["fab", "Round button"], ["pill", "Wide button"], ["top", "Top bar"], ["off", "Hidden"]];
  return `<div class="panel" id="voicePanel"><h3>Voice</h3>
   <p class="small">Tap a microphone and say a song, a mood, or a command such as “next”, in English or Arabic. Your browser or phone turns your voice into text; Velora only gets the text and keeps nothing.</p>
   <div class="vset"><span class="small muted">The language you speak</span><div class="chips">${LANGS.map(l => `<button type="button" class="chip${l === lang ? " on" : ""}" data-vsetlang="${l}" aria-pressed="${l === lang}">${e(langName(l))}</button>`).join("")}</div></div>
   <div class="vset"><span class="small muted">The floating microphone button</span><div class="chips">${P.map(p => `<button type="button" class="chip${p[0] === place ? " on" : ""}" data-vsetplace="${p[0]}" aria-pressed="${p[0] === place}">${p[1]}</button>`).join("")}</div></div>
   <p class="muted small" style="margin:10px 0 0">The search field and the player always keep their own microphone.</p></div>`;
}
function wireSettings(redraw){
  const box = document.getElementById("voicePanel"); if(!box) return;
  box.addEventListener("click", e => { const a = e.target.closest("[data-vsetlang]"), b = e.target.closest("[data-vsetplace]"); if(a){ setLang(a.dataset.vsetlang); redraw(); } else if(b){ setPlace(b.dataset.vsetplace); redraw(); } });
}

const api = { norm, canon, sound, soundSim, titleScore, titleForms, createMatcher, init, open, settingsHTML, wireSettings };
root.VeloraVoice = api;
if(typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
