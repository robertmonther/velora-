"""Velora voice checks: the microphone in the page, from the tap to the music.

    python3 tests/voice.py        (needs: pip install playwright, Chrome)

No real microphone is used. The browser's speech service is played by a small stand-in that "hears" whatever
sentence the check gives it (in English, in Arabic, or an error), and inside the app the phone's speech plugin
is played the same way. What the sentences MEAN is checked separately, without a browser: node tests/voice.mjs.
Pictures of the three microphone shapes go to tests/shots/ (not committed)."""
import asyncio, json, mimetypes, os, re, sys, threading
from http.server import ThreadingHTTPServer
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from server import H

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8797
BASE = f"http://localhost:{PORT}/index.html"
SHOTS = os.path.join(ROOT, "tests", "shots")
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
CFG = open(os.path.join(ROOT, "config.js"), encoding="utf-8").read()
SUPA = (re.search(r'supabase:\s*\{\s*url:\s*"([^"]*)"', CFG) or [None, ""])[1]
REPO = re.search(r'mediaRepo:\s*"([^"]+)"', CFG)[1]; REV = re.search(r'mediaRev:\s*"([^"]+)"', CFG)[1]
CDN = f"https://cdn.jsdelivr.net/gh/{REPO}@{REV}/"
CORS = {"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS"}
results = []

def check(name, ok, detail=""):
    results.append(ok); print(("PASS  " if ok else "FAIL  ") + name + (f"   [{detail}]" if detail and not ok else ""), flush=True)

# The browser's speech service, played by a stand-in: it starts "listening" and then hears what the check says.
SPEECH = """
window.__sr = { started: [], cur: null };
class FakeSpeech {
  constructor(){ this.lang = ""; this.dead = false; }
  start(){ window.__sr.started.push(this.lang); window.__sr.cur = this; setTimeout(() => { if(!this.dead && this.onstart) this.onstart(); }, 10); }
  stop(){ if(this.dead) return; this.dead = true; setTimeout(() => this.onend && this.onend(), 0); }
  abort(){ this.dead = true; }
}
window.SpeechRecognition = window.webkitSpeechRecognition = FakeSpeech;
window.__say = alts => { const r = window.__sr.cur; if(!r || r.dead) return false;
  const one = alts.map(t => ({ transcript: t, confidence: .9 })); one.isFinal = true;
  r.onresult && r.onresult({ resultIndex: 0, results: [one] }); r.dead = true; r.onend && r.onend(); return true; };
window.__fail = code => { const r = window.__sr.cur; if(!r || r.dead) return false; r.onerror && r.onerror({ error: code }); r.dead = true; r.onend && r.onend(); return true; };
"""
NO_SPEECH = "try{ delete window.SpeechRecognition; delete window.webkitSpeechRecognition; }catch(e){} Object.defineProperty(window, 'SpeechRecognition', {value: undefined}); Object.defineProperty(window, 'webkitSpeechRecognition', {value: undefined});"
# The app's bridge with the phone's speech plugin, played by a stand-in.
BRIDGE = """
window.__native = []; window.__speech = { available: true, perm: "prompt", grant: true, matches: ["play the skeleton key"], fail: "" };
window.Capacitor = { isNativePlatform: () => true, Plugins: { SpeechRecognition: {}, Share: {} },
  nativePromise: (plugin, method, options) => { window.__native.push({ plugin, method, options }); const S = window.__speech;
    if(plugin !== "SpeechRecognition") return Promise.resolve({});
    if(method === "available") return Promise.resolve({ available: S.available });
    if(method === "checkPermissions") return Promise.resolve({ speechRecognition: S.perm });
    if(method === "requestPermissions"){ S.perm = S.grant ? "granted" : "denied"; return Promise.resolve({ speechRecognition: S.perm }); }
    if(method === "start") return S.fail ? Promise.reject(new Error(S.fail)) : new Promise(res => setTimeout(() => res({ status: "success", matches: S.matches }), 60));
    return Promise.resolve({}); } };
"""

async def backend(route):
    u = route.request.url
    if route.request.method == "OPTIONS": await route.fulfill(status=204, headers=CORS)
    elif "/rpc/public_catalogue" in u: await route.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body='{"complete":true,"songs":[],"artists":[]}')
    elif "/rpc/shop_info" in u: await route.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body='{"open":false,"currency":"eur","rent":900,"buy":4900,"premium":1400,"rent_days":30}')
    else: await route.fulfill(status=404, headers={**CORS, "content-type": "application/json"}, body='{"message":"not in the stand-in"}')
async def cdn(route):          # inside the app the songs come from the web; here the web is the repo folder
    path = os.path.join(ROOT, route.request.url[len(CDN):].split("?")[0])
    if not os.path.isfile(path): return await route.fulfill(status=404, headers=CORS, body="")
    await route.fulfill(status=200, headers={**CORS, "content-type": mimetypes.guess_type(path)[0] or "application/octet-stream", "accept-ranges": "bytes"}, body=open(path, "rb").read())

async def new_page(browser, width=390, height=844, mobile=True, speech=SPEECH, app=False, config=None, store=None):
    ctx = await browser.new_context(viewport={"width": width, "height": height}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1, locale="en-US")
    await ctx.add_init_script("try{ localStorage.setItem('velora_age', JSON.stringify('adult')); }catch(e){}")
    for k, v in (store or {}).items(): await ctx.add_init_script(f"try{{ if(!sessionStorage.getItem('seeded_{k}')){{ localStorage.setItem({json.dumps(k)}, {json.dumps(json.dumps(v))}); sessionStorage.setItem('seeded_{k}', '1'); }} }}catch(e){{}}")
    if speech: await ctx.add_init_script(speech)
    if app: await ctx.add_init_script(BRIDGE); await ctx.route(CDN + "**", cdn)
    if config: await ctx.route("**/config.js*", lambda r: r.fulfill(body=config, content_type="application/javascript"))
    if SUPA: await ctx.route(SUPA + "/**", backend)
    page = await ctx.new_page(); page.problems = []
    page.on("pageerror", lambda e: page.problems.append("error: " + str(e)))
    page.on("console", lambda m: page.problems.append("console: " + m.text) if m.type == "error" else None)
    return page

SEEN = "el => !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0"
async def state(page):
    return await page.evaluate(f"""() => {{ const a = document.querySelector('#audio'), q = s => document.querySelector(s), seen = {SEEN}; return {{
        np: q('#np').classList.contains('open'), title: q('#npTitle').textContent, frm: q('#npFrom').textContent, paused: a.paused, src: decodeURIComponent(a.currentSrc.split('/').pop()),
        radio: document.body.classList.contains('radio-on'), toast: q('#toast').classList.contains('show') ? q('#toast').textContent : '',
        sheet: !!q('#vx'), st: q('#vxState') ? q('#vxState').textContent : '', heard: q('#vxHeard') ? q('#vxHeard').textContent : '', mic: q('#vxMic') ? q('#vxMic').dataset.state : '',
        lng: q('#vx') ? q('#vx').dataset.lang : '', dir: q('#vx') ? getComputedStyle(q('#vx')).direction : '', res: q('#vxRes') ? q('#vxRes').innerText : '', picks: [...document.querySelectorAll('#vxRes [data-vpick]')].map(b => b.innerText.split('\\n')[0]),
        chips: [...document.querySelectorAll('#vxRes [data-vsay]')].map(b => b.textContent), tips: [...document.querySelectorAll('#vxTips [data-vsay]')].filter(seen).map(b => b.textContent),
        fab: seen(q('#voiceFab')), fabText: seen(q('#voiceFab span')), top: seen(q('.voice-top-btn')), cls: document.documentElement.className }}; }}""")
async def tap_mic(page, sel="#voiceFab"):
    await page.click(sel); await page.wait_for_selector("#vx"); await page.wait_for_selector('#vxMic[data-state="listening"]')
async def say(page, *alts, wait=700):
    ok = await page.evaluate("a => window.__say(a)", list(alts)); await page.wait_for_timeout(wait); return ok
async def catalogue(page):
    return await page.evaluate("() => window.VELORA_DATA.songs.map(s => ({id: s.id, title: s.title, genre: s.genre, tags: s.tags || [], explicit: !!s.explicit}))")

def serve():
    os.chdir(ROOT); srv = ThreadingHTTPServer(("127.0.0.1", PORT), H); srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()

async def main():
    os.makedirs(SHOTS, exist_ok=True); serve()
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--autoplay-policy=no-user-gesture-required"])

        # 1. A phone, on the website
        pg = await new_page(b); await pg.goto(BASE); await pg.wait_for_selector(".feat"); await pg.wait_for_timeout(900)
        songs = await catalogue(pg); cat = lambda title: next(s for s in songs if s["title"] == title)
        s = await state(pg); await pg.screenshot(path=f"{SHOTS}/voice-1-round.png")
        box = await pg.evaluate("() => { const r = document.querySelector('#voiceFab').getBoundingClientRect(), t = document.querySelector('.tabbar').getBoundingClientRect(); return {w: r.width, h: r.height, right: innerWidth - r.right, aboveTabs: t.top - r.bottom}; }")
        check("the round microphone floats bottom right, above the tab bar, big enough for a thumb", s["fab"] and not s["fabText"] and not s["top"] and box["w"] >= 48 and box["h"] >= 48 and 8 <= box["right"] <= 24 and box["aboveTabs"] >= 8, str(box))
        await tap_mic(pg); s = await state(pg); lang = await pg.evaluate("window.__sr.started")
        await pg.screenshot(path=f"{SHOTS}/voice-4-listening.png")
        check("a tap opens the sheet and listens at once, in English, with examples to say", s["sheet"] and s["st"] == "Listening…" and lang == ["en-US"] and len(s["tips"]) >= 3 and s["tips"][0].startswith("Play "), str(s) + str(lang))
        await say(pg, "play the skeleton key"); s = await state(pg)
        check("\"play the skeleton key\": the sheet closes, the song plays and its screen opens", not s["sheet"] and s["np"] and s["title"] == "The Skeleton Key" and not s["paused"] and "The Skeleton Key" in s["toast"], str(s))

        await pg.click("#npVoice"); await pg.wait_for_selector("#vx"); await pg.wait_for_selector('#vxMic[data-state="listening"]'); s = await state(pg)
        check("the player has its own microphone, and the music stops while it listens", s["sheet"] and s["paused"], str(s))
        await say(pg, "pause"); s1 = await state(pg)
        await pg.click("#npVoice"); await pg.wait_for_selector('#vxMic[data-state="listening"]'); await say(pg, "play"); s2 = await state(pg)
        check("\"pause\" pauses and \"play\" carries on with the same song", not s1["sheet"] and s1["paused"] and s1["toast"] == "Paused" and not s2["paused"] and s2["title"] == "The Skeleton Key", str(s1) + str(s2))
        await pg.click("#npVoice"); await pg.wait_for_selector('#vxMic[data-state="listening"]'); await say(pg, "nexed", "next"); s = await state(pg)
        check("\"next\" plays another song (taken from the phone's second guess)", s["np"] and s["title"] not in ("", "The Skeleton Key") and not s["paused"] and s["toast"] == "Next song", str(s))
        await pg.click("#npVoice"); await pg.wait_for_selector('#vxMic[data-state="listening"]'); await pg.keyboard.press("Escape"); await pg.wait_for_timeout(500); s = await state(pg)
        check("closing the sheet without saying anything gives the music back", not s["sheet"] and not s["paused"], str(s))

        # Arabic
        await pg.click("#npVoice"); await pg.wait_for_selector('#vxMic[data-state="listening"]')
        await pg.click('#vx [data-vlang="ar"]'); await pg.wait_for_selector('#vx[data-lang="ar"] #vxMic[data-state="listening"]')
        s = await state(pg); lang = await pg.evaluate("window.__sr.started.slice(-1)[0]"); await pg.screenshot(path=f"{SHOTS}/voice-5-arabic.png")
        check("one tap switches to Arabic: it listens for Lebanese Arabic and shows Arabic sentences to say, while the sheet's own words stay English",
              s["lng"] == "ar" and s["dir"] == "ltr" and lang == "ar-LB" and s["st"] == "Listening…" and len(s["tips"]) >= 3 and all(re.search(r"[\u0600-\u06FF]", t) for t in s["tips"]), str(s) + lang)
        await say(pg, "حطلي شي رومانسي"); s = await state(pg)
        check("Arabic \"play me something romantic\": a Romantic row plays", not s["sheet"] and s["np"] and s["frm"] == "Romantic Radio" and "Romantic" in cat(s["title"])["tags"] and not s["paused"] and s["toast"].startswith("Romantic · "), str(s))
        await pg.click("#npVoice"); await pg.wait_for_selector('#vxMic[data-state="listening"]'); s0 = await state(pg); lang = await pg.evaluate("window.__sr.started.slice(-1)[0]")
        await say(pg, "موسيقى راقية"); s = await state(pg)
        check("the language is remembered, and Arabic \"classy music\" plays the Classy mix", s0["lng"] == "ar" and lang == "ar-LB" and s["frm"] == "Classy mix" and not cat(s["title"])["explicit"] and not s["paused"], str(s))
        await pg.click("#npVoice"); await pg.wait_for_selector('#vxMic[data-state="listening"]'); await say(pg, "حطلي سكيلتون كي"); s = await state(pg)
        check("an English title heard in Arabic letters still finds its song", s["title"] == "The Skeleton Key" and not s["paused"], str(s))
        await pg.click("#npVoice"); await pg.wait_for_selector('#vxMic[data-state="listening"]'); await pg.click('#vx [data-vlang="en"]')
        await pg.wait_for_selector('#vx[data-lang="en"] #vxMic[data-state="listening"]')

        # Not understood, a choice, a mood chip
        await say(pg, "play blinding lights"); s = await state(pg); await pg.screenshot(path=f"{SHOTS}/voice-6-not-found.png")
        check("an unknown song: the sheet stays, says so, and offers moods to tap (nothing plays by a guess)", s["sheet"] and "blinding lights" in s["st"] and len(s["chips"]) >= 3 and s["paused"] and s["mic"] == "idle", str(s))
        await pg.click("#vxMic"); await pg.wait_for_selector('#vxMic[data-state="listening"]'); await say(pg, "burn"); s = await state(pg)
        check("a doubtful match is offered, not played", s["sheet"] and s["picks"] == ["If We Burn"] and s["st"] == "Did you mean…", str(s))
        await pg.click("#vxRes [data-vpick]"); await pg.wait_for_timeout(700); s = await state(pg)
        check("tapping the offered song plays it", not s["sheet"] and s["title"] == "If We Burn" and not s["paused"], str(s))
        await pg.click("#npVoice"); await pg.wait_for_selector('#vxMic[data-state="listening"]'); await say(pg, "play some jazz"); s = await state(pg)
        chip = s["chips"][0] if s["chips"] else ""
        if chip: await pg.click("#vxRes [data-vsay]"); await pg.wait_for_timeout(700)
        s2 = await state(pg)
        check("a genre with no songs yet says so; tapping a mood chip plays that mood", s["sheet"] and "Jazz" in s["st"] and chip != "" and not s2["sheet"] and s2["frm"] == chip + " Radio" and not s2["paused"], str(s) + str(s2))

        # Errors
        await pg.click("#npVoice"); await pg.wait_for_selector('#vxMic[data-state="listening"]'); await pg.evaluate("window.__fail('not-allowed')"); await pg.wait_for_timeout(300); s = await state(pg)
        n0 = await pg.evaluate("window.__sr.started.length"); await pg.click("#vxMic"); await pg.wait_for_selector('#vxMic[data-state="listening"]'); n1 = await pg.evaluate("window.__sr.started.length")
        await pg.evaluate("window.__fail('no-speech')"); await pg.wait_for_timeout(300); s2 = await state(pg)
        check("a blocked microphone and silence are explained in plain words, and the mic can be tapped again", "blocked" in s["st"] and s["mic"] == "idle" and n1 == n0 + 1 and "didn't hear" in s2["st"], str(s) + str(s2))
        await pg.fill("#vxText", "the radio"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(900); s = await state(pg)
        check("typing works as well as speaking: \"the radio\" starts Velora Radio", not s["sheet"] and s["radio"] and not s["paused"] and s["toast"] == "Velora Radio", str(s))
        await pg.click("#npVoice"); await pg.wait_for_selector('#vxMic[data-state="listening"]'); await say(pg, "next"); s = await state(pg)
        check("live radio cannot skip: \"next\" says so and the radio goes on", s["radio"] and not s["paused"] and "live radio" in s["toast"], str(s))
        check("no errors on the phone pages", not pg.problems, str(pg.problems[:4]))

        # 2. The search field, and the settings
        pg2 = await new_page(b); await pg2.goto(BASE + "#/search"); await pg2.wait_for_selector(".sbox-mic"); await pg2.wait_for_timeout(500)
        ok_search = await pg2.evaluate(f"() => {{ const seen = {SEEN}; return seen(document.querySelector('.sbox-mic')); }}")
        await tap_mic(pg2, ".sbox-mic"); await say(pg2, "something sensual"); s = await state(pg2)
        check("the search field has a microphone, and a mood said there plays", ok_search and s["np"] and s["frm"] == "Sensual Radio" and not s["paused"], str(s))
        await pg2.evaluate("document.querySelector('#npClose').click()"); await pg2.wait_for_timeout(500)
        await pg2.goto(BASE + "#/settings"); await pg2.wait_for_selector("#voicePanel")
        await pg2.click('[data-vsetplace="pill"]'); await pg2.wait_for_timeout(700); s_pill = await state(pg2); await pg2.goto(BASE + "#/"); await pg2.wait_for_selector(".feat"); await pg2.wait_for_timeout(900); await pg2.screenshot(path=f"{SHOTS}/voice-2-wide.png")
        pill = await pg2.evaluate("() => { const r = document.querySelector('#voiceFab').getBoundingClientRect(); return {center: Math.abs((r.left + r.right) / 2 - innerWidth / 2), w: r.width, text: document.querySelector('#voiceFab span').textContent}; }")
        await pg2.goto(BASE + "#/settings"); await pg2.wait_for_selector("#voicePanel"); await pg2.click('[data-vsetplace="top"]'); await pg2.wait_for_timeout(400); s_top = await state(pg2)
        await pg2.goto(BASE + "#/"); await pg2.wait_for_selector(".feat"); await pg2.wait_for_timeout(700); await pg2.screenshot(path=f"{SHOTS}/voice-3-top.png")
        await pg2.reload(); await pg2.wait_for_selector(".feat"); await pg2.wait_for_timeout(500); s_again = await state(pg2)
        await tap_mic(pg2, ".voice-top-btn"); s_open = await state(pg2); await pg2.keyboard.press("Escape")
        await pg2.goto(BASE + "#/settings"); await pg2.wait_for_selector("#voicePanel"); await pg2.click('[data-vsetplace="off"]'); await pg2.wait_for_timeout(300); s_off = await state(pg2)
        check("Settings > Voice changes the microphone button: wide and centred, in the top bar, or hidden; the choice is remembered",
              s_pill["fab"] and s_pill["fabText"] and pill["center"] <= 2 and pill["w"] > 150 and pill["text"] == "Say a song or a mood"
              and s_top["top"] and not s_top["fab"] and s_again["top"] and not s_again["fab"] and s_open["sheet"] and not s_off["fab"] and not s_off["top"] and not pg2.problems, str([s_pill["cls"], pill, s_top["cls"], s_again["cls"], s_off["cls"], pg2.problems[:3]]))

        # 3. A browser that cannot listen
        pg3 = await new_page(b, speech=NO_SPEECH); await pg3.goto(BASE); await pg3.wait_for_selector(".feat"); await pg3.wait_for_timeout(700)
        await pg3.click("#voiceFab"); await pg3.wait_for_selector("#vx"); await pg3.wait_for_timeout(300); s = await state(pg3)
        await pg3.fill("#vxText", "play fashionably late"); await pg3.click("#vxForm button"); await pg3.wait_for_timeout(800); s2 = await state(pg3)
        check("a browser without a speech service says so and takes the same sentence typed", s["sheet"] and "can't listen" in s["st"] and s["mic"] == "typeonly" and s2["title"] == "Fashionably Late" and not s2["paused"] and not pg3.problems, str(s) + str(s2) + str(pg3.problems[:3]))

        # 4. A computer
        dk = await new_page(b, 1366, 860, mobile=False); await dk.goto(BASE); await dk.wait_for_selector(".feat"); await dk.wait_for_timeout(800)
        d = await dk.evaluate(f"() => {{ const seen = {SEEN}; return {{ field: seen(document.querySelector('.search-mic')), top: seen(document.querySelector('.voice-top-btn')), fab: seen(document.querySelector('#voiceFab')), over: document.documentElement.scrollWidth - innerWidth }}; }}")
        await tap_mic(dk, ".search-mic"); await say(dk, "play the radio"); s = await state(dk); await dk.screenshot(path=f"{SHOTS}/voice-7-desktop.png")
        check("on a computer the top search field has the microphone, and it works", d["field"] and not d["top"] and d["fab"] and d["over"] <= 0 and s["radio"] and not s["paused"] and not dk.problems, str(d) + str(s) + str(dk.problems[:3]))

        # 5. Inside the phone app
        ap = await new_page(b, speech="", app=True); await ap.goto(BASE); await ap.wait_for_selector(".feat"); await ap.wait_for_timeout(700)
        await ap.click("#voiceFab"); await ap.wait_for_selector("#vx"); await ap.wait_for_timeout(900); s = await state(ap)
        calls = await ap.evaluate("window.__native.filter(c => c.plugin === 'SpeechRecognition')")
        start = next((c for c in calls if c["method"] == "start"), None)
        check("inside the app the phone's own speech service is asked: permission first, then listening, then the song plays",
              [c["method"] for c in calls][:4] == ["available", "checkPermissions", "requestPermissions", "start"] and start and start["options"]["language"] == "en-US" and start["options"]["popup"] is False
              and start["options"]["partialResults"] is False and not s["sheet"] and s["title"] == "The Skeleton Key" and not s["paused"], str(calls) + str(s))
        await ap.evaluate("window.__speech.perm = 'denied'; window.__speech.grant = false"); await ap.click("#npVoice"); await ap.wait_for_selector("#vx"); await ap.wait_for_timeout(500); s = await state(ap)
        await ap.evaluate("window.__speech.perm = 'granted'; window.__speech.fail = 'No match'"); await ap.click("#vxMic"); await ap.wait_for_timeout(500); s2 = await state(ap)
        await ap.evaluate("window.__speech.fail = ''; window.__speech.matches = ['حطلي شي رومانسي']"); await ap.click('#vx [data-vlang="ar"]'); await ap.wait_for_timeout(900); s3 = await state(ap)
        code = await ap.evaluate("window.__native.filter(c => c.method === 'start').slice(-1)[0].options.language")
        check("inside the app: a refused microphone points to the phone's settings, silence is explained, and Arabic is asked for as Lebanese Arabic",
              s["sheet"] and "phone's settings" in s["st"] and "didn't hear" in s2["st"] and code == "ar-LB" and s3["frm"] == "Romantic Radio" and not s3["paused"] and not ap.problems, str(s) + str(s2) + str(s3) + code + str(ap.problems[:3]))

        # 6. Switched off, and the server headers
        off = await new_page(b, config=CFG.replace("voice: { enabled: true", "voice: { enabled: false")); await off.goto(BASE + "#/search"); await off.wait_for_selector(".sbox"); await off.wait_for_timeout(500)
        none = await off.evaluate(f"() => {{ const seen = {SEEN}; return [...document.querySelectorAll('[data-voice]')].filter(seen).length; }}")
        check("config.js voice.enabled: false takes every microphone off the site", "voice: { enabled: false" in CFG.replace("voice: { enabled: true", "voice: { enabled: false") and none == 0 and not off.problems, str(none) + str(off.problems[:3]))
        ht = open(os.path.join(ROOT, "hosting", ".htaccess"), encoding="utf-8").read(); vj = json.load(open(os.path.join(ROOT, "vercel.json"), encoding="utf-8"))
        pol = [h["value"] for h in vj["headers"][0]["headers"] if h["key"] == "Permissions-Policy"][0]
        html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
        check("the server allows the microphone for the site's own pages only, and the page still runs only its own scripts",
              'Permissions-Policy "camera=(), microphone=(self), geolocation=()"' in ht and pol == "camera=(), microphone=(self), geolocation=()" and "script-src 'self';" in html and 'src="voice.js?v=' in html and 'src="data/voice-words.js?v=' in html)
        build = open(os.path.join(ROOT, "app", "build-www.mjs"), encoding="utf-8").read(); site = open(os.path.join(ROOT, "scripts", "build_site.py"), encoding="utf-8").read()
        man = open(os.path.join(ROOT, "app", "android", "app", "src", "main", "AndroidManifest.xml"), encoding="utf-8").read(); plist = open(os.path.join(ROOT, "app", "ios", "App", "App", "Info.plist"), encoding="utf-8").read()
        pkg = json.load(open(os.path.join(ROOT, "app", "package.json"), encoding="utf-8"))
        check("the app and the hosted site carry the voice files, and the app asks for the microphone the way each phone wants",
              '"voice.js"' in build and '"voice.js"' in site and "@capgo/capacitor-speech-recognition" in pkg["dependencies"] and "android.permission.RECORD_AUDIO" in man and "android.speech.RecognitionService" in man
              and "NSMicrophoneUsageDescription" in plist and "NSSpeechRecognitionUsageDescription" in plist)
        await b.close()
    print(f"\n{sum(results)} of {len(results)} voice checks passed")
    sys.exit(0 if all(results) else 1)

asyncio.run(main())
