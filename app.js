/* Velora: the whole site in one file, no build step.
   Order of this file: helpers, categories, search, colours, toast, ads, player, Now Playing,
   radio, license demo, page building blocks, pages, clicks, router.
   Settings live in config.js; the bundled songs in data/catalogue.js; accounts and uploaded songs in backend.js;
   the upload pages in studio.js (loaded only when someone opens Upload). */
(function(){
"use strict";
const CFG = window.VELORA_CONFIG || {};
const D = window.VELORA_DATA || {songs:[],categories:[]}, CATS = Array.isArray(D.categories) ? D.categories : [];
// ALL: every song (the bundled ones, plus the uploaded ones once the server answers).
// S: the songs this visitor sees: ALL, minus the adult songs once someone answers "No" to the age question.
const ALL = Array.isArray(D.songs) ? D.songs : [];
let S = ALL;
const Backend = window.VeloraBackend || {enabled:false, user:null, premium:false, role:"", ready:true, canUpload:()=>false};
const VER = ((document.currentScript && document.currentScript.src) || "").split("?v=")[1] || "";
const $ = s => document.querySelector(s), main = $("#main"), audio = $("#audio");

// ---------- Helpers ----------
// Every piece of text that goes into the page passes through esc(), ids included,
// so a song title or id can never turn into HTML (this matters once other people can add songs).
const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt = t => { t=Math.max(0,Math.floor(t||0)); return Math.floor(t/60)+":"+String(t%60).padStart(2,"0"); };
const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
const plural = (n,w) => n+" "+w+(n===1?"":"s");
const icon = (name, cls="") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const byId = id => ALL.find(s=>s.id===id);
const safeColor = c => /^#[0-9a-f]{3,8}$/i.test(c||"") ? c : "#5b7a99";
// Links from settings may only be https addresses or pages of this site.
const safeLink = u => /^(https:\/\/|#\/)/.test(u||"") ? u : "";
// Inside the phone app (the app/ folder, Capacitor) the pages run from the app itself, not from a web address.
const NATIVE = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform==="function" && window.Capacitor.isNativePlatform());
// Media is served from the GitHub repo through the jsDelivr CDN when hosted, and from the local folder on localhost.
// config.js mediaFrom:"site" = from the site's own folder (after the move to our own hosting); the app then uses siteUrl.
const LOCAL = !NATIVE && /^(localhost|127\.0\.0\.1|)$/.test(location.hostname);
const SITE = /^https:\/\/[^\s"'<>]+$/.test(CFG.siteUrl||"") ? String(CFG.siteUrl).replace(/\/+$/,"")+"/" : "";
const CDN = `https://cdn.jsdelivr.net/gh/${CFG.mediaRepo}@${CFG.mediaRev}/`;
const MEDIA_BASE = CFG.mediaFrom==="site" ? (NATIVE ? (SITE||CDN) : "") : (LOCAL ? "" : CDN);
// Licensing and Premium live on the website. Inside the phone app they stay out (store rules) unless config.js app.sales is true.
const SALES = !NATIVE || !!(CFG.app && CFG.app.sales===true);
if(NATIVE) document.documentElement.classList.add("native");
if(!SALES) document.documentElement.classList.add("nosales");
const url = p => /^https:\/\//.test(p) ? p : MEDIA_BASE + String(p).replace(/^\/+/,"");
const cssUrl = p => `url('${encodeURI(url(p)).replace(/['()]/g,c=>"%"+c.charCodeAt(0).toString(16))}')`;
// Browser storage can be missing, blocked or edited by hand: never let it break the page.
const store = {
  get(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } },
  list(k){ const v=this.get(k,[]); return Array.isArray(v)?v:[]; },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} },
  wipe(){ try{ Object.keys(localStorage).filter(k=>k.startsWith("velora_")).forEach(k=>localStorage.removeItem(k)); }catch(e){} }
};
const CREATOR = "Robert Monther"; // rights holder (lyrics and song design); never shown as a singer
const PAL = [["#5b7a99","#2a3646"],["#b0524a","#3b1f1d"],["#e0a9b0","#5a3a40"]];
const PRICES = CFG.prices, RADIO = CFG.radio, DEMO = CFG.demo!==false;
// The shop: null until the server says it is open (Backend.shop). While it is closed, paying is a demo (demo:true) or off.
let SHOP = null;
const shopOpen = () => !!(SHOP && SHOP.open===true), payDemo = () => DEMO && !shopOpen(), dTag = () => payDemo() ? " (demo)" : "";

// Seeded shuffle: the same seed always gives the same order (used for "today" rows and the radio schedule).
function seededShuffle(list, seed){
  let h=2166136261; for(const ch of String(seed)){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619); }
  const rnd=()=>{ h+=0x6D2B79F5; let t=h; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; };
  const a=list.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a;
}
const dayShuffle = (list, salt="") => seededShuffle(list, new Date().toISOString().slice(0,10)+salt);
const shuffled = list => seededShuffle(list, Math.random());
const recents = () => store.list("velora_recent").map(byId).filter(s=>s && S.includes(s));

// ---------- Categories ----------
const catByName = n => CATS.find(c=>c.name===n);
const catById = id => CATS.find(c=>c.id===id);
const inCat = (s,c) => s.genre===c.name || (s.tags||[]).includes(c.name);
const songsIn = c => S.filter(s=>inCat(s,c));
const catsOf = s => CATS.filter(c=>inCat(s,c));
const catLink = c => `#/genre/${encodeURIComponent(c.id)}`;
const kindLabel = c => c.kind==="mood" ? "Mood" : c.kind==="collection" ? "Collection" : "Genre";
// Every genre and every tag (a mood, or a collection such as "Slowed") is a category.
// USED: categories that have songs (search). BROWSE: 2 songs or more (Browse all). HOME: 3 or more (shelves, stations, pills).
// Moods and collections come first, then genres; inside each group the biggest first.
let USED = [], BROWSE = [], HOME = [];
// A genre or tag that is not in the list yet (it can arrive with an uploaded song) becomes a category of its own.
function ensureCats(){
  const have = new Set(CATS.map(c=>c.name)), ids = new Set(CATS.map(c=>c.id));
  for(const s of ALL) for(const [n,kind] of [[s.genre,"genre"], ...(s.tags||[]).map(t=>[t,"mood"])]){
    if(typeof n!=="string" || !n || have.has(n)) continue;
    let id = n.toLowerCase().replace(/&/g,"n").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"") || "c"; while(ids.has(id)) id+="-x";
    CATS.push({id, name:n, kind, color:"#5b7a99", words:""}); have.add(n); ids.add(id);
  }
}
function sortCats(){
  const n = new Map(CATS.map(c=>[c,songsIn(c).length])), rank = c => c.kind==="genre" ? 1 : 0;
  USED = CATS.filter(c=>n.get(c)>0).map((c,i)=>[c,i]).sort((a,b)=>rank(a[0])-rank(b[0]) || n.get(b[0])-n.get(a[0]) || a[1]-b[1]).map(x=>x[0]);
  BROWSE = USED.filter(c=>n.get(c)>=2); HOME = USED.filter(c=>n.get(c)>=3);
  if(!HOME.length) HOME = USED.slice(0,6);
}

const coverStyle = s => { if(s.art) return `background:#141418 ${cssUrl(s.art)} center/cover no-repeat`; const c=catByName(s.genre); const p=PAL[s.hue||0]||PAL[0]; return `background:radial-gradient(circle at 30% 25%, ${safeColor(c&&c.color)} 0%, transparent 62%),linear-gradient(160deg, ${p[1]}, #141418 80%)`; };
const cover = (s,cls="cover") => `<div class="${cls}" style="${coverStyle(s)}" role="img" aria-label="Cover of ${esc(s.title)}">${s.art?"":`<span>${esc(s.title)}</span>`}</div>`;
const hasLyrics = s => Array.isArray(s.lyrics) && s.lyrics.length>0;
// Adult songs: marked "adult" in the catalogue (sensual songs), and every song with explicit lyrics.
const isAdult = s => !!(s && (s.adult || s.explicit));
// Explicit songs carry an "E" badge, like Spotify, and play like every other song.
const eb = s => s.explicit ? '<span class="e-badge" title="Explicit lyrics" aria-label="Explicit">E</span>' : "";
// In lists: "18+" on adult songs until the visitor has confirmed their age, afterwards the usual E for explicit lyrics.
const badge = s => !adultOK() && isAdult(s) ? '<span class="a18" title="For adults" aria-label="For adults">18+</span>' : eb(s);
// ---------- Artists and credits ----------
// A song may name an artist (catalogue "artists"). Without one, the line under the title shows the genre.
const ARTISTS = D.artists || [];
const artistById = id => ARTISTS.find(a=>a.id===id);
const artistOf = s => s.artist ? artistById(s.artist) : null;
const songsBy = a => S.filter(s=>s.artist===a.id);
const artistLink = a => `#/artist/${encodeURIComponent(a.id)}`;
const artistArt = a => a.image ? `background:#141418 ${cssUrl(a.image)} center/cover no-repeat` : `background:linear-gradient(160deg, ${safeColor(a.color)}, #141418 85%)`;
const subOf = s => { const a=artistOf(s); return esc(a ? a.name : s.genre); };
function creditsOf(s){
  if(Array.isArray(s.credits) && s.credits.length) return s.credits;
  const a=artistOf(s), out=[];
  if(a) out.push({group:"Artist", name:a.name, roles:["Main Artist"], artist:a.id});
  out.push({group:"Composition and lyrics", name:CREATOR, roles:["Lyricist","Song design"]});
  out.push({group:"Production", name:CREATOR, roles:["Producer"]});
  out.push({group:"Production", name:"Suno", roles:["Music generation (AI-assisted)"]});
  return out;
}

// Who made the song, in one plain line. An uploaded song answers from its own form; the bundled ones are Robert's.
const listAnd = a => a.length<2 ? (a[0]||"") : a.slice(0,-1).join(", ")+" and "+a[a.length-1];
function aiLine(s){
  const ai=s.ai; if(!ai) return "";
  if(!ai.used) return "Made without AI.";
  const made=[ai.music&&"the music", ai.vocals&&"the voice", ai.lyrics&&"the lyrics", ai.artwork&&"the cover"].filter(Boolean);
  return `Made with AI: ${esc(listAnd(made)||"parts of the song")}${ai.tool?` (${esc(ai.tool)})`:""}.`;
}
function madeBy(s){
  if(!s.uploaded) return `Lyrics, concept and song design by ${esc(CREATOR)}; music made with Suno (AI-assisted).`;
  const who=r=>[...new Set((s.credits||[]).filter(c=>(c.roles||[]).includes(r)).map(c=>c.name))], ly=who("Lyricist"), pr=who("Producer"), parts=[];
  if(ly.length) parts.push("Lyrics by "+esc(listAnd(ly))); if(pr.length) parts.push((parts.length?"produced by ":"Produced by ")+esc(listAnd(pr)));
  return [parts.join("; ")+(parts.length?".":""), aiLine(s)].filter(Boolean).join(" ");
}
const holderOf = s => s.uploaded ? esc(s.holder||"The uploader") : `${esc(CREATOR)} (lyrics and song design) · music made with Suno`;

// ---------- Search (like Spotify: a title, an artist, a genre, a mood, "explicit", "video", or a lyric) ----------
function norm(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\br\s*(?:&|and|n|'n'|\+)\s*b\b/g,"rnb").replace(/\bhip[\s-]*hop\b/g,"hiphop").replace(/\blo[\s-]*fi\b/g,"lofi").replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim(); }
const STOP = new Set(["song","songs","music","track","tracks","the","a","of"]);
let IDX = [];
function reindex(){ IDX = S.map(s=>{ const a=artistOf(s); return {s, title:norm(s.title),
  meta:norm([s.genre,s.subgenre,...(s.tags||[]),s.mood,s.language,a?a.name:"",...catsOf(s).map(c=>c.words||""),s.explicit?"explicit e":"clean",s.video?"video videos short shorts":"",s.clip?"video videos clip clips music video":""].join(" ")),
  lyr:norm(hasLyrics(s) && playable(s) ? s.lyrics.map(l=>l[1]).join(" ") : "")}; }); }

// ---------- Explicit and sensual songs ----------
// Default (config.js: ageGate false): like Spotify. Explicit songs carry an E badge and play like every other song;
// Settings has one switch that hides them on this device.
// With ageGate true: the first time someone opens a sensual or explicit song the site asks their age. Until then those
// songs are listed with an "18+" mark and never start by themselves; after "No" they are hidden.
const AGE_GATE = CFG.ageGate === true;
const hideExplicit = () => !AGE_GATE && store.get("velora_explicit","")==="hide";
const age = () => { if(!AGE_GATE) return "adult"; const v=store.get("velora_age",""); return v==="adult"||v==="minor" ? v : ""; };
const adultOK = () => age()==="adult";
const playable = s => adultOK() || !isAdult(s);
function applyAge(){ S = AGE_GATE ? (age()==="minor" ? ALL.filter(s=>!isAdult(s)) : ALL) : (hideExplicit() ? ALL.filter(s=>!s.explicit) : ALL); ensureCats(); sortCats(); reindex(); }
function setAge(v){ if(v) store.set("velora_age",v); else { try{ localStorage.removeItem("velora_age"); }catch(e){} } applyAge(); }
function askAge(then){
  if(adultOK()){ if(then) then(); return; }
  openModal(`<h2 id="mTitle">Adults only</h2><p>Sensual songs on Velora are made for adults. Are you 18 or older?</p>
   <div class="row"><button type="button" class="btn primary" id="ageYes">Yes, I'm 18 or older</button><button type="button" class="btn ghost" id="ageNo">No</button></div>
   <p class="muted small" style="margin:14px 0 0">Your answer stays on this device. You can change it in Settings.</p>`);
  $("#ageYes").onclick=()=>{ setAge("adult"); closeM(); route(true); if(then) then(); };
  $("#ageNo").onclick=()=>{ setAge("minor"); closeM(); if(current && isAdult(current)){ audio.pause(); } toast("Adult songs are hidden on this device."); route(true); };
}
applyAge();
function search(q){
  const toks = norm(q).split(" ").filter(t=>t && !STOP.has(t)).slice(0,8);
  if(!toks.length) return {songs:[], cats:[], artists:[], lyricHit:new Set()};
  const hits=[], lyricHit=new Set();
  for(const e of IDX){
    let score=0, viaLyr=false, ok=true;
    for(const t of toks){
      if(e.title.includes(t)) score+=5;
      else if(e.meta.split(" ").some(w=>w.startsWith(t))) score+=3;
      else if(t.length>=3 && e.lyr.includes(t)){ score+=1; viaLyr=true; }
      else { ok=false; break; }
    }
    if(ok){ hits.push([e.s,score]); if(viaLyr) lyricHit.add(e.s.id); }
  }
  hits.sort((a,b)=>b[1]-a[1]);
  const cats = USED.filter(c=>{ const hay=norm(c.name+" "+(c.words||"")).split(" "); return toks.every(t=>hay.some(w=>w.startsWith(t))); });
  const artists = ARTISTS.filter(a=>songsBy(a).length && toks.every(t=>norm(a.name).includes(t)));
  return {songs:hits.map(h=>h[0]), cats, artists, lyricHit};
}

// ---------- Colour from the cover (Spotify-style background) ----------
function hexToHsl(hex){
  let h=safeColor(hex).replace("#",""); if(h.length===3) h=h.split("").map(c=>c+c).join("");
  const r=parseInt(h.slice(0,2),16)/255, g=parseInt(h.slice(2,4),16)/255, b=parseInt(h.slice(4,6),16)/255;
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b), L=(mx+mn)/2; let H=0, Sx=0;
  if(mx!==mn){ const d=mx-mn; Sx = L>0.5 ? d/(2-mx-mn) : d/(mx+mn); H = mx===r ? (g-b)/d+(g<b?6:0) : mx===g ? (b-r)/d+2 : (r-g)/d+4; H*=60; }
  return [Math.round(H), Math.round(Sx*100), Math.round(L*100)];
}
function themeOf(song){
  const [h,s,l] = hexToHsl(song.color || (PAL[song.hue||0]||PAL[0])[0]);
  const sat = clamp(s,40,78);
  return { top:`hsl(${h} ${sat}% ${clamp(l,30,42)}%)`, mid:`hsl(${h} ${clamp(sat-10,30,60)}% 17%)`, card:`hsl(${h} ${sat}% ${clamp(l-4,28,38)}%)`, mini:`hsl(${h} ${clamp(sat-8,30,58)}% 22%)` };
}
function applyTheme(song){
  const t=themeOf(song), np=$("#np"), mini=$("#mini");
  np.style.setProperty("--np-top",t.top); np.style.setProperty("--np-mid",t.mid); np.style.setProperty("--np-card",t.card);
  mini.style.setProperty("--mini-bg",t.mini);
  if(!song.color && song.art) sampleColor(url(song.art)).then(hex=>{ if(hex){ song.color=hex; if(current===song) applyTheme(song); } });
}
// Fallback when a song has no saved colour: sample the cover in the browser.
function sampleColor(src){
  return new Promise(res=>{
    const img=new Image(); img.crossOrigin="anonymous";
    img.onload=()=>{ try{
      const c=document.createElement("canvas"); c.width=c.height=32; const x=c.getContext("2d"); x.drawImage(img,0,0,32,32);
      const d=x.getImageData(0,0,32,32).data, B={};
      for(let i=0;i<d.length;i+=4){ const r=d[i],g=d[i+1],b=d[i+2], mx=Math.max(r,g,b)/255, mn=Math.min(r,g,b)/255, L=(mx+mn)/2; if(L<.12||L>.88) continue;
        const sat = mx===mn ? 0 : (mx-mn)/(1-Math.abs(2*L-1)); const k=(r>>5)+"-"+(g>>5)+"-"+(b>>5); const o=B[k]||(B[k]={n:0,r:0,g:0,b:0,s:0}); o.n++; o.r+=r; o.g+=g; o.b+=b; o.s+=sat; }
      let best=null, sc=-1; for(const k in B){ const o=B[k], v=o.n*((o.s/o.n)**2+0.01); if(v>sc){ sc=v; best=o; } }
      res(best ? "#"+[best.r,best.g,best.b].map(v=>Math.round(v/best.n).toString(16).padStart(2,"0")).join("") : null);
    }catch(e){ res(null); } };
    img.onerror=()=>res(null); img.src=src;
  });
}

// ---------- Toast (short messages at the bottom) ----------
let toastTimer=0;
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),3200); }

// ---------- Ads (off by default, see config.js) ----------
// Audio spots play between songs; banners are quiet cards. Premium members never get either.
const ADS = CFG.ads || {};
const adsOn = () => ADS.enabled===true && !Backend.premium;
const adSpots = () => adsOn() && Array.isArray(ADS.audio) ? ADS.audio.filter(a=>a && a.audio) : [];
let adState=null, songsSinceAd=0, adIndex=0;
function banner(slot){
  const b = adsOn() && ADS.banners ? ADS.banners[slot] : null; if(!b) return "";
  const link=safeLink(b.link), ext=/^https:/.test(link);
  const inner = b.image ? `<img src="${esc(url(b.image))}" alt="${esc(b.alt||"")}" loading="lazy">` : `<span>${esc(b.text||"")}</span>`;
  return `<aside class="ad-slot" aria-label="Sponsored"><small>Sponsored</small>${link?`<a href="${esc(link)}"${ext?' target="_blank" rel="noopener noreferrer sponsored"':" data-close-np"}>${inner}</a>`:inner}</aside>`;
}
// Called when a song ends by itself: plays a spot when one is due, then carries on.
function afterSongEnds(then){
  const spots=adSpots(), every=mode==="radio" ? ADS.radioEvery : ADS.streamEvery;
  songsSinceAd++;
  if(!spots.length || !(every>0) || songsSinceAd<every){ then(); return; }
  songsSinceAd=0; const spot=spots[adIndex++ % spots.length];
  adState={spot, then};
  document.body.classList.add("ad-on");
  $("#miniTitle").textContent=spot.title||"A short message"; $("#miniSub").textContent="Sponsored · the music continues right after";
  const link=safeLink(spot.link);
  $("#npAd").innerHTML=`<b>${esc(spot.title||"A short message")}</b><span id="adLeft">The music continues right after</span>${link?`<a class="btn light sm" href="${esc(link)}"${/^https:/.test(link)?' target="_blank" rel="noopener noreferrer sponsored"':" data-close-np"}>Learn more</a>`:""}`;
  audio.src=url(spot.audio); audio.play().catch(()=>finishAd());
}
function finishAd(){
  if(!adState) return; const then=adState.then; adState=null;
  document.body.classList.remove("ad-on"); $("#npAd").innerHTML="";
  then();
}

// ---------- Player ----------
let queue = S.slice(), qi = -1, current = null, mode = "library", source = "All songs", shuffle = false;
let npOpen = false, videoOn = false, lastSec = -1, lastLyr = -2, lastPos = 0, lastFocus = null, pendingHash = null;
let loadErrors = 0, pausedAt = 0;
const canSeek = () => !!current && !adState && mode!=="radio";

function load(song, autoplay=true, at=0){
  if(!playable(song)){ askAge(()=>load(song,autoplay,at)); return; }
  if(adState){ adState=null; document.body.classList.remove("ad-on"); $("#npAd").innerHTML=""; }
  current = song; qi = queue.indexOf(song); if(qi<0){ queue=[song]; qi=0; }
  audio.src = url(song.audio);
  if(at>0) audio.addEventListener("loadedmetadata", ()=>{ if(current===song) audio.currentTime = Math.min(at, Math.max(0,(audio.duration||song.duration)-2)); }, {once:true});
  if(autoplay) audio.play().catch(()=>setPlayIcons());
  $("#mini").hidden = false; document.body.classList.add("has-mini");
  document.body.classList.toggle("radio-on", mode==="radio");
  const rec=store.list("velora_recent").filter(id=>id!==song.id); rec.unshift(song.id); store.set("velora_recent",rec.slice(0,12));
  paintMini(song); renderNP(song); applyTheme(song); setMediaSession(song); paintBars(); setPlayIcons();
}
function playFrom(list, song, label, at=0, after=null){
  mode="library"; queue=list.filter(x=>playable(x)||x===song); if(!queue.includes(song)) queue.unshift(song); source=label; load(song,true,at);
  if(after) after();
}
function seekTo(t, play=false){
  if(!current) return;
  if(!canSeek()){ toast(adState ? "The music continues right after this message." : "This is live radio. Open the song to jump around in it."); return; }
  audio.currentTime=t; if(play) audio.play().catch(()=>{});
}
function togglePlay(){ if(!current){ startStream(); return; } if(audio.paused) audio.play().catch(()=>{}); else audio.pause(); }
function next(){
  if(!current || adState) return;
  if(mode==="radio"){ radioAdvance(); return; }
  if(shuffle && queue.length>1){ let i; do{ i=Math.floor(Math.random()*queue.length); }while(i===qi); load(queue[i]); return; }
  if(qi<queue.length-1){ load(queue[qi+1]); return; }
  // End of the list: keep the music going with similar songs (like Netflix autoplay).
  const more=suggestions(current,10); if(more.length){ source="Autoplay · similar songs"; queue=[current,...more]; load(more[0]); }
}
function prev(){ if(!canSeek()) return; if(audio.currentTime>3 || qi<=0){ audio.currentTime=0; return; } load(queue[qi-1]); }
function bestPart(){ if(current) seekTo(current.bestPart||0, true); }
function startStream(){ if(!current){ const list=dayShuffle(S,"stream").filter(playable); if(!list.length) return; playFrom(list, list[0], "All songs"); } openNP(); }
function suggestions(s,n=8){
  const mine=catsOf(s);
  const score = x => mine.filter(c=>inCat(x,c)).length*2 + (x.genre===s.genre?2:0) + (x.mood===s.mood?1:0) + (!!x.explicit===!!s.explicit?0.5:0);
  return S.filter(x=>x!==s && playable(x)).map((x,i)=>[x,score(x),i]).sort((a,b)=>b[1]-a[1]||a[2]-b[2]).slice(0,n).map(a=>a[0]);
}
// Play a list from the top or shuffled. If every song in it is for adults, ask the age first; otherwise the adult ones are left out.
function playList(list, label, mix){
  const ok=list.filter(playable); if(!ok.length){ if(list.length) askAge(()=>playList(list,label,mix)); return; }
  const l = mix ? shuffled(ok) : ok; playFrom(l, l[0], label, 0, openNP);
}
function startStation(c){ if(c) playList(songsIn(c), c.name+" Radio", true); }

function paintMini(s){
  $("#miniCover").setAttribute("style", coverStyle(s));
  $("#miniTitle").textContent = s.title;
  $("#miniSub").innerHTML = eb(s) + subOf(s) + (mode==="radio" ? " · Velora Radio, live" : "");
  paintTicks($("#miniBar"), s);
}
function paintTicks(bar, s){ const d=s.duration||1; bar.querySelector(".bar-ticks").innerHTML = (s.sections||[]).filter(x=>x.start>0).map(x=>`<i style="left:${clamp(x.start/d*100,0,100)}%"></i>`).join(""); }
function paintBars(){
  const d=(isFinite(audio.duration)&&audio.duration)||(current&&current.duration)||1, t=audio.currentTime||0, p=Math.min(100,t/d*100);
  for(const b of [$("#miniBar"),$("#npBar")]){ b.querySelector(".bar-fill").style.width=p+"%"; b.querySelector(".bar-knob").style.left=p+"%"; b.setAttribute("aria-valuenow",Math.round(p)); b.setAttribute("aria-valuetext",fmt(t)+" of "+fmt(d)); }
  $("#miniProg").style.width=p+"%"; $("#miniCur").textContent=fmt(t); $("#miniDur").textContent=fmt(d); $("#npCur").textContent=fmt(t); $("#npDur").textContent=mode==="radio"&&!adState?"LIVE":fmt(d);
  if(adState){ const left=$("#adLeft"); if(left) left.textContent="The music continues in "+fmt(Math.max(0,d-t)); }
}
function bindBar(bar){
  let drag=false;
  const seek=e=>{ if(!canSeek()) return; const r=bar.getBoundingClientRect(); const x=clamp((e.clientX-r.left)/r.width,0,1); audio.currentTime=x*((isFinite(audio.duration)&&audio.duration)||current.duration); paintBars(); };
  bar.addEventListener("pointerdown",e=>{ if(!canSeek()){ seekTo(0); return; } drag=true; try{ bar.setPointerCapture(e.pointerId); }catch(_){} seek(e); });
  bar.addEventListener("pointermove",e=>{ if(drag) seek(e); });
  bar.addEventListener("pointerup",()=>{ drag=false; }); bar.addEventListener("pointercancel",()=>{ drag=false; });
  bar.addEventListener("keydown",e=>{ if(!canSeek()) return; if(e.key==="ArrowRight"){ audio.currentTime+=5; e.preventDefault(); } if(e.key==="ArrowLeft"){ audio.currentTime-=5; e.preventDefault(); } });
}
[$("#miniBar"),$("#npBar")].forEach(bindBar);
function setPlayIcons(){ const playing=!audio.paused; for(const id of ["#miniPlay","#npPlay"]){ const b=$(id); b.innerHTML=icon(playing?"pause":"play"); b.setAttribute("aria-label",playing?"Pause":"Play"); } }

audio.addEventListener("play",()=>{
  setPlayIcons(); syncVideo(true);
  // Live radio: after a real pause, come back to what is on air now.
  if(mode==="radio" && !adState && pausedAt && Date.now()-pausedAt>20000){ pausedAt=0; radioTuneIn(); }
  pausedAt=0;
});
audio.addEventListener("pause",()=>{ setPlayIcons(); syncVideo(true); if(!audio.ended) pausedAt=Date.now(); });
audio.addEventListener("seeked",()=>{ syncVideo(true); markLyric(true); });
audio.addEventListener("waiting",()=>document.body.classList.add("buffering"));
for(const ev of ["playing","canplay","pause"]) audio.addEventListener(ev,()=>document.body.classList.remove("buffering"));
audio.addEventListener("playing",()=>{ loadErrors=0; });
audio.addEventListener("ended",()=>{ if(adState){ finishAd(); return; } afterSongEnds(next); });
audio.addEventListener("error",()=>{
  document.body.classList.remove("buffering");
  if(adState){ finishAd(); return; }
  if(!current) return;
  setPlayIcons(); loadErrors++;
  toast(loadErrors<3 ? "This song didn't load. Trying the next one…" : "The music isn't loading. Check your connection and try again.");
  if(loadErrors<3) setTimeout(()=>{ if(audio.error) next(); },1200);
});
audio.addEventListener("loadedmetadata",()=>{ paintBars(); setPosition(); });
audio.addEventListener("timeupdate",()=>{ paintBars(); if(adState) return; syncVideo(false); markSection(); markLyric(); const now=Date.now(); if(now-lastPos>4000){ lastPos=now; setPosition(); } });

$("#miniOpen").onclick=openNP;
$("#miniPlay").onclick=togglePlay; $("#npPlay").onclick=togglePlay;
$("#miniPrev").onclick=prev; $("#npPrev").onclick=prev;
$("#miniNext").onclick=next; $("#npNext").onclick=next;
$("#miniBest").onclick=bestPart; $("#npBest").onclick=bestPart;
const licCurrent=()=>{ if(current) openLicense(current); };
$("#miniLicense").onclick=licCurrent; $("#miniLicIcon").onclick=licCurrent; $("#npLicense").onclick=licCurrent; $("#npLicTop").onclick=licCurrent;
$("#npClose").onclick=()=>closeNP(false);
$("#npShare").onclick=()=>{ if(current) openShare(current); };
$("#npShuffle").onclick=()=>{ shuffle=!shuffle; const b=$("#npShuffle"); b.setAttribute("aria-pressed",String(shuffle)); b.classList.toggle("on",shuffle); toast(shuffle?"Shuffle is on":"Shuffle is off"); };
$("#npSections").addEventListener("click",e=>{ const b=e.target.closest(".sec"); if(b&&current){ seekTo(+b.dataset.t,true); markSection(true); } });

// ---------- Now Playing screen ----------
function renderNP(s){
  $("#npFrom").textContent = mode==="radio" ? "Velora Radio · live" : source;
  const art=$("#npArt"); art.setAttribute("style",coverStyle(s)); art.setAttribute("aria-label","Cover of "+s.title);
  art.innerHTML = s.art ? "" : `<span class="np-art-title">${esc(s.title)}</span>`;
  const c=catByName(s.genre);
  const ar=artistOf(s);
  $("#npTitle").textContent=s.title; $("#npArtist").innerHTML=eb(s)+(ar?`<a href="${artistLink(ar)}" data-close-np>${esc(ar.name)}</a>`:c?`<a href="${catLink(c)}" data-close-np>${esc(s.genre)}</a>`:esc(s.genre));
  paintTicks($("#npBar"), s);
  const d=s.duration, secs=s.sections||[];
  $("#npSections").innerHTML = secs.map((x,j)=>{ const end=(secs[j+1]||{start:d}).start, best=x.start===s.bestPart;
    return `<button type="button" class="sec${best?" best":""}" data-t="${+x.start||0}" aria-label="${esc(x.name)}, ${fmt(x.start)} to ${fmt(end)}${best?", best part":""}">${best?icon("spark"):""}${esc(x.name)} <small>${fmt(x.start)}</small></button>`; }).join("");
  $("#npCards").innerHTML = lyricsCard(s) + videoCard(s) + artistCard(s) + creditsCard(s) + licenseCard(s) + banner("player") + aboutCard(s) + nextCard(s);
  lastSec=-1; lastLyr=-2; markSection(true); markLyric(true);
  if(videoOn && (s.video||s.clip)) startVideo();
}
// Lyric lines with a small gap where a new part of the song starts.
function lyricLines(s, tag="p", attrs=()=>""){
  const starts=(s.sections||[]).map(x=>x.start); let prevT=-1;
  return s.lyrics.map(([t,l],i)=>{ const gap=i>0 && starts.some(st=>st>prevT && st<=t+0.5); prevT=t;
    return `<${tag} class="ll${gap?" gap":""}" data-t="${+t||0}" ${attrs(+t||0,i)}>${esc(l)}</${tag}>`; }).join("");
}
function lyricsCard(s){
  if(!hasLyrics(s)) return `<div class="np-card lyrics"><div class="card-h"><span>Lyrics</span></div><p class="muted" style="margin:0">Lyrics coming soon.</p></div>`;
  return `<div class="np-card lyrics"><div class="card-h"><span>Lyrics</span><button type="button" class="lyr-more" id="lyrMore" aria-expanded="false">Show all</button></div>
    <div class="lyr-box" id="lyrBox">${lyricLines(s)}</div>
    <p class="lyr-note">${esc(s.lyricsNote||"")} Tap a line to play from there.</p></div>`;
}
// A song can have a vertical short (video) or a wide music video (clip). Both follow the audio, muted.
function videoCard(s){
  const src=s.video||s.clip; if(!src) return "";
  const poster=cssUrl(s.poster||s.clipPoster||s.art||"");
  return `<div class="np-card media"><div class="card-h">${icon("video")}<span>Video</span></div>
    <div class="np-video${s.video?"":" wide"}" style="background-image:${poster}"><video id="npVideo" muted playsinline preload="none" disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"></video>
    <button type="button" class="np-video-btn" id="npVideoBtn">${icon("play")}<span>Play the video with the song</span></button></div>
    <p class="muted small" style="margin:0;text-align:center">The video follows the song you're hearing.</p></div>`;
}
// "About the artist" and "Credits", as on Spotify.
function artistCard(s){
  const a=artistOf(s); if(!a) return "";
  const n=songsBy(a).length;
  return `<div class="np-card artist"><a class="artist-img" href="${artistLink(a)}" data-close-np style="${artistArt(a)}" aria-label="${esc(a.name)}"><span>About the artist</span></a>
    <div class="artist-body"><div class="artist-row"><div><b>${esc(a.name)}</b><small>${plural(n,"song")} on Velora</small></div><a class="btn ghost sm" href="${artistLink(a)}" data-close-np>View artist</a></div>
    ${a.bio?`<p class="clamp3">${esc(a.bio)}</p>`:""}</div></div>`;
}
const creditRow = c => { const a=c.artist&&artistById(c.artist); return `<div class="credit"><div><b>${esc(c.name)}</b><small>${(c.roles||[]).map(esc).join(" · ")}</small></div>${a?`<a class="btn ghost sm" href="${artistLink(a)}" data-close-np>View</a>`:""}</div>`; };
function creditsCard(s){
  const list=creditsOf(s), names=[...new Set(list.map(c=>c.name))];
  const merged=names.map(n=>{ const of=list.filter(c=>c.name===n); return {name:n, roles:[...new Set(of.flatMap(c=>c.roles||[]))], artist:(of.find(c=>c.artist)||{}).artist}; });
  return `<div class="np-card"><div class="card-h spread"><span>Credits</span><button type="button" class="linkbtn" data-credits="${esc(s.id)}">Show all</button></div>${merged.slice(0,3).map(creditRow).join("")}</div>`;
}
// Label, publisher, owner lines and ISRC, when the upload gave them.
function releaseRows(s){
  const r=s.release, out=[], add=(name,role)=>{ if(name) out.push({group:"Release", name, roles:[role]}); }; if(!r) return out;
  add(r.label,"Label"); add(r.publisher,"Publisher");
  if(r.cOwner) add(`© ${r.cYear||""} ${r.cOwner}`.replace(/\s+/g," "),"Composition owner");
  if(r.pOwner) add(`℗ ${r.pYear||""} ${r.pOwner}`.replace(/\s+/g," "),"Recording owner");
  if(r.isrc) add(r.isrc.replace(/^(..)(...)(..)(.....)$/,"$1-$2-$3-$4"),"ISRC");
  return out;
}
function artistCredits(a, list){
  const up=list.filter(s=>s.uploaded);
  if(!up.length || up.length<list.length) return [{name:a.name,roles:["Main Artist"]},{name:CREATOR,roles:["Lyricist","Song design","Producer"]},{name:"Suno",roles:["Music generation (AI-assisted)"]}];
  const all=up.flatMap(creditsOf), names=[...new Set(all.map(c=>c.name))];
  return names.map(n=>({name:n, roles:[...new Set(all.filter(c=>c.name===n).flatMap(c=>c.roles||[]))].slice(0,6)})).slice(0,12);
}
function openCredits(s){
  const list=creditsOf(s).concat(releaseRows(s)), groups=[...new Set(list.map(c=>c.group||"Credits"))];
  openModal(`<h2 id="mTitle">${esc(s.title)}</h2><p class="muted small" style="margin-top:-6px">${subOf(s)}</p>${groups.map(g=>`<h3 class="cgroup">${esc(g)}</h3>${list.filter(c=>(c.group||"Credits")===g).map(creditRow).join("")}`).join("")}<p class="muted small" style="margin:16px 0 0">Source: Velora catalogue · ID ${esc(s.id)}</p>`);
}
function licenseCard(s){
  if(!SALES) return "";
  return `<div class="np-card"><div class="card-h">${icon("tag")}<span>Use this song in your videos</span></div>
    <div class="lic-row"><button type="button" class="btn red" data-lic="${esc(s.id)}">Rent ${esc(PRICES.rent.price)}</button><button type="button" class="btn blue" data-lic="${esc(s.id)}" data-pre="buy">Buy rights ${esc(PRICES.buy.price)}</button></div>
    <p class="muted small" style="margin:0">${payDemo()?"Example prices. ":""}Every license comes with a dated certificate.</p></div>`;
}
function aboutCard(s){
  const cats=catsOf(s);
  return `<div class="np-card"><div class="card-h"><span>About the song</span></div>
    <div class="facts np-facts"><div class="fact"><b>Genre</b>${esc(s.genre)}${s.subgenre?" · "+esc(s.subgenre):""}</div><div class="fact"><b>Mood</b>${esc(s.mood)}</div><div class="fact"><b>Length</b>${fmt(s.duration)}</div>${s.bpm?`<div class="fact"><b>BPM</b>${esc(s.bpm)}</div>`:`<div class="fact"><b>Language</b>${esc(s.language||"–")}</div>`}${s.key?`<div class="fact"><b>Key</b>${esc(s.key)}</div>`:""}<div class="fact"><b>Content</b>${s.explicit?"Explicit lyrics":"Clean"}</div></div>
    ${cats.length>1?`<div class="chips" style="margin:0 0 12px">${cats.map(c=>`<a class="chip" href="${catLink(c)}" data-close-np>${esc(c.name)}</a>`).join("")}</div>`:""}
    <p class="small" style="margin:0 0 12px">${madeBy(s)}</p>
    <a class="btn ghost sm" href="#/song/${encodeURIComponent(s.id)}" data-close-np>Open the song page</a></div>`;
}
function nextCard(s){
  if(mode==="radio"){ const up=radioTimeline(Date.now(),3).slice(1);
    return `<div class="np-card"><div class="card-h"><span>Next on the radio</span></div><div class="rows">${up.map(e=>srowStatic(e.song)).join("")}</div></div>`; }
  const up = queue[qi+1];
  return `<div class="np-card">${up?`<div class="card-h"><span>Up next</span></div><div class="rows">${srowNP(up,"queue")}</div>`:""}
    <div class="card-h"${up?' style="margin-top:14px"':""}><span>More like this</span></div><div class="rows">${suggestions(s).map(x=>srowNP(x,"sug")).join("")}</div></div>`;
}
const srowMeta = x => `<span class="srow-cover" style="${coverStyle(x)}"></span><span class="srow-t"><b>${esc(x.title)}</b><small>${badge(x)}${esc(x.genre)} · ${esc(x.mood)} · ${fmt(x.duration)}</small></span>`;
const srowNP = (x,kind) => `<button type="button" class="srow" data-${kind}="${esc(x.id)}">${srowMeta(x)}${icon("play","srow-i")}</button>`;
const srowStatic = x => `<div class="srow static">${srowMeta(x)}</div>`;
$("#npCards").addEventListener("click",e=>{
  if(e.target.closest("#npVideoBtn")){ startVideo(); return; }
  const more=e.target.closest("#lyrMore"); if(more){ const box=$("#lyrBox"), full=box.classList.toggle("full"); more.textContent=full?"Show less":"Show all"; more.setAttribute("aria-expanded",String(full)); markLyric(true); return; }
  const ll=e.target.closest("#lyrBox .ll"); if(ll && current){ seekTo(+ll.dataset.t,true); markLyric(true); return; }
  const sg=e.target.closest("[data-sug]"); if(sg){ const x=byId(sg.dataset.sug), from=current; if(!x) return; playFrom([x,...suggestions(x,8)], x, "More like "+from.title); $("#npScroll").scrollTo({top:0,behavior:"smooth"}); return; }
  const qu=e.target.closest("[data-queue]"); if(qu){ const x=byId(qu.dataset.queue); if(x){ load(x); $("#npScroll").scrollTo({top:0,behavior:"smooth"}); } }
});
function markSection(force){
  if(!current || (!npOpen && !force)) return;
  const t=audio.currentTime||0; let idx=0; (current.sections||[]).forEach((x,i)=>{ if(t>=x.start) idx=i; });
  if(idx===lastSec && !force) return; lastSec=idx;
  document.querySelectorAll("#npSections .sec").forEach((b,i)=>b.classList.toggle("on",i===idx));
}
// Synced lyrics: the line being sung lights up and the card follows it, like Spotify.
function markLyric(force){
  if(!current || !hasLyrics(current) || (!npOpen && !force)) return;
  const L=current.lyrics, t=(audio.currentTime||0)+0.25; let i=-1, lo=0, hi=L.length-1;
  while(lo<=hi){ const m=(lo+hi)>>1; if(L[m][0]<=t){ i=m; lo=m+1; } else hi=m-1; }
  if(i===lastLyr && !force) return; lastLyr=i;
  const box=$("#lyrBox"); if(!box) return;
  const ps=box.children; for(let k=0;k<ps.length;k++){ ps[k].classList.toggle("on",k===i); ps[k].classList.toggle("past",k<i); }
  if(!box.classList.contains("full")){ const el=ps[Math.max(0,i)]; if(el) box.scrollTo({top:Math.max(0, el.offsetTop - box.clientHeight*0.3), behavior: force?"auto":"smooth"}); }
}
// The video plays muted and follows the audio, so the song never plays twice.
function startVideo(){
  const v=$("#npVideo"), src=current&&(current.video||current.clip); if(!v||!src) return;
  videoOn=true; const btn=$("#npVideoBtn"); if(btn) btn.hidden=true;
  if(!v.getAttribute("src")){ v.preload="auto"; v.src=url(src); }
  v.addEventListener("loadedmetadata",()=>syncVideo(true),{once:true});
  syncVideo(true);
}
function syncVideo(hard){
  const v=$("#npVideo"); if(!v || !v.getAttribute("src")) return;
  if(!npOpen || audio.paused || adState){ if(!v.paused) v.pause(); return; }
  if(v.readyState>=1 && (hard || Math.abs(v.currentTime-audio.currentTime)>0.45)){ try{ v.currentTime=audio.currentTime; }catch(e){} }
  if(v.paused) v.play().catch(()=>{});
}
// While a full-screen layer is open, everything behind it is switched off for keyboard and screen readers.
const SHELL = [".demo-banner","header.topbar","main","footer","#mini","nav.tabbar"];
function setInert(on, extra=[]){ [...SHELL,...extra].forEach(sel=>{ const el=$(sel); if(!el) return; if(on) el.setAttribute("inert",""); else el.removeAttribute("inert"); }); }
function openNP(){
  if(!current || npOpen) return;
  npOpen=true; lastFocus=document.activeElement;
  const np=$("#np"); np.classList.add("open"); np.setAttribute("aria-hidden","false");
  document.body.classList.add("np-open"); setInert(true);
  try{ history.pushState({velNP:1},""); }catch(e){}
  setTimeout(()=>{ try{ $("#npClose").focus({preventScroll:true}); }catch(e){} },40);
  markSection(true); markLyric(true); syncVideo(true);
}
function closeNP(fromPop, thenHash){
  if(!npOpen) return;
  npOpen=false;
  const np=$("#np"); np.classList.remove("open"); np.setAttribute("aria-hidden","true");
  document.body.classList.remove("np-open"); setInert(false);
  const v=$("#npVideo"); if(v && !v.paused) v.pause();
  let viaBack=false;
  if(!fromPop){ try{ if(history.state && history.state.velNP){ pendingHash=thenHash||null; viaBack=true; history.back(); } }catch(e){} }
  if(thenHash && !viaBack) location.hash=thenHash;
  if(!thenHash && lastFocus && lastFocus.focus){ try{ lastFocus.focus({preventScroll:true}); }catch(e){} }
}
window.addEventListener("popstate",()=>{ if(npOpen) closeNP(true); if(pendingHash){ const h=pendingHash; pendingHash=null; location.hash=h; } });

// Lock-screen and headphone controls on phones (like any music app)
function setMediaSession(s){
  if(!("mediaSession" in navigator)) return;
  try{ navigator.mediaSession.metadata = new MediaMetadata({ title:s.title, artist:(artistOf(s)||{name:"Velora · "+s.genre}).name, album:mode==="radio"?"Velora Radio":"Velora", artwork: s.art ? [{src:url(s.art), sizes:"600x600", type:"image/jpeg"}] : [] }); }catch(e){}
}
function setPosition(){
  if(!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
  const d=audio.duration; if(!d || !isFinite(d)) return;
  try{ navigator.mediaSession.setPositionState({duration:d, playbackRate:audio.playbackRate||1, position:Math.min(audio.currentTime,d)}); }catch(e){}
}
if("mediaSession" in navigator){
  const H=(a,f)=>{ try{ navigator.mediaSession.setActionHandler(a,f); }catch(e){} };
  H("play",()=>audio.play().catch(()=>{})); H("pause",()=>audio.pause()); H("previoustrack",prev); H("nexttrack",()=>{ if(canSeek()) next(); });
  H("seekbackward",()=>{ if(canSeek()) audio.currentTime=Math.max(0,audio.currentTime-10); }); H("seekforward",()=>{ if(canSeek()) audio.currentTime+=10; });
  H("seekto",d=>{ if(canSeek() && d && d.seekTime!=null) audio.currentTime=d.seekTime; });
}
// No download button anywhere; also block the "save" menu on covers and videos. (This only makes saving harder.)
document.addEventListener("contextmenu",e=>{ if(e.target.closest("video,audio,.cover,.np-art,.mini-cover,.srow-cover,.tile-cover,.vid,.np-video,.st-circles,.feat-cover")) e.preventDefault(); });

// ---------- Radio: one station, the same moment for every listener ----------
// There is no server yet, so the schedule is calculated from the clock: for each time slot the songs
// are put in an order that depends only on the date and the slot. Two phones that open the radio
// at the same second land on the same song at the same place.
const TZ = CFG.stationTimeZone || "Europe/Amsterdam";
let tzFmt; try{ tzFmt=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}); }catch(e){ tzFmt=new Intl.DateTimeFormat("en-GB",{hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}); }
function stationClock(ms){ const p={}; for(const x of tzFmt.formatToParts(new Date(ms))) p[x.type]=x.value; const hour=(+p.hour)%24; return {date:`${p.year}-${p.month}-${p.day}`, hour, secs:hour*3600+(+p.minute)*60+(+p.second)}; }
function slotAt(ms){
  const c=stationClock(ms), late=c.hour<2, hh=late?c.hour+24:c.hour;
  const slot=RADIO.find(r=>hh>=r.from && hh<r.to) || RADIO[0];
  const into=Math.max(0,(c.secs+(late?86400:0))-slot.from*3600), start=ms-into*1000;
  return {slot, into, start, key:stationClock(start).date+"|"+slot.from};
}
// A slot plays the songs of its categories; "adult:false" leaves out adult songs, "explicit:false" explicit ones.
const slotAllows = (slot,s) => !(slot.adult===false && isAdult(s)) && !(slot.explicit===false && s.explicit);
function radioPool(slot){
  const fine = s => slotAllows(slot,s) && playable(s);
  const p=S.filter(s=>fine(s) && slot.cats.some(n=>{ const c=catByName(n); return c && inCat(s,c); }));
  if(p.length) return p; const rest=S.filter(fine); return rest.length ? rest : S.filter(playable);
}
// The song on air at time ms (with how far into it we are) and the ones after it.
function radioTimeline(ms, count=4){
  const {slot,into,start,key}=slotAt(ms), pool=radioPool(slot), out=[]; let t=0, last=null;
  if(!pool.length) return out;
  for(let cyc=0; cyc<600 && out.length<count; cyc++){
    const order=seededShuffle(pool,key+"|"+cyc); if(last && order.length>1 && order[0]===last) order.push(order.shift());
    for(const s of order){
      const d=Math.max(30,s.duration||180);
      if(out.length || t+d>into){ out.push({song:s, offset:out.length?0:Math.max(0,into-t), startsAt:start+t*1000, slot}); if(out.length>=count) break; }
      t+=d; last=s;
    }
  }
  return out;
}
const slotNow = () => slotAt(Date.now()).slot;
function radioTuneIn(){
  const e=radioTimeline(Date.now(),1)[0]; if(!e) return;
  mode="radio"; source="Velora Radio"; queue=[e.song];
  if(current===e.song && audio.src && !audio.error && isFinite(audio.duration)){ audio.currentTime=Math.min(e.offset,audio.duration-2); audio.play().catch(()=>{}); document.body.classList.add("radio-on"); renderNP(e.song); paintMini(e.song); return; }
  load(e.song,true,e.offset);
}
// A song finished on the radio: carry on with the schedule. If we are only a little behind the live
// moment, the next song starts from its beginning; if far behind, we jump back to the live moment.
function radioAdvance(){
  const live=radioTimeline(Date.now(),2); if(!live.length) return;
  let e=live[0]; if(e.song===current && live[1]) e={...live[1],offset:0};
  queue=[e.song]; load(e.song,true,e.offset<30?0:e.offset);
}
function startRadio(){ radioTuneIn(); openNP(); }
const fmtClock = ms => { const c=stationClock(ms); return String(c.hour).padStart(2,"0")+":"+String(Math.floor(c.secs%3600/60)).padStart(2,"0"); };

// ---------- Modal (license, video) ----------
let modalFocus=null;
function openModal(html){
  const m=$("#modal"); if(m.hidden) modalFocus=document.activeElement;
  $("#mBody").innerHTML=html; m.hidden=false; m.querySelector(".modal").scrollTop=0;
  setInert(true,["#np"]);
  const first=m.querySelector("#mBody input:checked") || m.querySelector("#mBody button, #mBody a[href]") || $("#mClose"); try{ first.focus({preventScroll:true}); }catch(e){}
}
function closeM(){
  const m=$("#modal"); if(m.hidden) return;
  const v=m.querySelector("video"); if(v){ v.pause(); v.removeAttribute("src"); v.load(); }
  m.hidden=true; $("#mBody").innerHTML="";
  $("#np").removeAttribute("inert"); if(!npOpen) setInert(false);
  if(modalFocus && modalFocus.isConnected) try{ modalFocus.focus({preventScroll:true}); }catch(e){}
  modalFocus=null;
}
$("#mClose").onclick=closeM; $("#modal").addEventListener("click",e=>{ if(e.target.id==="modal") closeM(); });
document.addEventListener("keydown",e=>{ if(e.key!=="Escape") return; if(!$("#modal").hidden) closeM(); else if(!$("#drawer").hidden) closeMenu(); else if(npOpen) closeNP(false); });
// Keep the Tab key inside the open window (license window, menu).
function trapTab(box){ box.addEventListener("keydown",e=>{
  if(e.key!=="Tab") return; const f=[...box.querySelectorAll("button,a[href],input,select,textarea,video[controls]")].filter(x=>!x.disabled && x.offsetParent!==null); if(!f.length) return;
  const first=f[0], last=f[f.length-1];
  if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); } else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
}); }
trapTab($("#modal")); trapTab($("#drawer"));

// ---------- Menu (the ☰ button): Upload, the account, Settings and the other pages ----------
let menuFocus=null;
function menuHTML(){
  const u=Backend.user, up=!!u && Backend.canUpload();
  const who = u ? `<div class="dr-who"><span class="dr-ava">${icon("user")}</span><div><b>${esc(Backend.name||u.email||"Signed in")}</b><small>${Backend.role==="owner"?"Owner":up?"Creator":"Signed in"}</small></div></div>`
    : `<div class="dr-who"><span class="dr-ava">${icon("user")}</span><div><b>Welcome</b><small>Listening needs no account</small></div></div>`;
  const item=(href,ic,label,cls="")=>`<a class="dr-item${cls}" href="${href}">${icon(ic)}<span>${label}</span></a>`;
  return `<div class="dr-head"><span class="brand"><span class="logo-dot"></span>Velora</span><button type="button" class="icon-btn" id="menuClose" aria-label="Close the menu">${icon("close")}</button></div>
   ${who}
   ${item("#/upload","upload","Upload a song"," main")}
   ${up?item("#/studio","music","My songs"):""}
   <div class="dr-sep"></div>
   ${item("#/","home","Home")}${item("#/search","search","Search")}${item("#/radio","radio","Radio")}${item("#/videos","video","Videos")}
   <div class="dr-sep"></div>
   ${item("#/pricing","premium","Pricing")}${item("#/verify","check","Verify a license")}
   <div class="dr-sep"></div>
   ${item("#/settings","settings","Settings")}${item("#/legal","lock","Terms and privacy")}
   ${u?`<button type="button" class="dr-item" id="menuOut">${icon("lock")}<span>Sign out</span></button>`:item("#/account","user",Backend.enabled?"Sign in":"Account")}`;
}
function openMenu(){
  const d=$("#drawer"); if(!d.hidden) return;
  menuFocus=document.activeElement; $("#drawerNav").innerHTML=menuHTML(); d.hidden=false; $("#menuBtn").setAttribute("aria-expanded","true");
  requestAnimationFrame(()=>d.classList.add("open")); setInert(true);
  try{ $("#menuClose").focus({preventScroll:true}); }catch(e){}
  if(Backend.enabled && !Backend.ready) Backend.init().then(()=>{ if(!d.hidden) $("#drawerNav").innerHTML=menuHTML(); }).catch(()=>{});
}
function closeMenu(){
  const d=$("#drawer"); if(d.hidden) return;
  d.classList.remove("open"); d.hidden=true; $("#menuBtn").setAttribute("aria-expanded","false");
  if(!npOpen && $("#modal").hidden) setInert(false);
  if(menuFocus && menuFocus.isConnected) try{ menuFocus.focus({preventScroll:true}); }catch(e){}
  menuFocus=null;
}
$("#menuBtn").onclick=openMenu;
$("#drawer").addEventListener("click",e=>{
  if(e.target.id==="drawer" || e.target.closest("#menuClose")){ closeMenu(); return; }
  if(e.target.closest("#menuOut")){ closeMenu(); Backend.signOut().then(()=>{ toast("Signed out."); route(true); }); return; }
  if(e.target.closest("a.dr-item")) closeMenu();
});

// ---------- Share (a ready card, like Spotify: the song, or lyric lines you pick) ----------
// A link to a page of the site. Inside the phone app that is the website's address (config.js siteUrl); "" while it has none.
const pageLink = hashPath => NATIVE ? (SITE ? SITE+hashPath : "") : location.href.split("#")[0] + hashPath;
// The phone's own share sheet (the app carries a small share plugin; Android's web view has no share of its own).
const nativeShare = (title, link) => window.Capacitor.nativePromise("Share","share", link ? {title, text:title, url:link, dialogTitle:"Share"} : {title, text:title, dialogTitle:"Share"});
async function shareLink(title, link){
  if(NATIVE){ try{ await nativeShare(title, link); }catch(e){ if(link){ try{ await navigator.clipboard.writeText(link); toast("Link copied."); }catch(e2){} } } return; }
  try{ if(navigator.share){ await navigator.share({title, text:title, url:link}); return; } }catch(e){ if(e && e.name==="AbortError") return; }
  try{ await navigator.clipboard.writeText(link); toast("Link copied."); }catch(e){ toast(link); }
}
const imgCache = new Map();
const loadImg = src => { if(!imgCache.has(src)) imgCache.set(src, new Promise(res=>{ const i=new Image(); i.crossOrigin="anonymous"; i.onload=()=>res(i); i.onerror=()=>res(null); i.src=src; })); return imgCache.get(src); };
function wrapText(x, text, maxW){ const out=[]; let line=""; for(const w of String(text).split(/\s+/)){ const t=line?line+" "+w:w; if(x.measureText(t).width>maxW && line){ out.push(line); line=w; } else line=t; } if(line) out.push(line); return out; }
function rrect(x, X, Y, W, H, r){ x.beginPath(); if(x.roundRect) x.roundRect(X,Y,W,H,r); else x.rect(X,Y,W,H); }
let share=null;
async function drawShare(){
  const cv=$("#shareCv"); if(!cv||!share) return; const x=cv.getContext("2d"), s=share.s, W=1080, H=1920, t=themeOf(s), sub=(artistOf(s)||{name:s.genre}).name;
  try{ await document.fonts.load('800 60px Inter'); }catch(e){}
  const img = s.art && share.art!==false ? await loadImg(url(s.art)) : null;
  if(!share || share.s!==s) return;
  if(share.bg===2){ x.fillStyle="#121214"; } else if(share.bg===1){ const g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,t.top); g.addColorStop(1,"#121214"); x.fillStyle=g; } else x.fillStyle=t.top;
  x.fillRect(0,0,W,H); x.textBaseline="alphabetic";
  const brand=(bx,by)=>{ const g=x.createLinearGradient(bx,by-40,bx+44,by); g.addColorStop(0,"#5b7a99"); g.addColorStop(.5,"#e0a9b0"); g.addColorStop(1,"#b0524a"); x.fillStyle=g; x.beginPath(); x.arc(bx+22,by-18,22,0,7); x.fill(); x.fillStyle="#fff"; x.font='700 44px "Playfair Display", Georgia, serif'; x.fillText("Velora",bx+60,by-3); };
  const drawCover=(X,Y,Z,r)=>{ x.save(); rrect(x,X,Y,Z,Z,r); x.clip(); if(img) x.drawImage(img,X,Y,Z,Z); else { const g=x.createLinearGradient(X,Y,X+Z,Y+Z); g.addColorStop(0,t.card); g.addColorStop(1,"#141418"); x.fillStyle=g; x.fillRect(X,Y,Z,Z); } x.restore(); };
  if(share.tab==="lyrics" && hasLyrics(s)){
    drawCover(100,150,150,16);
    x.fillStyle="#fff"; x.font='700 44px Inter, sans-serif'; x.fillText(wrapText(x,s.title,700)[0],280,212);
    x.fillStyle="rgba(255,255,255,.75)"; x.font='500 38px Inter, sans-serif'; x.fillText(sub,280,268);
    const picked=[...share.lines].sort((a,b)=>a-b).map(i=>s.lyrics[i][1]);
    let size=92; x.fillStyle="#fff";
    for(;size>=52;size-=8){ x.font=`800 ${size}px Inter, sans-serif`; const n=picked.reduce((a,l)=>a+wrapText(x,l,880).length,0); if(n*size*1.22+picked.length*size*0.35<=1180) break; }
    let y=470+size;
    for(const l of picked){ for(const ln of wrapText(x,l,880)){ x.fillText(ln,100,y); y+=size*1.22; } y+=size*0.35; }
    brand(100,1790);
  } else {
    x.fillStyle="rgba(0,0,0,.34)"; rrect(x,120,400,840,1120,40); x.fill();
    drawCover(160,440,760,20);
    x.fillStyle="#fff"; x.font='800 58px Inter, sans-serif'; const tl=wrapText(x,s.title,760).slice(0,2); tl.forEach((ln,i)=>x.fillText(ln,160,1290+i*70));
    x.fillStyle="rgba(255,255,255,.75)"; x.font='500 46px Inter, sans-serif'; x.fillText(sub,160,1290+tl.length*70);
    brand(160,1480);
  }
}
function openShare(s){
  const L=hasLyrics(s), start = L ? Math.max(0, current===s ? lastLyr : 0) : 0;
  share={s, tab:"song", bg:0, lines:new Set(L?[start]:[])};
  const link0=pageLink("#/song/"+encodeURIComponent(s.id));
  openModal(`<h2 id="mTitle">Share</h2>
   <canvas id="shareCv" class="share-cv" width="1080" height="1920" role="img" aria-label="Share card for ${esc(s.title)}"></canvas>
   <div class="seg" role="tablist" aria-label="What to share"><button type="button" role="tab" aria-selected="true" class="on" data-shtab="song">Song</button><button type="button" role="tab" aria-selected="false" data-shtab="lyrics"${L?"":" disabled"}>Lyrics</button></div>
   <div class="swatches" role="group" aria-label="Background">${[0,1,2].map(i=>`<button type="button" class="swatch${i===0?" on":""}" data-shbg="${i}" aria-label="Background ${i+1}" style="background:${i===2?"#121214":i===1?`linear-gradient(${themeOf(s).top},#121214)`:themeOf(s).top}"></button>`).join("")}</div>
   <div class="share-pick" id="sharePick" hidden><p class="muted small" style="margin:0 0 6px">Tap the lines you want (up to 5).</p>${L?s.lyrics.map((l,i)=>`<button type="button" class="pickline${i===start?" on":""}" data-shline="${i}" aria-pressed="${i===start}">${esc(l[1])}</button>`).join(""):""}</div>
   <div class="share-actions"><button type="button" class="btn primary" id="shGo">${icon("share")}Share</button>${link0?`<button type="button" class="btn" id="shCopy">Copy link</button>`:""}<button type="button" class="btn ghost" id="shSave">Save image</button></div>`);
  const link=link0, body=$("#mBody");
  body.onclick=async e=>{
    const tb=e.target.closest("[data-shtab]"); if(tb && !tb.disabled){ share.tab=tb.dataset.shtab; body.querySelectorAll("[data-shtab]").forEach(b=>{ const on=b===tb; b.classList.toggle("on",on); b.setAttribute("aria-selected",String(on)); }); const pk=$("#sharePick"); pk.hidden=share.tab!=="lyrics"; if(!pk.hidden){ const on=pk.querySelector(".pickline.on"); if(on) pk.scrollTop=Math.max(0,on.offsetTop-pk.clientHeight/3); } drawShare(); return; }
    const bg=e.target.closest("[data-shbg]"); if(bg){ share.bg=+bg.dataset.shbg; body.querySelectorAll(".swatch").forEach(b=>b.classList.toggle("on",b===bg)); drawShare(); return; }
    const ln=e.target.closest("[data-shline]"); if(ln){ const i=+ln.dataset.shline;
      if(share.lines.has(i)){ if(share.lines.size>1) share.lines.delete(i); } else if(share.lines.size>=5){ toast("Up to 5 lines."); return; } else share.lines.add(i);
      body.querySelectorAll(".pickline").forEach(b=>{ const on=share.lines.has(+b.dataset.shline); b.classList.toggle("on",on); b.setAttribute("aria-pressed",String(on)); }); drawShare(); return; }
    if(e.target.closest("#shCopy")){ try{ await navigator.clipboard.writeText(link); toast("Link copied."); }catch(err){ toast(link); } return; }
    const go=e.target.closest("#shGo"), save=e.target.closest("#shSave"); if(!go && !save) return;
    const title=s.title+" · "+(artistOf(s)||{name:"Velora"}).name;
    if(NATIVE && go && !(navigator.canShare && navigator.share)){ try{ await nativeShare(title, link); }catch(err){} return; }   // Android app: the phone's share sheet, text and link
    let blob=null; try{ blob=await new Promise(res=>$("#shareCv").toBlob(res,"image/png")); }catch(err){ share.art=false; await drawShare(); try{ blob=await new Promise(res=>$("#shareCv").toBlob(res,"image/png")); }catch(e2){} }
    if(save){ if(!blob){ toast("The image isn't ready."); return; } const a=document.createElement("a"), u=URL.createObjectURL(blob); a.href=u; a.download="velora-"+s.id+".png"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),4000); return; }
    try{
      const file = blob ? new File([blob],"velora-"+s.id+".png",{type:"image/png"}) : null;
      if(file && navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], title, text:title+"\n"+link}); return; }
      if(navigator.share){ await navigator.share({title, text:title, url:link}); return; }
      await navigator.clipboard.writeText(link); toast("Link copied. Use Save image for the card.");
    }catch(err){ if(!err || err.name!=="AbortError") toast("Sharing didn't work here. Try Copy link."); }
  };
  drawShare();
}

// ---------- License / checkout ----------
// Three states. Shop open on the server: real payment at the provider, then the certificate (thanksView).
// Shop closed and config demo:true: the demo below (nothing is charged, records stay in this browser).
// Shop closed and demo:false: a short "opens soon" note.
const LIC_TEXT = {
  rent:"For one video or post, published within that time. Once published it may stay online.",
  buy:"Non-exclusive. You keep the right to use it forever. The song stays in the Velora catalogue.",
  excl:"Only on request. The song can be taken out of the catalogue for new buyers if you ask.",
  sub:"Every song, for content you publish while you are a member."
};
const LIC_NAME = { rent:"Rent", buy:"Usage rights", premium:"Premium", exclusive:"Exclusive" };
const money = (cents,cur) => { const v=(+cents||0)/100, c=String(cur||"eur").toUpperCase();
  try{ return new Intl.NumberFormat("en-IE",{style:"currency",currency:c,minimumFractionDigits:v%1?2:0,maximumFractionDigits:2}).format(v); }catch(e){ return (v%1?v.toFixed(2):String(v))+" "+c; } };
// The server's prices replace the example ones as soon as the shop is open.
function applyShop(d){
  if(!d || d.open!==true || shopOpen()) return;
  SHOP=d;
  PRICES.rent.price=money(d.rent,d.currency); PRICES.rent.per=`${d.rent_days} days, one channel`;
  PRICES.buy.price=money(d.buy,d.currency); PRICES.sub.price=money(d.premium,d.currency);
  const bn=$(".demo-banner"); if(bn) bn.remove();          // real payments are on: nothing may say "demo" any more
  if(/^#\/?(pricing)?$/.test(location.hash) && !npOpen && $("#modal").hidden) route(true);
}
function openLicense(song, preset="rent"){
  if(!song || !SALES) return; if(!PRICES[preset]) preset="rent";
  if(shopOpen()){ openPay(song, preset); return; }
  if(!DEMO){ openModal(`<h2 id="mTitle">Licensing opens soon</h2><p>Paying for a license is not switched on yet. Every song already plays in full, for free.</p><button type="button" class="btn" id="mDone">Close</button>`); $("#mDone").onclick=closeM; return; }
  openModal(`
  <h2 id="mTitle">${preset==="sub"?"Start Premium":`License “${esc(song.title)}”`}</h2>
  <p class="muted small">${esc(song.genre)} · ${esc(song.mood)} · ${fmt(song.duration)} · ID ${esc(song.id)}</p>
  <form id="lic">
   <div class="opts" role="radiogroup" aria-label="License type">
    ${["rent","buy","excl","sub"].map(k=>`<label class="opt"><input type="radio" name="t" value="${k}" ${k===preset?"checked":""}><div><b>${esc(PRICES[k].label)} · ${esc(PRICES[k].price)}</b><span class="muted small">${esc(PRICES[k].per)}. ${LIC_TEXT[k]}</span></div></label>`).join("")}
   </div>
   <div class="note"><b>About exclusivity.</b> Buying usage rights is non-exclusive: other people can license the same song, and it stays in the catalogue. If you need it to be yours alone, choose Exclusive and we will contact you; the song is removed for new buyers only when you ask.</div>
   <div class="paybar">
     <span class="muted small">Demo checkout. Nothing is charged.</span>
     <button class="btn primary" type="submit">Pay (demo)</button>
   </div>
  </form>`);
  $("#lic").onsubmit = e => { e.preventDefault(); const t=new FormData(e.target).get("t");
    if(t==="excl"){ openModal(`<h2 id="mTitle">Exclusive request sent (demo)</h2><p>In the real site, your request for “${esc(song.title)}” goes to the rights holder, who replies by email. Nothing was charged.</p><button type="button" class="btn" id="mDone">Close</button>`); $("#mDone").onclick=closeM; return; }
    showCert(song, PRICES[t]?t:"rent"); };
}
// The real license window: choose, tick the delivery box, and go to the payment provider's page.
function openPay(song, preset){
  const member=Backend.premium, kinds=member?["rent","buy","excl"]:["rent","buy","excl","sub"], mail=String((CFG.business||{}).email||"");
  if(!kinds.includes(preset)) preset="rent";
  openModal(`
  <h2 id="mTitle">${preset==="sub"?"Start Premium":`License “${esc(song.title)}”`}</h2>
  <p class="muted small">${esc(song.genre)} · ${esc(song.mood)} · ${fmt(song.duration)} · ID ${esc(song.id)}</p>
  ${member?`<div class="note" id="memBox"><b>Included in your Premium.</b> Get the license certificate for this song now.<div class="row" style="margin-top:10px"><button type="button" class="btn primary sm" id="memGet">Get the license</button></div><p class="formmsg" id="memMsg" role="alert"></p></div>`:""}
  <form id="lic">
   <div class="opts" role="radiogroup" aria-label="License type">
    ${kinds.map(k=>`<label class="opt"><input type="radio" name="t" value="${k}" ${k===preset?"checked":""}><div><b>${esc(PRICES[k].label)} · ${esc(PRICES[k].price)}</b><span class="muted small">${esc(PRICES[k].per)}. ${LIC_TEXT[k]}</span></div></label>`).join("")}
   </div>
   <div id="payBuy">
    <div class="field"><label for="licName">Name on the license <span class="muted">(optional)</span></label><input id="licName" type="text" maxlength="120" autocomplete="name" value="${esc(Backend.name||"")}" placeholder="You, your channel or your company"></div>
    <label class="tick agree"><input type="checkbox" id="licOk"><span>Deliver my license right after I pay. I understand that I then lose my 14-day right to withdraw. <a href="#/sales" target="_blank" rel="noopener">Terms of sale</a> · <a href="#/license" target="_blank" rel="noopener">License terms</a></span></label>
   </div>
   <p class="note" id="paySub" hidden>Premium belongs to an account and renews every month until you cancel, which you can do in your account at any time. You keep your 14-day right to withdraw. <a href="#/sales" target="_blank" rel="noopener">Terms of sale</a></p>
   <p class="note" id="payExcl" hidden>Exclusive rights are agreed one by one. ${mail?`Write to <a href="mailto:${esc(mail)}?subject=${encodeURIComponent("Exclusive rights: "+song.title+" ("+song.id+")")}">${esc(mail)}</a> and name the song.`:"Our contact address is listed on the “Who we are” page before sales open."} Buying usage rights is non-exclusive: the song stays in the catalogue.</p>
   <p class="formmsg" id="licMsg" role="alert"></p>
   <div class="paybar">
     <span class="muted small">You pay on our payment provider's secure page.</span>
     <button class="btn primary" type="submit" id="licPay">Pay</button>
   </div>
  </form>`);
  const form=$("#lic"), msg=$("#licMsg"), btn=$("#licPay"), kindOf=()=>new FormData(form).get("t")||"rent";
  const paint=()=>{ const t=kindOf(); $("#payBuy").hidden=!(t==="rent"||t==="buy"); $("#paySub").hidden=t!=="sub"; $("#payExcl").hidden=t!=="excl"; btn.hidden=t==="excl";
    btn.textContent = t==="sub" ? `Start Premium · ${PRICES.sub.price} a month` : `Pay ${PRICES[t]?PRICES[t].price:""}`; msg.textContent=""; };
  // Only a change of the license type redraws: nothing may move under a finger that is on its way to the tick box.
  form.onchange=e=>{ if(e.target.name==="t") paint(); else if(e.target.id==="licOk" && e.target.checked) msg.textContent=""; }; paint();
  const leave=addr=>{ btn.disabled=true; btn.textContent="Opening the payment page…"; location.href=addr; };
  form.onsubmit=async e=>{ e.preventDefault(); const t=kindOf(); msg.textContent=""; if(t==="excl") return;
    if(t==="sub" && !Backend.user){ premiumDoor(song); return; }
    if(t!=="sub" && !$("#licOk").checked){ msg.textContent="Tick the box above to continue: it lets us deliver your license at once."; $("#licOk").focus(); return; }
    btn.disabled=true;
    try{ leave(await Backend.checkout(t==="sub" ? {kind:"premium"} : {kind:t, song_id:song.id, song_title:song.title, buyer_name:$("#licName").value.trim(), consent:true})); }
    catch(err){ btn.disabled=false; if(err.code==="account"){ premiumDoor(song); return; } msg.textContent=err.message; } };
  const mg=$("#memGet"); if(mg) mg.onclick=async()=>{ mg.disabled=true; $("#memMsg").textContent="";
    try{ const l=await Backend.premiumLicense(song.id, song.title); if(l && l.id){ rememberLicense(l); certModal(l, true); } else throw new Error("That did not work. Try again."); }
    catch(err){ mg.disabled=false; if($("#memMsg")) $("#memMsg").textContent=err.message; } };
}
// Premium belongs to an account: sign in (or create one) inside the window, then go on to the payment.
function premiumDoor(song){
  openModal(`<h2 id="mTitle">Start Premium</h2><p class="muted small">Premium belongs to an account. Sign in or create one, then you go on to the payment.</p><div id="premAuth"></div>`);
  authPanel($("#premAuth"), ()=>{ if(Backend.user){ if(Backend.premium){ closeM(); toast("Premium is already active on this account."); } else openPay(song,"sub"); } });
}
async function hash(str){ try{ const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str)); return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join(""); }catch(e){ let h=0; for(const c of str) h=(h*31+c.charCodeAt(0))>>>0; return h.toString(16).padStart(8,"0").repeat(8);} }
function licenseId(){
  const A="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let out="";
  try{ for(const b of crypto.getRandomValues(new Uint8Array(8))) out+=A[b%32]; }catch(e){ while(out.length<8) out+=A[Math.floor(Math.random()*32)]; }
  return "VL-"+new Date().getFullYear()+"-"+out;
}
const longDate = v => { const d=new Date(v); return isNaN(d) ? "–" : d.toLocaleDateString("en-GB",{dateStyle:"long"}); };
const longDateTime = v => { const d=new Date(v); return isNaN(d) ? "–" : d.toLocaleString("en-GB",{dateStyle:"long",timeStyle:"short"}); };
// The demo certificate (nothing was paid; it lives in this browser only).
async function showCert(song,t){
  const now=new Date(), lic=licenseId(), made=song.created||song.published;
  const fp=await hash([lic,song.id,song.title,made,t,now.toISOString()].join("|"));
  const all=store.list("velora_licenses"); all.push({lic,song:song.id,title:song.title,type:PRICES[t].label,issued:now.toISOString(),songDate:made,fp}); store.set("velora_licenses",all.slice(-50));
  openModal(`<h2 id="mTitle">You're licensed (demo)</h2>
  <div class="cert"><h3>Velora License Certificate</h3><div class="small">Example certificate. Not a real license.</div>
  <dl><dt>License ID</dt><dd><b>${esc(lic)}</b></dd><dt>Song</dt><dd>${esc(song.title)} (${esc(song.id)})</dd><dt>Type</dt><dd>${esc(PRICES[t].label)}</dd>
  <dt>Issued</dt><dd>${longDateTime(now)}</dd><dt>Song created</dt><dd>${longDate(made)}</dd>
  <dt>Rights holder</dt><dd>${holderOf(song)}</dd><dt>Fingerprint</dt><dd class="mono">${esc(fp.slice(0,32))}…</dd></dl></div>
  <div class="row" style="margin-top:14px"><a class="btn primary" href="#/verify?id=${encodeURIComponent(lic)}" id="mVerify">Verify this license</a><button type="button" class="btn" id="mDone">Close</button></div>`);
  $("#mDone").onclick=closeM; $("#mVerify").onclick=e=>{ e.preventDefault(); closeM(); const h="#/verify?id="+encodeURIComponent(lic); if(npOpen) closeNP(false, h); else location.hash=h; };
}
// ---------- Real licenses (written by the server after a payment) ----------
const licBad = l => l.status==="active" ? "" : l.status==="refunded" ? "Refunded. This license is no longer valid." : l.status==="revoked" ? "Withdrawn. This license is no longer valid."
  : "The Premium membership has ended. Content published while it ran stays covered; new content is not.";
function certHTML(l){
  const s=byId(l.song_id), bad=licBad(l);
  return `<div class="cert${bad?" off":""}"><h3>Velora License Certificate</h3>${bad?`<div class="small certbad" role="status">${esc(bad)}</div>`:""}
  <dl><dt>License ID</dt><dd><b>${esc(l.id)}</b></dd><dt>Song</dt><dd>${esc(s?s.title:(l.song_title||"Song"))} (${esc(l.song_id)})</dd><dt>Type</dt><dd>${esc(LIC_NAME[l.type]||l.type)}</dd>
  <dt>Licensed to</dt><dd>${esc(l.buyer_name||"")}</dd><dt>Covers</dt><dd>${esc(l.allowed_use||"")}</dd>
  <dt>Issued</dt><dd>${longDateTime(l.issued_at)}</dd>${l.valid_until?`<dt>Publish by</dt><dd>${longDate(l.valid_until)}</dd>`:""}
  <dt>Rights holder</dt><dd>${s?holderOf(s):esc(CREATOR)}</dd></dl></div>`;
}
// What a buyer can do with a license: get the song file, check the number, keep the page.
function certActions(l){
  const s=byId(l.song_id), ok=l.status==="active";
  return `<div class="row certrow" style="margin-top:14px">${ok&&s&&s.audio?`<button type="button" class="btn primary" data-getsong="${esc(s.id)}">${icon("download")}Download the song</button>`:""}<a class="btn" href="#/verify?id=${encodeURIComponent(l.id)}" data-close-np>Check this number</a><button type="button" class="btn ghost" data-print>Print or save as PDF</button></div>`;
}
function certModal(l, fresh){
  openModal(`<h2 id="mTitle">${fresh?"You're licensed":"Your license"}</h2>${certHTML(l)}${certActions(l)}<p class="muted small" style="margin:12px 0 0">Keep the license number: anyone can check it on the “Verify a license” page.</p>`);
}
// Licenses bought on this device (number and song only), so a buyer without an account finds them again.
function rememberLicense(l){ const all=store.list("velora_bought").filter(x=>x && x.id!==l.id); all.push({id:l.id, song:l.song_id, title:l.song_title||"", at:l.issued_at}); store.set("velora_bought", all.slice(-50)); }
// The song file for a license holder. Same site or the file server: saved as a file; elsewhere it opens in a new tab.
async function getSong(id){
  const s=byId(id); if(!s||!s.audio) return; const src=url(s.audio), name=(s.title||s.id).replace(/[^\w\- ]+/g,"").trim().slice(0,80)+".mp3";
  toast("Getting the song file…");
  try{ const r=await fetch(src); if(!r.ok) throw new Error("no"); const blob=await r.blob(), a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href), 60000); }
  catch(e){ const a=document.createElement("a"); a.href=src; a.download=name; a.target="_blank"; a.rel="noopener"; document.body.appendChild(a); a.click(); a.remove(); }
}
// Back from the payment provider: show the license (or Premium) as soon as the provider's message has arrived.
function thanksView(params){
  const ref=(params.get("ref")||"").slice(0,200), kind=params.get("kind")||"";
  if(!Backend.enabled || !/^[A-Za-z0-9_]{20,200}$/.test(ref)){ main.innerHTML=`<h1 class="pagetitle">Thank you</h1><p class="muted">There is no payment to show here.</p><a class="btn" href="#/">Back to the music</a>`; return; }
  main.innerHTML=`<h1 class="pagetitle">Thank you</h1><div id="thx" aria-live="polite" style="max-width:640px"><p class="muted" role="status">Your payment went through. One moment: your ${kind==="premium"?"Premium":"license"} is being prepared…</p></div>`;
  const box=$("#thx"), alive=()=>box.isConnected && location.hash.startsWith("#/thanks"); let tries=0;
  const late=again=>{ box.innerHTML=`<div class="note">Your payment went through, and the confirmation is still on its way to us. This usually takes less than a minute. Nothing is lost: keep this page open.</div><div class="row" style="margin-top:12px"><button type="button" class="btn primary" id="thxAgain">Check again</button></div>`;
    $("#thxAgain").onclick=()=>{ tries=0; box.innerHTML=`<p class="muted" role="status">Checking…</p>`; again(); }; };
  if(kind==="premium"){
    const tick=async()=>{ if(!alive()) return; try{ await Backend.reload(); }catch(e){} if(!alive()) return;
      if(Backend.premium){ box.innerHTML=`<div class="panel"><h3>Premium is active</h3><p>Every song is now included: open a song, choose “License”, and get its certificate. You can manage or cancel Premium in your account.</p><div class="row"><a class="btn primary" href="#/search">Pick a song</a><a class="btn" href="#/account">Your account</a></div></div>`; return; }
      if(!Backend.user){ box.innerHTML=`<p>Your payment went through. Sign in to see your Premium.</p><div id="thxAuth"></div>`; authPanel($("#thxAuth"), ()=>{ if(alive()){ box.innerHTML=`<p class="muted" role="status">Checking…</p>`; tick(); } }); return; }
      if(++tries<24) setTimeout(tick, 2500); else late(tick); };
    tick(); return;
  }
  const tick=async()=>{ if(!alive()) return; let l=null; try{ l=await Backend.claim(ref); }catch(e){} if(!alive()) return;
    if(l && l.id){ rememberLicense(l);
      box.innerHTML=`<p>Your license is ready. ${Backend.user?"It is also listed in your account.":"Keep the license number. If you create an account with the email address you paid with, your licenses are listed there."}</p>${certHTML(l)}${certActions(l)}<div class="row" style="margin-top:18px"><a class="btn ghost" href="#/song/${encodeURIComponent(l.song_id)}">Back to the song</a></div>`; return; }
    if(++tries<30) setTimeout(tick, 2000); else late(tick); };
  tick();
}

// ---------- Building blocks for the pages ----------
// Every row of songs registers its list, so tapping a song plays that row in order.
let ROWS = {}, rowN = 0;
const PAGE = 50; // long lists show 50 songs at a time, so the page stays fast with 1,000+ songs
const reg = (list,label) => { const k="r"+(++rowN); ROWS[k]={list,label,shown:PAGE}; return k; };
const tile = (s,k) => `<button type="button" class="tile" data-song="${esc(s.id)}" data-list="${k}"><span class="tile-cover" style="${coverStyle(s)}"></span><span class="tile-t">${badge(s)}${esc(s.title)}</span><span class="tile-s">${subOf(s)}</span></button>`;
const hrow = (list,label) => { const k=reg(list,label); return `<div class="hrow">${list.slice(0,24).map(s=>tile(s,k)).join("")}</div>`; };
const srow = (s,k,n) => `<button type="button" class="srow lrow" data-song="${esc(s.id)}" data-list="${k}">${n?`<span class="srow-n">${n}</span>`:""}${srowMeta(s)}${icon("play","srow-i")}</button>`;
function rowsInner(k,numbered){ const r=ROWS[k], part=r.list.slice(0,r.shown);
  return part.map((s,i)=>srow(s,k,numbered?i+1:0)).join("") + (r.list.length>r.shown?`<button type="button" class="btn ghost sm more" data-more="${k}"${numbered?" data-numbered":""}>Show more (${r.list.length-r.shown} left)</button>`:""); }
const rows = (list,label,numbered=false) => { const k=reg(list,label); return `<div class="rows" id="rows-${k}">${rowsInner(k,numbered)}</div>`; };
const circles = list => { const a=list.slice(0,3); while(a.length<3 && list.length) a.push(list[a.length%list.length]); return `<span class="st-circles">${a.map(s=>`<i style="${coverStyle(s)}"></i>`).join("")}</span>`; };
const isDark = hex => { const [, , l]=hexToHsl(hex); return l<52; };
const station = c => { const list=songsIn(c); return `<div class="st-wrap"><button type="button" class="station${isDark(c.color)?" dark":""}" data-station="${esc(c.id)}" style="--st:${safeColor(c.color)}" aria-label="Play ${esc(c.name)} Radio"><span class="st-top">RADIO</span>${circles(list)}<span class="st-name">${esc(c.name)}</span></button><div class="st-sub">${list.slice(0,6).map(s=>esc(s.title)).join(", ")}</div></div>`; };
const head = (title, sub="", link="") => `<div class="row-head"><div><h2>${title}</h2>${sub?`<div class="muted small">${sub}</div>`:""}</div>${link}</div>`;
const pills = active => `<nav class="pillrow" aria-label="Categories"><a class="pill${active?"":" on"}" href="#/"${active?"":' aria-current="page"'}>All</a>${HOME.map(c=>`<a class="pill${active===c.id?" on":""}" href="${catLink(c)}"${active===c.id?' aria-current="page"':""}>${esc(c.name)}</a>`).join("")}</nav>`;
const btile = c => { const n=songsIn(c), s=n[0]; return `<a class="btile" href="${catLink(c)}" style="--st:${safeColor(c.color)}"><b>${esc(c.name)}</b><small>${plural(n.length,"song")}</small>${s?`<i style="${coverStyle(s)}"></i>`:""}</a>`; };
function onAirHTML(){
  const tl=radioTimeline(Date.now(),2), e=tl[0]; if(!e) return "";
  return `<section class="radio-banner"><div class="rb-now"><span class="rb-cover" style="${coverStyle(e.song)}"></span><div><div class="onair">Velora Radio · on air</div><h2>${esc(e.song.title)}</h2><div class="muted small">${esc(e.slot.name)} · the same station for everyone, non-stop</div></div></div><button type="button" class="btn primary" data-radio>${icon("play")}Listen live</button></section>`;
}

// ---------- Pages ----------
function home(){
  if(!S.length){ main.innerHTML=`<h1 class="pagetitle">Velora</h1><p class="muted">The songs are on their way.</p>`; return; }
  const today=dayShuffle(S), pick=today.find(s=>!isAdult(s))||today[0], rec=recents(), base=rec[0]||today[1]||pick, kPick=reg(today,"Today's pick");
  const intro = !SALES || store.get("velora_intro_seen",false) ? "" : `<section class="intro" id="intro"><div><b>Full songs you can use in your videos.</b><span>Listen free. Rent a song from ${esc(PRICES.rent.price)} or buy the rights; every license comes with a certificate.</span></div><div class="intro-actions"><a class="btn sm primary" href="#/pricing">How it works</a><button type="button" class="btn sm ghost" id="introX">Got it</button></div></section>`;
  main.innerHTML = `
  ${pills(null)}${intro}
  <section class="feat">
    <button type="button" class="feat-cover" data-song="${esc(pick.id)}" data-list="${kPick}" style="${coverStyle(pick)}" aria-label="Play ${esc(pick.title)}"></button>
    <div class="feat-t"><div class="muted small">Today's pick</div><h2>${esc(pick.title)}</h2><div class="muted">${badge(pick)}${subOf(pick)} · ${esc(pick.mood)}</div>
      <div class="feat-actions"><button type="button" class="icon-btn" data-lic="${esc(pick.id)}" aria-label="License ${esc(pick.title)}">${icon("tag")}</button><button type="button" class="round-play" data-song="${esc(pick.id)}" data-list="${kPick}" aria-label="Play ${esc(pick.title)}">${icon("play")}</button></div></div>
  </section>
  <section>${head("Recommended for today")}${hrow(today,"Recommended for today")}</section>
  ${onAirHTML()}
  <section>${head("Recommended Stations")}<div class="hrow st-row">${HOME.map(station).join("")}</div></section>
  ${banner("home")}
  ${rec.length?`<section>${head("Recents")}${hrow(rec,"Recents")}</section>`:""}
  <section><div class="morelike"><span class="ml-cover" style="${coverStyle(base)}"></span><div><div class="muted small">More like</div><h2>${esc(base.title)}</h2></div></div>${hrow(suggestions(base,8),"More like "+base.title)}</section>
  ${HOME.map(c=>`<section>${head(esc(c.name),plural(songsIn(c).length,"song"),`<a class="showall" href="${catLink(c)}" aria-label="Show all ${esc(c.name)}">Show all</a>`)}${hrow(songsIn(c),c.name)}</section>`).join("")}
  ${S.some(s=>s.video||s.clip)?`<section>${head("Videos","",`<a class="showall" href="#/videos" aria-label="Show all videos">Show all</a>`)}<div class="hrow vrow">${shortTiles()}</div></section>`:""}
  ${SALES?`<section>${head("Three ways to use the music")}${tiersHTML()}</section>`:""}`;
  const x=$("#introX"); if(x) x.onclick=()=>{ store.set("velora_intro_seen",true); $("#intro").remove(); };
}
// Vertical shorts and wide (16:9) music videos. Wide videos are ready in the code; add "clip" to a song to show one.
const vidTile = (s,wide) => `<button type="button" class="vid${wide?" wide":""}" data-video="${esc(s.id)}"${wide?" data-wide":""} style="background:#141418 ${cssUrl((wide?s.clipPoster:s.poster)||s.art||"")} center/cover no-repeat" aria-label="Watch ${esc(s.title)}"><span class="yt">${icon("play")}${wide?"Music video":"Short"}</span><span class="ov"><b>${esc(s.title)}</b><span class="small muted">${subOf(s)}</span></span></button>`;
const shortTiles = () => S.filter(s=>s.video).map(s=>vidTile(s,false)).join("");
function openVideo(s, wide){
  const src=wide?s.clip:(s.video||s.clip); if(!s||!src) return;
  audio.pause();
  openModal(`<h2 id="mTitle">${esc(s.title)}</h2><video class="mvideo${wide||!s.video?" wide":""}" src="${esc(url(src))}" controls autoplay playsinline disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"></video><div class="row" style="margin-top:12px"><button type="button" class="btn primary" data-lic="${esc(s.id)}">License this song</button><a class="btn ghost" href="#/song/${encodeURIComponent(s.id)}" id="mSong">Song page</a></div>`);
  $("#mSong").onclick=closeM;
}
function tiersHTML(){ return `<div class="tiers">
  <div class="tier"><h3>Rent a track</h3><div class="price">${esc(PRICES.rent.price)}</div><div class="muted small">${esc(PRICES.rent.per)}</div><ul><li>One song, one channel</li><li>Perfect for a single video or campaign</li><li>Dated certificate</li></ul><a class="btn" href="#/search">Pick a song</a></div>
  <div class="tier feat-tier"><h3>Buy usage rights</h3><div class="price">${esc(PRICES.buy.price)}</div><div class="muted small">${esc(PRICES.buy.per)}</div><ul><li>Use it forever, non-exclusive</li><li>The song stays in the catalogue</li><li>Exclusive available on request</li><li>Dated certificate</li></ul><a class="btn primary" href="#/search">Pick a song</a></div>
  <div class="tier"><h3>Premium</h3><div class="price">${esc(PRICES.sub.price)}</div><div class="muted small">${esc(PRICES.sub.per)}</div><ul><li>Every song, for content you publish while a member</li><li>Radio and songs without ads</li><li>Every category, every new release</li><li>Cancel anytime</li></ul><button type="button" class="btn blue" data-sub>Start Premium${dTag()}</button></div>
 </div>${payDemo()?'<p class="muted small">Example prices and terms.</p>':""}`; }

// Search: the categories ("Browse all") and every song; typing filters by title, artist, genre, mood or lyric.
let searchQ = "";
function searchView(params){
  if(params.get("q")!==null) searchQ=params.get("q").slice(0,80);
  main.innerHTML=`<h1 class="pagetitle">Search</h1>
  <div class="sbox">${icon("search")}<label for="libq" class="sr">Search songs</label><input id="libq" type="search" autocomplete="off" maxlength="80" enterkeyhint="search" placeholder="Songs, artists, genres, moods, lyrics" value="${esc(searchQ)}"></div>
  <div id="sres" aria-live="polite"></div>`;
  const lq=$("#libq"); lq.addEventListener("input",e=>{ searchQ=e.target.value; $("#q").value=searchQ; drawSearch(); });
  drawSearch();
  if(params.get("focus")==="search") setTimeout(()=>{ try{ lq.focus(); }catch(e){} },60);
}
function drawSearch(){
  const box=$("#sres"); if(!box) return;
  ROWS={}; rowN=0;
  if(!norm(searchQ)){
    const act=ARTISTS.filter(a=>songsBy(a).length);
    box.innerHTML=`<h2 class="sh">Browse all</h2><div class="browse">${BROWSE.map(btile).join("")}</div>${act.length?`<h2 class="sh">Artists</h2><div class="hrow arow">${act.map(artistTile).join("")}</div>`:""}
    <h2 class="sh">All songs <span class="muted small">${S.length}</span></h2>${rows(S,"All songs")}`;
    return;
  }
  const r=search(searchQ);
  box.innerHTML = (r.artists.length?`<div class="hrow arow" style="margin-top:14px">${r.artists.map(artistTile).join("")}</div>`:"")
    + (r.cats.length?`<div class="chips" style="margin-top:14px">${r.cats.map(c=>`<a class="chip cat-chip" href="${catLink(c)}" style="--st:${safeColor(c.color)}">${esc(c.name)} · ${songsIn(c).length}</a>`).join("")}</div>`:"")
    + (r.songs.length?`<div class="muted small" style="margin:10px 0 8px">${plural(r.songs.length,"song")}${r.lyricHit.size?" · some found in the lyrics":""}</div>${rows(r.songs,"Search: "+searchQ)}`
    : r.artists.length||r.cats.length ? "" : `<p class="muted" style="margin-top:16px">No results for “${esc(searchQ)}”. Try a song title, an artist, or a word like ${HOME.slice(0,3).map(c=>esc(c.name)).join(", ")}.</p>`);
}
const artistTile = a => `<a class="atile" href="${artistLink(a)}"><span class="atile-img" style="${artistArt(a)}"></span><b>${esc(a.name)}</b><small>Artist</small></a>`;
function artistView(id){
  const a=artistById(id); if(!a){ notFound("Artist"); return; }
  const list=songsBy(a), cats=[...new Set(list.map(s=>s.genre))], latest=list.slice().sort((x,y)=>String(y.created||y.published||"").localeCompare(String(x.created||x.published||"")));
  main.innerHTML=`<section class="ahead" style="${artistArt(a)}"><div class="ahead-in"><h1>${esc(a.name)}</h1>${a.tagline?`<div class="ahead-tag">${esc(a.tagline)}</div>`:""}</div></section>
  <div class="muted small" style="margin-top:12px">${plural(list.length,"song")} · ${cats.map(esc).join(", ")}</div>
  <div class="ghead-actions"><button type="button" class="round-play" id="aPlay" aria-label="Play ${esc(a.name)}">${icon("play")}</button><button type="button" class="icon-btn" id="aShuffle" aria-label="Shuffle ${esc(a.name)}">${icon("shuffle")}</button><button type="button" class="btn ghost sm" id="aShare">${icon("share")}Share</button></div>
  <section>${head("Popular")}${rows(list,a.name,true)}</section>
  ${latest.length?`<section>${head("Releases")}${hrow(latest,a.name+" · releases")}</section>`:""}
  <section>${head("About")}<div class="about-card"><div class="about-img" style="${artistArt(a)}"></div><div class="about-body"><b>${esc(a.name)}</b><small>${plural(list.length,"song")} on Velora</small>${a.bio?`<p>${esc(a.bio)}</p>`:""}${Array.isArray(a.facts)&&a.facts.length?`<dl class="afacts">${a.facts.map(f=>`<dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd>`).join("")}</dl>`:""}</div></div></section>
  <section>${head("Credits")}<div class="panel" style="margin-top:0">${artistCredits(a,list).map(creditRow).join("")}</div></section>`;
  $("#aPlay").onclick=()=>playList(list, a.name, false);
  $("#aShuffle").onclick=()=>playList(list, a.name+" · shuffle", true);
  $("#aShare").onclick=()=>shareLink(a.name+" on Velora", pageLink(artistLink(a)));
}
const notFound = what => { main.innerHTML=`<h1 class="pagetitle">${what} not found</h1><p class="muted">It may have moved.</p><a class="btn primary" href="#/">Back to Home</a>`; };
function genreView(id){
  const c=catById(id); if(!c){ notFound("Category"); return; }
  const list=songsIn(c), total=list.reduce((a,s)=>a+(s.duration||0),0);
  main.innerHTML=`${pills(c.id)}
  <section class="ghead" style="--st:${safeColor(c.color)}"><div class="muted small">${kindLabel(c)}</div><h1>${esc(c.name)}</h1>
   <div class="muted small">${plural(list.length,"song")} · ${Math.round(total/60)} min${list.some(s=>s.explicit)?" · some songs have explicit lyrics":""}</div>
   <div class="ghead-actions"><button type="button" class="round-play" id="gPlay" aria-label="Play ${esc(c.name)}">${icon("play")}</button><button type="button" class="icon-btn" id="gShuffle" aria-label="Shuffle ${esc(c.name)}">${icon("shuffle")}</button><button type="button" class="btn ghost sm" data-station="${esc(c.id)}">${icon("radio")}${esc(c.name)} Radio</button></div></section>
  ${rows(list,c.name,true)}
  <section>${head("More to explore")}<div class="browse">${BROWSE.filter(x=>x!==c).map(btile).join("")}</div></section>`;
  $("#gPlay").onclick=()=>playList(list, c.name, false);
  $("#gShuffle").onclick=()=>playList(list, c.name+" · shuffle", true);
}
// An uploaded song carries a dated ownership record, written by the server at the moment it was published.
function recordPanel(s){
  const r=s.record;
  return `<div class="panel prov"><div class="seal" aria-hidden="true">✓</div><div><h3 style="margin-bottom:4px">Ownership record${r&&r.id?" no. "+esc(r.id):""}</h3>
    <div class="small">${r&&r.at?`Recorded <b>${longDateTime(r.at)}</b> · `:""}rights holder <b>${esc(s.holder||"the uploader")}</b> · ID ${esc(s.id)}</div>
    <div class="muted small">${madeBy(s)}</div>
    ${r&&r.hash?`<div class="muted small mono" style="overflow-wrap:anywhere">Fingerprint ${esc(r.hash.slice(0,32))}…</div><button type="button" class="linkbtn" data-record="${esc(s.id)}">Show the full record</button>`:""}</div></div>`;
}
async function openRecord(s){
  openModal(`<h2 id="mTitle">Ownership record</h2><p class="muted" role="status">One moment…</p>`);
  let rows; try { rows=await Backend.open("song_record",{p_song:s.id}); } catch(e){ rows=null; }
  if($("#modal").hidden) return;
  const dd=(k,v,mono)=>v?`<dt>${k}</dt><dd${mono?' class="mono"':""}>${esc(v)}</dd>`:"", kind={published:"Published",unlisted:"Taken off the list",relisted:"Put back on the list"};
  openModal(`<h2 id="mTitle">Ownership record</h2><p class="muted small" style="margin-top:-6px">${esc(s.title)} · ${subOf(s)}</p>
   ${Array.isArray(rows)&&rows.length?rows.map(x=>{ const d=x.details||{}; return `<div class="cert rec"><h3>No. ${esc(x.id)} · ${esc(kind[x.kind]||x.kind)}</h3><dl>${dd("Song",x.title)}${dd("Artist",x.artist)}${dd("Rights holder",x.holder)}${dd("Recorded",longDateTime(x.at))}${dd("Original file",d.original_sha256,1)}${dd("Streamed file",d.audio_sha256,1)}${dd("Cover",d.cover_sha256,1)}${dd("Lyrics",d.lyrics_sha256,1)}${dd("This record",x.hash,1)}${dd("Record before it",x.prev,1)}</dl></div>`; }).join(""):`<p class="muted">The record could not be loaded right now. Try again in a moment.</p>`}
   <p class="muted small">Each long code is a fingerprint (SHA-256): only that exact file produces it, so anyone holding the file can check it against this record. Every record also carries the fingerprint of the one before it, so none can be changed or removed later without it showing. This is evidence of what was uploaded and when; it is not a copyright registration.</p>`);
}
function song(id){
  const s=byId(id); if(!s){ notFound("Song"); return; }
  if(isAdult(s) && age()==="minor"){ main.innerHTML=`<h1 class="pagetitle">For adults only</h1><p class="muted">This song is hidden on this device. You can change that in Settings.</p><div class="row"><a class="btn primary" href="#/">Back to Home</a><a class="btn ghost" href="#/settings">Settings</a></div>`; return; }
  const d=s.duration, c=catByName(s.genre), secs=s.sections||[], more=S.filter(x=>x!==s && catsOf(s).some(k=>inCat(x,k)));
  main.innerHTML=`<div class="split"><div>${cover(s,"cover song-cover")}</div><div>
   <div class="muted small">${catsOf(s).map(k=>`<a href="${catLink(k)}">${esc(k.name)}</a>`).join(" · ")}${s.mood && !catsOf(s).some(k=>k.name===s.mood)?" · "+esc(s.mood):""}</div><h1>${esc(s.title)}</h1>${artistOf(s)?`<div class="song-artist"><a href="${artistLink(artistOf(s))}">${esc(artistOf(s).name)}</a></div>`:""}${s.explicit?`<div class="muted">${eb(s)}Explicit lyrics</div>`:""}
   <div class="facts"><div class="fact"><b>Length</b>${fmt(d)}</div>${s.bpm?`<div class="fact"><b>BPM</b>${esc(s.bpm)}</div>`:`<div class="fact"><b>Language</b>${esc(s.language||"–")}</div>`}${s.key?`<div class="fact"><b>Key</b>${esc(s.key)}</div>`:""}${s.subgenre?`<div class="fact"><b>Style</b>${esc(s.subgenre)}</div>`:""}<div class="fact"><b>${s.created?"Created":"Added"}</b>${esc(s.created||s.published||"–")}</div></div>
   <div class="row"><button type="button" class="btn primary" data-play="${esc(s.id)}" data-np>${icon("play")}Play full song</button><button type="button" class="btn red" data-lic="${esc(s.id)}">Rent ${esc(PRICES.rent.price)}</button><button type="button" class="btn blue" data-lic="${esc(s.id)}" data-pre="buy">Buy rights ${esc(PRICES.buy.price)}</button>${s.video||s.clip?`<button type="button" class="btn ghost" data-video="${esc(s.id)}">Watch video</button>`:""}<button type="button" class="btn ghost" data-share="${esc(s.id)}">${icon("share")}Share</button></div>
   <div class="panel"><h3>Lyrics</h3>${!playable(s)?`<p class="muted" style="margin-top:0">This song is for adults. The lyrics show once you confirm your age.</p><button type="button" class="btn sm" data-age>I'm 18 or older</button>`:hasLyrics(s)?`<p class="muted small" style="margin-top:0">${esc(s.lyricsNote||"")} Tap a line to play from there.</p><div class="plyr">${lyricLines(s,"button",t=>`type="button" data-play="${esc(s.id)}" data-at="${t}" data-np`)}</div>`:`<p class="muted">Lyrics coming soon.</p>`}</div>
   <div class="panel"><h3>Song map</h3><p class="muted small">Where each part starts and ends. Tap to jump there.</p>
    <div class="schedule">${secs.map((x,j)=>`<button type="button" class="slot tap" data-play="${esc(s.id)}" data-at="${+x.start||0}"><span>${esc(x.name)}${x.start===s.bestPart?" · best part":""}</span><span class="muted">${fmt(x.start)} – ${fmt((secs[j+1]||{start:d}).start)}</span></button>`).join("")}</div></div>
   ${s.uploaded?recordPanel(s):`<div class="panel prov"><div class="seal" aria-hidden="true">✓</div><div><h3 style="margin-bottom:4px">Provenance record</h3><div class="small">${s.created?"Made with Suno · created":"Made with Suno · added"} <b>${longDate(s.created||s.published)}</b> · catalogue ID ${esc(s.id)}</div><div class="muted small">Lyrics and song design by ${esc(CREATOR)}. Each license gets a dated certificate you can check on the Verify page.</div></div></div>`}
  </div></div>
  ${more.length?`<section>${head("More like this",c?`<a href="${catLink(c)}">${esc(c.name)}</a>`:"")}${hrow(more,"More like "+s.title)}</section>`:""}`;
}
function radioView(){
  const now=slotNow(), tl=radioTimeline(Date.now(),4);
  main.innerHTML=`<h1 class="pagetitle">Velora Radio</h1><p class="muted">One station, non-stop. Everyone hears the same song at the same moment, like a radio in the car. Connect your phone to the car and press play.</p>
  ${onAirHTML()}
  ${tl.length>1?`<section>${head("Coming up")}<div class="rows">${tl.slice(1).map(e=>`<div class="srow static"><span class="srow-n wide">${fmtClock(e.startsAt)}</span>${srowMeta(e.song)}</div>`).join("")}</div></section>`:""}
  <section>${head("Today on the radio",`Station time: ${esc(TZ.split("/").pop().replace(/_/g," "))}`)}
  <div class="schedule" style="max-width:640px">${RADIO.map(r=>`<div class="slot ${r===now?"live":""}"><span>${String(r.from%24).padStart(2,"0")}:00–${String(r.to%24).padStart(2,"0")}:00 · <b>${esc(r.name)}</b>${r===now?' <em class="livetag">on air</em>':""}</span><span class="muted">${r.cats.map(esc).join(" + ")}</span></div>`).join("")}</div></section>
  <section>${head("Stations","Pick a mood. These play just for you.")}<div class="hrow st-row">${HOME.map(station).join("")}</div></section>`;
}
function videosView(){
  const wide=S.filter(s=>s.clip), shorts=S.filter(s=>s.video);
  main.innerHTML=`<h1 class="pagetitle">Videos</h1>
  <section>${head("Music videos","Full videos, wide like on YouTube")}
   ${wide.length?`<div class="wgrid">${wide.map(s=>vidTile(s,true)).join("")}</div>`
   :`<div class="wgrid">${[0,1,2].map(()=>`<div class="vid wide empty" aria-hidden="true">${icon("video")}</div>`).join("")}</div><p class="muted small">The first music videos are coming soon.</p>`}</section>
  <section>${head("Shorts","Vertical videos of the songs")}
   ${shorts.length?`<div class="videos">${shortTiles()}</div>`:`<p class="muted small">Shorts are coming soon.</p>`}</section>`;
}
function pricing(){ main.innerHTML=`<h1 class="pagetitle">Pricing</h1><p class="muted">Three simple ways to use the music.</p>${tiersHTML()}
 <div class="row-head" style="margin-top:28px"><h2>Questions</h2></div><div class="faq">
 <details open><summary>If I buy a song, is it only mine?</summary><p>No, buying usage rights is non-exclusive. The song stays in the Velora catalogue and others can license it too. If you need it to be yours alone, request Exclusive rights and the song will be removed for new buyers only when you ask.</p></details>
 <details><summary>What does renting cover?</summary><p>One piece of content on one channel, published within the rental time. Once it is published in time it may stay online.${payDemo()?" Example terms.":` The full text is in the <a href="#/license">License terms</a>.`}</p></details>
 <details><summary>How do I prove I have a license?</summary><p>Every license comes with a dated certificate and an ID anyone can check on the <a href="#/verify">Verify page</a>.</p></details>
 <details><summary>Is the radio free?</summary><p>Yes. The radio and full-song listening are free. Premium is for using the songs in your own videos, and for listening without ads once ads start.</p></details>
 <details><summary>Who makes the music?</summary><p>${esc(CREATOR)} writes the lyrics, concepts and song design, and produces the music with Suno (AI-assisted).</p></details></div>`; }
function verify(params){
  const id=(params.get("id")||"").slice(0,40), mine=store.list("velora_bought").filter(x=>x && typeof x.id==="string").slice(-10).reverse();
  main.innerHTML=`<h1 class="pagetitle">Verify a license</h1><p class="muted">Enter a license ID to see its record and date.</p><form id="vf" class="row" style="max-width:560px"><div class="field" style="flex:1;margin:0"><label for="vid" class="sr">License ID</label><input id="vid" maxlength="40" autocomplete="off" autocapitalize="characters" placeholder="VL-2026-XXXXXXXX" value="${esc(id)}"></div><button class="btn primary">Verify</button></form><div id="vr" style="margin-top:18px;max-width:640px" aria-live="polite"></div>
  ${mine.length?`<div class="panel" style="max-width:640px"><h3>Bought on this device</h3><div class="schedule">${mine.map(x=>{ const sg=byId(x.song); return `<a class="slot tap" href="#/verify?id=${encodeURIComponent(x.id)}"><span><b>${esc(sg?sg.title:(x.title||x.song||""))}</b></span><span class="muted">${esc(x.id)}</span></a>`; }).join("")}</div></div>`:""}`;
  const box=$("#vr"), none=extra=>`<div class="note">No license found with that ID.${extra||""}</div>`;
  const run=async()=>{ const v=$("#vid").value.trim().toUpperCase(); if(!v){ box.innerHTML=""; return; }
    const rec=store.list("velora_licenses").find(r=>r && r.lic===v);       // a demo license made in this browser
    if(rec){ box.innerHTML=`<div class="cert"><h3>Valid license (demo)</h3><dl><dt>License ID</dt><dd>${esc(rec.lic)}</dd><dt>Song</dt><dd>${esc(rec.title)} (${esc(rec.song)})</dd><dt>Type</dt><dd>${esc(rec.type)}</dd><dt>Issued</dt><dd>${longDateTime(rec.issued)}</dd><dt>Song created</dt><dd>${longDate(rec.songDate)}</dd></dl></div>`; return; }
    if(!/^VL-[0-9]{4}-[A-Z0-9]{8,24}$/.test(v)){ box.innerHTML=`<div class="note">A license ID looks like VL-2026-AB12CD34EF.</div>`; return; }
    if(!Backend.enabled){ box.innerHTML=none(payDemo()?" In this preview, licenses are only stored in the browser that made them.":""); return; }
    box.innerHTML=`<p class="muted" role="status">Checking the register…</p>`;
    let l=null, down=false; try{ l=await Backend.verify(v); }catch(e){ down=true; }
    const now=$("#vid"); if(!box.isConnected || !now || now.value.trim().toUpperCase()!==v) return;
    box.innerHTML = down ? `<div class="note">The license register can't be reached right now. Try again in a moment.</div>`
      : l && l.id ? `<p class="verdict ${l.status==="active"?"ok":"bad"}">${l.status==="active"?icon("check")+"Valid license":"Not valid any more"}</p>${certHTML(l)}`
      : none(payDemo()?" In this preview, demo licenses are only stored in the browser that made them.":""); };
  $("#vf").onsubmit=e=>{e.preventDefault();run();}; if(id) run();
}
// ---------- Sign-in, the account page and Settings ----------
// Sign-in is for the owner (and later for creators). Listening never needs an account.
const pwField = (id,label,auto,min=8) => `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="password" required minlength="${min}" maxlength="200" autocomplete="${auto}"></div>`;
// Sign in, create an account, confirm the email, forgotten password. opts.owner: also offer the one-time owner setup (the upload door).
let linkNote = null;                       // set when the visitor arrives from a link in an email (see Backend.fromLink)
const ACC = CFG.accounts || {}, MIN_PW = Math.max(8, ACC.minPassword || 10);
function authPanel(box, done, opts){
  opts = opts || {};
  if(!Backend.enabled){ box.innerHTML=`<div class="panel"><h3>Accounts open soon</h3><p class="muted small" style="margin:0">The account server is not connected yet. Listening works without an account.</p></div>`; return; }
  const canJoin = ACC.signup !== false;
  const sharedNote = Backend.shared ? `<p class="muted small" style="margin:10px 0 0">On this test address you sign in again after a reload.</p>` : "";
  const emailField = (id, v) => `<div class="field"><label for="${id}">Email</label><input id="${id}" type="email" required maxlength="254" autocomplete="username" inputmode="email" value="${esc(v||"")}"></div>`;
  const links = a => `<div class="authlinks">${a.map(([id,t])=>`<button type="button" class="linkbtn" id="${id}">${t}</button>`).join("")}</div>`;
  // One form at a time: while it is sent the button waits; whatever goes wrong is said in plain words under it.
  const send = (form, f) => { form.onsubmit = async e => { e.preventDefault(); const btn=form.querySelector("button[type=submit]"), msg=form.querySelector(".formmsg"); btn.disabled=true; msg.textContent="";
    try{ await f(msg); }catch(err){ if(msg.isConnected) msg.textContent=err.message; } finally{ btn.disabled=false; } }; };
  const signIn = (email) => {
    box.innerHTML=`<div class="panel auth"><h3>Sign in</h3><p class="muted small" style="margin-top:-4px">Listening needs no account.</p>
     <form id="si">${emailField("em", email)}${pwField("pw","Password","current-password",1)}
     <button class="btn primary" type="submit">Sign in</button><p id="siMsg" class="formmsg" role="alert"></p></form>
     ${links([["toForgot","Forgot your password?"]].concat(canJoin?[["toJoin","New here? Create an account"]]:[], opts.owner?[["toSetup","First time here? Set up the owner account"]]:[]))}${sharedNote}</div>`;
    $("#toForgot").onclick=()=>forgot($("#em").value);
    if($("#toJoin")) $("#toJoin").onclick=join;
    if($("#toSetup")) $("#toSetup").onclick=setup;
    send($("#si"), async () => { const em=$("#em").value.trim(), pw=$("#pw").value;
      try{ await Backend.signIn(em, pw); }catch(err){ if(err.code==="unconfirmed"){ confirmStep(em, pw); return; } throw err; }
      if(done) done(); });
  };
  const join = () => {
    box.innerHTML=`<div class="panel auth"><h3>Create your account</h3><p class="muted small" style="margin-top:-4px">Free. It keeps your licenses in one place. Listening needs no account.</p>
     <form id="ju"><div class="field"><label for="jnm">Your name</label><input id="jnm" type="text" required maxlength="80" autocomplete="name"></div>${emailField("jem")}
     ${pwField("jpw",`Password <span class="muted">(${MIN_PW} characters or more)</span>`,"new-password",MIN_PW)}
     <label class="tick agree"><input type="checkbox" id="jok" required><span>I agree to the <a href="#/terms" target="_blank" rel="noopener">Terms of use</a> and have read the <a href="#/privacy" target="_blank" rel="noopener">Privacy policy</a>.</span></label>
     <button class="btn primary" type="submit">Create account</button><p id="juMsg" class="formmsg" role="alert"></p></form>
     ${links([["toSignIn","I already have an account: sign in"]])}${sharedNote}</div>`;
    $("#toSignIn").onclick=()=>signIn($("#jem").value);
    send($("#ju"), async msg => { const em=$("#jem").value.trim(), pw=$("#jpw").value;
      if(pw.length<MIN_PW){ msg.textContent=`Use ${MIN_PW} characters or more.`; return; }
      const r=await Backend.signUp({name:$("#jnm").value, email:em, password:pw});
      if(r==="in"){ toast("Welcome to Velora."); if(done) done(); }
      else if(r==="exists") msg.textContent="This email already has an account. Sign in, or reset the password.";
      else confirmStep(em, pw); });
  };
  const confirmStep = (email, pw) => {
    box.innerHTML=`<div class="panel auth"><h3>Confirm your email</h3><p class="small">We sent an email to <b>${esc(email)}</b>. Open it and tap the link, then come back here. If the email shows a code, enter it below.</p>
     <form id="cf"><div class="field"><label for="ccode">Code from the email <span class="muted">(if it shows one)</span></label><input id="ccode" type="text" inputmode="numeric" maxlength="10" autocomplete="one-time-code" spellcheck="false"></div>
     <button class="btn primary" type="submit">I confirmed: sign me in</button><p id="cfMsg" class="formmsg" role="alert"></p></form>
     ${links([["reSend","Send the email again"],["toSignIn","Back to sign in"]])}</div>`;
    $("#toSignIn").onclick=()=>signIn(email);
    $("#reSend").onclick=async e=>{ const b=e.currentTarget; b.disabled=true; try{ await Backend.resend(email); toast("Sent again. Look in your inbox."); }catch(err){ $("#cfMsg").textContent=err.message; } finally{ b.disabled=false; } };
    send($("#cf"), async () => { const code=$("#ccode").value.trim();
      if(code) await Backend.confirmEmail(email, code);
      else { try{ await Backend.signIn(email, pw); }catch(err){ if(err.code==="unconfirmed") throw new Error("Not confirmed yet. Tap the link in the email first, or enter its code."); throw err; } }
      toast("Welcome to Velora."); if(done) done(); });
  };
  const forgot = (email) => {
    box.innerHTML=`<div class="panel auth"><h3>Reset your password</h3><p class="muted small" style="margin-top:-4px">Enter your email and we send you a message to choose a new password.</p>
     <form id="fg">${emailField("fem", email)}<button class="btn primary" type="submit">Send the email</button><p id="fgMsg" class="formmsg" role="alert"></p></form>
     ${links([["toSignIn","Back to sign in"]])}</div>`;
    $("#toSignIn").onclick=()=>signIn($("#fem").value);
    send($("#fg"), async () => { const em=$("#fem").value.trim(); await Backend.sendReset(em); resetStep(em); });
  };
  const resetStep = (email) => {
    box.innerHTML=`<div class="panel auth"><h3>Choose a new password</h3><p class="small">If <b>${esc(email)}</b> has an account, an email is on its way. Tap its link to continue from there. Or, if the email shows a code, enter it here.</p>
     <form id="rs"><div class="field"><label for="rcode">Code from the email</label><input id="rcode" type="text" required inputmode="numeric" maxlength="10" autocomplete="one-time-code" spellcheck="false"></div>
     ${pwField("rpw",`New password <span class="muted">(${MIN_PW} characters or more)</span>`,"new-password",MIN_PW)}
     <button class="btn primary" type="submit">Save the new password</button><p id="rsMsg" class="formmsg" role="alert"></p></form>
     ${links([["reSend","Send the email again"],["toSignIn","Back to sign in"]])}</div>`;
    $("#toSignIn").onclick=()=>signIn(email);
    $("#reSend").onclick=async e=>{ const b=e.currentTarget; b.disabled=true; try{ await Backend.sendReset(email); toast("Sent again. Look in your inbox."); }catch(err){ $("#rsMsg").textContent=err.message; } finally{ b.disabled=false; } };
    send($("#rs"), async msg => { const pw=$("#rpw").value; if(pw.length<MIN_PW){ msg.textContent=`Use ${MIN_PW} characters or more.`; return; }
      await Backend.resetWithCode(email, $("#rcode").value, pw); toast("Password changed. You are signed in."); if(done) done(); });
  };
  const setup = () => {
    box.innerHTML=`<div class="panel auth"><h3>Set up the owner account</h3><p class="muted small" style="margin-top:-4px">This works once. It creates the account that can upload and manage the songs.</p>
     <form id="su"><div class="field"><label for="snm">Your name <span class="muted">(shown as the rights holder)</span></label><input id="snm" type="text" required maxlength="80" autocomplete="name"></div>
     <div class="field"><label for="sem">Email</label><input id="sem" type="email" required maxlength="254" autocomplete="username" inputmode="email"></div>
     ${pwField("spw","Password <span class=\"muted\">(12 characters or more)</span>","new-password",12)}${pwField("spw2","Password again","new-password",12)}
     <div class="field"><label for="scode">Setup code</label><input id="scode" type="text" required maxlength="80" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false"></div>
     <button class="btn primary" type="submit">Create the owner account</button><p id="suMsg" class="formmsg" role="alert"></p></form>
     ${links([["toSignIn","I already have the account: sign in"]])}${sharedNote}</div>`;
    $("#toSignIn").onclick=()=>signIn();
    send($("#su"), async msg => { const pw=$("#spw").value;
      if(pw!==$("#spw2").value){ msg.textContent="The two passwords are not the same."; return; }
      if(pw.length<12){ msg.textContent="Use 12 characters or more."; return; }
      await Backend.ownerSetup({name:$("#snm").value.trim(), email:$("#sem").value.trim(), password:pw, code:$("#scode").value.trim()}); await Backend.signIn($("#sem").value, pw); toast("The owner account is ready."); if(done) done(); });
  };
  if(opts.start==="join" && canJoin) join(); else signIn();
}
const privacyPanel = () => `<div class="panel"><h3>Your privacy</h3><p class="small">Velora uses no tracking and no advertising cookies. This browser only remembers the songs you played recently, ${AGE_GATE?"your answer to the age question":"your choice about explicit songs"}${payDemo()?" and the demo licenses you made":shopOpen()?" and the numbers of the licenses bought on it":""}, on this device.</p><button type="button" class="btn ghost sm" id="wipe">Clear what this browser remembers</button></div>`;
const wireWipe = () => { const w=$("#wipe"); if(w) w.onclick=()=>{ store.wipe(); applyAge(); toast("Cleared."); route(true); }; };
function accountView(){
  if(!Backend.enabled){
    main.innerHTML=`<h1 class="pagetitle">Your account</h1>
    <div class="panel"><h3>Accounts open soon</h3><p>With an account you will find here:</p><ul class="plain"><li>your licenses and certificates</li><li>Premium: your subscription and listening without ads</li><li>the songs you saved</li></ul><p class="muted small" style="margin-bottom:0">Listening already works without an account.</p></div>${privacyPanel()}`;
    wireWipe(); return;
  }
  main.innerHTML=`<h1 class="pagetitle">Your account</h1><div id="acct" aria-live="polite"><p class="muted">One moment…</p></div>${privacyPanel()}`; wireWipe();
  Backend.init().then(async ()=>{
    const box=$("#acct"); if(!box) return; const u=Backend.user, note=linkNote;
    if(note && u && (note.error || note.type!=="recovery")) linkNote=null;       // a note stays while it still has something to say
    const again=()=>{ if(location.hash.startsWith("#/account")) accountView(); };
    if(!u){
      box.innerHTML=`${note&&note.error?`<div class="panel"><p class="small" style="margin:0" role="alert">${esc(note.error)}</p></div>`:""}<div id="acctAuth"></div>`;
      authPanel($("#acctAuth"), again); return;
    }
    if(note && !note.error && note.type!=="recovery") toast("Your email is confirmed. You are signed in.");
    if(shopOpen()) await Backend.linkPurchases();      // bought before signing in, with this email: now in the account
    const lic=await Backend.licenses(); if(!$("#acct")) return;
    const isOwner=Backend.role==="owner";
    box.innerHTML=`${note&&note.type==="recovery"&&!note.error?`<div class="panel auth" id="newPw"><h3>Choose a new password</h3><p class="small">You came from the email. Set your new password now.</p>
      <form id="npForm">${pwField("np1",`New password <span class="muted">(${MIN_PW} characters or more)</span>`,"new-password",MIN_PW)}<button class="btn primary" type="submit">Save the new password</button><p class="formmsg" role="alert"></p></form></div>`:""}
    <div class="panel"><h3 id="acName">${esc(Backend.name||u.email||"Signed in")}</h3><p class="small">${esc(u.email)} · ${isOwner?"Owner":Backend.canUpload()?"Creator":"Listener"}${Backend.premium?" · Premium":""}</p>
      <div class="row">${Backend.canUpload()?`<a class="btn primary sm" href="#/upload">${icon("upload")}Upload a song</a><a class="btn sm" href="#/studio">My songs</a>`:""}<button type="button" class="btn ghost sm" id="so">Sign out</button></div></div>
    ${Backend.premium?`<div class="panel"><h3>Premium</h3><p class="small">Premium is active: every song is included. It renews every month until you cancel.</p><div class="row"><button type="button" class="btn sm" id="premManage">Manage or cancel Premium</button></div><p class="formmsg" id="premMsg" role="alert"></p></div>`:""}
    <div class="panel"><h3>Your licenses</h3>${lic.length?`<div class="schedule">${lic.map((l,i)=>{ const sg=byId(l.song_id); return `<button type="button" class="slot tap" data-mylic="${i}"><span><b>${esc(sg?sg.title:(l.song_title||l.song_id))}</b> · ${esc(LIC_NAME[l.type]||l.type)}${l.status&&l.status!=="active"?` · <span class="certbad">${esc(l.status)}</span>`:""}</span><span class="muted">${esc(l.id)} · ${longDate(l.issued_at)}</span></button>`; }).join("")}</div>`:`<p class="muted small" style="margin:0">No licenses yet.</p>`}</div>
    <div class="panel auth"><h3>Account settings</h3>
      <form id="nmForm"><div class="field"><label for="acNm">Your name</label><input id="acNm" type="text" required maxlength="80" autocomplete="name" value="${esc(Backend.name)}"></div><button class="btn sm" type="submit">Save the name</button><p class="formmsg" role="alert"></p></form>
      <form id="pwForm" style="margin-top:18px">${pwField("acPw",`New password <span class="muted">(${MIN_PW} characters or more)</span>`,"new-password",MIN_PW)}<button class="btn sm" type="submit">Change the password</button><p class="formmsg" role="alert"></p></form>
      ${isOwner?"":`<button type="button" class="linkbtn danger" id="delAcc">Delete my account</button>`}</div>`;
    $("#so").onclick=()=>{ linkNote=null; Backend.signOut().then(()=>toast("Signed out.")); };
    box.querySelectorAll("[data-mylic]").forEach(b=>{ b.onclick=()=>{ const l=lic[+b.dataset.mylic]; if(l) certModal(l, false); }; });
    const pm=$("#premManage"); if(pm) pm.onclick=async()=>{ pm.disabled=true; $("#premMsg").textContent="";
      try{ location.href=await Backend.checkout({kind:"manage"}); }catch(err){ pm.disabled=false; if($("#premMsg")) $("#premMsg").textContent = err.code==="closed" ? "This page is not available right now. Write to us and we cancel it for you." : err.message; } };
    const form=(sel,f)=>{ const fm=$(sel); if(!fm) return; fm.onsubmit=async e=>{ e.preventDefault(); const btn=fm.querySelector("button[type=submit]"), msg=fm.querySelector(".formmsg"); btn.disabled=true; msg.textContent="";
      try{ await f(fm,msg); }catch(err){ if(msg.isConnected) msg.textContent=err.message; } finally{ btn.disabled=false; } }; };
    const newPw=async(input,msg)=>{ const pw=input.value; if(pw.length<MIN_PW){ msg.textContent=`Use ${MIN_PW} characters or more.`; return false; } await Backend.setPassword(pw); input.value=""; return true; };
    form("#npForm", async(fm,msg)=>{ if(await newPw($("#np1"),msg)){ linkNote=null; toast("Password changed."); $("#newPw").remove(); } });
    form("#pwForm", async(fm,msg)=>{ if(await newPw($("#acPw"),msg)) toast("Password changed."); });
    form("#nmForm", async()=>{ const n=await Backend.setName($("#acNm").value); $("#acName").textContent=n; toast("Name saved."); });
    const del=$("#delAcc"); if(del) del.onclick=()=>{
      openModal(`<h2 id="mTitle">Delete your account?</h2><p>Your sign-in and your profile are removed for good. Licenses you bought stay valid: keep their certificates.</p>
        <div class="row"><button type="button" class="btn primary" id="delYes">Delete my account</button><button type="button" class="btn ghost" id="delNo">Keep it</button></div><p id="delMsg" class="formmsg" role="alert"></p>`);
      $("#delNo").onclick=closeM;
      $("#delYes").onclick=async e=>{ const yes=e.currentTarget; yes.disabled=true; try{ await Backend.deleteAccount(); closeM(); toast("Your account is deleted."); again(); }catch(err){ if(yes.isConnected){ $("#delMsg").textContent=err.message; yes.disabled=false; } } };
    };
  }).catch(err=>{ const box=$("#acct"); if(box) box.innerHTML=`<p class="muted">${esc(err && err.message || "Accounts are not reachable right now. Please try again later.")}</p>`; });
}
function settingsView(){
  const a=age(), u=Backend.user;
  main.innerHTML=`<h1 class="pagetitle">Settings</h1>
  ${AGE_GATE?`<div class="panel"><h3>Adult songs</h3>
    <p class="small">${a==="adult"?"You confirmed that you are 18 or older. Sensual songs play like every other song.":a==="minor"?"Adult songs are hidden on this device.":"Sensual songs are for adults. The site asks your age the first time you open one."}</p>
    ${a==="adult"?`<button type="button" class="btn ghost sm" id="ageHide">Hide adult songs on this device</button>`:`<button type="button" class="btn sm" data-age>I'm 18 or older</button>`}</div>`
  :`<div class="panel"><h3>Explicit songs</h3>
    <p class="small">${hideExplicit()?"Songs with explicit lyrics are hidden on this device.":"Songs with explicit lyrics carry an E badge and play like every other song."}</p>
    <button type="button" class="btn ghost sm" id="exToggle" aria-pressed="${hideExplicit()}">${hideExplicit()?"Show explicit songs":"Hide explicit songs"}</button></div>`}
  <div class="panel"><h3>Account</h3>${!Backend.enabled?`<p class="muted small" style="margin:0">Accounts open soon. Listening needs no account.</p>`
    :u?`<p class="small">Signed in as ${esc(u.email)}.</p><div class="row"><a class="btn sm" href="#/account">Open my account</a><button type="button" class="btn ghost sm" id="setOut">Sign out</button></div>`
    :`<p class="small">You are not signed in. Listening needs no account.</p><a class="btn sm" href="#/account">Sign in</a>`}</div>
  ${privacyPanel()}
  <div class="panel"><h3>About</h3><p class="small" style="margin:0">Velora${DEMO?", test version":""}. Lyrics, concepts and song design by ${esc(CREATOR)}; music made with Suno (AI-assisted).${VER?` Build ${esc(VER)}.`:""}</p>
   <p class="muted small" style="margin:8px 0 0">Open-source parts: MP3 files are made in your browser with lamejs 1.2.1, which uses the LAME encoder (<a href="https://lame.sourceforge.io" target="_blank" rel="noopener noreferrer">lame.sourceforge.io</a>), under the LGPL licence; accounts use supabase-js (MIT). Both are in the site's vendor folder, unchanged.</p></div>`;
  wireWipe();
  const h=$("#ageHide"); if(h) h.onclick=()=>{ setAge("minor"); if(current && isAdult(current)) audio.pause(); toast("Adult songs are hidden on this device."); route(true); };
  const x=$("#exToggle"); if(x) x.onclick=()=>{
    if(hideExplicit()){ try{ localStorage.removeItem("velora_explicit"); }catch(e){} toast("Explicit songs are back."); }
    else { store.set("velora_explicit","hide"); if(current && current.explicit) audio.pause(); toast("Explicit songs are hidden on this device."); }
    applyAge(); route(true); };
  const o=$("#setOut"); if(o) o.onclick=()=>Backend.signOut().then(()=>toast("Signed out."));
}

// ---------- Uploaded songs: they arrive from the server and join the catalogue ----------
// Only plain data is taken over, and media must come from this site's own storage.
function cleanRemoteSong(r){
  if(!r || typeof r.id!=="string" || typeof r.title!=="string" || !Backend.isMediaUrl(r.audio)) return null;
  const txt=(v,n)=>typeof v==="string"?v.slice(0,n):"", num=v=>Number.isFinite(+v)?+v:0;
  const s={ id:r.id.slice(0,40), title:r.title.slice(0,160), genre:txt(r.genre,60)||"Pop", subgenre:txt(r.subgenre,60), tags:Array.isArray(r.tags)?r.tags.filter(t=>typeof t==="string").slice(0,6).map(t=>t.slice(0,40)):[],
    mood:txt(r.mood,40), language:txt(r.language,40), explicit:!!r.explicit, adult:!!r.adult, duration:Math.round(num(r.duration)), bpm:num(r.bpm)||undefined, key:txt(r.key,20)||undefined,
    audio:r.audio, art:Backend.isMediaUrl(r.art)?r.art:undefined, color:/^#[0-9a-f]{6}$/i.test(r.color||"")?r.color:undefined,
    sections:(Array.isArray(r.sections)?r.sections:[]).filter(x=>x && typeof x.name==="string").slice(0,40).map(x=>({name:x.name.slice(0,40), start:Math.max(0,num(x.start))})),
    bestPart:Math.max(0,num(r.bestPart)), created:txt(r.created,10)||undefined, published:txt(r.published,10)||undefined, artist:txt(r.artist,60)||undefined,
    lyricsNote:txt(r.lyricsNote,200), uploaded:true, record:r.record && typeof r.record==="object" ? {id:num(r.record.id), at:txt(r.record.at,40), hash:txt(r.record.hash,64)} : undefined,
    holder:txt(r.holder,80)||undefined, ai:r.ai && typeof r.ai==="object" ? {used:!!r.ai.used, music:!!r.ai.music, vocals:!!r.ai.vocals, lyrics:!!r.ai.lyrics, artwork:!!r.ai.artwork, tool:txt(r.ai.tool,60)} : undefined };
  if(r.release && typeof r.release==="object"){ const x=r.release, yr=v=>{ const n=num(v); return n>=1900&&n<=2100?n:0; }; s.release={label:txt(x.label,80), publisher:txt(x.publisher,80), isrc:/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(x.isrc||"")?x.isrc:"", cOwner:txt(x.c_owner,80), cYear:yr(x.c_year), pOwner:txt(x.p_owner,80), pYear:yr(x.p_year)}; }
  if(!s.sections.length) s.sections=[{name:"Start",start:0}];
  if(Array.isArray(r.lyrics)){ const L=r.lyrics.filter(l=>Array.isArray(l) && typeof l[1]==="string").slice(0,400).map(l=>[Math.max(0,num(l[0])), l[1].slice(0,300)]); if(L.length){ s.lyrics=L; if(r.lyricsSynced===false) s.lyricsSynced=false; } }
  if(Array.isArray(r.credits)) s.credits=r.credits.filter(c=>c && typeof c.name==="string").slice(0,30).map(c=>({group:txt(c.group,40)||"Credits", name:c.name.slice(0,80), roles:(Array.isArray(c.roles)?c.roles:[]).filter(x=>typeof x==="string").slice(0,6).map(x=>x.slice(0,60))}));
  return s;
}
function mergeRemote(d, quiet){
  if(!d) return [];
  const added=[];
  for(const a of Array.isArray(d.artists)?d.artists:[]){
    if(!a || typeof a.id!=="string" || typeof a.name!=="string") continue;
    const clean={id:a.id.slice(0,60), name:a.name.slice(0,80), tagline:typeof a.tagline==="string"?a.tagline.slice(0,120):"", bio:typeof a.bio==="string"?a.bio.slice(0,1500):"", color:a.color, image:Backend.isMediaUrl(a.image)?a.image:undefined};
    const i=ARTISTS.findIndex(x=>x.id===clean.id); if(i<0) ARTISTS.push(clean); else if(!ARTISTS[i].bundled) Object.assign(ARTISTS[i], clean);
  }
  for(const r of Array.isArray(d.songs)?d.songs:[]){
    const c=cleanRemoteSong(r); if(!c) continue;
    const i=ALL.findIndex(x=>x.id===c.id);
    if(i<0){ ALL.unshift(c); added.push(c); } else if(ALL[i].uploaded){ if(ALL[i]===current){ Object.assign(ALL[i], c); } else ALL[i]=c; }
  }
  const gone = Array.isArray(d.songs) ? new Set(d.songs.map(x=>x&&x.id)) : null;   // an unlisted song leaves the list
  if(gone && d.complete) for(let i=ALL.length-1;i>=0;i--) if(ALL[i].uploaded && !gone.has(ALL[i].id) && ALL[i]!==current) ALL.splice(i,1);
  applyAge();
  if(!quiet && !npOpen && $("#modal").hidden && window.scrollY<120 && !/^#\/(upload|studio|account|settings)/.test(location.hash)) route(true);
  return added;
}
ARTISTS.forEach(a=>{ a.bundled=true; });
if(Backend.enabled){
  Backend.catalogue().then(d=>mergeRemote(d)).catch(()=>{});
  Backend.onChange(()=>{ if(/^#\/(account|settings)/.test(location.hash)) route(true); });
  if(Backend.remembered()) Backend.init().catch(()=>{});   // someone signed in on this device before: restore it
}

// ---------- Upload pages (studio.js is loaded only when someone opens them) ----------
let studioP=null;
const loadScript = src => new Promise((res,rej)=>{ const el=document.createElement("script"); el.src=src; el.onload=res; el.onerror=()=>rej(new Error("load")); document.head.appendChild(el); });
const studioCtx = { main, Backend, CFG, VER, esc, icon, fmt, toast, openModal, closeM, authPanel, safeColor, mediaOf:p=>url(p), longDateTime:v=>longDateTime(v), pageLink, shareLink,
  artists:()=>ARTISTS, songs:()=>ALL, addSongs:d=>mergeRemote(d,true), stopMusic:()=>{ try{ audio.pause(); }catch(e){} }, go:h=>{ location.hash=h; } };
// The legal pages (terms, license terms, sale, privacy, content rules, who we are) load only when opened.
const LEGAL = new Set(["/legal","/terms","/license","/sales","/privacy","/content","/imprint"]);
let legalP = null;
function legalView(path){
  main.innerHTML=`<p class="muted" role="status">One moment…</p>`;
  if(!legalP) legalP = new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="legal.js"+(VER?"?v="+VER:""); s.onload=res; s.onerror=()=>{ legalP=null; rej(); }; document.head.appendChild(s); });
  legalP.then(()=>{ if(LEGAL.has((location.hash.slice(1).split("?")[0])||"")) window.VeloraLegal.open(path, { main, esc, CFG, creator: CREATOR }); })
    .catch(()=>{ main.innerHTML=`<h1 class="pagetitle">Legal</h1><p class="muted">This page did not load. Check your connection and try again.</p>`; });
}
function studioView(path, params){
  main.innerHTML=`<p class="muted" style="margin-top:24px" role="status">One moment…</p>`;
  const q = VER ? "?v="+VER : "";
  if(!studioP){
    if(!document.getElementById("studioCss")){ const l=document.createElement("link"); l.id="studioCss"; l.rel="stylesheet"; l.href="studio.css"+q; document.head.appendChild(l); }
    studioP = loadScript("data/taxonomy.js"+q).then(()=>loadScript("studio-audio.js"+q)).then(()=>loadScript("studio.js"+q)).catch(e=>{ studioP=null; throw e; });
  }
  studioP.then(()=>{ if(/^#\/(upload|studio)/.test(location.hash)) window.VeloraStudio.open(path, params, studioCtx); })
    .catch(()=>{ main.innerHTML=`<h1 class="pagetitle">Upload</h1><p class="muted">The upload page did not load. Check your connection.</p><button type="button" class="btn primary" id="stRetry">Try again</button>`; const b=$("#stRetry"); if(b) b.onclick=()=>studioView(path, params); });
}

// Footer channels: only real addresses are shown.
(function(){ const list=(CFG.channels||[]).filter(c=>c && /^https:\/\//.test(c.url||"")), box=$("#channels"); if(!box) return;
  box.innerHTML = list.length ? list.map(c=>`<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.name)}</a>`).join("") : "";
  box.hidden=!list.length; })();
if(!DEMO){ const b=$(".demo-banner"); if(b) b.remove(); }

// ---------- Global clicks ----------
document.addEventListener("click",e=>{
  if(e.target.closest("[data-stream]")){ e.preventDefault(); startStream(); return; }
  if(e.target.closest("[data-radio]")){ e.preventDefault(); startRadio(); return; }
  const cn=e.target.closest("[data-close-np]"); if(cn){ e.preventDefault(); closeM(); const h=cn.getAttribute("href"); if(npOpen) closeNP(false, h); else location.hash=h; return; }
  const v=e.target.closest("[data-video]"); if(v){ e.preventDefault(); const s=byId(v.dataset.video); if(s) openVideo(s, v.hasAttribute("data-wide")); return; }
  const st=e.target.closest("[data-station]"); if(st){ e.preventDefault(); startStation(catById(st.dataset.station)); return; }
  const sh=e.target.closest("[data-share]"); if(sh){ e.preventDefault(); const s=byId(sh.dataset.share); if(s) openShare(s); return; }
  const rc=e.target.closest("[data-record]"); if(rc){ e.preventDefault(); const s=byId(rc.dataset.record); if(s) openRecord(s); return; }
  const cr=e.target.closest("[data-credits]"); if(cr){ e.preventDefault(); const s=byId(cr.dataset.credits); if(s) openCredits(s); return; }
  const l=e.target.closest("[data-lic]"); if(l){ e.preventDefault(); openLicense(byId(l.dataset.lic), l.dataset.pre||"rent"); return; }
  const gs=e.target.closest("[data-getsong]"); if(gs){ e.preventDefault(); getSong(gs.dataset.getsong); return; }
  if(e.target.closest("[data-print]")){ e.preventDefault(); document.body.classList.add("printcert"); const done=()=>{ document.body.classList.remove("printcert"); window.removeEventListener("afterprint",done); }; window.addEventListener("afterprint",done); setTimeout(done,60000); window.print(); return; }
  const mo=e.target.closest("[data-more]"); if(mo){ const k=mo.dataset.more, r=ROWS[k]; if(r){ r.shown+=PAGE; const box=document.getElementById("rows-"+k); if(box) box.innerHTML=rowsInner(k, mo.hasAttribute("data-numbered")); } return; }
  // Tap a song anywhere: it plays and its full screen opens (cover, lyrics, video, license).
  const t=e.target.closest("[data-song]"); if(t){ e.preventDefault(); const s=byId(t.dataset.song); if(!s) return; const row=ROWS[t.dataset.list]||{list:[s],label:s.genre};
    const go=()=>{ if(current===s && mode!=="radio" && !adState && !audio.error){ if(audio.paused) audio.play().catch(()=>{}); openNP(); return; } playFrom(row.list, s, row.label, 0, openNP); };
    if(playable(s)) go(); else askAge(go); return; }
  const p=e.target.closest("[data-play]"); if(p){ e.preventDefault(); const s=byId(p.dataset.play), at=Math.max(0,+(p.dataset.at||0)||0), open=p.hasAttribute("data-np")?openNP:null; if(!s) return;
    const go=()=>{ if(current===s && mode!=="radio" && !adState && !audio.error){ audio.currentTime=at; audio.play().catch(()=>{}); if(open) open(); return; }
      playFrom([s,...suggestions(s,8)], s, s.genre, at, open); };
    if(playable(s)) go(); else askAge(go); return; }
  if(e.target.closest("[data-age]")){ e.preventDefault(); askAge(); return; }
  if(e.target.closest("[data-sub]")){ e.preventDefault(); openLicense(current||S[0],"sub"); return; }
});
$("#q").addEventListener("input",e=>{ searchQ=e.target.value; if(!/^#\/(search|library)/.test(location.hash)) location.hash="#/search"; else { const lq=$("#libq"); if(lq) lq.value=searchQ; drawSearch(); } });

// ---------- Router (addresses look like #/song/rm-0006) ----------
const decode = s => { try{ return decodeURIComponent(s||""); }catch(e){ return ""; } };
let lastPath="";
function route(keep){
  if(!location.hash.startsWith("#/account")) linkNote=null;
  const h=location.hash.slice(1)||"/"; const [path,qs]=h.split("?"); const params=new URLSearchParams(qs||"");
  if(npOpen) closeNP(true);
  closeM(); closeMenu();
  ROWS={}; rowN=0;
  const inStudio = p => p==="/upload" || p==="/studio";
  if(inStudio(lastPath) && !inStudio(path) && window.VeloraStudio) window.VeloraStudio.leave();
  lastPath=path; document.body.classList.toggle("in-studio", path==="/upload");
  const navPath = path.startsWith("/song") || path.startsWith("/genre") || path.startsWith("/artist") || path==="/library" ? "/search" : path;
  document.querySelectorAll(".topnav a").forEach(a=>{ const on=a.getAttribute("href")==="#"+navPath; a.classList.toggle("active",on); if(on) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
  document.querySelectorAll(".tabbar [data-tab]").forEach(a=>{ const on=a.dataset.tab===navPath; a.classList.toggle("active",on); if(on) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
  const names={"/":"","/search":"Search","/radio":"Radio","/videos":"Videos","/pricing":"Pricing","/verify":"Verify a license","/account":"Account","/settings":"Settings","/upload":"Upload a song","/studio":"My songs","/thanks":"Thank you"};
  let title=names[navPath]||"";
  if(!SALES && (path==="/pricing"||path==="/thanks")){ location.replace("#/"); return; }      // the phone app has no shop
  if(path==="/") home(); else if(path==="/search"||path==="/library") searchView(params);
  else if(path.startsWith("/song/")){ const id=decode(path.split("/")[2]); song(id); const s=byId(id); if(s) title=s.title; }
  else if(path.startsWith("/genre/")){ const id=decode(path.split("/")[2]); genreView(id); const c=catById(id); if(c) title=c.name; }
  else if(path.startsWith("/artist/")){ const id=decode(path.split("/")[2]); artistView(id); const a=artistById(id); if(a) title=a.name; }
  else if(path==="/radio") radioView(); else if(path==="/videos") videosView(); else if(path==="/pricing") pricing(); else if(path==="/verify") verify(params);
  else if(path==="/account") accountView(); else if(path==="/settings") settingsView(); else if(path==="/thanks") thanksView(params);
  else if(LEGAL.has(path)) legalView(path);
  else if(path==="/upload"||path==="/studio") studioView(path, params);
  else if(path==="/stream"){ home(); startStream(); } else home();
  document.title=(title?title+" · ":"")+"Velora";
  document.querySelectorAll("#uploadBtn").forEach(b=>b.classList.toggle("on", path==="/upload"));
  if(keep!==true) window.scrollTo(0,0);
}
window.addEventListener("hashchange",()=>route());
// Back from the payment provider: its checkout reference arrives as ?paid=…; move it into the thanks page's address.
(function(){ let q; try{ q=new URLSearchParams(location.search); }catch(e){ return; }
  const ref=q.get("paid")||""; if(!ref) return;
  const kind=/^(rent|buy|premium)$/.test(q.get("kind")||"") ? q.get("kind") : "";
  const to="#/thanks?ref="+encodeURIComponent(ref.slice(0,200))+(kind?"&kind="+kind:"");
  try{ history.replaceState(null,"",location.pathname+to); }catch(e){ location.hash=to; } })();
if(Backend.enabled && Backend.shop) Backend.shop().then(applyShop).catch(()=>{});
if(Backend.linkInAddress && Backend.linkInAddress()){          // back from a link in an email: take the sign-in over first
  main.innerHTML=`<p class="muted" role="status">One moment…</p>`;
  Backend.fromLink().then(n=>{ linkNote=n; route(); }).catch(()=>route());
} else route();
})();
