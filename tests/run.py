"""Velora checks. Starts a local server and walks through the site like a visitor on a phone.

    python3 tests/run.py            (needs: pip install playwright, and Chrome)

Every line printed must say PASS. Screenshots go to tests/shots/ (not committed)."""
import asyncio, json, os, re, subprocess, sys, time
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8791
BASE = f"http://localhost:{PORT}/index.html"
SHOTS = os.path.join(ROOT, "tests", "shots")
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
results = []
# The site's server (Supabase). The checks never talk to the real one: every page gets a stand-in that answers
# like an empty server, and the upload checks use a fuller stand-in (tests/fake_backend.py).
_cfg = open(os.path.join(ROOT, "config.js"), encoding="utf-8").read()
SUPA = (re.search(r'supabase:\s*\{\s*url:\s*"([^"]*)"', _cfg) or [None, ""])[1]
CORS = {"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS", "access-control-expose-headers": "*"}
async def empty_backend(route):
    if route.request.method == "OPTIONS": await route.fulfill(status=204, headers=CORS)
    elif "/rest/v1/rpc/public_catalogue" in route.request.url: await route.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body='{"complete":true,"songs":[],"artists":[]}')
    else: await route.fulfill(status=404, headers={**CORS, "content-type": "application/json"}, body='{"message":"not in the stand-in"}')

def check(name, ok, detail=""):
    results.append(ok)
    print(("PASS  " if ok else "FAIL  ") + name + (f"   [{detail}]" if detail and not ok else ""), flush=True)

CFG_GATE = open(os.path.join(ROOT, "config.js"), encoding="utf-8").read().replace("ageGate: false", "ageGate: true")

async def new_page(browser, width=390, height=844, mobile=True, adult=True, gate=False):
    """A fresh visitor. gate=True switches the age question on for this visitor (config.js: ageGate), the way a site
    that wants it would; adult=True then means the question was already answered with Yes."""
    ctx = await browser.new_context(viewport={"width": width, "height": height}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
    if adult: await ctx.add_init_script("try{ localStorage.setItem('velora_age', JSON.stringify('adult')); }catch(e){}")
    if gate: await ctx.route("**/config.js*", lambda r: r.fulfill(body=CFG_GATE, content_type="application/javascript"))
    if SUPA: await ctx.route(SUPA + "/**", empty_backend)
    page = await ctx.new_page()
    page.problems = []
    page.on("pageerror", lambda e: page.problems.append("error: " + str(e)))
    page.on("console", lambda m: page.problems.append("console: " + m.text) if m.type == "error" else None)
    page.on("requestfailed", lambda r: page.problems.append("failed: " + r.url) if "localhost" in r.url and "ERR_ABORTED" not in (r.failure or "") else None)  # a song download that is cut off when the next song starts is normal
    return page

J = "document.querySelector"
async def state(page):
    return await page.evaluate("""() => { const a=document.querySelector('#audio'); return {
        np: document.querySelector('#np').classList.contains('open'), title: document.querySelector('#npTitle').textContent,
        t: a.currentTime, paused: a.paused, src: a.currentSrc.split('/').pop(), dur: a.duration,
        radio: document.body.classList.contains('radio-on'), ad: document.body.classList.contains('ad-on'),
        toast: document.querySelector('#toast').classList.contains('show') ? document.querySelector('#toast').textContent : '' }; }""")

async def main():
    os.makedirs(SHOTS, exist_ok=True)
    server = subprocess.Popen([sys.executable, os.path.join(ROOT, "tests", "server.py"), ROOT, str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME, args=["--autoplay-policy=no-user-gesture-required"])

            # 1. Home as a first-time phone visitor
            pg = await new_page(b)
            await pg.goto(BASE); await pg.wait_for_timeout(1200)
            info = await pg.evaluate("""() => ({tiles: document.querySelectorAll('.tile').length, stations: document.querySelectorAll('.station').length,
                intro: !!document.querySelector('#intro'), onair: !!document.querySelector('.radio-banner'), title: document.title,
                inter: document.fonts.check('16px Inter'), wide: document.documentElement.scrollWidth - window.innerWidth,
                dead: [...document.querySelectorAll('a')].filter(a => a.getAttribute('href') === '#').length})""")
            check("home shows songs, stations, the radio and the intro", info["tiles"] > 10 and info["stations"] >= 4 and info["intro"] and info["onair"], str(info))
            check("fonts are loaded from the site", info["inter"])
            check("no sideways scrolling on the home page", info["wide"] <= 0, str(info["wide"]))
            check("no dead links", info["dead"] == 0, str(info["dead"]))
            await pg.screenshot(path=f"{SHOTS}/01-home.png"); await pg.screenshot(path=f"{SHOTS}/02-home-full.png", full_page=True)

            # 2. Tap a song: it plays and the player opens with lyrics
            await pg.click('.hrow .tile[data-song="rm-0006"] >> nth=0'); await pg.wait_for_timeout(2200)
            s = await state(pg)
            check("tapping a song plays it and opens the player", s["np"] and not s["paused"] and s["t"] > 0.5, str(s))
            await pg.click("#npBest"); await pg.wait_for_timeout(1500)
            lit = await pg.evaluate("(() => { const e=document.querySelector('#lyrBox .ll.on'); return e ? e.textContent : '' })()")
            check("the lyric line being sung is lit", bool(lit))
            await pg.click("#lyrMore"); await pg.wait_for_timeout(200)
            line = pg.locator("#lyrBox .ll").nth(10); lt = float(await line.get_attribute("data-t")); await line.click(); await pg.wait_for_timeout(900)
            s = await state(pg); check("tapping a lyric line jumps there", abs(s["t"] - lt) < 3, f"{lt} vs {s['t']}")
            await pg.screenshot(path=f"{SHOTS}/03-player.png")
            # license window on top of the player: focus stays inside, Escape closes it
            await pg.click("#npLicense"); await pg.wait_for_timeout(300)
            inside = await pg.evaluate("document.querySelector('#modal').contains(document.activeElement) && document.querySelector('#np').hasAttribute('inert')")
            check("license window takes the focus and locks the page behind", inside)
            await pg.screenshot(path=f"{SHOTS}/04-license.png")
            await pg.click("#lic button[type=submit]"); await pg.wait_for_timeout(500)
            lic = await pg.evaluate("document.querySelector('.cert dd b').textContent")
            check("demo checkout gives a certificate with a license ID", bool(re.match(r"^VL-\d{4}-[A-Z0-9]{8}$", lic)), lic)
            await pg.click("#mVerify"); await pg.wait_for_timeout(700)
            ok = await pg.evaluate("location.hash.startsWith('#/verify') && !!document.querySelector('#vr .cert') && !document.querySelector('#np').classList.contains('open')")
            check("the certificate can be verified", ok)

            # 3. Search like Spotify: a mood, a genre, a collection, "explicit", "video", a title, an artist
            cat = json.loads(open(os.path.join(ROOT, "data", "catalogue.json"), encoding="utf-8").read())["songs"]
            tagged = lambda t: sum(1 for x in cat if x["genre"] == t or t in x.get("tags", []))
            for q, want in (("sensual", tagged("Sensual")), ("romantic", tagged("Romantic")), ("slowed", tagged("Slowed")), ("anthem", tagged("Arena Anthems")),
                            ("r&b", tagged("R&B / Soul")), ("explicit", sum(1 for x in cat if x.get("explicit"))), ("video", sum(1 for x in cat if x.get("video"))),
                            ("barefoot", 1), ("jazz", 0)):
                await pg.goto(BASE + "#/search?q=" + q.replace("&", "%26")); await pg.wait_for_timeout(350)
                n = await pg.evaluate("document.querySelectorAll('#sres .srow').length")
                check(f"search '{q}' finds {want} song(s)", n == want and want != 1 or (want == 1 and n == 1), str(n))
            await pg.goto(BASE + "#/search?q=sensual"); await pg.wait_for_timeout(350)
            await pg.screenshot(path=f"{SHOTS}/05-search.png")
            await pg.goto(BASE + "#/search?q=voluptra"); await pg.wait_for_timeout(350)
            a = await pg.evaluate("({artist: document.querySelectorAll('#sres .atile').length, songs: document.querySelectorAll('#sres .srow').length})")
            check("search 'voluptra' finds the artist and the artist's songs", a["artist"] == 1 and a["songs"] >= 1, str(a))
            # artist page, credits and the share card
            await pg.click("#sres .atile"); await pg.wait_for_timeout(500)
            a = await pg.evaluate("({h: location.hash, name: (document.querySelector('.ahead h1')||{}).textContent, rows: document.querySelectorAll('main .lrow').length, about: !!document.querySelector('.about-card')})")
            check("the artist page shows the name, the songs and About", a["h"] == "#/artist/voluptra" and a["name"] == "VOLUPTRA" and a["rows"] >= 1 and a["about"], str(a))
            await pg.screenshot(path=f"{SHOTS}/05b-artist.png", full_page=True)
            await pg.click("main .lrow >> nth=0"); await pg.wait_for_timeout(1200)
            await pg.click("[data-credits]"); await pg.wait_for_timeout(300)
            cr = await pg.evaluate("document.querySelector('#mBody').textContent")
            check("credits list the artist, the writer and Suno", "VOLUPTRA" in cr and "Robert Monther" in cr and "Suno" in cr, cr[:120])
            await pg.keyboard.press("Escape"); await pg.wait_for_timeout(200)
            await pg.click("#npShare"); await pg.wait_for_timeout(900)
            sh = await pg.evaluate("""() => { const c=document.querySelector('#shareCv'); if(!c) return {ok:false}; const d=c.getContext('2d').getImageData(540,900,1,1).data; return {ok:true, tabs: document.querySelectorAll('[data-shtab]').length, painted: d[3]>0, lyricsTab: !document.querySelector('[data-shtab=lyrics]').disabled}; }""")
            check("share opens a ready card with Song and Lyrics", sh.get("ok") and sh["tabs"] == 2 and sh["painted"] and sh["lyricsTab"], str(sh))
            await pg.click("[data-shtab=lyrics]"); await pg.wait_for_timeout(300); await pg.click(".pickline >> nth=3"); await pg.wait_for_timeout(400)
            picked = await pg.evaluate("document.querySelectorAll('.pickline.on').length")
            check("share: lyric lines can be picked", picked == 2, str(picked))
            await pg.screenshot(path=f"{SHOTS}/05c-share-lyrics.png")
            await pg.keyboard.press("Escape"); await pg.wait_for_timeout(200); await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)

            # 4. Every page: no sideways scrolling at a narrow phone width, no errors
            small = await new_page(b, 360, 740)
            for path in ("#/", "#/search", "#/genre/sensual", "#/genre/anthems", "#/artist/voluptra", "#/song/rm-0007", "#/song/rm-0020", "#/radio", "#/videos", "#/pricing", "#/verify", "#/account", "#/settings", "#/genre/nope", "#/song/nope"):
                await small.goto(BASE + path); await small.wait_for_timeout(400)
                over = await small.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                tiny = await small.evaluate("""() => [...document.querySelectorAll('main button, main a.btn, main a.pill, .tabbar a, .tabbar button')].filter(e => { const r=e.getBoundingClientRect(); return r.width>0 && r.height<32 && !e.classList.contains('ll'); }).length""")
                check(f"page {path} fits a 360px phone, buttons are big enough", over <= 0 and tiny == 0, f"overflow {over}, small buttons {tiny}")
                name = re.sub(r"[^a-z0-9]+", "-", path.lower()).strip("-") or "home"
                await small.screenshot(path=f"{SHOTS}/page-{name}.png", full_page=True)
            check("no errors on any page (phone)", not small.problems and not pg.problems, str((small.problems + pg.problems)[:4]))

            # 4b. Menu and the Upload button
            await small.goto(BASE); await small.wait_for_timeout(400)
            up = await small.evaluate("(() => { const b=document.querySelector('#uploadBtn'), r=b.getBoundingClientRect(); return {w:r.width, h:r.height, text:b.textContent.trim(), right:r.right<=window.innerWidth}; })()")
            check("the Upload button is on screen on a small phone", up["w"] > 40 and up["h"] >= 32 and up["right"] and up["text"] == "Upload", str(up))
            await small.click("#menuBtn"); await small.wait_for_timeout(400)
            m = await small.evaluate("({open: !document.querySelector('#drawer').hidden, items: [...document.querySelectorAll('.dr-item')].map(e=>e.textContent.trim()), first: document.querySelector('.dr-item').textContent.trim(), focusIn: document.querySelector('#drawer').contains(document.activeElement), inert: document.querySelector('main').hasAttribute('inert')})")
            check("the menu opens with Upload first, then Settings and the other pages", m["open"] and m["first"] == "Upload a song" and "Settings" in m["items"] and "Radio" in m["items"] and m["focusIn"] and m["inert"], str(m))
            await small.screenshot(path=f"{SHOTS}/04b-menu.png")
            await small.keyboard.press("Escape"); await small.wait_for_timeout(250)
            closed = await small.evaluate("document.querySelector('#drawer').hidden && !document.querySelector('main').hasAttribute('inert')")
            await small.click("#menuBtn"); await small.wait_for_timeout(300); await small.click(".dr-item[href='#/settings']"); await small.wait_for_timeout(400)
            there = await small.evaluate("location.hash==='#/settings' && document.querySelector('#drawer').hidden && !!document.querySelector('main h1')")
            check("Escape closes the menu; a menu item opens its page", closed and there)

            # 4c. Like Spotify (the default): no age question; explicit songs carry an E badge and can be hidden in Settings
            ex = await new_page(b, adult=False)
            n_exp = len([x for x in cat if x.get("explicit")])
            await ex.goto(BASE + "#/genre/sensual"); await ex.wait_for_timeout(500)
            marks = await ex.evaluate("({a18: document.querySelectorAll('main .a18').length, e: document.querySelectorAll('main .e-badge').length})")
            await ex.click("main .lrow >> nth=0"); await ex.wait_for_timeout(1800)
            st = await state(ex); asked = await ex.evaluate("!document.querySelector('#modal').hidden")
            check("no age question: a sensual song plays at once, explicit songs show the E badge", marks["a18"] == 0 and marks["e"] >= 1 and st["np"] and not st["paused"] and not asked, f"{marks} {st} {asked}")
            await ex.click("#npClose"); await ex.goto(BASE + "#/settings"); await ex.wait_for_timeout(300)
            await ex.screenshot(path=f"{SHOTS}/04d-settings.png", full_page=True)
            await ex.click("#exToggle"); await ex.wait_for_timeout(400)
            await ex.goto(BASE + "#/search?q=explicit"); await ex.wait_for_timeout(400); n1 = await ex.evaluate("document.querySelectorAll('#sres .srow').length")
            await ex.goto(BASE + "#/search?q="); await ex.wait_for_timeout(300); total = await ex.evaluate("document.querySelectorAll('#sres .srow').length")
            await ex.goto(BASE + "#/settings"); await ex.wait_for_timeout(300); await ex.click("#exToggle"); await ex.wait_for_timeout(300)
            await ex.goto(BASE + "#/search?q=explicit"); await ex.wait_for_timeout(400); n2 = await ex.evaluate("document.querySelectorAll('#sres .srow').length")
            check("Settings can hide the explicit songs on a device and bring them back", n1 == 0 and total == len(cat) - n_exp and n2 == n_exp and not ex.problems, f"{n1} {total} {n2} {n_exp} {ex.problems[:2]}")

            # 4d. The age question, for a site that switches it on (config.js: ageGate true): asks once, nothing adult starts by itself, hidden after "No"
            ag = await new_page(b, adult=False, gate=True)
            await ag.goto(BASE + "#/genre/sensual"); await ag.wait_for_timeout(500)
            marks = await ag.evaluate("document.querySelectorAll('main .a18').length")
            await ag.click("main .lrow >> nth=0"); await ag.wait_for_timeout(700)
            q = await ag.evaluate("({asked: (document.querySelector('#mTitle')||{}).textContent, playing: !document.querySelector('#audio').paused, src: document.querySelector('#audio').currentSrc})")
            check("an adult song shows 18+ and asks the age before playing", marks >= 10 and q["asked"] == "Adults only" and not q["playing"] and not q["src"], f"{marks} {q}")
            await ag.screenshot(path=f"{SHOTS}/04c-age-question.png")
            await ag.click("#ageYes"); await ag.wait_for_timeout(1800)
            st = await state(ag); left = await ag.evaluate("document.querySelectorAll('main .a18').length")
            check("after Yes the song plays and the 18+ marks are gone", st["np"] and not st["paused"] and left == 0, f"{st} {left}")
            a2 = await new_page(b, adult=False, gate=True)
            await a2.goto(BASE); await a2.wait_for_timeout(600)
            await a2.click(".tabbar [data-stream]"); await a2.wait_for_timeout(1500)
            adult_ids = {x["id"] for x in cat if x.get("adult") or x.get("explicit")}
            cur = await a2.evaluate("(() => { const t=document.querySelector('#npTitle').textContent; return t; })()")
            cur_id = next((x["id"] for x in cat if x["title"] == cur), "")
            check("before the age is known, Stream starts a song that is not for adults", bool(cur_id) and cur_id not in adult_ids, cur)
            await a2.click("#npClose"); await a2.wait_for_timeout(300)
            await a2.goto(BASE + "#/genre/sensual"); await a2.wait_for_timeout(400); await a2.click("#gPlay"); await a2.wait_for_timeout(500)
            asked = await a2.evaluate("(document.querySelector('#mTitle')||{}).textContent")
            await a2.click("#ageNo"); await a2.wait_for_timeout(500)
            await a2.goto(BASE + "#/search?q=sensual"); await a2.wait_for_timeout(400)
            n1 = await a2.evaluate("document.querySelectorAll('#sres .srow').length")
            await a2.goto(BASE + "#/song/rm-0008"); await a2.wait_for_timeout(300)
            hid = await a2.evaluate("document.querySelector('main h1').textContent")
            await a2.goto(BASE + "#/search?q="); await a2.wait_for_timeout(300)
            total = await a2.evaluate("document.querySelectorAll('#sres .srow').length")
            check("after No, adult songs are hidden everywhere", asked == "Adults only" and n1 == 0 and hid == "For adults only" and total == len(cat) - len(adult_ids), f"{asked} {n1} {hid} {total}")
            await a2.goto(BASE + "#/settings"); await a2.wait_for_timeout(300)
            await a2.click("[data-age]"); await a2.wait_for_timeout(300); await a2.click("#ageYes"); await a2.wait_for_timeout(400)
            await a2.goto(BASE + "#/search?q=sensual"); await a2.wait_for_timeout(400)
            back = await a2.evaluate("document.querySelectorAll('#sres .srow').length")
            check("Settings can bring the adult songs back", back == tagged("Sensual"), str(back))
            check("no errors around the age question", not ag.problems and not a2.problems, str((ag.problems + a2.problems)[:4]))

            # 5. Radio: two listeners land on the same song at the same moment; no seeking on live radio
            r1 = await new_page(b); r2 = await new_page(b)
            await r1.goto(BASE + "#/radio"); await r2.goto(BASE + "#/radio"); await r1.wait_for_timeout(600)
            await asyncio.gather(r1.click("[data-radio]"), r2.click("[data-radio]")); await r1.wait_for_timeout(3000)
            a, c = await state(r1), await state(r2)
            check("radio: both listeners hear the same song", a["radio"] and a["src"] == c["src"] and not a["paused"], f"{a['src']} / {c['src']}")
            check("radio: both listeners are at the same moment", abs(a["t"] - c["t"]) < 2.5, f"{a['t']:.1f} / {c['t']:.1f}")
            before = a["t"]; await r1.mouse.click(60, await r1.evaluate("document.querySelector('#npBar').getBoundingClientRect().y + 12")); await r1.wait_for_timeout(500)
            a = await state(r1); check("radio: the song can't be dragged around", a["t"] >= before and "live radio" in a["toast"], str(a))
            await r1.screenshot(path=f"{SHOTS}/06-radio-player.png")
            # a song ends on the radio: the next one starts by itself
            await r1.evaluate("(() => { const a=document.querySelector('#audio'); a.currentTime = a.duration - 1.5; })()"); await r1.wait_for_timeout(4500)
            n = await state(r1); check("radio: the next song starts by itself", n["radio"] and not n["paused"] and n["t"] < 60 or n["src"] != a["src"], str(n))
            # picking a song leaves the radio
            await r1.click("#npClose"); await r1.goto(BASE + "#/search"); await r1.wait_for_timeout(300); await r1.click("#sres .srow >> nth=2"); await r1.wait_for_timeout(1500)
            n = await state(r1); check("picking a song leaves radio mode", not n["radio"] and n["np"] and n["t"] < 5, str(n))
            check("no errors while using the radio", not r1.problems and not r2.problems, str((r1.problems + r2.problems)[:4]))

            # 6. Ads are off by default; when switched on, a spot plays between songs and the music carries on
            off = await pg.evaluate("document.querySelectorAll('.ad-slot').length")
            check("ads are off by default: nothing is shown", off == 0)
            ad = await new_page(b)
            cfg = open(os.path.join(ROOT, "config.js"), encoding="utf-8").read()
            cfg = cfg.replace("enabled: false,", "enabled: true,").replace("streamEvery: 4,", "streamEvery: 1,").replace("audio: [],", 'audio: [{ id: "t", title: "Test message", audio: "media/audio/song-06-barefoot.mp3", link: "#/pricing" }],').replace("banners: {}", 'banners: { home: { text: "Test banner", link: "#/radio" } }')
            await ad.route("**/config.js*", lambda route: route.fulfill(body=cfg, content_type="application/javascript"))
            await ad.goto(BASE + "#/genre/anthems"); await ad.wait_for_timeout(600)
            await ad.click(".rows .srow >> nth=0"); await ad.wait_for_timeout(1500)
            first = await state(ad)
            await ad.evaluate("(() => { const a=document.querySelector('#audio'); a.currentTime = a.duration - 1.2; })()"); await ad.wait_for_timeout(3500)
            s = await state(ad); check("ads on: a message plays after the song", s["ad"] and "barefoot" in s["src"] and not s["paused"], str(s))
            await ad.screenshot(path=f"{SHOTS}/07-ad.png")
            await ad.evaluate("(() => { const a=document.querySelector('#audio'); a.currentTime = a.duration - 1.2; })()"); await ad.wait_for_timeout(3500)
            s = await state(ad); check("ads on: the next song plays after the message", not s["ad"] and s["src"] != first["src"] and "barefoot" not in s["src"] and not s["paused"], str(s))
            await ad.click("#npClose"); await ad.goto(BASE); await ad.wait_for_timeout(500)
            check("ads on: the home banner shows", await ad.evaluate("document.querySelectorAll('main .ad-slot').length") == 1)
            check("no errors with ads on", not ad.problems, str(ad.problems[:4]))

            # 7. Hostile song data can't inject anything into the page
            evil = await new_page(b)
            data = open(os.path.join(ROOT, "data", "catalogue.js"), encoding="utf-8").read()
            d = json.loads(data[len("window.VELORA_DATA="):].rstrip().rstrip(";"))
            bad = dict(d["songs"][0]); bad.update({"id": 'x"><img src=x onerror=window.__pwned=1>', "title": '<img src=x onerror=window.__pwned=1>', "art": "media/covers/a') ;}</style><script>window.__pwned=1</script>.jpg", "mood": "<b>m</b>", "lyrics": [[1, "<script>window.__pwned=1</script>"]]})
            d["songs"].insert(0, bad); d["categories"][0]["color"] = 'red" onmouseover="window.__pwned=1'
            await evil.route("**/data/catalogue.js*", lambda route: route.fulfill(body="window.VELORA_DATA=" + json.dumps(d) + ";", content_type="application/javascript"))
            for path in ("#/", "#/search", "#/search?q=%3Cimg%20src%3Dx%20onerror%3Dwindow.__pwned%3D1%3E", "#/verify?id=%22%3E%3Cimg%20src%3Dx%20onerror%3Dwindow.__pwned%3D1%3E"):
                await evil.goto(BASE + path); await evil.wait_for_timeout(400)
            await evil.goto(BASE + "#/search"); await evil.wait_for_timeout(300); await evil.click("#sres .srow >> nth=0"); await evil.wait_for_timeout(800)
            pw = await evil.evaluate("({p: window.__pwned === 1, imgs: document.querySelectorAll('main img, #np img, script:not([src])').length})")
            check("hostile song data and addresses can't inject code", not pw["p"] and pw["imgs"] == 0, str(pw))

            # 7b. The legal pages: all six open, in plain words, with the prices from config.js
            lg = await new_page(b)
            await lg.goto(BASE + "#/legal"); await lg.wait_for_selector(".legalcard")
            cards = await lg.evaluate("[...document.querySelectorAll('.legalcard')].map(a => a.getAttribute('href'))")
            bad = []; texts = {}
            for href in cards:
                await lg.goto(BASE + href); await lg.wait_for_selector("article.legal h2")
                t = await lg.inner_text("main"); texts[href] = t
                n = await lg.evaluate("document.querySelectorAll('article.legal section').length")
                if n < 2 or "Draft of" not in t or re.search(r"undefined|\[object|NaN|\$\{", t): bad.append(href)
            await lg.screenshot(path=f"{SHOTS}/07b-legal.png", full_page=True)
            foot = await lg.evaluate("!!document.querySelector('.footlinks a[href=\"#/legal\"]')")
            await lg.click("#menuBtn"); await lg.wait_for_selector("#drawerNav a"); inmenu = await lg.evaluate("!!document.querySelector('#drawerNav a[href=\"#/legal\"]')")
            check("the six legal pages open from the menu and the footer, with the prices from config.js", len(cards) == 6 and not bad and foot and inmenu
                  and all(x in texts["#/license"] for x in ("€9", "€49", "€14")) and "lose the right to withdraw" in texts["#/sales"] and "Autoriteit Persoonsgegevens" in texts["#/privacy"] and not lg.problems, f"{cards} {bad} {lg.problems[:2]}")

            # 8. English only: no Arabic letters in anything the site serves
            arabic = []
            for dirpath, dirs, files in os.walk(ROOT):
                dirs[:] = [d for d in dirs if d not in (".git", "media", "tests", "node_modules", "vendor")]
                for f in files:
                    if f.endswith((".js", ".html", ".css", ".json", ".md", ".sql")):
                        if re.search(r"[\u0600-\u06FF]", open(os.path.join(dirpath, f), encoding="utf-8").read()): arabic.append(f)
            check("English only: no Arabic text in the site files", not arabic, str(arabic))

            # 9. Desktop
            dk = await new_page(b, 1366, 860, mobile=False)
            await dk.goto(BASE); await dk.wait_for_timeout(900)
            over = await dk.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            await dk.screenshot(path=f"{SHOTS}/08-desktop.png")
            await dk.click(".hrow .tile >> nth=1"); await dk.wait_for_timeout(1500)
            s = await state(dk); await dk.screenshot(path=f"{SHOTS}/09-desktop-player.png")
            await dk.keyboard.press("Escape"); await dk.wait_for_timeout(500)
            s2 = await state(dk)
            check("desktop: layout fits, player opens and Escape closes it", over <= 0 and s["np"] and not s2["np"] and not dk.problems, str(dk.problems[:3]))
            await b.close()
    finally:
        server.terminate()
    print(f"\n{sum(results)} of {len(results)} checks passed")
    sys.exit(0 if all(results) else 1)

asyncio.run(main())
