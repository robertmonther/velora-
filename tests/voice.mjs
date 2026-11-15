// Checks for the voice feature's understanding: a sentence goes in, "what to do" comes out.
//   node tests/voice.mjs
// No microphone and no browser here: the sentences are written the way a phone usually writes what it heard,
// in English, in Arabic, and English titles written in Arabic letters. The real catalogue is used.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const W = require("../data/voice-words.js"), V = require("../voice.js"), D = require("../data/catalogue.json");

let pass = 0, total = 0;
const check = (name, ok, detail = "") => { total++; if (ok) pass++; console.log((ok ? "PASS  " : "FAIL  ") + name + (!ok && detail ? "   [" + detail + "]" : "")); };
const matcher = (songs = D.songs, extra) => V.createMatcher({ words: W, songs: () => songs, cats: () => D.categories, artists: () => D.artists, extra, random: () => 0 });
const m = matcher();
const u = t => m.understand(t);
const inCat = (s, name) => s.genre === name || (s.tags || []).includes(name);
// every sentence of the list must give this type (and, for a song, this title)
const all = (list, type, title) => { const bad = list.filter(t => { const r = u(t); return r.type !== type || (title && (!r.song || r.song.title !== title)); }); return [bad.length === 0, bad.map(t => t + " -> " + u(t).type + (u(t).song ? ":" + u(t).song.title : "")).join(" ; ")]; };

// ---------- Spelling ----------
check("Arabic is evened out: vowel marks, the forms of alef, ya and ta marbuta, Arabic digits", V.norm("شَغِّلْ أُغنيةً إلى آخره ٣") === V.norm("شغل اغنيه الي اخره 3") && V.norm("موسيقى") === V.norm("موسيقي"), V.norm("شَغِّلْ أُغنيةً إلى آخره ٣"));
check("English is evened out: capitals, accents, R&B, hip-hop", V.norm("Bon Appétit!") === "bon appetit" && V.norm("R & B") === "rnb" && V.norm("Hip-Hop") === "hiphop");
check("a title sounds the same in Latin and in Arabic letters", V.soundSim(V.sound(V.canon(V.norm("The Skeleton Key"))), V.sound(V.canon(V.norm("سكيلتون كي")))) > .9 && V.soundSim(V.sound("fashionably late"), V.sound(V.norm("فاشنبلي ليت"))) > .85);

// ---------- Commands ----------
check("English: pause", ...all(["pause", "stop", "Stop.", "stop the music", "pause the song", "stop it please", "hey velora stop", "be quiet", "that's enough"], "pause"));
check("English: carry on", ...all(["resume", "continue", "keep playing", "play", "Play.", "play it"], "play"));
check("English: next song", ...all(["next", "next song", "skip", "skip this one", "skip this song", "another one", "something else", "change the song", "play the next one", "next track please"], "next"));
check("English: previous song and from the start", ...all(["previous", "go back", "previous song", "the one before", "last song"], "prev").map((x, i) => i ? x : x && all(["again", "play it again", "start over", "from the beginning", "replay", "one more time"], "restart")[0]));
check("English: the radio", ...all(["radio", "the radio", "play the radio", "turn on the radio", "put on the radio", "velora radio", "live radio"], "radio"));
check("English: anything, shuffled", ...all(["anything", "surprise me", "shuffle", "play something", "play anything", "play music", "play some music", "play something good", "you choose", "something new"], "stream"));
check("English: what is playing, volume, best part, lyrics, more like this",
  all(["what is this", "what's this song", "what song is this", "who sings this", "what's playing"], "what")[0] && all(["louder", "volume up", "turn it up"], "louder")[0] && all(["quieter", "turn it down", "volume down", "too loud"], "quieter")[0]
  && all(["the chorus", "best part", "jump to the best part", "skip to the good part"], "best")[0] && all(["lyrics", "show me the lyrics", "open the player"], "lyrics")[0] && all(["more like this", "similar songs", "same vibe"], "similar")[0]);
check("Arabic: pause", ...all(["وقّف", "وقف", "وقّفها", "وقّف الغنية", "وقف الموسيقى", "اسكت", "طفّيها", "خلص", "بس", "ستوب", "لو سمحت وقف"], "pause"));
check("Arabic: carry on (the Lebanese word for \"continue\" is not read as \"enough\")", ...all(["كمّل", "كملها", "كفّي", "كفي", "تابع", "رجّع شغّلها", "شغّل", "حط", "حطلي", "شغّلها"], "play"));
check("Arabic: next song", ...all(["التالي", "اللي بعدها", "يلي بعدها", "غيّرها", "غيّر الغنية", "حط غيرها", "وحدة تانية", "غنية تانية", "شي تاني", "نكست", "حطلي اللي بعدها"], "next"));
check("Arabic: previous song and from the start", all(["السابق", "اللي قبلها", "رجّعلي اللي قبلها", "ارجع", "الغنية السابقة"], "prev")[0] && all(["عيدها", "عيد", "من الأول", "من البداية", "كمان مرة", "مرة تانية"], "restart")[0]);
check("Arabic: the radio", ...all(["الراديو", "شغّل الراديو", "حطلي الراديو", "بدي اسمع الراديو", "راديو فيلورا", "البث المباشر"], "radio"));
check("Arabic: anything, shuffled", ...all(["أي شي", "حطلي أي شي", "شي حلو", "حط شي حلو", "على ذوقك", "فاجئني", "اختارلي", "شي جديد"], "stream"));
check("Arabic: what is playing, volume, best part, lyrics, more like this",
  all(["شو هالغنية", "شو اسم الغنية", "مين عم يغني", "شو عم يشتغل"], "what")[0] && all(["علّي الصوت", "عليها", "ارفع الصوت"], "louder")[0] && all(["وطّي الصوت", "وطيها", "اخفض الصوت"], "quieter")[0]
  && all(["الكورس", "أحلى مقطع", "اللازمة"], "best")[0] && all(["الكلمات", "كلمات الغنية"], "lyrics")[0] && all(["متلها", "شي متلها", "متل هيدي", "نفس الجو"], "similar")[0]);
check("small words only (\"a song\", Arabic \"play me music\") mean: carry on, or start the music", u("a song").type === "play" && u("حطلي موسيقى").type === "play" && u("شغللي أغاني").type === "play");

// ---------- Song titles ----------
check("a title, said plainly or inside a sentence", ...all(["The Skeleton Key", "skeleton key", "play the skeleton key", "Play Skeleton Key please", "hey velora can you play the skeleton key", "i want to hear the skeleton key", "put on skeleton key", "the song skeleton key"], "song", "The Skeleton Key"));
check("every title in the catalogue is found by saying it", ...(() => { const bad = D.songs.filter(s => { const r = u("play " + s.title); return r.type !== "song" || r.song.id !== s.id; }); return [bad.length === 0, bad.map(s => s.title).join(" ; ")]; })());
check("a \"(Slowed)\" song is found with and without the word", u("just friends").song?.title === "Just Friends (Slowed)" && u("play just friends slowed").song?.title === "Just Friends (Slowed)" && u("sweet agony").song?.title === "SWEET AGONY (Slowed)");
check("the words in brackets work as a title too", u("let me watch").song?.title === "Tip (Let Me Watch)" && u("tip").song?.title === "Tip (Let Me Watch)");
check("a title that starts with \"play\" is a title, not an order", u("play with us").song?.title === "Play With Us" && u("play play with us").song?.title === "Play With Us");
check("titles made of everyday words are still titles", u("not a vibe").song?.title === "Not a Vibe" && u("your kind of love").song?.title === "Your Kind of Love" && u("used").song?.title === "USED" && u("love you crazily").song?.title === "Love You Crazily (Slowed)");
check("small hearing mistakes are forgiven", [["bone appetite", "bon appétit"], ["those billion", "Those Billions"], ["she is better", "She's Better"], ["i am your good girl", "I'm Your Good Girl (Slowed)"], ["your eyes still on me", "Your Eyes Still Own Me"],
  ["love you crazy lee", "Love You Crazily (Slowed)"], ["fashionable late", "Fashionably Late"], ["count to 3", "Count to Three"], ["lose your fear", "Lose Our Fear"], ["skeleton keys", "The Skeleton Key"]].every(([said, title]) => u(said).song?.title === title));
check("a clear part of a title is enough", u("live footage").song?.title === "Live Footage of Me Ruining This" && u("smell like you").song?.title === "Hug Me Until I Smell Like You (Slowed)" && u("hug me").song?.title === "Hug Me Until I Smell Like You (Slowed)" && u("good girl").song?.title === "I'm Your Good Girl (Slowed)");
check("one short word that is only part of a title is offered, not played", u("burn").type === "choices" && u("burn").songs[0].title === "If We Burn");
check("Arabic sentence, English title in Latin letters", ...all(["حطلي Skeleton Key", "شغّللي skeleton key", "بدي اسمع The Skeleton Key", "حطلي غنية Skeleton Key لو سمحت", "فيك تحطلي skeleton key"], "song", "The Skeleton Key"));
check("English titles written by the phone in Arabic letters", [["حطلي سكيلتون كي", "The Skeleton Key"], ["شغللي ذا سكيلتون كي", "The Skeleton Key"], ["بدي اسمع فاشنبلي ليت", "Fashionably Late"], ["حطلي غنية مولاسيس", "Molasses"], ["شغل بيرفوت", "BAREFOOT"],
  ["حط نت ا فايب", "Not a Vibe"], ["حطلي جست فريندز", "Just Friends (Slowed)"], ["شيز بيتر", "She's Better"], ["ذوز بيليونز", "Those Billions"], ["زوز بليونز", "Those Billions"], ["تيب لت مي واتش", "Tip (Let Me Watch)"], ["لوز اور فير", "Lose Our Fear"],
  ["كاونت تو ثري", "Count to Three"], ["اف وي بيرن", "If We Burn"], ["سويت اغوني", "SWEET AGONY (Slowed)"], ["يور كايند اوف لوف", "Your Kind of Love"], ["لوف يو كريزيلي", "Love You Crazily (Slowed)"], ["يو اولريدي نيو", "you already knew (Slowed)"],
  ["اوف ذا كلوك", "Off the Clock"], ["بلاي ويذ اس", "Play With Us"], ["هاغ مي انتيل اي سميل لايك يو", "Hug Me Until I Smell Like You (Slowed)"]].map(([said, title]) => u(said).song?.title === title ? "" : said).filter(Boolean).join(" ; ") === "");
check("very short titles in Arabic letters are offered to tap, never played by a guess", ["اوبي مي", "يوزد", "تيب"].every(t => u(t).type === "choices") && u("اوبي مي").songs[0].title === "Obey Me" && u("يوزد").songs[0].title === "USED");
check("a line of the lyrics finds its song", u("they wrote my name in code").song?.title === "The Skeleton Key" && u("the song that goes all the screens go dark").song?.title === "The Skeleton Key" && u("حطلي يلي بتقول there is a door for me").song?.title === "The Skeleton Key" && u("they wrote my name in code").byLyric === true);
check("of the phone's guesses, the one that makes sense is taken", m.understand(["pley skelton ki", "play skeleton key", "place kelton key"]).song?.title === "The Skeleton Key" && m.understand(["nexed", "next"]).type === "next");

// ---------- Moods, genres, artists ----------
const mood = (t, cat) => { const r = u(t); return r.type === "mood" && r.songs.length > 0 && r.songs.every(s => inCat(s, cat)); };
check("English: a mood plays that mood", mood("something romantic", "Romantic") && mood("romantic", "Romantic") && mood("love songs", "Romantic") && mood("play some sensual music", "Sensual") && u("romantic radio").label === "Romantic Radio"
  && (() => { const r = u("i'm in the mood for something dark"); return r.type === "mood" && r.label === "Dark Radio" && inCat(r.songs[0], "Dark") && inCat(r.songs[1], "Dark"); })());
check("Arabic: a mood plays that mood", mood("شي رومانسي", "Romantic") && mood("حطلي شي رومانسي", "Romantic") && mood("بدي اسمع أغاني حب", "Romantic") && mood("موسيقى رومانسية", "Romantic") && mood("شي مثير", "Sensual") && mood("شغللي بوب", "Pop"));
check("two moods together: the songs that fit both come first", (() => { const r = u("romantic slowed"), r2 = u("شي رومانسي سلو"); return r.type === "mood" && inCat(r.songs[0], "Romantic") && inCat(r.songs[0], "Slowed") && r.label === "Romantic + Slowed" && r2.type === "mood" && inCat(r2.songs[0], "Romantic") && inCat(r2.songs[0], "Slowed"); })());
check("a mood without songs yet plays its neighbours, and says so", (() => { const r = u("sad songs"), a = u("شي حزين"), c = u("شي هادي"); return r.type === "mood" && r.closest && r.closest.asked === "Sad" && r.closest.got.includes("Melancholic") && r.label === "Closest to Sad" && r.songs.length >= 5
  && a.closest && a.closest.asked === "Sad" && c.type === "mood" && c.closest && c.closest.asked === "Chill" && c.songs.every(s => inCat(s, "Slowed")); })());
check("\"classy music\" (English and Arabic): the soft side of the library, no explicit lyrics", ["classy music", "something classy", "elegant music", "موسيقى راقية", "حطلي موسيقى راقية", "شي راقي", "بدي شي كلاس"].every(t => { const r = u(t);
  return r.type === "mood" && r.label === "Classy mix" && r.songs.length >= 5 && r.songs.every(s => !s.explicit && ["R&B / Soul", "Tender", "Dreamy", "Romantic", "Melancholic"].some(c => inCat(s, c))); }) && u("موسيقى راقية").names[0] === "Classy mix");
check("workout, party, calm: everyday words lead to music", u("workout music").type === "mood" && u("something for the gym").type === "mood" && u("party").type === "mood" && u("شي للسهرة").type === "mood" && u("شي حماسي للرياضة").type === "mood" && u("something calm").type === "mood" && u("chill music").type === "mood");
check("a genre with no songs yet says so instead of playing something else", u("jazz").type === "empty" && u("jazz").name === "Jazz" && u("play some rock").type === "empty" && u("جاز").type === "empty" && u("شغللي راب").type === "empty" && u("موسيقى كلاسيكية").name === "Classical");
check("an artist by name, in both scripts", u("voluptra").artist?.id === "voluptra" && u("songs by voluptra").artist?.id === "voluptra" && u("play something by lucid lava").artist?.id === "lucid-lava" && u("أغاني فولبترا").artist?.id === "voluptra" && u("شغللي لوسيد لافا").artist?.id === "lucid-lava");
check("mood words do not swallow titles", u("sweet agony").type === "song" && u("dark").type === "mood" && u("love").type === "mood" && u("your kind of love").type === "song" && u("something new").type === "stream");

// ---------- What it must not do ----------
check("everyday talk starts nothing", ["how are you", "what time is it", "call mom", "the weather today", "hello", "thank you", "test test", "كيفك", "مرحبا", "شو الأخبار", "بدي اكل", "الو", "تست"].every(t => u(t).type === "none"));
check("an unknown song is not replaced by a guess", ["play despacito", "play blinding lights", "حطلي ديسباسيتو"].every(t => ["none", "choices"].includes(u(t).type)) && u("play blinding lights").type === "none");
check("nothing heard gives nothing", u("").type === "none" && u("   ").type === "none" && m.understand([]).type === "none" && u("please").type === "none");
{ const clean = matcher(D.songs.filter(s => !s.explicit)), r = clean.understand("play used"), r2 = clean.understand("something sensual");
  check("songs hidden on this device (explicit songs switched off) are not found or played", r.type !== "song" && r2.type === "mood" && r2.songs.every(s => !s.explicit)); }
{ const own = matcher(D.songs, [{ say: "sunday morning, صباح الأحد", play: ["Tender", "Dreamy"], name: "Sunday morning" }]), r = own.understand("play sunday morning music"), r2 = own.understand("شي لصباح الأحد");
  check("the site owner's own words (config.js: voice.words) work", r.type === "mood" && r.label === "Sunday morning" && r.songs.every(s => inCat(s, "Tender") || inCat(s, "Dreamy")) && own.understand("صباح الأحد").type === "mood", JSON.stringify([r.type, r.label, r2.type])); }
{ const t0 = Date.now(), big = []; for (let i = 0; i < 1200; i++) big.push({ ...D.songs[i % D.songs.length], id: "x" + i, title: D.songs[i % D.songs.length].title + " " + i });
  const bm = matcher(big); bm.understand("play the skeleton key 7"); const t1 = Date.now(); bm.understand(["حطلي سكيلتون كي", "حطلي سكيلتن كي", "حط لي سكيلتون"]); const ms = Date.now() - t1;
  check("fast enough with 1,200 songs (three guesses, under one second)", ms < 1000, (t1 - t0) + " ms to prepare and first answer, " + ms + " ms"); }
check("the sheet's own words are all there and in English only; the example sentences (English and Arabic) are understood",
  ["tap", "listening", "blocked", "blockedApp", "silent", "offline", "unsupported", "unavailable", "failed", "none", "choices", "empty", "paused", "next", "song", "mix", "closest", "live", "type", "go"].every(k => typeof W.text[k] === "string" && W.text[k])
  && !/[\u0600-\u06FF]/.test(JSON.stringify(W.text)) && W.text.langs.en === "English" && W.text.langs.ar === "Arabic" && W.tips.en.length >= 3 && W.tips.ar.length >= 3 && /[\u0600-\u06FF]/.test(W.tips.ar.join(" "))
  && W.tips.en.concat(W.tips.ar).every(t => u(t.replace("{song}", "The Skeleton Key")).type !== "none"));

console.log(`\n${pass} of ${total} voice understanding checks passed`);
process.exit(pass === total ? 0 : 1);
