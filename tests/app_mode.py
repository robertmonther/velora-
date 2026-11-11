"""Velora inside the phone app (the app/ folder): the same pages, told that they run inside the app.
The checks open the site in a phone-size browser with the app's bridge played by a small stand-in, and look at
what must be different there: no shop, songs loaded from the web, the phone's share sheet.

    python3 tests/app_mode.py        (needs: pip install playwright, Chrome)"""
import asyncio, json, mimetypes, os, re, sys, threading
from http.server import ThreadingHTTPServer
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from server import H

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8796
BASE = f"http://localhost:{PORT}/index.html"
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
CFG = open(os.path.join(ROOT, "config.js"), encoding="utf-8").read()
SUPA = (re.search(r'supabase:\s*\{\s*url:\s*"([^"]*)"', CFG) or [None, ""])[1]
REPO = re.search(r'mediaRepo:\s*"([^"]+)"', CFG)[1]; REV = re.search(r'mediaRev:\s*"([^"]+)"', CFG)[1]
CDN = f"https://cdn.jsdelivr.net/gh/{REPO}@{REV}/"
CORS = {"access-control-allow-origin": "*", "access-control-allow-headers": "*"}
# The app's bridge, as far as the pages use it: "am I inside the app?" and the share sheet.
BRIDGE = "window.__shared = []; window.Capacitor = { isNativePlatform: () => true, nativePromise: (plugin, method, options) => { window.__shared.push({plugin, method, options}); return Promise.resolve({}); } };"
results = []

def check(name, ok, detail=""):
    results.append(ok); print(("PASS  " if ok else "FAIL  ") + name + (f"   [{detail}]" if detail and not ok else ""), flush=True)

async def backend(route):
    u = route.request.url
    if route.request.method == "OPTIONS": await route.fulfill(status=204, headers=CORS)
    elif "/rpc/public_catalogue" in u: await route.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body='{"complete":true,"songs":[],"artists":[]}')
    elif "/rpc/shop_info" in u: await route.fulfill(status=200, headers={**CORS, "content-type": "application/json"}, body='{"open":false,"currency":"eur","rent":900,"buy":4900,"premium":1400,"rent_days":30}')
    else: await route.fulfill(status=404, headers={**CORS, "content-type": "application/json"}, body='{"message":"not in the stand-in"}')
async def cdn(route):          # the songs and covers come from the web; here the web is the repo folder
    path = os.path.join(ROOT, route.request.url[len(CDN):].split("?")[0])
    if not os.path.isfile(path): return await route.fulfill(status=404, headers=CORS, body="")
    await route.fulfill(status=200, headers={**CORS, "content-type": mimetypes.guess_type(path)[0] or "application/octet-stream", "accept-ranges": "bytes"}, body=open(path, "rb").read())

async def app_page(browser, width=390, height=844, scale=2, site=""):
    ctx = await browser.new_context(viewport={"width": width, "height": height}, is_mobile=True, has_touch=True, device_scale_factor=scale)
    await ctx.add_init_script(BRIDGE)
    if site: await ctx.route("**/config.js*", lambda r: r.fulfill(body=CFG.replace('siteUrl: ""', f'siteUrl: "{site}"'), content_type="application/javascript"))
    if SUPA: await ctx.route(SUPA + "/**", backend)
    await ctx.route(CDN + "**", cdn)
    pg = await ctx.new_page(); pg.problems = []
    pg.on("pageerror", lambda e: pg.problems.append("error: " + str(e)))
    pg.on("console", lambda m: pg.problems.append("console: " + m.text) if m.type == "error" else None)
    return pg

def serve():
    os.chdir(ROOT); srv = ThreadingHTTPServer(("127.0.0.1", PORT), H); srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()

async def main():
    serve()
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--autoplay-policy=no-user-gesture-required"])
        pg = await app_page(b)
        await pg.goto(BASE); await pg.wait_for_selector(".feat")
        seen = "el => !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0"
        home = await pg.evaluate(f"""() => {{ const seen = {seen}; return {{
            cls: document.documentElement.className, banner: seen(document.querySelector('.demo-banner')), tabs: [...document.querySelectorAll('.tabbar > *')].filter(seen).map(x => x.textContent.trim()),
            tiers: !!document.querySelector('.tiers'), intro: !!document.querySelector('#intro'), lic: [...document.querySelectorAll('[data-lic],[data-sub],a[href="#/pricing"]')].filter(seen).length,
            cover: getComputedStyle(document.querySelector('.feat-cover')).backgroundImage }}; }}""")
        check("inside the app the pages know it: no preview banner, four tabs, no Premium tab", "native" in home["cls"] and "nosales" in home["cls"] and not home["banner"] and home["tabs"] == ["Home", "Search", "Stream", "Radio"], str(home))
        check("no shop inside the app: no prices, no License buttons, no pricing link on the home page", not home["tiers"] and not home["intro"] and home["lic"] == 0, str(home))
        check("songs and covers come from the web, not from inside the app", CDN in home["cover"], home["cover"][:120])
        await pg.click(".feat-cover"); await pg.wait_for_selector("#np:not([hidden])"); await pg.wait_for_timeout(600)
        np = await pg.evaluate(f"""() => {{ const seen = {seen}; return {{ lic: [...document.querySelectorAll('#np [data-lic], #npLicense, #npLicTop, #miniLicense, #miniLicIcon')].filter(seen).length,
            src: document.querySelector('audio') ? document.querySelector('audio').src : '', text: document.querySelector('#np').innerText.includes('Use this song in your videos') }}; }}""")
        check("the player has no License button or license card, and plays the song from the web", np["lic"] == 0 and not np["text"] and np["src"].startswith(CDN), str(np))
        await pg.evaluate("document.querySelector('#npClose').click()"); await pg.wait_for_timeout(300)
        await pg.goto(BASE + "#/pricing"); await pg.wait_for_selector(".feat")
        check("the pricing page does not exist inside the app: it leads home", pg.url.endswith("#/") and await pg.evaluate("!document.querySelector('.tiers')"), pg.url)
        await pg.click("#menuBtn"); await pg.wait_for_selector(".drawer")
        menu = await pg.evaluate(f"""() => {{ const seen = {seen}; return [...document.querySelectorAll('.drawer a, .drawer button')].filter(seen).map(x => x.textContent.trim()); }}""")
        check("the menu has no Pricing; Upload, Verify, Settings and the legal pages stay", "Pricing" not in menu and "Upload a song" in menu and "Verify a license" in menu and "Settings" in menu and "Terms and privacy" in menu, str(menu))
        # sharing: the phone's own share sheet
        song = await pg.evaluate("document.querySelector('.feat-cover').dataset.song")
        await pg.goto(BASE + "#/song/" + song); await pg.wait_for_selector("[data-share]"); await pg.click("[data-share]"); await pg.wait_for_selector("#shGo")
        copy = await pg.evaluate("!!document.querySelector('#shCopy')"); await pg.click("#shGo"); await pg.wait_for_timeout(300)
        sh = await pg.evaluate("window.__shared")
        check("Share opens the phone's share sheet; while the site has no address yet, no link is sent and Copy link is not offered",
              len(sh) == 1 and sh[0]["plugin"] == "Share" and sh[0]["method"] == "share" and "url" not in sh[0]["options"] and sh[0]["options"]["title"] and not copy, str(sh))
        check("no script errors inside the app", not pg.problems, str(pg.problems[:3]))
        pg2 = await app_page(b, site="https://music.example")
        await pg2.goto(BASE + "#/song/" + song); await pg2.wait_for_selector("[data-share]"); await pg2.click("[data-share]"); await pg2.wait_for_selector("#shGo")
        await pg2.click("#shGo"); await pg2.wait_for_timeout(300); sh = await pg2.evaluate("window.__shared")
        check("once the site has an address, shared links point to the website", len(sh) == 1 and sh[0]["options"].get("url") == f"https://music.example/#/song/{song}" and await pg2.evaluate("!!document.querySelector('#shCopy')"), str(sh))
        await b.close()
    print(f"\n{sum(results)} of {len(results)} app checks passed")
    sys.exit(0 if all(results) else 1)

if __name__ == "__main__": asyncio.run(main())
