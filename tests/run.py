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

def check(name, ok, detail=""):
    results.append(ok)
    print(("PASS  " if ok else "FAIL  ") + name + (f"   [{detail}]" if detail and not ok else ""), flush=True)

async def new_page(browser, width=390, height=844, mobile=True):
    ctx = await browser.new_context(viewport={"width": width, "height": height}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
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
            await pg.click(".hrow .tile >> nth=0"); await pg.wait_for_timeout(2200)
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

            # 3. Search in Arabic and English
            for q, want in (("حسي", 5), ("رومانسي", 2), ("ترند", 5), ("barefoot", 1)):
                await pg.goto(BASE + "#/search?q=" + q); await pg.wait_for_timeout(350)
                n = await pg.evaluate("document.querySelectorAll('#sres .srow').length")
                check(f"search '{q}' finds {want} song(s)", n == want, str(n))
            await pg.screenshot(path=f"{SHOTS}/05-search.png")

            # 4. Every page: no sideways scrolling at a narrow phone width, no errors
            small = await new_page(b, 360, 740)
            for path in ("#/", "#/search", "#/genre/explicit-sensual", "#/song/rm-0007", "#/radio", "#/videos", "#/pricing", "#/verify", "#/account", "#/genre/nope", "#/song/nope"):
                await small.goto(BASE + path); await small.wait_for_timeout(400)
                over = await small.evaluate("document.documentElement.scrollWidth - window.innerWidth")
                tiny = await small.evaluate("""() => [...document.querySelectorAll('main button, main a.btn, main a.pill, .tabbar a, .tabbar button')].filter(e => { const r=e.getBoundingClientRect(); return r.width>0 && r.height<32 && !e.classList.contains('ll'); }).length""")
                check(f"page {path} fits a 360px phone, buttons are big enough", over <= 0 and tiny == 0, f"overflow {over}, small buttons {tiny}")
                name = re.sub(r"[^a-z0-9]+", "-", path.lower()).strip("-") or "home"
                await small.screenshot(path=f"{SHOTS}/page-{name}.png", full_page=True)
            check("no errors on any page (phone)", not small.problems and not pg.problems, str((small.problems + pg.problems)[:4]))

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
            await ad.goto(BASE + "#/genre/trend"); await ad.wait_for_timeout(600)
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

            # 8. Desktop
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
