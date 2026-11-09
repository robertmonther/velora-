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
 {from:2,to:6,name:"Late Night",genres:["Explicit Sensual","Lo-fi"],mood:"Late night"}
];
const fmt = t => { t=Math.max(0,Math.floor(t||0)); return Math.floor(t/60)+":"+String(t%60).padStart(2,"0"); };
const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
const icon = (name, cls="") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const coverStyle = s => { if(s.art) return `background:#141418 url('${url(s.art)}') center/cover no-repeat`; const p=PAL[s.hue||0]; const a=GENRE_ANGLE[s.genre]||0; return `background:radial-gradient(circle at ${30+(a%60)}% ${25+(a%40)}%, ${p[0]} 0%, transparent 60%),linear-gradient(${a}deg, ${p[1]}, #141418 80%), ${p[0]}`; };
const cover = (s,cls="cover") => `<div class="${cls}" style="${coverStyle(s)}" role="img" aria-label="Cover of ${esc(s.title)}">${s.real?'<span class="tag new">Robert original</span>':""}<span>${esc(s.title)}</span></div>`;
const byId = id => S.find(s=>s.id===id);
const artistOf = s => s.artist || "Robert Mo";
const hasLyrics = s => !!(s.lyrics && !/coming soon|placeholder/i.test(s.lyrics));
// Browser storage can be missing or blocked: never let it break the page.
const store = {
  get(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
};
// Explicit songs carry an "E" badge, like Spotify, and play like every other song (Robert's decision, 9 Nov).
const eb = s => s.explicit ? '<span class="e-badge" title="Explicit lyrics" aria-label="Explicit">E</span>' : "";

// ---------- Colour from the cover (Spotify-style background) ----------
function hexToHsl(hex){
  let h=hex.replace("#",""); if(h.length===3) h=h.split("").map(c=>c+c).join("");
  const r=parseInt(h.slice(0,2),16)/255, g=parseInt(h.slice(2,4),16)/255, b=parseInt(h.slice(4,6),16)/255;
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b), L=(mx+mn)/2; let H=0, Sx=0;
  if(mx!==mn){ const d=mx-mn; Sx = L>0.5 ? d/(2-mx-mn) : d/(mx+mn); H = mx===r ? (g-b)/d+(g<b?6:0) : mx===g ? (b-r)/d+2 : (r-g)/d+4; H*=60; }
  return [Math.round(H), Math.round(Sx*100), Math.round(L*100)];
}
function themeOf(song){
  const [h,s,l] = hexToHsl(song.color || PAL[song.hue||0][0]);
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

// ---------- Player ----------
let queue = S.slice(), qi = -1, current = null, mode = "library", source = "Robert's songs", shuffle = false;
let npOpen = false, videoOn = false, lastSec = -1, lastPos = 0, lastFocus = null, pendingHash = null;

function load(song, autoplay=true, at=0){
  current = song; qi = queue.indexOf(song); if(qi<0){ queue=[song]; qi=0; }
  audio.src = url(song.audio);
  audio.addEventListener("loadedmetadata", function f(){ audio.removeEventListener("loadedmetadata",f); if(at) audio.currentTime = at; }, {once:true});
  if(autoplay) audio.play().catch(()=>setPlayIcons());
  $("#mini").hidden = false; document.body.classList.add("has-mini");
  paintMini(song); renderNP(song); applyTheme(song); setMediaSession(song); paintBars(); setPlayIcons();
}
function playFrom(list, song, label, at=0, after=null){
  mode="library"; queue=list.slice(); if(!queue.includes(song)) queue.unshift(song); source=label; load(song,true,at);
  if(after) after();
}
function togglePlay(){ if(!current){ startStream(); return; } if(audio.paused) audio.play().catch(()=>{}); else audio.pause(); }
function next(){
  if(!current) return;
  if(mode==="radio"){ load(radioPick()); return; }
  if(shuffle && queue.length>1){ let i; do{ i=Math.floor(Math.random()*queue.length); }while(i===qi); load(queue[i]); return; }
  if(qi<queue.length-1){ load(queue[qi+1]); return; }
  // End of the list: keep the music going with similar songs (like Netflix autoplay).
  const more=suggestions(current,10); if(more.length){ source="Autoplay · similar songs"; queue=[current,...more]; load(more[0]); }
}
function prev(){ if(!current) return; if(audio.currentTime>3 || qi<=0){ audio.currentTime=0; return; } load(queue[qi-1]); }
function bestPart(){ if(current){ audio.currentTime=current.bestPart||0; audio.play().catch(()=>{}); } }
function startStream(){ if(!current){ const list=REAL.length?REAL:S; playFrom(list, list[0], REAL.length?"Robert's songs":"Velora"); } openNP(); }
function suggestions(s,n=8){
  const score = x => (x.real?3:0)+(x.genre===s.genre?2:0)+(x.mood===s.mood?1:0);
  return S.filter(x=>x!==s).map((x,i)=>[x,score(x),i]).sort((a,b)=>b[1]-a[1]||a[2]-b[2]).slice(0,n).map(a=>a[0]);
}

function paintMini(s){
  $("#miniCover").setAttribute("style", coverStyle(s));
  $("#miniTitle").textContent = s.title;
  $("#miniSub").innerHTML = eb(s) + esc(artistOf(s)) + (mode==="radio" ? " · Velora Radio" : "");
  paintTicks($("#miniBar"), s);
}
function paintTicks(bar, s){ const d=s.duration||1; bar.querySelector(".bar-ticks").innerHTML = s.sections.filter(x=>x.start>0).map(x=>`<i style="left:${x.start/d*100}%"></i>`).join(""); }
function paintBars(){
  const d=audio.duration||(current&&current.duration)||1, t=audio.currentTime||0, p=Math.min(100,t/d*100);
  for(const b of [$("#miniBar"),$("#npBar")]){ b.querySelector(".bar-fill").style.width=p+"%"; b.querySelector(".bar-knob").style.left=p+"%"; b.setAttribute("aria-valuenow",Math.round(p)); b.setAttribute("aria-valuetext",fmt(t)+" of "+fmt(d)); }
  $("#miniProg").style.width=p+"%"; $("#miniCur").textContent=fmt(t); $("#miniDur").textContent=fmt(d); $("#npCur").textContent=fmt(t); $("#npDur").textContent=fmt(d);
}
function bindBar(bar){
  let drag=false;
  const seek=e=>{ if(!current) return; const r=bar.getBoundingClientRect(); const x=clamp((e.clientX-r.left)/r.width,0,1); audio.currentTime=x*(audio.duration||current.duration); paintBars(); };
  bar.addEventListener("pointerdown",e=>{ drag=true; try{ bar.setPointerCapture(e.pointerId); }catch(_){} seek(e); });
  bar.addEventListener("pointermove",e=>{ if(drag) seek(e); });
  bar.addEventListener("pointerup",()=>{ drag=false; }); bar.addEventListener("pointercancel",()=>{ drag=false; });
  bar.addEventListener("keydown",e=>{ if(!current) return; if(e.key==="ArrowRight"){ audio.currentTime+=5; e.preventDefault(); } if(e.key==="ArrowLeft"){ audio.currentTime-=5; e.preventDefault(); } });
}
[$("#miniBar"),$("#npBar")].forEach(bindBar);
function setPlayIcons(){ const playing=!audio.paused; for(const id of ["#miniPlay","#npPlay"]){ const b=$(id); b.innerHTML=icon(playing?"pause":"play"); b.setAttribute("aria-label",playing?"Pause":"Play"); } }

audio.addEventListener("play",()=>{ setPlayIcons(); syncVideo(true); });
audio.addEventListener("pause",()=>{ setPlayIcons(); syncVideo(true); });
audio.addEventListener("seeked",()=>syncVideo(true));
audio.addEventListener("ended",next);
audio.addEventListener("loadedmetadata",()=>{ paintBars(); setPosition(); });
audio.addEventListener("timeupdate",()=>{ paintBars(); syncVideo(false); markSection(); const now=Date.now(); if(now-lastPos>4000){ lastPos=now; setPosition(); } });

$("#miniOpen").onclick=openNP;
$("#miniPlay").onclick=togglePlay; $("#npPlay").onclick=togglePlay;
$("#miniPrev").onclick=prev; $("#npPrev").onclick=prev;
$("#miniNext").onclick=next; $("#npNext").onclick=next;
$("#miniBest").onclick=bestPart; $("#npBest").onclick=bestPart;
const licCurrent=()=>{ if(current) openLicense(current); };
$("#miniLicense").onclick=licCurrent; $("#miniLicIcon").onclick=licCurrent; $("#npLicense").onclick=licCurrent; $("#npLicTop").onclick=licCurrent;
$("#npClose").onclick=()=>closeNP(false);
$("#npShuffle").onclick=()=>{ shuffle=!shuffle; const b=$("#npShuffle"); b.setAttribute("aria-pressed",String(shuffle)); b.classList.toggle("on",shuffle); };
$("#npSections").addEventListener("click",e=>{ const b=e.target.closest(".sec"); if(b&&current){ audio.currentTime=+b.dataset.t; audio.play().catch(()=>{}); markSection(true); } });

// ---------- Now Playing screen ----------
function renderNP(s){
  $("#npFrom").textContent = mode==="radio" ? "Velora Radio" : source;
  const art=$("#npArt"); art.setAttribute("style",coverStyle(s)); art.setAttribute("aria-label","Cover of "+s.title);
  art.innerHTML = s.art ? "" : `<span class="np-art-title">${esc(s.title)}</span>`; // songs without a cover yet show their title
  $("#npTitle").textContent=s.title; $("#npArtist").innerHTML=eb(s)+esc(artistOf(s));
  paintTicks($("#npBar"), s);
  const d=s.duration;
  $("#npSections").innerHTML = s.sections.map((x,j)=>{ const end=(s.sections[j+1]||{start:d}).start, best=x.start===s.bestPart;
    return `<button type="button" class="sec${best?" best":""}" data-t="${x.start}" aria-label="${esc(x.name)}, ${fmt(x.start)} to ${fmt(end)}${best?", best part":""}">${best?icon("spark"):""}${esc(x.name)} <small>${fmt(x.start)}</small></button>`; }).join("");
  $("#npCards").innerHTML = mediaCards(s) + licenseCard(s) + aboutCard(s) + nextCard(s);
  lastSec=-1; markSection(true);
  if(videoOn && s.video) startVideo();
}
function mediaCards(s){
  let h="";
  if(s.video){ const poster=url(s.poster||s.art);
    h+=`<div class="np-card media"><div class="card-h">${icon("video")}<span>Video</span></div>
      <div class="np-video" style="background-image:url('${poster}')"><video id="npVideo" muted playsinline preload="none" disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback" poster="${poster}"></video>
      <button type="button" class="np-video-btn" id="npVideoBtn">${icon("play")}<span>Play the video with the song</span></button></div>
      <p class="muted small" style="margin:0;text-align:center">The video follows the song you're hearing.</p></div>`; }
  if(hasLyrics(s)){ const lines=s.lyrics.split("\n");
    h+=`<div class="np-card lyrics"><div class="card-h"><span>Lyrics</span></div><div class="lyr" id="npLyr">${esc(lines.slice(0,6).join("\n"))}</div>${lines.length>6?`<button type="button" class="btn light sm" id="npLyrMore">Show lyrics</button>`:""}</div>`; }
  else h+=`<div class="np-card${s.video?"":" lyrics"}"><div class="card-h"><span>Lyrics</span></div><p class="muted" style="margin:0">Lyrics by Robert, coming soon.</p></div>`;
  return h;
}
function licenseCard(s){
  return `<div class="np-card"><div class="card-h">${icon("tag")}<span>Use this song in your videos</span></div>
    <div class="lic-row"><button type="button" class="btn red" data-lic="${s.id}">Rent ${PRICES.rent.price}</button><button type="button" class="btn blue" data-lic="${s.id}" data-pre="buy">Buy rights ${PRICES.buy.price}</button></div>
    <p class="muted small" style="margin:0">Example prices. Every license comes with a dated certificate.</p></div>`;
}
function aboutCard(s){
  return `<div class="np-card"><div class="card-h"><span>About the song</span></div>
    <div class="facts np-facts"><div class="fact"><b>Genre</b>${esc(s.genre)}</div><div class="fact"><b>Mood</b>${esc(s.mood)}</div><div class="fact"><b>Length</b>${fmt(s.duration)}</div><div class="fact"><b>BPM</b>${s.bpm||"–"}</div>${s.key?`<div class="fact"><b>Key</b>${esc(s.key)}</div>`:""}<div class="fact"><b>Content</b>${s.explicit?"Explicit lyrics":"Clean"}</div></div>
    <p class="small" style="margin:0 0 12px">${esc(artistOf(s))}. Lyrics, concept and song design by Robert; music made with Suno (AI-assisted).</p>
    <a class="btn ghost sm" href="#/song/${s.id}" data-close-np>Open the song page</a></div>`;
}
function nextCard(s){
  const up = mode==="radio" ? null : queue[qi+1];
  return `<div class="np-card">${up?`<div class="card-h"><span>Up next</span></div><div class="rows">${srow(up,"queue")}</div>`:""}
    <div class="card-h"${up?' style="margin-top:14px"':""}><span>More like this</span></div><div class="rows">${suggestions(s).map(x=>srow(x,"sug")).join("")}</div></div>`;
}
const srow = (x,kind) => `<button type="button" class="srow" data-${kind}="${x.id}"><span class="srow-cover" style="${coverStyle(x)}"></span><span class="srow-t"><b>${esc(x.title)}</b><small>${eb(x)}${esc(x.genre)} · ${esc(x.mood)} · ${fmt(x.duration)}</small></span>${icon("play","srow-i")}</button>`;
$("#npCards").addEventListener("click",e=>{
  if(e.target.closest("#npVideoBtn")){ startVideo(); return; }
  const more=e.target.closest("#npLyrMore"); if(more){ $("#npLyr").textContent=current.lyrics; more.remove(); return; }
  const sg=e.target.closest("[data-sug]"); if(sg){ const x=byId(sg.dataset.sug), from=current; playFrom([x,...suggestions(x,8)], x, "More like "+from.title); $("#npScroll").scrollTo({top:0,behavior:"smooth"}); return; }
  const qu=e.target.closest("[data-queue]"); if(qu){ load(byId(qu.dataset.queue)); $("#npScroll").scrollTo({top:0,behavior:"smooth"}); }
});
function markSection(force){
  if(!current || (!npOpen && !force)) return;
  const t=audio.currentTime||0; let idx=0; current.sections.forEach((x,i)=>{ if(t>=x.start) idx=i; });
  if(idx===lastSec && !force) return; lastSec=idx;
  document.querySelectorAll("#npSections .sec").forEach((b,i)=>b.classList.toggle("on",i===idx));
}
// The video plays muted and follows the audio, so the song never plays twice.
function startVideo(){
  const v=$("#npVideo"); if(!v||!current||!current.video) return;
  videoOn=true; const btn=$("#npVideoBtn"); if(btn) btn.hidden=true;
  if(!v.getAttribute("src")){ v.preload="auto"; v.src=url(current.video); }
  v.addEventListener("loadedmetadata",()=>syncVideo(true),{once:true});
  syncVideo(true);
}
function syncVideo(hard){
  const v=$("#npVideo"); if(!v || !v.getAttribute("src")) return;
  if(!npOpen || audio.paused){ if(!v.paused) v.pause(); return; }
  if(v.readyState>=1 && (hard || Math.abs(v.currentTime-audio.currentTime)>0.45)){ try{ v.currentTime=audio.currentTime; }catch(e){} }
  if(v.paused) v.play().catch(()=>{});
}
const SHELL = [".demo-banner","header.topbar","main","footer","#mini","nav.tabbar"];
function setInert(on){ SHELL.forEach(sel=>{ const el=$(sel); if(!el) return; if(on) el.setAttribute("inert",""); else el.removeAttribute("inert"); }); }
function openNP(){
  if(!current || npOpen) return;
  npOpen=true; lastFocus=document.activeElement;
  const np=$("#np"); np.classList.add("open"); np.setAttribute("aria-hidden","false");
  document.body.classList.add("np-open"); setInert(true);
  try{ history.pushState({velNP:1},""); }catch(e){}
  setTimeout(()=>{ try{ $("#npClose").focus({preventScroll:true}); }catch(e){} },40);
  markSection(true); syncVideo(true);
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
  try{ navigator.mediaSession.metadata = new MediaMetadata({ title:s.title, artist:artistOf(s), album:"Velora", artwork: s.art ? [{src:url(s.art), sizes:"600x600", type:"image/jpeg"}] : [] }); }catch(e){}
}
function setPosition(){
  if(!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
  const d=audio.duration; if(!d || !isFinite(d)) return;
  try{ navigator.mediaSession.setPositionState({duration:d, playbackRate:audio.playbackRate||1, position:Math.min(audio.currentTime,d)}); }catch(e){}
}
if("mediaSession" in navigator){
  const H=(a,f)=>{ try{ navigator.mediaSession.setActionHandler(a,f); }catch(e){} };
  H("play",()=>audio.play().catch(()=>{})); H("pause",()=>audio.pause()); H("previoustrack",prev); H("nexttrack",next);
  H("seekbackward",()=>{ audio.currentTime=Math.max(0,audio.currentTime-10); }); H("seekforward",()=>{ audio.currentTime+=10; });
  H("seekto",d=>{ if(d && d.seekTime!=null) audio.currentTime=d.seekTime; });
}
// No download button anywhere; also block the "save" menu on covers and videos.
document.addEventListener("contextmenu",e=>{ if(e.target.closest("video,audio,.cover,.np-art,.mini-cover,.srow-cover,.vid,.np-video")) e.preventDefault(); });

// ---------- Radio ----------
function slotNow(h=new Date().getHours()){ const hh = h<2? h+24 : h; return RADIO.find(r=> hh>=r.from && hh<r.to) || RADIO[0]; }
let radioMood = null;
let radioRealIdx = 0;
function radioPick(){
  // Robert's real songs play in order, then alternate with the example rotation.
  const R=REAL;
  if(R.length && !radioMood && (radioRealIdx < R.length || Math.random()<0.6)){ const s=R[radioRealIdx % R.length]; radioRealIdx++; return s; }
  const slot=slotNow(); let pool=S.filter(s=> radioMood ? s.mood===radioMood : (slot.genres.includes(s.genre)||s.real)); if(!pool.length) pool=S;
  pool=pool.filter(s=>s!==current); if(!pool.length) pool=S;
  return pool[Math.floor(Math.random()*pool.length)];
}
function startRadio(){ mode="radio"; source="Velora Radio"; queue=S.slice(); if(!radioMood) radioRealIdx=0; load(radioPick()); }

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
   <div class="paybar">
     <span class="muted small">Demo checkout. Nothing is charged.</span>
     <button class="btn primary" type="submit">Pay (demo)</button>
   </div>
  </form>`;
  m.hidden=false; m.querySelector(".modal").scrollTop=0;
  const chosen=b.querySelector("input:checked"); if(chosen) chosen.focus({preventScroll:true});
  $("#lic").onsubmit = async e => { e.preventDefault(); const t=new FormData(e.target).get("t"); if(t==="excl"){ b.innerHTML=`<h2 id="mTitle">Exclusive request sent (demo)</h2><p>Robert would get your request for “${esc(song.title)}” and reply by email. Nothing was charged.</p><button class="btn" id="mDone">Close</button>`; $("#mDone").onclick=closeM; return;} showCert(song,t); };
}
async function hash(str){ try{ const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str)); return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join(""); }catch(e){ let h=0; for(const c of str) h=(h*31+c.charCodeAt(0))>>>0; return h.toString(16).padStart(8,"0").repeat(8);} }
async function showCert(song,t){
  const now=new Date(); const iso=now.toISOString(); const lic="VL-"+now.getFullYear()+"-"+Math.random().toString(36).slice(2,8).toUpperCase();
  const fp=await hash(song.id+song.title+song.published);
  const rec={lic,song:song.id,title:song.title,type:PRICES[t].label,issued:iso,songDate:song.published,fp};
  const all=store.get("velora_licenses",[]); all.push(rec); store.set("velora_licenses",all);
  $("#mBody").innerHTML = `<h2 id="mTitle">You're licensed (demo)</h2>
  <div class="cert"><h3>Velora License Certificate</h3><div class="small">Example certificate. Not a real license.</div>
  <dl><dt>License ID</dt><dd><b>${lic}</b></dd><dt>Song</dt><dd>${esc(song.title)} (${song.id})</dd><dt>Type</dt><dd>${PRICES[t].label}</dd>
  <dt>Issued</dt><dd>${now.toLocaleString("en-GB",{dateStyle:"long",timeStyle:"short"})}</dd><dt>Song created</dt><dd>${new Date(song.published).toLocaleDateString("en-GB",{dateStyle:"long"})}</dd>
  <dt>Creator</dt><dd>${esc(artistOf(song))} · Suno-assisted</dd><dt>Fingerprint</dt><dd style="word-break:break-all;font-family:monospace;font-size:12px">${fp.slice(0,32)}…</dd></dl></div>
  <div class="row" style="margin-top:14px"><a class="btn primary" href="#/verify?id=${lic}" id="mVerify">Verify this license</a><button class="btn" id="mDone">Close</button></div>`;
  $("#mDone").onclick=closeM; $("#mVerify").onclick=e=>{ e.preventDefault(); closeM(); const h="#/verify?id="+lic; if(npOpen) closeNP(false, h); else location.hash=h; };
}
function closeM(){ const v=document.querySelector("#mBody video"); if(v) v.pause(); $("#modal").hidden=true; }
$("#mClose").onclick=closeM; $("#modal").addEventListener("click",e=>{ if(e.target.id==="modal") closeM(); });
document.addEventListener("keydown",e=>{ if(e.key!=="Escape") return; if(!$("#modal").hidden) closeM(); else if(npOpen) closeNP(false); });

// ---------- Views ----------
const card = s => `<article class="card">${cover(s)}<button class="playbtn" data-play="${s.id}" aria-label="Play ${esc(s.title)}">${icon("play")}</button>
 <h3><a href="#/song/${s.id}">${esc(s.title)}</a></h3><div class="meta">${eb(s)}${esc(s.genre)} · ${esc(s.mood)} · ${fmt(s.duration)}</div>
 <div class="actions"><button class="btn ghost" data-play="${s.id}">Play</button><button class="btn primary" data-lic="${s.id}">License</button></div></article>`;

function home(){
  const slot=slotNow(); const sample=REAL[0]||S.filter(s=>slot.genres.includes(s.genre)).slice(0,1)[0]||S[0];
  const moods=[...new Set(S.map(s=>s.mood))];
  main.innerHTML = `
  <section class="hero">
   <div class="hero-main"><div class="onair" style="color:var(--cream)">Robert's music only</div>
    <h1>Whole songs.<br>Ready for your story.</h1>
    <p>Listen to every song from start to finish, see its sections, and license it for your videos in two clicks.</p>
    <div class="row"><a class="btn primary" href="#/library">Browse the library</a><button class="btn blue" id="hRadio">${icon("play")}Start Velora Radio</button><a class="btn ghost" href="#/pricing">See pricing</a></div></div>
   <aside class="radio-card" aria-label="Velora Radio">
    <div class="onair">Velora Radio · on air</div>
    <div class="now">${cover(sample)}<div><b>${esc(slot.name)}</b><div class="muted small">${slot.genres.join(" + ")} · ${slot.mood}</div><button class="btn primary" style="margin-top:8px" id="rPlay">${icon("play")}Listen live</button></div></div>
    <div><div class="muted small" style="margin-bottom:6px">Today's schedule</div><div class="schedule">${RADIO.map(r=>`<div class="slot ${r===slot?"live":""}"><span>${String(r.from%24).padStart(2,"0")}:00–${String(r.to%24).padStart(2,"0")}:00</span><span>${esc(r.name)}</span></div>`).join("")}</div></div>
    <div><div class="muted small" style="margin-bottom:6px">Or tune by mood</div><div class="chips" style="margin:0">${moods.slice(0,6).map(m=>`<button class="chip" data-rmood="${esc(m)}">${esc(m)}</button>`).join("")}</div></div>
   </aside>
  </section>
  ${REAL.length?`<div class="section-head"><div><h2>Robert's songs</h2><div class="muted small">${REAL.length} real songs, playable in full. Also first on Velora Radio.</div></div><button class="btn primary" id="hAll">${icon("play")}Play all</button></div>
  <div class="grid">${REAL.map(card).join("")}</div>`:""}
  <div class="section-head"><div><h2>Genres</h2><div class="muted small">${G.length} genres · ${REAL.length} real songs and ${S.length-REAL.length} example songs (the full library will hold Robert's 1000+ songs)</div></div><a href="#/library" class="btn ghost">Open library</a></div>
  <div class="chips">${G.map(g=>`<a class="chip" href="#/library?genre=${encodeURIComponent(g)}">${esc(g)}</a>`).join("")}</div>
  <div class="section-head"><h2>More in the catalogue</h2><div class="muted small">Example songs</div></div>
  <div class="grid">${S.filter(s=>!s.real).slice().sort((a,b)=>b.published.localeCompare(a.published)).slice(0,10).map(card).join("")}</div>
  <div class="section-head"><div><h2>Shorts</h2><div class="muted small">Robert's song videos</div></div><a href="#/videos" class="btn ghost">All videos</a></div>
  <div class="videos">${videoTiles(6)}</div>
  <div class="section-head"><h2>Three ways to use the music</h2></div>
  ${tiersHTML()}`;
  $("#hRadio").onclick=startRadio; $("#rPlay").onclick=startRadio; const ha=$("#hAll"); if(ha) ha.onclick=()=>playFrom(REAL, REAL[0], "Robert's songs");
  main.querySelectorAll("[data-rmood]").forEach(b=>b.onclick=()=>{ radioMood=b.dataset.rmood; main.querySelectorAll("[data-rmood]").forEach(x=>x.classList.toggle("on",x===b)); startRadio(); });
}
function videoTiles(n){
  const real=REAL.filter(s=>s.video).map(s=>`<a class="vid" href="#" data-video="${s.id}" style="background:#141418 url('${url(s.poster||s.art)}') center/cover no-repeat" aria-label="Watch ${esc(s.title)}"><span class="yt">▶ Video</span><div class="ov"><b>${esc(s.title)}</b><div class="small muted">Robert Monther</div></div></a>`);
  const ex=S.filter(s=>!s.real).slice(0,Math.max(0,n-real.length)).map((s,i)=>`<a class="vid" href="#" data-todo style="${coverStyle(s)}"><span class="yt">YouTube Short</span><div class="ov"><b>${esc(s.title)}</b><div class="small muted">Example video ${i+1}</div></div></a>`);
  return real.concat(ex).join("");
}
function openVideo(s){ audio.pause(); const m=$("#modal"), b=$("#mBody"); b.innerHTML=`<h2 id="mTitle">${esc(s.title)}</h2><video src="${url(s.video)}" poster="${url(s.poster||s.art)}" controls autoplay playsinline disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback" style="width:100%;max-height:70vh;border-radius:12px;background:#000"></video><div class="row" style="margin-top:12px"><button class="btn primary" data-lic="${s.id}">License this song</button><a class="btn ghost" href="#/song/${s.id}" id="mSong">Song page</a></div>`; m.hidden=false; $("#mSong").onclick=closeM; }
function tiersHTML(){ return `<div class="tiers">
  <div class="tier"><h3>Rent a track</h3><div class="price">${PRICES.rent.price}</div><div class="muted small">${PRICES.rent.per}</div><ul><li>One song, one channel</li><li>Perfect for a single video or campaign</li><li>Dated certificate</li></ul><a class="btn" href="#/library">Pick a song</a></div>
  <div class="tier feat"><h3>Buy usage rights</h3><div class="price">${PRICES.buy.price}</div><div class="muted small">${PRICES.buy.per}</div><ul><li>Use it forever, non-exclusive</li><li>The song stays in the catalogue</li><li>Exclusive available on request</li><li>Dated certificate</li></ul><a class="btn primary" href="#/library">Pick a song</a></div>
  <div class="tier"><h3>Premium</h3><div class="price">${PRICES.sub.price}</div><div class="muted small">${PRICES.sub.per}</div><ul><li>Rent any song while subscribed</li><li>Every genre, every new release</li><li>Cancel anytime</li></ul><button class="btn blue" data-sub>Start Premium (demo)</button></div>
 </div><p class="muted small">Example prices. Robert sets the real ones.</p>`; }

let libState={genre:null,mood:null,q:"",page:1};
function library(params){
  if(params.get("genre")) libState.genre=params.get("genre");
  const moods=[...new Set(S.map(s=>s.mood))].sort();
  main.innerHTML=`<h1>Library</h1><p class="muted">Every song by Robert, in full. Filter by genre and mood, play, and license.</p>
  <div class="libsearch"><label for="libq" class="sr">Search songs</label><input id="libq" type="search" placeholder="Search songs, genres, moods" value="${esc(libState.q)}"></div>
  <div class="muted small" style="margin:6px 0">Genre</div><div class="chips">${["All",...G].map(g=>`<button class="chip ${((g==="All"&&!libState.genre)||g===libState.genre)?"on":""}" data-g="${esc(g)}">${esc(g)}</button>`).join("")}</div>
  <div class="muted small" style="margin-bottom:6px">Mood</div><div class="chips">${["All",...moods].map(m=>`<button class="chip ${((m==="All"&&!libState.mood)||m===libState.mood)?"on":""}" data-m="${esc(m)}">${esc(m)}</button>`).join("")}</div>
  <div id="libResults"></div>`;
  main.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{libState.genre=b.dataset.g==="All"?null:b.dataset.g;libState.page=1;history.replaceState(history.state,"","#/library");library(new URLSearchParams());});
  main.querySelectorAll("[data-m]").forEach(b=>b.onclick=()=>{libState.mood=b.dataset.m==="All"?null:b.dataset.m;libState.page=1;library(new URLSearchParams());});
  const lq=$("#libq"); lq.addEventListener("input",e=>{ libState.q=e.target.value; libState.page=1; $("#q").value=libState.q; drawLib(); });
  drawLib();
  if(params.get("focus")==="search") setTimeout(()=>{ try{ lq.focus(); }catch(e){} },60);
}
function drawLib(){
  const q=libState.q.toLowerCase();
  const list=S.filter(s=>(!libState.genre||s.genre===libState.genre)&&(!libState.mood||s.mood===libState.mood)&&(!q||(s.title+" "+s.genre+" "+s.mood).toLowerCase().includes(q)));
  const per=20, pages=Math.max(1,Math.ceil(list.length/per)); libState.page=Math.min(libState.page,pages);
  const box=$("#libResults"); if(!box) return;
  box.innerHTML=`<div class="muted small" style="margin-bottom:10px">${list.length} song${list.length===1?"":"s"}</div>
  <div class="grid">${list.slice((libState.page-1)*per,libState.page*per).map(card).join("")||'<p class="muted">No songs match.</p>'}</div>
  <div class="pager">${pages>1?Array.from({length:pages},(_,i)=>`<button class="chip ${i+1===libState.page?"on":""}" data-p="${i+1}">${i+1}</button>`).join(""):""}</div>`;
  box.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{libState.page=+b.dataset.p;drawLib();window.scrollTo(0,0);});
}
function song(id){
  const s=byId(id); if(!s){ main.innerHTML="<h1>Song not found</h1>"; return; }
  const d=s.duration;
  main.innerHTML=`<div class="split"><div>${cover(s,"cover song-cover")}</div><div>
   <div class="muted small">${esc(s.genre)} · ${esc(s.mood)}</div><h1>${esc(s.title)}</h1><div class="muted">${eb(s)}${esc(artistOf(s))}</div>
   <div class="facts"><div class="fact"><b>Length</b>${fmt(d)}</div><div class="fact"><b>BPM</b>${s.bpm}</div>${s.key?`<div class="fact"><b>Key</b>${esc(s.key)}</div>`:""}<div class="fact"><b>Released</b>${s.published}</div><div class="fact"><b>Content</b>${s.explicit?"Explicit lyrics":"Clean"}</div></div>
   <div class="row"><button class="btn primary" data-play="${s.id}" data-np>${icon("play")}Play full song</button><button class="btn red" data-lic="${s.id}">Rent ${PRICES.rent.price}</button><button class="btn blue" data-lic="${s.id}" data-pre="buy">Buy rights ${PRICES.buy.price}</button>${s.video?`<button class="btn ghost" data-video="${s.id}">Watch video</button>`:""}</div>${s.analysisNote?`<p class="muted small">${esc(s.analysisNote)}</p>`:""}
   <div class="panel"><h3>Song map</h3><p class="muted small">Where each part starts and ends. Click to jump there.${s.sectionsEstimated?" Parts are estimated from the song's energy.":""}</p>
    <div class="schedule">${s.sections.map((x,j)=>`<button class="slot" style="border:0;color:inherit;cursor:pointer;font:inherit" data-play="${s.id}" data-at="${x.start}"><span>${esc(x.name)}${x.start===s.bestPart?" · best part":""}</span><span class="muted">${fmt(x.start)} – ${fmt((s.sections[j+1]||{start:d}).start)}</span></button>`).join("")}</div></div>
   <div class="panel prov"><div class="seal">✓</div><div><h3 style="margin-bottom:4px">Provenance record</h3><div class="small">${s.real?(s.created?"Made with Suno · created":esc(s.provenance)+" · added"):"Created by Robert Mo with Suno · first published"} <b>${new Date(s.created||s.published).toLocaleDateString("en-GB",{dateStyle:"long"})}</b> · catalogue ID ${s.id}</div><div class="muted small">Each license gets a dated certificate you can verify on the Verify page.${s.real?"":" Example data."}</div></div></div>
   <div class="panel"><h3>Lyrics</h3><div class="lyrics">${esc(s.lyrics)}</div></div>
  </div></div>
  <div class="section-head"><h2>More ${esc(s.genre)}</h2></div><div class="grid">${S.filter(x=>x.genre===s.genre&&x.id!==s.id).slice(0,5).map(card).join("")}</div>`;
}
function radioView(){ main.innerHTML=`<h1>Velora Radio</h1><p class="muted">One station for every genre. It follows the time of day, or you can tune it to a mood.</p><div class="schedule" style="max-width:640px">${RADIO.map(r=>`<div class="slot ${r===slotNow()?"live":""}"><span>${String(r.from%24).padStart(2,"0")}:00–${String(r.to%24).padStart(2,"0")}:00 · <b>${esc(r.name)}</b></span><span class="muted">${r.genres.join(" + ")}</span></div>`).join("")}</div><div class="row" style="margin-top:18px"><button class="btn primary" id="rv">${icon("play")}Listen live</button></div>`; $("#rv").onclick=startRadio; }
function videosView(){ main.innerHTML=`<h1>Shorts</h1><p class="muted">Short-form videos from Robert's YouTube channel. Robert's song videos first; the other tiles are examples until the real channel is linked.</p><div class="videos">${videoTiles(12)}</div>`; }
function pricing(){ main.innerHTML=`<h1>Pricing</h1><p class="muted">Three simple ways to use Robert's music.</p>${tiersHTML()}
 <div class="section-head"><h2>Questions</h2></div><div class="faq">
 <details open><summary>If I buy a song, is it only mine?</summary><p>No, buying usage rights is non-exclusive. The song stays in the Velora catalogue and others can license it too. If you need it to be yours alone, request Exclusive rights and the song will be removed for new buyers only when you ask.</p></details>
 <details><summary>What does renting cover?</summary><p>Use in your videos and posts on one channel while the rental is active. Example terms.</p></details>
 <details><summary>How do I prove I have a license?</summary><p>Every license comes with a dated certificate and an ID you can check on the Verify page.</p></details>
 <details><summary>Who makes the music?</summary><p>Robert writes the lyrics, concepts and song design, and produces the music with Suno.</p></details></div>`; }
function verify(params){ const id=params.get("id")||""; main.innerHTML=`<h1>Verify a license</h1><p class="muted">Enter a license ID to see its record and date.</p><form id="vf" class="row" style="max-width:560px"><div class="field" style="flex:1;margin:0"><label for="vid" class="sr">License ID</label><input id="vid" placeholder="VL-2026-XXXXXX" value="${esc(id)}"></div><button class="btn primary">Verify</button></form><div id="vr" style="margin-top:18px;max-width:640px"></div>`;
 const run=()=>{ const v=$("#vid").value.trim().toUpperCase(); const rec=store.get("velora_licenses",[]).find(r=>r.lic===v); $("#vr").innerHTML= !v?"": rec?`<div class="cert"><h3>Valid license (demo)</h3><dl><dt>License ID</dt><dd>${esc(rec.lic)}</dd><dt>Song</dt><dd>${esc(rec.title)} (${esc(rec.song)})</dd><dt>Type</dt><dd>${esc(rec.type)}</dd><dt>Issued</dt><dd>${new Date(rec.issued).toLocaleString("en-GB",{dateStyle:"long",timeStyle:"short"})}</dd><dt>Song created</dt><dd>${esc(rec.songDate)}</dd></dl></div>`:`<div class="note">No license found with that ID. In this demo, licenses are only stored in this browser.</div>`; };
 $("#vf").onsubmit=e=>{e.preventDefault();run();}; if(id) run(); }

// ---------- Global clicks ----------
document.addEventListener("click",e=>{
  if(e.target.closest("[data-stream]")){ e.preventDefault(); startStream(); return; }
  const cn=e.target.closest("[data-close-np]"); if(cn){ e.preventDefault(); closeNP(false, cn.getAttribute("href")); return; }
  const v=e.target.closest("[data-video]"); if(v){ e.preventDefault(); openVideo(byId(v.dataset.video)); return; }
  const p=e.target.closest("[data-play]"); if(p){ e.preventDefault(); const s=byId(p.dataset.play); const list=s.real?REAL:S.filter(x=>x.genre===s.genre); playFrom(list, s, s.real?"Robert's songs":s.genre, +(p.dataset.at||0), p.hasAttribute("data-np")?openNP:null); return; }
  const l=e.target.closest("[data-lic]"); if(l){ e.preventDefault(); openLicense(byId(l.dataset.lic), l.dataset.pre||"rent"); return; }
  if(e.target.closest("[data-sub]")){ e.preventDefault(); openLicense(current||S[0],"rent"); setTimeout(()=>{const r=document.querySelector('input[value=sub]'); if(r) r.checked=true;},0); return; }
  if(e.target.closest("[data-todo]")){ e.preventDefault(); }
});
$("#q").addEventListener("input",e=>{ libState.q=e.target.value; libState.page=1; if(!location.hash.startsWith("#/library")) location.hash="#/library"; else { const lq=$("#libq"); if(lq) lq.value=libState.q; drawLib(); } });

function route(){
  const h=location.hash.slice(1)||"/"; const [path,qs]=h.split("?"); const params=new URLSearchParams(qs||"");
  if(npOpen) closeNP(true);
  const navPath = path.startsWith("/song") ? "/library" : path;
  document.querySelectorAll(".topnav a").forEach(a=>a.classList.toggle("active", a.getAttribute("href")==="#"+navPath));
  document.querySelectorAll(".tabbar [data-tab]").forEach(a=>a.classList.toggle("active", a.dataset.tab===navPath));
  if(path==="/") home(); else if(path==="/library") library(params); else if(path.startsWith("/song/")) song(path.split("/")[2]);
  else if(path==="/radio") radioView(); else if(path==="/videos") videosView(); else if(path==="/pricing") pricing(); else if(path==="/verify") verify(params);
  else if(path==="/stream"){ home(); startStream(); } else home();
  window.scrollTo(0,0);
}
window.addEventListener("hashchange",route); route();
})();
