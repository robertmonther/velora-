(function(){
"use strict";
const D = window.VELORA_DATA, S = D.songs, CATS = D.categories || [];
// Media (audio, covers, videos) is served from the GitHub repo through the jsDelivr CDN when hosted,
// and from the local folder when the site runs on localhost.
// MEDIA_REV pins the media to one commit: a "@main" link can stay cached for hours, so new covers or songs
// would not show. After pushing new or changed media, set MEDIA_REV to that commit's full ID (git rev-parse HEAD).
const MEDIA_REV = "35af767f219230a9db57fd7bd3a1e184871a34a8";
const LOCAL = /^(localhost|127\.0\.0\.1|)$/.test(location.hostname);
const MEDIA_BASE = LOCAL ? "" : "https://cdn.jsdelivr.net/gh/robertmonther/velora-@" + MEDIA_REV + "/";
const url = p => /^https?:/.test(p) ? p : MEDIA_BASE + p;
const $ = s => document.querySelector(s), main = $("#main"), audio = $("#audio");
// Robert is the rights holder (lyrics and song design); he is not shown as a singer anywhere.
const CREATOR = "Robert Monther";
const PAL = [["#5b7a99","#2a3646"],["#b0524a","#3b1f1d"],["#e0a9b0","#5a3a40"]];
const MOOD_AR = {Defiant:"متحدّي",Epic:"ملحمي",Hopeful:"متفائل",Uplifting:"حماسي",Dramatic:"درامي",Dreamy:"حالم",Melancholic:"حزين",Sexy:"مثير",Romantic:"رومانسي",Seductive:"مغري",Dark:"قاتم"};
// EXAMPLE prices - Robert decides the real ones
const PRICES = {rent:{label:"Rent a track",price:"€9",per:"30 days, one channel"}, buy:{label:"Buy usage rights",price:"€49",per:"one-time, lifetime use"}, excl:{label:"Exclusive rights",price:"Ask Robert",per:"negotiated"}, sub:{label:"Premium",price:"€14",per:"per month, whole library"}};
// Velora Radio follows the time of day; each slot plays songs from these categories.
const RADIO = [
 {from:6,to:10,name:"Morning Light",cats:["Pop","Romantic","Soft Sensual"]},
 {from:10,to:14,name:"Rise Up",cats:["Trend (Arena)"]},
 {from:14,to:18,name:"Afternoon Fire",cats:["Trend (Arena)","Pop"]},
 {from:18,to:22,name:"Golden Evening",cats:["Romantic","Soft Sensual","Pop"]},
 {from:22,to:26,name:"After Dark",cats:["Soft Sensual","Explicit Sensual"]},
 {from:2,to:6,name:"Late Night",cats:["Explicit Sensual"]}
];
const fmt = t => { t=Math.max(0,Math.floor(t||0)); return Math.floor(t/60)+":"+String(t%60).padStart(2,"0"); };
const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
const icon = (name, cls="") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const byId = id => S.find(s=>s.id===id);

// ---------- Categories ----------
const catByName = n => CATS.find(c=>c.name===n);
const catById = id => CATS.find(c=>c.id===id);
const inCat = (s,c) => s.genre===c.name || (s.tags||[]).includes(c.name);
const songsIn = c => S.filter(s=>inCat(s,c));
const catsOf = s => CATS.filter(c=>inCat(s,c));
const USED = CATS.filter(c=>songsIn(c).length); // only categories that have songs
const catLink = c => `#/genre/${c.id}`;

const coverStyle = s => { if(s.art) return `background:#141418 url('${url(s.art)}') center/cover no-repeat`; const c=catByName(s.genre); const p=PAL[s.hue||0]; return `background:radial-gradient(circle at 30% 25%, ${c?c.color:p[0]} 0%, transparent 62%),linear-gradient(160deg, ${p[1]}, #141418 80%)`; };
const cover = (s,cls="cover") => `<div class="${cls}" style="${coverStyle(s)}" role="img" aria-label="Cover of ${esc(s.title)}">${s.art?"":`<span>${esc(s.title)}</span>`}</div>`;
const hasLyrics = s => Array.isArray(s.lyrics) && s.lyrics.length>0;
// Browser storage can be missing or blocked: never let it break the page.
const store = {
  get(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
};
// Explicit songs carry an "E" badge, like Spotify, and play like every other song (Robert's decision, 9 Nov).
const eb = s => s.explicit ? '<span class="e-badge" title="Explicit lyrics" aria-label="Explicit">E</span>' : "";
// The line under a song title shows its category (where Spotify shows the artist).
const subOf = s => esc(s.genre);

// Same "random" order for the whole day, a new one tomorrow.
function dayShuffle(list, salt=""){
  let h=2166136261; for(const ch of new Date().toISOString().slice(0,10)+salt){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619); }
  const rnd=()=>{ h+=0x6D2B79F5; let t=h; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; };
  const a=list.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a;
}
const shuffled = list => { const a=list.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const recents = () => store.get("velora_recent",[]).map(byId).filter(Boolean);

// ---------- Search (English and Arabic) ----------
function norm(s){
  return String(s||"").toLowerCase().replace(/[ً-ٰٟـ]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي").replace(/ؤ/g,"و").replace(/ئ/g,"ي")
    .replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim();
}
const STOP = new Set(["song","songs","music","track","tracks","the","a","of","اغاني","اغنيه","اغنيات","اغان","موسيقي","موسيقى","ال"].map(norm));
const IDX = S.map(s=>({s, title:norm(s.title),
  meta:norm([s.genre,...(s.tags||[]),s.mood,MOOD_AR[s.mood]||"",...catsOf(s).map(c=>c.ar+" "+c.words),s.explicit?"explicit E صريح":""].join(" ")),
  lyr:norm(hasLyrics(s)?s.lyrics.map(l=>l[1]).join(" "):"")}));
function search(q){
  const toks = norm(q).split(" ").filter(t=>t && !STOP.has(t));
  if(!toks.length) return {songs:[], cats:[], lyricHit:new Set()};
  const hits=[], lyricHit=new Set();
  for(const e of IDX){
    let score=0, viaLyr=false, ok=true;
    for(const t of toks){
      if(e.title.includes(t)) score+=5;
      else if(e.meta.includes(t)) score+=3;
      else if(t.length>=3 && e.lyr.includes(t)){ score+=1; viaLyr=true; }
      else { ok=false; break; }
    }
    if(ok){ hits.push([e.s,score]); if(viaLyr) lyricHit.add(e.s.id); }
  }
  hits.sort((a,b)=>b[1]-a[1]);
  const cats = USED.filter(c=>{ const hay=norm(c.name+" "+c.ar+" "+c.words); return toks.every(t=>hay.includes(t)); });
  return {songs:hits.map(h=>h[0]), cats, lyricHit};
}

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
let npOpen = false, videoOn = false, lastSec = -1, lastLyr = -2, lastPos = 0, lastFocus = null, pendingHash = null;
let radioSlot = null;

function load(song, autoplay=true, at=0){
  current = song; qi = queue.indexOf(song); if(qi<0){ queue=[song]; qi=0; }
  audio.src = url(song.audio);
  audio.addEventListener("loadedmetadata", function f(){ audio.removeEventListener("loadedmetadata",f); if(at) audio.currentTime = at; }, {once:true});
  if(autoplay) audio.play().catch(()=>setPlayIcons());
  $("#mini").hidden = false; document.body.classList.add("has-mini");
  const rec=store.get("velora_recent",[]).filter(id=>id!==song.id); rec.unshift(song.id); store.set("velora_recent",rec.slice(0,12));
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
function startStream(){ if(!current){ const list=dayShuffle(S,"stream"); playFrom(list, list[0], "All of Robert's songs"); } openNP(); }
function suggestions(s,n=8){
  const mine=catsOf(s);
  const score = x => mine.filter(c=>inCat(x,c)).length*2 + (x.genre===s.genre?2:0) + (x.mood===s.mood?1:0) + (!!x.explicit===!!s.explicit?0.5:0);
  return S.filter(x=>x!==s).map((x,i)=>[x,score(x),i]).sort((a,b)=>b[1]-a[1]||a[2]-b[2]).slice(0,n).map(a=>a[0]);
}
function startStation(c){
  const list=shuffled(songsIn(c)); if(!list.length) return;
  playFrom(list, list[0], c.name+" Radio", 0, openNP);
}

function paintMini(s){
  $("#miniCover").setAttribute("style", coverStyle(s));
  $("#miniTitle").textContent = s.title;
  $("#miniSub").innerHTML = eb(s) + subOf(s) + (mode==="radio" ? " · Velora Radio" : "");
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
audio.addEventListener("seeked",()=>{ syncVideo(true); markLyric(true); });
audio.addEventListener("ended",next);
audio.addEventListener("loadedmetadata",()=>{ paintBars(); setPosition(); });
audio.addEventListener("timeupdate",()=>{ paintBars(); syncVideo(false); markSection(); markLyric(); const now=Date.now(); if(now-lastPos>4000){ lastPos=now; setPosition(); } });

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
  art.innerHTML = s.art ? "" : `<span class="np-art-title">${esc(s.title)}</span>`;
  $("#npTitle").textContent=s.title; $("#npArtist").innerHTML=eb(s)+`<a href="${catLink(catByName(s.genre)||{id:""})}" data-close-np>${subOf(s)}</a>`;
  paintTicks($("#npBar"), s);
  const d=s.duration;
  $("#npSections").innerHTML = s.sections.map((x,j)=>{ const end=(s.sections[j+1]||{start:d}).start, best=x.start===s.bestPart;
    return `<button type="button" class="sec${best?" best":""}" data-t="${x.start}" aria-label="${esc(x.name)}, ${fmt(x.start)} to ${fmt(end)}${best?", best part":""}">${best?icon("spark"):""}${esc(x.name)} <small>${fmt(x.start)}</small></button>`; }).join("");
  $("#npCards").innerHTML = lyricsCard(s) + videoCard(s) + licenseCard(s) + aboutCard(s) + nextCard(s);
  lastSec=-1; lastLyr=-2; markSection(true); markLyric(true);
  if(videoOn && s.video) startVideo();
}
// Lyric lines with a small gap where a new part of the song starts.
function lyricLines(s, tag="p", attrs=()=>""){
  const starts=s.sections.map(x=>x.start); let prevT=-1;
  return s.lyrics.map(([t,l],i)=>{ const gap=i>0 && starts.some(st=>st>prevT && st<=t+0.5); prevT=t;
    return `<${tag} class="ll${gap?" gap":""}" data-t="${t}" ${attrs(t,i)}>${esc(l)}</${tag}>`; }).join("");
}
function lyricsCard(s){
  if(!hasLyrics(s)) return `<div class="np-card lyrics"><div class="card-h"><span>Lyrics</span></div><p class="muted" style="margin:0">Lyrics by Robert, coming soon.</p></div>`;
  return `<div class="np-card lyrics"><div class="card-h"><span>Lyrics</span><button type="button" class="lyr-more" id="lyrMore">Show all</button></div>
    <div class="lyr-box" id="lyrBox">${lyricLines(s)}</div>
    ${s.lyricsNote?`<p class="lyr-note">${esc(s.lyricsNote)} Tap a line to play from there.</p>`:""}</div>`;
}
function videoCard(s){
  if(!s.video) return "";
  const poster=url(s.poster||s.art);
  return `<div class="np-card media"><div class="card-h">${icon("video")}<span>Video</span></div>
    <div class="np-video" style="background-image:url('${poster}')"><video id="npVideo" muted playsinline preload="none" disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback" poster="${poster}"></video>
    <button type="button" class="np-video-btn" id="npVideoBtn">${icon("play")}<span>Play the video with the song</span></button></div>
    <p class="muted small" style="margin:0;text-align:center">The video follows the song you're hearing.</p></div>`;
}
function licenseCard(s){
  return `<div class="np-card"><div class="card-h">${icon("tag")}<span>Use this song in your videos</span></div>
    <div class="lic-row"><button type="button" class="btn red" data-lic="${s.id}">Rent ${PRICES.rent.price}</button><button type="button" class="btn blue" data-lic="${s.id}" data-pre="buy">Buy rights ${PRICES.buy.price}</button></div>
    <p class="muted small" style="margin:0">Example prices. Every license comes with a dated certificate.</p></div>`;
}
function aboutCard(s){
  const cats=catsOf(s);
  return `<div class="np-card"><div class="card-h"><span>About the song</span></div>
    <div class="facts np-facts"><div class="fact"><b>Category</b>${esc(s.genre)}</div><div class="fact"><b>Mood</b>${esc(s.mood)}</div><div class="fact"><b>Length</b>${fmt(s.duration)}</div><div class="fact"><b>BPM</b>${s.bpm||"–"}</div>${s.key?`<div class="fact"><b>Key</b>${esc(s.key)}</div>`:""}<div class="fact"><b>Content</b>${s.explicit?"Explicit lyrics":"Clean"}</div></div>
    ${cats.length>1?`<div class="chips" style="margin:0 0 12px">${cats.map(c=>`<a class="chip" href="${catLink(c)}" data-close-np>${esc(c.name)}</a>`).join("")}</div>`:""}
    <p class="small" style="margin:0 0 12px">Lyrics, concept and song design by Robert; music made with Suno (AI-assisted).</p>
    <a class="btn ghost sm" href="#/song/${s.id}" data-close-np>Open the song page</a></div>`;
}
function nextCard(s){
  const up = mode==="radio" ? null : queue[qi+1];
  return `<div class="np-card">${up?`<div class="card-h"><span>Up next</span></div><div class="rows">${srowNP(up,"queue")}</div>`:""}
    <div class="card-h"${up?' style="margin-top:14px"':""}><span>More like this</span></div><div class="rows">${suggestions(s).map(x=>srowNP(x,"sug")).join("")}</div></div>`;
}
const srowNP = (x,kind) => `<button type="button" class="srow" data-${kind}="${x.id}"><span class="srow-cover" style="${coverStyle(x)}"></span><span class="srow-t"><b>${esc(x.title)}</b><small>${eb(x)}${esc(x.genre)} · ${esc(x.mood)} · ${fmt(x.duration)}</small></span>${icon("play","srow-i")}</button>`;
$("#npCards").addEventListener("click",e=>{
  if(e.target.closest("#npVideoBtn")){ startVideo(); return; }
  const more=e.target.closest("#lyrMore"); if(more){ const box=$("#lyrBox"), full=box.classList.toggle("full"); more.textContent=full?"Show less":"Show all"; markLyric(true); return; }
  const ll=e.target.closest("#lyrBox .ll"); if(ll && current){ audio.currentTime=+ll.dataset.t; audio.play().catch(()=>{}); markLyric(true); return; }
  const sg=e.target.closest("[data-sug]"); if(sg){ const x=byId(sg.dataset.sug), from=current; playFrom([x,...suggestions(x,8)], x, "More like "+from.title); $("#npScroll").scrollTo({top:0,behavior:"smooth"}); return; }
  const qu=e.target.closest("[data-queue]"); if(qu){ load(byId(qu.dataset.queue)); $("#npScroll").scrollTo({top:0,behavior:"smooth"}); }
});
function markSection(force){
  if(!current || (!npOpen && !force)) return;
  const t=audio.currentTime||0; let idx=0; current.sections.forEach((x,i)=>{ if(t>=x.start) idx=i; });
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
  try{ navigator.mediaSession.metadata = new MediaMetadata({ title:s.title, artist:"Velora · "+s.genre, album:"Velora", artwork: s.art ? [{src:url(s.art), sizes:"600x600", type:"image/jpeg"}] : [] }); }catch(e){}
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
document.addEventListener("contextmenu",e=>{ if(e.target.closest("video,audio,.cover,.np-art,.mini-cover,.srow-cover,.tile-cover,.vid,.np-video,.st-circles")) e.preventDefault(); });

// ---------- Radio ----------
function slotNow(h=new Date().getHours()){ const hh = h<2? h+24 : h; return RADIO.find(r=> hh>=r.from && hh<r.to) || RADIO[0]; }
let radioRecent=[];
function radioPick(){
  const slot=radioSlot||slotNow();
  let pool=S.filter(s=>slot.cats.some(n=>{ const c=catByName(n); return c && inCat(s,c); }));
  if(!pool.length) pool=S;
  let fresh=pool.filter(s=>s!==current && !radioRecent.includes(s.id)); if(!fresh.length) fresh=pool.filter(s=>s!==current); if(!fresh.length) fresh=pool;
  const s=fresh[Math.floor(Math.random()*fresh.length)];
  radioRecent=[s.id,...radioRecent].slice(0,Math.max(1,Math.floor(pool.length/2)));
  return s;
}
function startRadio(slot){ mode="radio"; source="Velora Radio"; radioSlot=slot||null; queue=S.slice(); load(radioPick()); }

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
  const made=song.created||song.published;
  const fp=await hash(song.id+song.title+made);
  const rec={lic,song:song.id,title:song.title,type:PRICES[t].label,issued:iso,songDate:made,fp};
  const all=store.get("velora_licenses",[]); all.push(rec); store.set("velora_licenses",all);
  $("#mBody").innerHTML = `<h2 id="mTitle">You're licensed (demo)</h2>
  <div class="cert"><h3>Velora License Certificate</h3><div class="small">Example certificate. Not a real license.</div>
  <dl><dt>License ID</dt><dd><b>${lic}</b></dd><dt>Song</dt><dd>${esc(song.title)} (${song.id})</dd><dt>Type</dt><dd>${PRICES[t].label}</dd>
  <dt>Issued</dt><dd>${now.toLocaleString("en-GB",{dateStyle:"long",timeStyle:"short"})}</dd><dt>Song created</dt><dd>${new Date(made).toLocaleDateString("en-GB",{dateStyle:"long"})}</dd>
  <dt>Rights holder</dt><dd>${esc(CREATOR)} (lyrics and song design) · music made with Suno</dd><dt>Fingerprint</dt><dd style="word-break:break-all;font-family:monospace;font-size:12px">${fp.slice(0,32)}…</dd></dl></div>
  <div class="row" style="margin-top:14px"><a class="btn primary" href="#/verify?id=${lic}" id="mVerify">Verify this license</a><button class="btn" id="mDone">Close</button></div>`;
  $("#mDone").onclick=closeM; $("#mVerify").onclick=e=>{ e.preventDefault(); closeM(); const h="#/verify?id="+lic; if(npOpen) closeNP(false, h); else location.hash=h; };
}
function closeM(){ const v=document.querySelector("#mBody video"); if(v) v.pause(); $("#modal").hidden=true; }
$("#mClose").onclick=closeM; $("#modal").addEventListener("click",e=>{ if(e.target.id==="modal") closeM(); });
document.addEventListener("keydown",e=>{ if(e.key!=="Escape") return; if(!$("#modal").hidden) closeM(); else if(npOpen) closeNP(false); });

// ---------- Building blocks for the pages ----------
// Every row of songs registers its list, so tapping a song plays that row in order.
let ROWS = {}, rowN = 0;
const reg = (list,label) => { const k="r"+(++rowN); ROWS[k]={list,label}; return k; };
const tile = (s,k) => `<button type="button" class="tile" data-song="${s.id}" data-list="${k}"><span class="tile-cover" style="${coverStyle(s)}"></span><span class="tile-t">${eb(s)}${esc(s.title)}</span><span class="tile-s">${subOf(s)}</span></button>`;
const hrow = (list,label) => { const k=reg(list,label); return `<div class="hrow">${list.map(s=>tile(s,k)).join("")}</div>`; };
const srow = (s,k,n) => `<button type="button" class="srow lrow" data-song="${s.id}" data-list="${k}">${n?`<span class="srow-n">${n}</span>`:""}<span class="srow-cover" style="${coverStyle(s)}"></span><span class="srow-t"><b>${esc(s.title)}</b><small>${eb(s)}${esc(s.genre)} · ${esc(s.mood)} · ${fmt(s.duration)}</small></span>${icon("play","srow-i")}</button>`;
const rows = (list,label,numbered=false) => { const k=reg(list,label); return `<div class="rows">${list.map((s,i)=>srow(s,k,numbered?i+1:0)).join("")}</div>`; };
const circles = list => { const a=list.slice(0,3); while(a.length<3 && list.length) a.push(list[a.length%list.length]); return `<span class="st-circles">${a.map(s=>`<i style="${coverStyle(s)}"></i>`).join("")}</span>`; };
const station = c => { const list=songsIn(c); return `<div class="st-wrap"><button type="button" class="station" data-station="${c.id}" style="--st:${c.color}" aria-label="Play ${esc(c.name)} Radio"><span class="st-top">RADIO</span>${circles(list)}<span class="st-name">${esc(c.name)}</span></button><div class="st-sub">${list.map(s=>esc(s.title)).join(", ")}</div></div>`; };
const head = (title, sub="", link="") => `<div class="row-head"><div><h2>${title}</h2>${sub?`<div class="muted small">${sub}</div>`:""}</div>${link}</div>`;
const pills = active => `<nav class="pillrow" aria-label="Categories"><a class="pill${active?"":" on"}" href="#/">All</a>${USED.map(c=>`<a class="pill${active===c.id?" on":""}" href="${catLink(c)}">${esc(c.name)}</a>`).join("")}</nav>`;

function home(){
  const today=dayShuffle(S), pick=today.find(s=>!s.explicit)||today[0], rec=recents(), base=rec[0]||today[1]||pick, slot=slotNow();
  main.innerHTML = `
  ${pills(null)}
  <section class="feat">
    <button type="button" class="feat-cover" data-song="${pick.id}" data-list="${reg(today,"Today's pick")}" style="${coverStyle(pick)}" aria-label="Play ${esc(pick.title)}"></button>
    <div class="feat-t"><div class="muted small">Today's pick</div><h2>${esc(pick.title)}</h2><div class="muted">${eb(pick)}${subOf(pick)} · ${esc(pick.mood)}</div>
      <div class="feat-actions"><button type="button" class="icon-btn" data-lic="${pick.id}" aria-label="License ${esc(pick.title)}">${icon("tag")}</button><button type="button" class="round-play" data-song="${pick.id}" data-list="${reg(today,"Today's pick")}" aria-label="Play ${esc(pick.title)}">${icon("play")}</button></div></div>
  </section>
  <section>${head("Recommended for today")}${hrow(today,"Recommended for today")}</section>
  <section>${head("Recommended Stations")}<div class="hrow st-row">${USED.map(station).join("")}</div></section>
  ${rec.length?`<section>${head("Recents","",`<a class="showall" href="#/search">Show all</a>`)}${hrow(rec,"Recents")}</section>`:""}
  <section><div class="morelike"><span class="ml-cover" style="${coverStyle(base)}"></span><div><div class="muted small">More like</div><h2>${esc(base.title)}</h2></div></div>${hrow(suggestions(base,8),"More like "+base.title)}</section>
  ${USED.map(c=>`<section>${head(esc(c.name),`<span lang="ar" dir="rtl">${esc(c.ar)}</span> · ${songsIn(c).length} song${songsIn(c).length===1?"":"s"}`,`<a class="showall" href="${catLink(c)}">Show all</a>`)}${hrow(songsIn(c),c.name)}</section>`).join("")}
  ${S.some(s=>s.video)?`<section>${head("Videos from the songs","",`<a class="showall" href="#/videos">Show all</a>`)}<div class="hrow vrow">${videoTiles()}</div></section>`:""}
  <section class="radio-banner"><div><div class="onair">Velora Radio · on air</div><h2>${esc(slot.name)}</h2><div class="muted small">${slot.cats.join(" + ")} · non-stop, follows the time of day</div></div><button type="button" class="btn primary" id="hRadio">${icon("play")}Listen live</button></section>
  <section>${head("Three ways to use the music")}${tiersHTML()}</section>`;
  $("#hRadio").onclick=()=>{ startRadio(); };
}
function videoTiles(){
  return S.filter(s=>s.video).map(s=>`<a class="vid" href="#" data-video="${s.id}" style="background:#141418 url('${url(s.poster||s.art)}') center/cover no-repeat" aria-label="Watch ${esc(s.title)}"><span class="yt">▶ Video</span><div class="ov"><b>${esc(s.title)}</b><div class="small muted">${subOf(s)}</div></div></a>`).join("");
}
function openVideo(s){ audio.pause(); const m=$("#modal"), b=$("#mBody"); b.innerHTML=`<h2 id="mTitle">${esc(s.title)}</h2><video src="${url(s.video)}" poster="${url(s.poster||s.art)}" controls autoplay playsinline disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback" style="width:100%;max-height:70vh;border-radius:12px;background:#000"></video><div class="row" style="margin-top:12px"><button class="btn primary" data-lic="${s.id}">License this song</button><a class="btn ghost" href="#/song/${s.id}" id="mSong">Song page</a></div>`; m.hidden=false; $("#mSong").onclick=closeM; }
function tiersHTML(){ return `<div class="tiers">
  <div class="tier"><h3>Rent a track</h3><div class="price">${PRICES.rent.price}</div><div class="muted small">${PRICES.rent.per}</div><ul><li>One song, one channel</li><li>Perfect for a single video or campaign</li><li>Dated certificate</li></ul><a class="btn" href="#/search">Pick a song</a></div>
  <div class="tier feat-tier"><h3>Buy usage rights</h3><div class="price">${PRICES.buy.price}</div><div class="muted small">${PRICES.buy.per}</div><ul><li>Use it forever, non-exclusive</li><li>The song stays in the catalogue</li><li>Exclusive available on request</li><li>Dated certificate</li></ul><a class="btn primary" href="#/search">Pick a song</a></div>
  <div class="tier"><h3>Premium</h3><div class="price">${PRICES.sub.price}</div><div class="muted small">${PRICES.sub.per}</div><ul><li>Rent any song while subscribed</li><li>Every category, every new release</li><li>Cancel anytime</li></ul><button class="btn blue" data-sub>Start Premium (demo)</button></div>
 </div><p class="muted small">Example prices. Robert sets the real ones.</p>`; }

// Search: the categories ("Browse all") and every song; typing filters, in English or Arabic.
let searchQ = "";
function searchView(params){
  if(params.get("q")!==null) searchQ=params.get("q");
  main.innerHTML=`<h1 class="pagetitle">Search</h1>
  <div class="sbox">${icon("search")}<label for="libq" class="sr">Search songs</label><input id="libq" type="search" autocomplete="off" placeholder="Songs, categories, moods, lyrics · ابحث بالعربي" value="${esc(searchQ)}"></div>
  <div id="sres"></div>`;
  const lq=$("#libq"); lq.addEventListener("input",e=>{ searchQ=e.target.value; $("#q").value=searchQ; drawSearch(); });
  drawSearch();
  if(params.get("focus")==="search") setTimeout(()=>{ try{ lq.focus(); }catch(e){} },60);
}
function drawSearch(){
  const box=$("#sres"); if(!box) return;
  if(!norm(searchQ)){
    box.innerHTML=`<h2 class="sh">Browse all</h2>
    <div class="browse">${USED.map(c=>{ const s=songsIn(c)[0]; return `<a class="btile" href="${catLink(c)}" style="--st:${c.color}"><b>${esc(c.name)}</b><span lang="ar" dir="rtl">${esc(c.ar)}</span><small>${songsIn(c).length} song${songsIn(c).length===1?"":"s"}</small>${s?`<i style="${coverStyle(s)}"></i>`:""}</a>`; }).join("")}</div>
    <h2 class="sh">All songs <span class="muted small">${S.length}</span></h2>${rows(S,"All of Robert's songs")}`;
    return;
  }
  const r=search(searchQ);
  box.innerHTML = (r.cats.length?`<div class="chips" style="margin-top:4px">${r.cats.map(c=>`<a class="chip cat-chip" href="${catLink(c)}" style="--st:${c.color}">${esc(c.name)} <span lang="ar" dir="rtl">${esc(c.ar)}</span> · ${songsIn(c).length}</a>`).join("")}</div>`:"")
    + (r.songs.length?`<div class="muted small" style="margin:6px 0 8px">${r.songs.length} song${r.songs.length===1?"":"s"}${r.lyricHit.size?" · some found in the lyrics":""}</div>${rows(r.songs,"Search: "+searchQ)}`
    : `<p class="muted">No songs match “${esc(searchQ)}”. Try a category like Sensual, Romantic, Pop, Trend, or in Arabic: حسي، رومانسي، ترند، ثوري.</p>`);
}
function genreView(id){
  const c=catById(id); if(!c){ main.innerHTML="<h1>Category not found</h1>"; return; }
  const list=songsIn(c), total=list.reduce((a,s)=>a+(s.duration||0),0);
  main.innerHTML=`${pills(c.id)}
  <section class="ghead" style="--st:${c.color}"><div class="muted small">Category</div><h1>${esc(c.name)}</h1><div class="ghead-ar" lang="ar" dir="rtl">${esc(c.ar)}</div>
   <div class="muted small">${list.length} song${list.length===1?"":"s"} · ${Math.round(total/60)} min${list.some(s=>s.explicit)?" · some songs have explicit lyrics":""}</div>
   <div class="ghead-actions"><button type="button" class="round-play" id="gPlay" aria-label="Play ${esc(c.name)}">${icon("play")}</button><button type="button" class="icon-btn" id="gShuffle" aria-label="Shuffle ${esc(c.name)}">${icon("shuffle")}</button><button type="button" class="btn ghost sm" data-station="${c.id}">${icon("radio")}${esc(c.name)} Radio</button></div></section>
  ${rows(list,c.name,true)}
  <section>${head("Other categories")}<div class="browse">${USED.filter(x=>x!==c).map(x=>`<a class="btile" href="${catLink(x)}" style="--st:${x.color}"><b>${esc(x.name)}</b><span lang="ar" dir="rtl">${esc(x.ar)}</span><small>${songsIn(x).length} song${songsIn(x).length===1?"":"s"}</small><i style="${coverStyle(songsIn(x)[0])}"></i></a>`).join("")}</div></section>`;
  $("#gPlay").onclick=()=>playFrom(list, list[0], c.name, 0, openNP);
  $("#gShuffle").onclick=()=>{ const l=shuffled(list); playFrom(l, l[0], c.name+" · shuffle", 0, openNP); };
}
function song(id){
  const s=byId(id); if(!s){ main.innerHTML="<h1>Song not found</h1>"; return; }
  const d=s.duration, c=catByName(s.genre), more=S.filter(x=>x!==s && catsOf(s).some(k=>inCat(x,k)));
  main.innerHTML=`<div class="split"><div>${cover(s,"cover song-cover")}</div><div>
   <div class="muted small">${catsOf(s).map(k=>`<a href="${catLink(k)}">${esc(k.name)}</a>`).join(" · ")} · ${esc(s.mood)}</div><h1>${esc(s.title)}</h1>${s.explicit?`<div class="muted">${eb(s)}Explicit lyrics</div>`:""}
   <div class="facts"><div class="fact"><b>Length</b>${fmt(d)}</div><div class="fact"><b>BPM</b>${s.bpm}</div>${s.key?`<div class="fact"><b>Key</b>${esc(s.key)}</div>`:""}<div class="fact"><b>${s.created?"Created":"Released"}</b>${s.created||s.published}</div></div>
   <div class="row"><button class="btn primary" data-play="${s.id}" data-np>${icon("play")}Play full song</button><button class="btn red" data-lic="${s.id}">Rent ${PRICES.rent.price}</button><button class="btn blue" data-lic="${s.id}" data-pre="buy">Buy rights ${PRICES.buy.price}</button>${s.video?`<button class="btn ghost" data-video="${s.id}">Watch video</button>`:""}</div>
   <div class="panel"><h3>Lyrics</h3>${hasLyrics(s)?`<p class="muted small" style="margin-top:0">${esc(s.lyricsNote||"")} Tap a line to play from there.</p><div class="plyr">${lyricLines(s,"button",t=>`type="button" data-play="${s.id}" data-at="${t}" data-np`)}</div>`:`<p class="muted">Lyrics by Robert, coming soon.</p>`}</div>
   <div class="panel"><h3>Song map</h3><p class="muted small">Where each part starts and ends. Tap to jump there.</p>
    <div class="schedule">${s.sections.map((x,j)=>`<button class="slot" style="border:0;color:inherit;cursor:pointer;font:inherit" data-play="${s.id}" data-at="${x.start}"><span>${esc(x.name)}${x.start===s.bestPart?" · best part":""}</span><span class="muted">${fmt(x.start)} – ${fmt((s.sections[j+1]||{start:d}).start)}</span></button>`).join("")}</div>${s.analysisNote?`<p class="muted small" style="margin-bottom:0">${esc(s.analysisNote)}</p>`:""}</div>
   <div class="panel prov"><div class="seal">✓</div><div><h3 style="margin-bottom:4px">Provenance record</h3><div class="small">${s.created?"Made with Suno · created":esc(s.provenance||"Made with Suno")+" · added"} <b>${new Date(s.created||s.published).toLocaleDateString("en-GB",{dateStyle:"long"})}</b> · catalogue ID ${s.id}</div><div class="muted small">Lyrics and song design by Robert. Each license gets a dated certificate you can verify on the Verify page.</div></div></div>
  </div></div>
  ${more.length?`<section>${head("More like this",c?`<a href="${catLink(c)}">${esc(c.name)}</a>`:"")}${hrow(more,"More like "+s.title)}</section>`:""}`;
}
function radioView(){
  const now=slotNow();
  main.innerHTML=`<h1>Velora Radio</h1><p class="muted">Non-stop, like the YouTube radio. It follows the time of day, or pick a station.</p>
  <div class="schedule" style="max-width:640px">${RADIO.map((r,i)=>`<button type="button" class="slot ${r===now?"live":""}" data-slot="${i}" style="border:0;color:inherit;cursor:pointer;font:inherit;text-align:left"><span>${String(r.from%24).padStart(2,"0")}:00–${String(r.to%24).padStart(2,"0")}:00 · <b>${esc(r.name)}</b></span><span class="muted">${r.cats.join(" + ")}</span></button>`).join("")}</div>
  <div class="row" style="margin-top:18px"><button class="btn primary" id="rv">${icon("play")}Listen live</button></div>
  <section>${head("Stations")}<div class="hrow st-row">${USED.map(station).join("")}</div></section>`;
  $("#rv").onclick=()=>startRadio();
  main.querySelectorAll("[data-slot]").forEach(b=>b.onclick=()=>startRadio(RADIO[+b.dataset.slot]));
}
function videosView(){ main.innerHTML=`<h1>Videos</h1><p class="muted">Short videos of Robert's songs. Tap one to watch.</p><div class="videos">${videoTiles()}</div>`; }
function pricing(){ main.innerHTML=`<h1>Pricing</h1><p class="muted">Three simple ways to use Robert's music.</p>${tiersHTML()}
 <div class="row-head"><h2>Questions</h2></div><div class="faq">
 <details open><summary>If I buy a song, is it only mine?</summary><p>No, buying usage rights is non-exclusive. The song stays in the Velora catalogue and others can license it too. If you need it to be yours alone, request Exclusive rights and the song will be removed for new buyers only when you ask.</p></details>
 <details><summary>What does renting cover?</summary><p>Use in your videos and posts on one channel while the rental is active. Example terms.</p></details>
 <details><summary>How do I prove I have a license?</summary><p>Every license comes with a dated certificate and an ID you can check on the Verify page.</p></details>
 <details><summary>Who makes the music?</summary><p>Robert writes the lyrics, concepts and song design, and produces the music with Suno (AI-assisted).</p></details></div>`; }
function verify(params){ const id=params.get("id")||""; main.innerHTML=`<h1>Verify a license</h1><p class="muted">Enter a license ID to see its record and date.</p><form id="vf" class="row" style="max-width:560px"><div class="field" style="flex:1;margin:0"><label for="vid" class="sr">License ID</label><input id="vid" placeholder="VL-2026-XXXXXX" value="${esc(id)}"></div><button class="btn primary">Verify</button></form><div id="vr" style="margin-top:18px;max-width:640px"></div>`;
 const run=()=>{ const v=$("#vid").value.trim().toUpperCase(); const rec=store.get("velora_licenses",[]).find(r=>r.lic===v); $("#vr").innerHTML= !v?"": rec?`<div class="cert"><h3>Valid license (demo)</h3><dl><dt>License ID</dt><dd>${esc(rec.lic)}</dd><dt>Song</dt><dd>${esc(rec.title)} (${esc(rec.song)})</dd><dt>Type</dt><dd>${esc(rec.type)}</dd><dt>Issued</dt><dd>${new Date(rec.issued).toLocaleString("en-GB",{dateStyle:"long",timeStyle:"short"})}</dd><dt>Song created</dt><dd>${esc(rec.songDate)}</dd></dl></div>`:`<div class="note">No license found with that ID. In this demo, licenses are only stored in this browser.</div>`; };
 $("#vf").onsubmit=e=>{e.preventDefault();run();}; if(id) run(); }

// ---------- Global clicks ----------
document.addEventListener("click",e=>{
  if(e.target.closest("[data-stream]")){ e.preventDefault(); startStream(); return; }
  const cn=e.target.closest("[data-close-np]"); if(cn){ e.preventDefault(); closeNP(false, cn.getAttribute("href")); return; }
  const v=e.target.closest("[data-video]"); if(v){ e.preventDefault(); openVideo(byId(v.dataset.video)); return; }
  const st=e.target.closest("[data-station]"); if(st){ e.preventDefault(); startStation(catById(st.dataset.station)); return; }
  const l=e.target.closest("[data-lic]"); if(l){ e.preventDefault(); openLicense(byId(l.dataset.lic), l.dataset.pre||"rent"); return; }
  // Tap a song anywhere: it plays and its full screen opens (cover, lyrics, video, license).
  const t=e.target.closest("[data-song]"); if(t){ e.preventDefault(); const s=byId(t.dataset.song), row=ROWS[t.dataset.list]||{list:[s],label:s.genre};
    if(current===s && !audio.paused){ openNP(); return; } playFrom(row.list, s, row.label, 0, openNP); return; }
  const p=e.target.closest("[data-play]"); if(p){ e.preventDefault(); const s=byId(p.dataset.play), at=+(p.dataset.at||0), open=p.hasAttribute("data-np")?openNP:null;
    if(current===s){ audio.currentTime=at; audio.play().catch(()=>{}); if(open) open(); return; }
    playFrom([s,...suggestions(s,8)], s, s.genre, at, open); return; }
  if(e.target.closest("[data-sub]")){ e.preventDefault(); openLicense(current||S[0],"rent"); setTimeout(()=>{const r=document.querySelector('input[value=sub]'); if(r) r.checked=true;},0); return; }
  if(e.target.closest("[data-todo]")){ e.preventDefault(); }
});
$("#q").addEventListener("input",e=>{ searchQ=e.target.value; if(!/^#\/(search|library)/.test(location.hash)) location.hash="#/search"; else { const lq=$("#libq"); if(lq) lq.value=searchQ; drawSearch(); } });

function route(){
  const h=location.hash.slice(1)||"/"; const [path,qs]=h.split("?"); const params=new URLSearchParams(qs||"");
  if(npOpen) closeNP(true);
  ROWS={}; rowN=0;
  const navPath = path.startsWith("/song") || path.startsWith("/genre") || path==="/library" ? "/search" : path;
  document.querySelectorAll(".topnav a").forEach(a=>a.classList.toggle("active", a.getAttribute("href")==="#"+navPath));
  document.querySelectorAll(".tabbar [data-tab]").forEach(a=>a.classList.toggle("active", a.dataset.tab===navPath));
  if(path==="/") home(); else if(path==="/search"||path==="/library") searchView(params); else if(path.startsWith("/song/")) song(path.split("/")[2]);
  else if(path.startsWith("/genre/")) genreView(path.split("/")[2]);
  else if(path==="/radio") radioView(); else if(path==="/videos") videosView(); else if(path==="/pricing") pricing(); else if(path==="/verify") verify(params);
  else if(path==="/stream"){ home(); startStream(); } else home();
  window.scrollTo(0,0);
}
window.addEventListener("hashchange",route); route();
})();
