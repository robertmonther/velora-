"""Pictures of the upload, step by step, with one of Robert's real songs, plus two other layouts as mock-ups.
Writes JPEGs and steps.json to tests/shots/gallery/ . Uses the stand-in server; the real one is never touched.

    python3 tests/upload_gallery.py        (needs: pip install playwright pillow, Chrome and ffmpeg)

The two other layouts are pictures only: the real fields of each step, arranged differently. They are not built."""
import asyncio, io, json, os, re, shutil, subprocess, sys
from playwright.async_api import async_playwright
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fake_backend

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8797
BASE = f"http://localhost:{PORT}/index.html"
API = f"http://localhost:{PORT}/__supa"
OUT = os.path.join(ROOT, "tests", "shots", "gallery")
TMP = os.path.join(ROOT, "tests", "tmp", "gallery")
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
SONG = "rm-0007"
steps = []

def material():
    os.makedirs(TMP, exist_ok=True); shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
    cat = json.load(open(os.path.join(ROOT, "data", "catalogue.json"), encoding="utf-8"))
    s = next(x for x in cat["songs"] if x["id"] == SONG)
    wav = os.path.join(TMP, s["title"] + ".wav")
    if not os.path.exists(wav): subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(ROOT, s["audio"]), "-ar", "44100", "-ac", "2", wav], check=True)
    cover = os.path.join(TMP, "cover.jpg"); shutil.copy(os.path.join(ROOT, s["art"]), cover)
    lines, secs, k, text = s["lyrics"], s["sections"], 0, []
    for i, (t, line) in enumerate(lines):                       # the lyrics as Robert would paste them, with [Chorus] marks
        while k < len(secs) and secs[k]["start"] <= t + 0.5: text.append("[" + secs[k]["name"] + "]"); k += 1
        text.append(line)
    return s, wav, cover, "\n".join(text), [t for t, _ in lines]

CALM = """.topbar{position:static!important} .st-foot{position:static!important;margin-top:18px!important} .toast{display:none!important}
body.fullshot .tabbar, body.fullshot .mini{display:none!important}"""
ALT = """
.alt h2.alt-h{font:800 17px var(--font);margin:0;display:flex;align-items:center;gap:10px}
.alt .num{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font:700 13px var(--font);background:var(--card2);color:var(--text);flex:none}
.alt .altsec{background:var(--bg2);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;margin:0 0 10px}
.alt .altsec.done .num{background:#2f6b4f;color:#eafff3}
.alt .altsec.open{border-color:var(--pink)} .alt .altsec.open .num{background:var(--pink);color:#1b1114}
.alt .altsec.todo{opacity:.75}
.alt .altsec small.sum{display:block;color:var(--muted);font:500 13px var(--font);margin:2px 0 0 38px}
.alt .altsec .in{margin-top:14px}
.alt .prog{display:flex;align-items:center;gap:10px;margin:0 0 14px;font:600 13px var(--font);color:var(--muted)}
.alt .prog i{flex:1;height:6px;border-radius:6px;background:var(--line);position:relative;overflow:hidden}
.alt .prog i::after{content:"";position:absolute;inset:0 var(--rest) 0 0;background:var(--pink);border-radius:6px}
.alt .tabs3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:0 0 16px}
.alt .tabs3 span{padding:10px 6px;border-radius:14px;background:var(--bg2);border:1px solid var(--line);text-align:center;font:700 13px var(--font);color:var(--muted)}
.alt .tabs3 span b{display:block;font:500 11px var(--font);opacity:.8}
.alt .tabs3 span.on{background:var(--pink);color:#1b1114;border-color:transparent}
.alt .tabs3 span.ok{color:#d9d2cb;border-color:#2f6b4f}
.alt h3.grp{font:800 18px var(--font);margin:22px 0 10px}
"""

async def main():
    song, wav, cover, lyrics, times = material()
    fake_backend.serve(ROOT, PORT)
    cfg = open(os.path.join(ROOT, "config.js"), encoding="utf-8").read()
    cfg = re.sub(r'supabase:\s*\{[^}]*\}', f'supabase: {{ url: "{API}", anonKey: "sb_publishable_stand_in_key_0000000000" }}', cfg)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--autoplay-policy=no-user-gesture-required"])
        c = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        await c.add_init_script("try{ localStorage.setItem('velora_age', JSON.stringify('adult')); }catch(e){}")
        await c.route("**/config.js*", lambda r: r.fulfill(body=cfg, content_type="application/javascript"))
        pg = await c.new_page()
        async def until(expr, timeout=60000): await pg.wait_for_function("() => { try { return (" + expr + "); } catch (e) { return false; } }", timeout=timeout)
        async def shot(name, title, note, full=True, crop=None):
            await pg.evaluate("f => document.body.classList.toggle('fullshot', f)", full)
            data = await pg.screenshot(full_page=full)
            im = Image.open(io.BytesIO(data)).convert("RGB")
            if crop: im = im.crop((0, 0, im.width, min(im.height, crop)))
            f = f"{len(steps) + 1:02d}-{name}.jpg"; im.save(os.path.join(OUT, f), "JPEG", quality=84, optimize=True)
            steps.append({"file": f, "title": title, "note": note, "w": im.width, "h": im.height}); print(f, im.size, flush=True)

        # ---- where Upload is ----
        await pg.goto(BASE + "#/"); await pg.wait_for_selector("#uploadBtn"); await pg.add_style_tag(content=CALM + ALT); await pg.wait_for_timeout(600)
        await shot("home-upload-button", "find-1", "", full=False)
        await pg.click("#menuBtn"); await pg.wait_for_selector("#drawerNav a"); await pg.wait_for_timeout(350)
        await shot("menu", "find-2", "", full=False)
        await pg.keyboard.press("Escape")

        # ---- the door ----
        await pg.goto(BASE + "#/upload"); await pg.wait_for_selector("#stAuth form")
        await pg.click("#toSetup"); await pg.fill("#snm", "Robert Monther"); await pg.fill("#sem", "you@example.com"); await pg.fill("#spw", "a-long-password-1"); await pg.fill("#spw2", "a-long-password-1"); await pg.fill("#scode", fake_backend.SETUP_CODE)
        await pg.evaluate("document.querySelector('#scode').value = 'XXXX-XXXX-XXXX'")
        await shot("owner-setup", "door", "")
        await pg.fill("#scode", fake_backend.SETUP_CODE); await pg.click("#su button[type=submit]"); await pg.wait_for_selector(".st .drop", timeout=20000)

        frag = {}
        async def keep(i): frag[i] = await pg.evaluate("document.querySelector('.st-body').innerHTML")
        # ---- 1 song file ----
        await shot("step1-empty", "s1a", "")
        await pg.set_input_files("#fileIn", wav); await pg.wait_for_selector("#fWave", timeout=120000); await pg.wait_for_timeout(300)
        await shot("step1-file", "s1b", ""); await keep(1)
        await pg.click("#stNext"); await pg.wait_for_selector("#dTitle")
        # ---- 2 details ----
        await pg.select_option("#dArtist", song["artist"]); await pg.select_option("#dGenre", song["genre"]); await until("document.querySelectorAll('#dSub option').length > 2"); await pg.select_option("#dSub", song["subgenre"])
        for m in [t for t in song["tags"]][:3]:
            if await pg.query_selector(f"[data-mood='{m}']"): await pg.click(f"[data-mood='{m}']")
        if song.get("created"): await pg.fill("#dCreated", song["created"])
        await shot("step2-details", "s2", ""); await keep(2)
        await pg.click("#stNext"); await pg.wait_for_selector("#cLyr")
        # ---- 3 credits and AI ----
        await shot("step3-credits", "s3a", ""); await keep(3)
        await pg.click("#cMore summary"); await pg.wait_for_timeout(200)
        await pg.evaluate("document.querySelector('#cMore').scrollIntoView()")
        el = await pg.query_selector("#cMore"); data = await el.screenshot(); im = Image.open(io.BytesIO(data)).convert("RGB"); f = f"{len(steps) + 1:02d}-step3-stores.jpg"; im.save(os.path.join(OUT, f), "JPEG", quality=84, optimize=True)
        steps.append({"file": f, "title": "s3b", "note": "", "w": im.width, "h": im.height}); print(f, im.size, flush=True)
        await pg.click("#cMore summary"); await pg.click("#stNext"); await pg.wait_for_selector("#lText")
        # ---- 4 lyrics ----
        await pg.fill("#lText", lyrics); await pg.evaluate("document.querySelector('#lText').scrollTop = 0"); await pg.wait_for_timeout(200)
        await shot("step4-lyrics", "s4a", "", crop=2300)
        await pg.click("#lSync"); await pg.wait_for_selector("#syTap")
        await pg.evaluate("t => { document.querySelector('#stAudio').currentTime = Math.max(0, t - 2.5); }", times[0])
        await pg.click("#syTap")
        for i in range(5):
            await until(f"document.querySelector('#stAudio').currentTime >= {times[i] + 0.2}"); await pg.click("#syTap")
        await pg.wait_for_timeout(250)
        await shot("step4-syncing", "s4b", "", full=False)
        await pg.evaluate("T => { const s = VeloraStudio._state(); s.lines.forEach((l, i) => { l.t = T[i]; }); document.querySelector('#stAudio').pause(); }", times)
        await pg.click("#syDone"); await pg.wait_for_selector("#lCard .okdot"); await keep(4)
        await pg.evaluate("document.querySelector('#lCard').scrollIntoView({block:'center'})")
        el = await pg.query_selector("#lCard"); data = await el.screenshot(); im = Image.open(io.BytesIO(data)).convert("RGB"); f = f"{len(steps) + 1:02d}-step4-synced.jpg"; im.save(os.path.join(OUT, f), "JPEG", quality=84, optimize=True)
        steps.append({"file": f, "title": "s4c", "note": "", "w": im.width, "h": im.height}); print(f, im.size, flush=True)
        await pg.click("#stNext"); await pg.wait_for_selector("#coverIn", state="attached")
        # ---- 5 cover ----
        await pg.set_input_files("#coverIn", cover); await pg.wait_for_selector(".coverprev")
        await shot("step5-cover-small", "s5a", "")
        await pg.click("#cAllow"); await pg.wait_for_timeout(200)
        await shot("step5-cover-ok", "s5b", "", crop=1150); await keep(5)
        await pg.click("#stNext"); await pg.wait_for_selector("input[name=mOn]"); await pg.wait_for_selector("#abPlay", timeout=120000)
        # ---- 6 mastering ----
        await shot("step6-mastering", "s6", ""); await keep(6)
        await pg.click("#stNext"); await pg.wait_for_selector("#rOwn")
        # ---- 7 rights ----
        for i in ("#rOwn", "#rClean", "#rRec"): await pg.check(i)
        await shot("step7-rights", "s7", ""); await keep(7)
        await pg.click("#stNext"); await pg.wait_for_selector(".artistcard")
        # ---- 8 artist and publish ----
        await shot("step8-artist-publish", "s8", ""); await keep(8)
        await pg.click("#stNext"); await pg.wait_for_selector(".publog"); await until("document.querySelectorAll('.publog li.done').length >= 1"); await pg.wait_for_timeout(1500)
        await shot("publishing", "pub1", "", full=False, crop=1100)
        await pg.wait_for_selector(".st-done", timeout=300000); await pg.wait_for_timeout(300)
        await shot("published", "pub2", "")
        # ---- live ----
        await pg.click(".st-done a.btn.primary"); await pg.wait_for_selector(".song-cover"); await pg.wait_for_timeout(500)
        await shot("song-page", "live1", "", crop=3400)
        await pg.click("[data-record]"); await pg.wait_for_selector("#mBody .rec"); await pg.wait_for_timeout(300)
        await shot("record", "live2", "", full=False)
        await pg.keyboard.press("Escape")
        await pg.click("[data-play]"); await until(f"document.querySelector('#audio').currentTime > 0.5")
        await pg.evaluate("t => { document.querySelector('#audio').currentTime = t; }", times[8] + 0.3); await pg.wait_for_timeout(1500)
        await pg.evaluate("(() => { const n = document.querySelector('#np'), l = document.querySelector('#lyrBox'); if (l) l.scrollIntoView({block: 'center'}); })()"); await pg.wait_for_timeout(600)
        await shot("player-lyrics", "live3", "", full=False)
        await pg.evaluate("document.querySelector('#audio').pause()"); await pg.click("#npClose")
        await pg.goto(BASE + "#/studio"); await pg.wait_for_selector(".msrow"); await pg.wait_for_timeout(300)
        await shot("my-songs", "live4", "", full=False, crop=1100)

        # ---- two other layouts (pictures only): the real fields, arranged differently ----
        head = lambda small, title: f'<div class="st-head"><button type="button" class="icon-btn" aria-label="Close"><svg class="ic"><use href="#i-close"/></svg></button><div class="st-where"><small>{small}</small><h1 class="st-title">{title}</h1></div></div>'
        names = ["Song file", "Song details", "Credits and AI", "Lyrics", "Cover", "Mastering", "Rights", "Artist and publish"]
        sums = {1: f"{song['title']}.wav · 3:48", 2: "VOLUPTRA · Pop, Electropop · Romantic, Melancholic", 3: "Robert Monther · AI: music and voice (Suno)"}
        def sec(i, state):
            num = "✓" if state == "done" else str(i)
            return f'<div class="altsec {state}"><h2 class="alt-h"><span class="num">{num}</span>{names[i - 1]}</h2>' + (f'<small class="sum">{sums[i]}</small>' if state == "done" else "") + (f'<div class="in">{frag[i]}</div>' if state == "open" else "") + "</div>"
        page_b = f'<div class="st alt">{head("Upload a song", "One page")}<div class="prog"><span>3 of 8 ready</span><i style="--rest:62%"></i></div>' + "".join(sec(i, "done" if i < 4 else "open" if i == 4 else "todo") for i in range(1, 9)) + '<div class="st-foot"><div class="st-nav"><button type="button" class="btn primary" disabled>Publish (5 parts to go)</button></div></div></div>'
        await pg.goto(BASE + "#/upload"); await pg.wait_for_selector(".st"); await pg.evaluate("h => { document.querySelector('main').innerHTML = h; window.scrollTo(0, 0); }", page_b); await pg.wait_for_timeout(400)
        await shot("layout-b-one-page", "altB", "", crop=2600)
        page_c = f'<div class="st alt">{head("Screen 2 of 3", "Words and cover")}<div class="tabs3"><span class="ok">✓ The song<b>file, details, credits</b></span><span class="on">Words and cover<b>lyrics, cover</b></span><span>Finish<b>sound, rights, publish</b></span></div><h3 class="grp">Lyrics</h3>{frag[4]}<h3 class="grp">Cover</h3>{frag[5]}<div class="st-foot"><div class="st-nav"><button type="button" class="btn ghost">Back</button><button type="button" class="btn primary">Continue</button></div></div></div>'
        await pg.evaluate("h => { document.querySelector('main').innerHTML = h; window.scrollTo(0, 0); }", page_c); await pg.wait_for_timeout(400)
        await shot("layout-c-three-screens", "altC", "", crop=2600)
        await b.close()
    json.dump(steps, open(os.path.join(OUT, "steps.json"), "w"), indent=1)
    print(len(steps), "pictures in", OUT)

asyncio.run(main())
