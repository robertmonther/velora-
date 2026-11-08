(function(){
"use strict";
const D = window.VELORA_DATA, S = D.songs, G = D.genres;
// Media (audio, covers, videos) is served from the GitHub repo through the jsDelivr CDN when hosted,
// and from the local folder when the site runs on localhost.
const LOCAL = /^(localhost|127\.0\.0\.1|)$/.test(location.hostname);
const MEDIA_BASE = LOCAL ? "" : "https://cdn.jsdelivr.net/gh/robertmonther/velora-@main/";
const url = p => /^https?:/.test(p) ? p : MEDIA_BASE + p;
const REAL = S.filter(s=>s.real);
const $ = s => document.querySelector(s), main = $("#main"), audio = $("#audio");
const PAL = [["#5b7a99","#2a3646"],["#b0524a","#3b1f1d"],["#e0a9b0","#5a3a40"]];
const GENRE_ANGLE = Object.fromEntries(G.map((g,i)=>[g, i*33]));
// EXAMPLE prices - Robert decides the real ones
const PRICES = {rent:{label:"Rent a track",price:"€9",per:"30 days, one channel"}, buy:{label:"Buy usage rights",price:"€49",per:"one-time, lifetime use"}, excl:{label:"Exclusive rights",price:"Ask Robert",per:"negotiated"}, sub:{label:"Premium",price:"€14",per:"per month, whole library"}};
const RADIO = [
 {from:6,to:10,name:"Morning Warmth",genres:["Soul","Jazz"],mood:"Warm"},
 {from:10,to:14,name:"Daylight Focus",genres:["Lo-fi","House"],mood:"Playful"},
 {from:14,to:18,name:"Afternoon Energy",genres:["Hip Hop","Trend (Arena)"],mood:"Confident"},
 {from:18,to:22,name:"Golden Evening",genres:["Blues","Cinematic"],mood:"Melancholic"},
 {from:22,to:26,name:"After Dark",genres:["Soft Sensual","Soul"],mood:"Romantic"},
 {from:2,to:6,name:"Late Night (18+)",genres:["Explicit Sensual","Lo-fi"],mood:"Late night"}
];
const fmt = t => { t=Math.max(0,Math.floor(t||0)); return Math.floor(t/60)+":"+String(t%60).padStart(2,"0"); };
const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const coverStyle = s => { if(s.art) return `background:#141418 url('${url(s.art)}') center/cover no-repeat`; const p=PAL[s.hue]; const a=GENRE_ANGLE[s.genre]||0; return `background:radial-gradient(circle at ${30+(a%60)}% ${25+(a%40)}%, ${p[0]} 0%, transparent 60%),linear-gradient(${a}deg, ${p[1]}, #141418 80%), ${p[0]}`; };
const cover = (s,cls="cover") => `<div class="${cls}" style="${coverStyle(s)}" role="img" aria-label="Cover of ${esc(s.title)}">${s.explicit?'<span class="tag">18+</span>':""}${s.real?'<span class="tag new">Robert original</span>':""}<span>${esc(s.title)}</span></div>`;
const byId = id => S.find(s=>s.id===id);

// ---------- Player ----------
let queue = S.slice(), qi = -1, current = null, mode = "library";
function load(song, autoplay=true, at=0){
  current = song; qi = queue.indexOf(song); if(qi<0){queue=[song];qi=0;}
  audio.src = url(song.audio); audio.currentTime = 0;
  $("#pTitle").textContent = song.title;
  $("#pMeta").textContent = `${song.genre} · ${song.mood}${mode==="radio"?" · Velora Radio":""}`;
  $("#pCover").setAttribute("style", coverStyle(song));
  drawWave(song); drawSections(song);
  audio.addEventListener("loadedmetadata", function f(){ audio.removeEventListener("loadedmetadata",f); audio.currentTime = at; }, {once:true});
  if(autoplay) audio.play().catch(()=>{});
}
function drawWave(song){
  const w=$("#pWave"); let h=""; let seed=(parseInt(song.id.slice(3))+(song.real?777:0))*9301;
  for(let i=0;i<90;i++){ seed=(seed*9301+49297)%233280; const v=20+Math.round((seed/233280)*70); const inChorus = song.sections.some((x,j)=>(x.name.startsWith("Chorus")||x.start===song.bestPart) && i/90*song.duration>=x.start && i/90*song.duration<(song.sections[j+1]||{start:song.duration}).start); h+=`<i style="height:${inChorus?Math.min(95,v+15):v}%"></i>`; }
  w.innerHTML=h;
}
function drawSections(song){
  const el=$("#pSections"); const d=song.duration;
  el.innerHTML = song.sections.map((x,j)=>{ const end=(song.sections[j+1]||{start:d}).start; return `<button style="left:${x.start/d*100}%;width:${(end-x.start)/d*100}%" data-t="${x.start}" title="${esc(x.name)} ${fmt(x.start)}–${fmt(end)}">${esc(x.name)}</button>`; }).join("");
}
$("#pSections").addEventListener("click",e=>{ const b=e.target.closest("button"); if(b&&current){ e.stopPropagation(); audio.currentTime=+b.dataset.t; audio.play().catch(()=>{}); }});
$("#pTrack").addEventListener("click",e=>{ if(!current) return; const r=e.currentTarget.getBoundingClientRect(); audio.currentTime=(e.clientX-r.left)/r.width*(audio.duration||current.duration); });
$("#pTrack").addEventListener("keydown",e=>{ if(!current) return; if(e.key==="ArrowRight") audio.currentTime+=5; if(e.key==="ArrowLeft") audio.currentTime-=5; });
$("#pPlay").onclick=()=>{ if(!current){ queue=REAL.length?REAL.slice():S.slice(); load(queue[0]); return;} audio.paused?audio.play():audio.pause(); };
$("#pNext").onclick=()=> next();
$("#pPrev").onclick=()=>{ if(audio.currentTime>3){audio.currentTime=0;return;} if(qi>0) load(queue[qi-1]); };
$("#pBest").onclick=()=>{ if(current){ audio.currentTime=current.bestPart; audio.play().catch(()=>{});} };
$("#pLicense").onclick=()=> openLicense(current||S[0]);
function next(){ if(mode==="radio"){ load(radioPick()); return; } if(qi<queue.length-1) load(queue[qi+1]); }
audio.addEventListener("play",()=>{$("#pPlay").textContent="⏸";$("#pPlay").setAttribute("aria-label","Pause");});
audio.addEventListener("pause",()=>{$("#pPlay").textContent="▶";$("#pPlay").setAttribute("aria-label","Play");});
audio.addEventListener("ended",next);
audio.addEventListener("timeupdate",()=>{ const d=audio.duration||(current&&current.duration)||1; $("#pFill").style.width=(audio.currentTime/d*100)+"%"; $("#pCur").textContent=fmt(audio.currentTime); $("#pDur").textContent=fmt(d); $("#pTrack").setAttribute("aria-valuenow",Math.round(audio.currentTime/d*100)); });

// ---------- Radio ----------
function slotNow(h=new Date().getHours()){ const hh = h<2? h+24 : h; return RADIO.find(r=> hh>=r.from && hh<r.to) || RADIO[0]; }
let radioMood = null;
let radioRealIdx = 0;
function radioPick(){
  // Robert's real songs play in order, then alternate with the example rotation.
  if(REAL.length && !radioMood && (radioRealIdx < REAL.length || Math.random()<0.6)){ const s=REAL[radioRealIdx % REAL.length]; radioRealIdx++; return s; }
  const slot=slotNow(); let pool=S.filter(s=> radioMood ? s.mood===radioMood : (slot.genres.includes(s.genre)||s.real)); if(!pool.length) pool=S;
  pool=pool.filter(s=>s!==current); if(!pool.length) pool=S;
  return pool[Math.floor(Math.random()*pool.length)];
}
function startRadio(){ mode="radio"; queue=S.slice(); if(!radioMood) radioRealIdx=0; load(radioPick()); }

// ---------- License / checkout (demo) ----------
function openLicense(song, preset="rent"){
  const m=$("#modal"), b=$("#mBody");
  b.innerHTML = `
  <h2 id="mTitle">License “${esc(song.title)}”</h2>
  <p class="muted small">${esc(song.genre)} · ${esc(song.mood)} · ${fmt(song.duration)} · ID ${song.id}</p>
  <form id="lic">
   <div class="opts" role="radiogroup" aria-label="License type">
    ${["rent","buy","excl"].map(k=>`<label class="opt"><input type="radio" name="t" value="${k}" ${k===preset?"checked":""}><div><b>${PRICES[k].label} · ${PRICES[k].price}</b><span class="muted small">${PRICES[k].per}. ${k==="rent"?"Use in your videos and posts while the rental is active.":k==="buy"?"Non-exclusive. You keep the right to use it forever. The song stays in the Velora catalogue.":"Only on request. The song can be taken out of the catalogue for new buyers if you ask."}</span></div></label>`).join("")}
    <label class="opt"><input type="radio" name="t" value="sub"><div><b>${PRICES.sub.label} · ${PRICES.sub.price}</b><span class="muted small">${PRICES.sub.per}. Rent any song while subscribed.</span></div></label>
   </div>
   <div class="note"><b>About exclusivity.</b> Buying usage rights is non-exclusive: other people can license the same song, and it stays in the catalogue. If you need it to be yours alone, choose Exclusive and Robert will contact you; the song is removed for new buyers only when you ask.</div>
   <div class="row" style="margin-top:16px;justify-content:space-between">
     <span class="muted small">Demo checkout. Nothing is charged.</span>
     <button class="btn primary" type="submit">Pay (demo)</button>
   </div>
  </form>`;
  m.hidden=false; b.querySelector("button[type=submit]").focus();
  $("#lic").onsubmit = async e => { e.preventDefault(); const t=new FormData(e.target).get("t"); if(t==="excl"){ b.innerHTML=`<h2 id="mTitle">Exclusive request sent (demo)</h2><p>Robert would get your request for “${esc(song.title)}” and reply by email. Nothing was charged.</p><button class="btn" id="mDone">Close</button>`; $("#mDone").onclick=closeM; return;} showCert(song,t); };
}
async function hash(str){ try{ const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str)); return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join(""); }catch(e){ let h=0; for(const c of str) h=(h*31+c.charCodeAt(0))>>>0; return h.toString(16).padStart(8,"0").repeat(8);} }
async function showCert(song,t){
  const now=new Date(); const iso=now.toISOString(); const lic="VL-"+now.getFullYear()+"-"+Math.random().toString(36).slice(2,8).toUpperCase();
  const fp=await hash(song.id+song.title+song.published);
  const rec={lic,song:song.id,title:song.title,type:PRICES[t].label,issued:iso,songDate:song.published,fp};
  const all=JSON.parse(localStorage.getItem("velora_licenses")||"[]"); all.push(rec); localStorage.setItem("velora_licenses",JSON.stringify(all));
  $("#mBody").innerHTML = `<h2 id="mTitle">You're licensed (demo)</h2>
  <div class="cert"><h3>Velora License Certificate</h3><div class="small">Example certificate. Not a real license.</div>
  <dl><dt>License ID</dt><dd><b>${lic}</b></dd><dt>Song</dt><dd>${esc(song.title)} (${song.id})</dd><dt>Type</dt><dd>${PRICES[t].label}</dd>
  <dt>Issued</dt><dd>${now.toLocaleString("en-GB",{dateStyle:"long",timeStyle:"short"})}</dd><dt>Song created</dt><dd>${new Date(song.published).toLocaleDateString("en-GB",{dateStyle:"long"})}</dd>
  <dt>Creator</dt><dd>${esc(song.artist||"Robert Mo")} · Suno-assisted</dd><dt>Fingerprint</dt><dd style="word-break:break-all;font-family:monospace;font-size:12px">${fp.slice(0,32)}…</dd></dl></div>
  <div class="row" style="margin-top:14px"><a class="btn primary" href="#/verify?id=${lic}" id="mVerify">Verify this license</a><button class="btn" id="mDone">Close</button></div>`;
  $("#mDone").onclick=closeM; $("#mVerify").onclick=closeM;
}
function closeM(){ const v=document.querySelector("#mBody video"); if(v) v.pause(); $("#modal").hidden=true; }
$("#mClose").onclick=closeM; $("#modal").addEventListener("click",e=>{ if(e.target.id==="modal") closeM(); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeM(); });

// ---------- Views ----------
const card = s => `<article class="card">${cover(s)}<button class="playbtn" data-play="${s.id}" aria-label="Play ${esc(s.title)}">▶</button>
 <h3><a href="#/song/${s.id}">${esc(s.title)}</a></h3><div class="meta">${esc(s.genre)} · ${esc(s.mood)} · ${fmt(s.duration)}</div>
 <div class="actions"><button class="btn ghost" data-play="${s.id}">Play</button><button class="btn primary" data-lic="${s.id}">License</button></div></article>`;

function home(){
  const slot=slotNow(); const sample=REAL[0]||S.filter(s=>slot.genres.includes(s.genre)).slice(0,1)[0]||S[0];
  const moods=[...new Set(S.map(s=>s.mood))];
  main.innerHTML = `
  <section class="hero">
   <div class="hero-main"><div class="onair" style="color:var(--cream)">Robert's music only</div>
    <h1>Whole songs.<br>Ready for your story.</h1>
    <p>Listen to every song from start to finish, see its sections, and license it for your videos in two clicks.</p>
    <div class="row"><a class="btn primary" href="#/library">Browse the library</a><button class="btn blue" id="hRadio">▶ Start Velora Radio</button><a class="btn ghost" href="#/pricing">See pricing</a></div></div>
   <aside class="radio-card" aria-label="Velora Radio">
    <div class="onair">Velora Radio · on air</div>
    <div class="now">${cover(sample)}<div><b>${esc(slot.name)}</b><div class="muted small">${slot.genres.join(" + ")} · ${slot.mood}</div><button class="btn primary" style="margin-top:8px" id="rPlay">▶ Listen live</button></div></div>
    <div><div class="muted small" style="margin-bottom:6px">Today's schedule</div><div class="schedule">${RADIO.map(r=>`<div class="slot ${r===slot?"live":""}"><span>${String(r.from%24).padStart(2,"0")}:00–${String(r.to%24).padStart(2,"0")}:00</span><span>${esc(r.name)}</span></div>`).join("")}</div></div>
    <div><div class="muted small" style="margin-bottom:6px">Or tune by mood</div><div class="chips" style="margin:0">${moods.slice(0,6).map(m=>`<button class="chip" data-rmood="${esc(m)}">${esc(m)}</button>`).join("")}</div></div>
   </aside>
  </section>
  ${REAL.length?`<div class="section-head"><div><h2>Robert's songs</h2><div class="muted small">${REAL.length} real songs, playable in full. Also first on Velora Radio.</div></div><button class="btn primary" id="hAll">▶ Play all</button></div>
  <div class="grid">${REAL.map(card).join("")}</div>`:""}
  <div class="section-head"><div><h2>Genres</h2><div class="muted small">${G.length} genres · ${REAL.length} real songs and ${S.length-REAL.length} example songs (the full library will hold Robert's 1000+ songs)</div></div><a href="#/library" class="btn ghost">Open library</a></div>
  <div class="chips">${G.map(g=>`<a class="chip" href="#/library?genre=${encodeURIComponent(g)}">${esc(g)}</a>`).join("")}</div>
  <div class="section-head"><h2>More in the catalogue</h2><div class="muted small">Example songs</div></div>
  <div class="grid">${S.filter(s=>!s.real).slice().sort((a,b)=>b.published.localeCompare(a.published)).slice(0,10).map(card).join("")}</div>
  <div class="section-head"><div><h2>Shorts</h2><div class="muted small">Robert's song videos</div></div><a href="#/videos" class="btn ghost">All videos</a></div>
  <div class="videos">${videoTiles(6)}</div>
  <div class="section-head"><h2>Three ways to use the music</h2></div>
  ${tiersHTML()}`;
  $("#hRadio").onclick=startRadio; $("#rPlay").onclick=startRadio; const ha=$("#hAll"); if(ha) ha.onclick=()=>{ mode="library"; queue=REAL.slice(); load(queue[0]); };
  main.querySelectorAll("[data-rmood]").forEach(b=>b.onclick=()=>{ radioMood=b.dataset.rmood; main.querySelectorAll("[data-rmood]").forEach(x=>x.classList.toggle("on",x===b)); startRadio(); });
}
function videoTiles(n){
  const real=REAL.filter(s=>s.video).map(s=>`<a class="vid" href="#" data-video="${s.id}" style="background:#141418 url('${url(s.poster||s.art)}') center/cover no-repeat" aria-label="Watch ${esc(s.title)}"><span class="yt">▶ Video</span><div class="ov"><b>${esc(s.title)}</b><div class="small muted">Robert Monther</div></div></a>`);
  const ex=S.filter(s=>!s.real).slice(0,Math.max(0,n-real.length)).map((s,i)=>`<a class="vid" href="#" data-todo style="${coverStyle(s)}"><span class="yt">YouTube Short</span><div class="ov"><b>${esc(s.title)}</b><div class="small muted">Example video ${i+1}</div></div></a>`);
  return real.concat(ex).join("");
}
function openVideo(s){ audio.pause(); const m=$("#modal"), b=$("#mBody"); b.innerHTML=`<h2 id="mTitle">${esc(s.title)}</h2><video src="${url(s.video)}" poster="${url(s.poster||s.art)}" controls autoplay playsinline style="width:100%;max-height:70vh;border-radius:12px;background:#000"></video><div class="row" style="margin-top:12px"><button class="btn primary" data-lic="${s.id}">License this song</button><a class="btn ghost" href="#/song/${s.id}" id="mSong">Song page</a></div>`; m.hidden=false; $("#mSong").onclick=closeM; }
function tiersHTML(){ return `<div class="tiers">
  <div class="tier"><h3>Rent a track</h3><div class="price">${PRICES.rent.price}</div><div class="muted small">${PRICES.rent.per}</div><ul><li>One song, one channel</li><li>Perfect for a single video or campaign</li><li>Dated certificate</li></ul><a class="btn" href="#/library">Pick a song</a></div>
  <div class="tier feat"><h3>Buy usage rights</h3><div class="price">${PRICES.buy.price}</div><div class="muted small">${PRICES.buy.per}</div><ul><li>Use it forever, non-exclusive</li><li>The song stays in the catalogue</li><li>Exclusive available on request</li><li>Dated certificate</li></ul><a class="btn primary" href="#/library">Pick a song</a></div>
  <div class="tier"><h3>Premium</h3><div class="price">${PRICES.sub.price}</div><div class="muted small">${PRICES.sub.per}</div><ul><li>Rent any song while subscribed</li><li>Every genre, every new release</li><li>Cancel anytime</li></ul><button class="btn blue" data-sub>Start Premium (demo)</button></div>
 </div><p class="muted small">Example prices. Robert sets the real ones.</p>`; }

let libState={genre:null,mood:null,q:"",page:1};
function library(params){
  if(params.get("genre")) libState.genre=params.get("genre");
  const moods=[...new Set(S.map(s=>s.mood))].sort();
  let list=S.filter(s=>(!libState.genre||s.genre===libState.genre)&&(!libState.mood||s.mood===libState.mood)&&(!libState.q||(s.title+" "+s.genre+" "+s.mood).toLowerCase().includes(libState.q.toLowerCase())));
  const per=20, pages=Math.max(1,Math.ceil(list.length/per)); libState.page=Math.min(libState.page,pages);
  main.innerHTML=`<h1>Library</h1><p class="muted">Every song by Robert, in full. Filter by genre and mood, play, and license.</p>
  <div class="muted small" style="margin:14px 0 6px">Genre</div><div class="chips">${["All",...G].map(g=>`<button class="chip ${((g==="All"&&!libState.genre)||g===libState.genre)?"on":""}" data-g="${esc(g)}">${esc(g)}</button>`).join("")}</div>
  <div class="muted small" style="margin-bottom:6px">Mood</div><div class="chips">${["All",...moods].map(m=>`<button class="chip ${((m==="All"&&!libState.mood)||m===libState.mood)?"on":""}" data-m="${esc(m)}">${esc(m)}</button>`).join("")}</div>
  <div class="muted small" style="margin-bottom:10px">${list.length} songs</div>
  <div class="grid">${list.slice((libState.page-1)*per,libState.page*per).map(card).join("")||'<p class="muted">No songs match.</p>'}</div>
  <div class="pager">${Array.from({length:pages},(_,i)=>`<button class="chip ${i+1===libState.page?"on":""}" data-p="${i+1}">${i+1}</button>`).join("")}</div>`;
  main.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{libState.genre=b.dataset.g==="All"?null:b.dataset.g;libState.page=1;history.replaceState(null,"","#/library");library(new URLSearchParams());});
  main.querySelectorAll("[data-m]").forEach(b=>b.onclick=()=>{libState.mood=b.dataset.m==="All"?null:b.dataset.m;libState.page=1;library(new URLSearchParams());});
  main.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{libState.page=+b.dataset.p;library(new URLSearchParams());window.scrollTo(0,0);});
}
function song(id){
  const s=byId(id); if(!s){ main.innerHTML="<h1>Song not found</h1>"; return; }
  const d=s.duration;
  main.innerHTML=`<div class="split"><div>${cover(s,"cover song-cover")}</div><div>
   <div class="muted small">${esc(s.genre)} · ${esc(s.mood)}</div><h1>${esc(s.title)}</h1><div class="muted">${esc(s.artist||"Robert Mo")}</div>
   <div class="facts"><div class="fact"><b>Length</b>${fmt(d)}</div><div class="fact"><b>BPM</b>${s.bpm}</div>${s.key?`<div class="fact"><b>Key</b>${esc(s.key)}</div>`:""}<div class="fact"><b>Released</b>${s.published}</div><div class="fact"><b>Content</b>${s.explicit?"Explicit (18+)":"Clean"}</div></div>
   <div class="row"><button class="btn primary" data-play="${s.id}">▶ Play full song</button><button class="btn red" data-lic="${s.id}">Rent ${PRICES.rent.price}</button><button class="btn blue" data-lic="${s.id}" data-pre="buy">Buy rights ${PRICES.buy.price}</button>${s.video?`<button class="btn ghost" data-video="${s.id}">Watch video</button>`:""}</div>${s.analysisNote?`<p class="muted small">${esc(s.analysisNote)}</p>`:""}
   <div class="panel"><h3>Song map</h3><p class="muted small">Where each part starts and ends. Click to jump there.${s.sectionsEstimated?" Parts are estimated from the song's energy.":""}</p>
    <div class="schedule">${s.sections.map((x,j)=>`<button class="slot" style="border:0;color:inherit;cursor:pointer;font:inherit" data-play="${s.id}" data-at="${x.start}"><span>${esc(x.name)}${x.start===s.bestPart?" · best part":""}</span><span class="muted">${fmt(x.start)} – ${fmt((s.sections[j+1]||{start:d}).start)}</span></button>`).join("")}</div></div>
   <div class="panel prov"><div class="seal">✓</div><div><h3 style="margin-bottom:4px">Provenance record</h3><div class="small">${s.real?esc(s.provenance)+" · added":"Created by Robert Mo with Suno · first published"} <b>${new Date(s.published).toLocaleDateString("en-GB",{dateStyle:"long"})}</b> · catalogue ID ${s.id}</div><div class="muted small">Each license gets a dated certificate you can verify on the Verify page.${s.real?"":" Example data."}</div></div></div>
   <div class="panel"><h3>Lyrics</h3><div class="lyrics">${esc(s.lyrics)}</div></div>
  </div></div>
  <div class="section-head"><h2>More ${esc(s.genre)}</h2></div><div class="grid">${S.filter(x=>x.genre===s.genre&&x.id!==s.id).slice(0,5).map(card).join("")}</div>`;
}
function radioView(){ main.innerHTML=`<h1>Velora Radio</h1><p class="muted">One station for every genre. It follows the time of day, or you can tune it to a mood.</p><div class="schedule" style="max-width:640px">${RADIO.map(r=>`<div class="slot ${r===slotNow()?"live":""}"><span>${String(r.from%24).padStart(2,"0")}:00–${String(r.to%24).padStart(2,"0")}:00 · <b>${esc(r.name)}</b></span><span class="muted">${r.genres.join(" + ")}</span></div>`).join("")}</div><div class="row" style="margin-top:18px"><button class="btn primary" id="rv">▶ Listen live</button></div>`; $("#rv").onclick=startRadio; }
function videosView(){ main.innerHTML=`<h1>Shorts</h1><p class="muted">Short-form videos from Robert's YouTube channel. Robert's song videos first; the other tiles are examples until the real channel is linked.</p><div class="videos">${videoTiles(12)}</div>`; }
function pricing(){ main.innerHTML=`<h1>Pricing</h1><p class="muted">Three simple ways to use Robert's music.</p>${tiersHTML()}
 <div class="section-head"><h2>Questions</h2></div><div class="faq">
 <details open><summary>If I buy a song, is it only mine?</summary><p>No, buying usage rights is non-exclusive. The song stays in the Velora catalogue and others can license it too. If you need it to be yours alone, request Exclusive rights and the song will be removed for new buyers only when you ask.</p></details>
 <details><summary>What does renting cover?</summary><p>Use in your videos and posts on one channel while the rental is active. Example terms.</p></details>
 <details><summary>How do I prove I have a license?</summary><p>Every license comes with a dated certificate and an ID you can check on the Verify page.</p></details>
 <details><summary>Who makes the music?</summary><p>Robert writes the lyrics, concepts and song design, and produces the music with Suno.</p></details></div>`; }
function verify(params){ const id=params.get("id")||""; main.innerHTML=`<h1>Verify a license</h1><p class="muted">Enter a license ID to see its record and date.</p><form id="vf" class="row" style="max-width:560px"><div class="field" style="flex:1;margin:0"><label for="vid" class="sr">License ID</label><input id="vid" placeholder="VL-2026-XXXXXX" value="${esc(id)}"></div><button class="btn primary">Verify</button></form><div id="vr" style="margin-top:18px;max-width:640px"></div>`;
 const run=()=>{ const v=$("#vid").value.trim().toUpperCase(); const rec=JSON.parse(localStorage.getItem("velora_licenses")||"[]").find(r=>r.lic===v); $("#vr").innerHTML= !v?"": rec?`<div class="cert"><h3>Valid license (demo)</h3><dl><dt>License ID</dt><dd>${rec.lic}</dd><dt>Song</dt><dd>${esc(rec.title)} (${rec.song})</dd><dt>Type</dt><dd>${esc(rec.type)}</dd><dt>Issued</dt><dd>${new Date(rec.issued).toLocaleString("en-GB",{dateStyle:"long",timeStyle:"short"})}</dd><dt>Song created</dt><dd>${rec.songDate}</dd></dl></div>`:`<div class="note">No license found with that ID. In this demo, licenses are only stored in this browser.</div>`; };
 $("#vf").onsubmit=e=>{e.preventDefault();run();}; if(id) run(); }

// ---------- Global clicks ----------
document.addEventListener("click",e=>{
  const v=e.target.closest("[data-video]"); if(v){ e.preventDefault(); openVideo(byId(v.dataset.video)); return; }
  const p=e.target.closest("[data-play]"); if(p){ e.preventDefault(); mode="library"; const s=byId(p.dataset.play); queue=S.filter(x=>x.genre===s.genre); load(s,true,+(p.dataset.at||0)); return; }
  const l=e.target.closest("[data-lic]"); if(l){ e.preventDefault(); openLicense(byId(l.dataset.lic), l.dataset.pre||"rent"); return; }
  if(e.target.closest("[data-sub]")){ e.preventDefault(); openLicense(current||S[0],"rent"); setTimeout(()=>{const r=document.querySelector('input[value=sub]'); if(r) r.checked=true;},0); return; }
  if(e.target.closest("[data-todo]")){ e.preventDefault(); }
});
$("#q").addEventListener("input",e=>{ libState.q=e.target.value; libState.page=1; if(!location.hash.startsWith("#/library")) location.hash="#/library"; else library(new URLSearchParams()); });

function route(){
  const h=location.hash.slice(1)||"/"; const [path,qs]=h.split("?"); const params=new URLSearchParams(qs||"");
  document.querySelectorAll("nav a").forEach(a=>a.classList.toggle("active", a.getAttribute("href")==="#"+path || (path.startsWith("/song")&&a.getAttribute("href")==="#/library")));
  if(path==="/") home(); else if(path==="/library") library(params); else if(path.startsWith("/song/")) song(path.split("/")[2]);
  else if(path==="/radio") radioView(); else if(path==="/videos") videosView(); else if(path==="/pricing") pricing(); else if(path==="/verify") verify(params); else home();
  window.scrollTo(0,0);
}
window.addEventListener("hashchange",route); route();
})();
