"""Velora payment checks: the license window, paying at the (stand-in) provider, the thanks page with the
certificate, the public Verify page, licenses in the account, Premium, cancelling, a refund.
Runs against the stand-in server and its stand-in payment page (tests/fake_backend.py); no real server and no
real payment provider is touched, and nothing is charged.

    python3 tests/payments.py        (needs: pip install playwright, Chrome)"""
import asyncio, json, os, re, sys, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fake_backend

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8798
BASE = f"http://localhost:{PORT}/index.html"
API = f"http://localhost:{PORT}/__supa"
SHOTS = os.path.join(ROOT, "tests", "shots", "payments")
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
SONG = "rm-0007"
results = []

def check(name, ok, detail=""):
    results.append(ok); print(("PASS  " if ok else "FAIL  ") + name + (f"   [{detail}]" if detail and not ok else ""), flush=True)
def get(path): return json.loads(urllib.request.urlopen(API + path).read())
def state(): return get("/__state")

async def main():
    os.makedirs(SHOTS, exist_ok=True)
    fake_backend.serve(ROOT, PORT)
    cfg = open(os.path.join(ROOT, "config.js"), encoding="utf-8").read()
    cfg = re.sub(r'supabase:\s*\{[^}]*\}', f'supabase: {{ url: "{API}", anonKey: "sb_publishable_stand_in_key_0000000000" }}', cfg)
    cfg_live = cfg.replace("demo: true", "demo: false"); assert cfg_live != cfg
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME)
        async def visitor(live=False):
            c = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2, accept_downloads=True)
            await c.route("**/config.js*", lambda r: r.fulfill(body=cfg_live if live else cfg, content_type="application/javascript"))
            pg = await c.new_page(); pg.problems = []
            pg.on("pageerror", lambda e: pg.problems.append("error: " + str(e)))
            pg.on("console", lambda m: pg.problems.append("console: " + m.text) if m.type == "error" else None)
            return pg
        async def until(pg, expr, timeout=15000): await pg.wait_for_function("() => { try { return (" + expr + "); } catch (e) { return false; } }", timeout=timeout)
        async def open_license(pg, song=SONG):
            await pg.goto(BASE + "#/song/" + song); await pg.wait_for_selector("[data-lic]"); await pg.click("[data-lic]"); await pg.wait_for_selector("#lic")
        title = None

        # ---------- the shop is closed (today): nothing real can be paid ----------
        pg = await visitor()
        await open_license(pg)
        title = await pg.evaluate("document.querySelector('#mTitle').textContent.replace(/^License “|”$/g, '')")
        demo = await pg.evaluate("({pay: document.querySelector('#lic button[type=submit]').textContent, tick: !!document.querySelector('#licOk')})")
        await pg.click("#lic button[type=submit]"); await pg.wait_for_selector(".cert")
        cert = await pg.inner_text("#mBody")
        check("shop closed, preview site: the license window is the demo, and its certificate says it is an example", demo == {"pay": "Pay (demo)", "tick": False} and "Not a real license" in cert and len(state()["checkouts"]) == 0, f"{demo} {cert[:80]}")
        pg2 = await visitor(live=True)
        await pg2.goto(BASE + "#/song/" + SONG); await pg2.wait_for_selector("[data-lic]"); await pg2.click("[data-lic]"); await pg2.wait_for_selector("#mTitle")
        soon = await pg2.inner_text("#mBody")
        check("shop closed, real site: licensing says it opens soon; no example certificate can be made", "opens soon" in soon and await pg2.evaluate("!document.querySelector('#lic')"), soon[:80])
        closed = await pg2.evaluate("""async (api) => { const r = await fetch(api + "/functions/v1/checkout", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({kind: "rent", song_id: "rm-0007", song_title: "x", consent: true, return_url: location.href})}); return r.json(); }""", API)
        check("shop closed: the server refuses to start a payment", closed == {"ok": False, "closed": True}, str(closed))
        await pg2.close()

        # ---------- the shop opens: the server's prices and the real window ----------
        get("/__shop?open=1&rent=950")
        await pg.goto(BASE + "#/pricing"); await pg.reload(); await until(pg, "document.querySelector('.tiers .price').textContent.includes('9.50')")
        tiers = await pg.inner_text(".tiers"); page_text = await pg.inner_text("main")
        check("shop open: the pricing page shows the server's prices, without demo labels", "€9.50" in tiers and "€49" in tiers and "€14" in tiers and "(demo)" not in page_text and "Example prices" not in page_text, tiers[:200])
        await open_license(pg)
        win = await pg.evaluate("({pay: document.querySelector('#licPay').textContent, tick: document.querySelector('#licOk').checked, name: !!document.querySelector('#licName'), demo: document.querySelector('#mBody').textContent.includes('demo')})")
        check("the license window asks for the name on the license and has the delivery box unticked", win == {"pay": "Pay €9.50", "tick": False, "name": True, "demo": False}, str(win))
        await pg.screenshot(path=f"{SHOTS}/01-license-window.png")
        await pg.click("#licPay"); await until(pg, "document.querySelector('#licMsg').textContent.length > 0")
        check("without the tick nothing is sent: the window says what is missing", "Tick the box" in await pg.inner_text("#licMsg") and len(state()["checkouts"]) == 0)

        # ---------- rent: pay, come back, certificate ----------
        await pg.fill("#licName", "Lina's <b>Channel</b>"); await pg.check("#licOk"); await pg.click("#licPay")
        await pg.wait_for_selector("#pay"); pay_page = await pg.inner_text("body")
        co = state()["checkouts"][-1]
        check("Pay opens the provider's page with this song and the server's price (the browser cannot set a price)", f"Rent: {title}" in pay_page and "9.50 EUR" in pay_page and co["body"].get("consent") is True and "amount" not in co["body"] and co["song_id"] == SONG, pay_page[:120])
        await pg.click("#pay"); await pg.wait_for_selector(".cert"); await pg.wait_for_selector("[data-getsong]")
        lic = state()["licenses"][-1]; text = await pg.inner_text("#thx")
        check("after paying the buyer lands on the thanks page with the certificate: number, song, name, what it covers, publish-by date",
              re.fullmatch(r"VL-\d{4}-[A-Z0-9]{10}", lic["id"]) is not None and lic["id"] in text and title in text and "Lina's bChannel/b" in text and "One piece of content" in text and "Publish by" in text
              and lic["email"] == "buyer@example.test" and lic["amount"] == 950 and lic["type"] == "rent", text[:300])
        check("the address is clean again (the payment reference moved into the page address)", "?paid=" not in pg.url and "#/thanks?ref=cs_test_" in pg.url and "kind=rent" in pg.url, pg.url)
        await pg.screenshot(path=f"{SHOTS}/02-thanks-certificate.png", full_page=True)
        async with pg.expect_download() as dl: await pg.click("[data-getsong]")
        d = await dl.value
        check("the license holder downloads the song file, named after the song", d.suggested_filename.endswith(".mp3") and len(d.suggested_filename) > 6, d.suggested_filename)
        await pg.reload(); await pg.wait_for_selector(".cert")
        check("opening the thanks page again shows the same license; nothing is issued twice", lic["id"] in await pg.inner_text("#thx") and len(state()["licenses"]) == 1)

        # ---------- the public Verify page ----------
        await pg.goto(BASE + "#/verify"); await pg.wait_for_selector("#vid")
        mine = await pg.inner_text("main")
        await pg.fill("#vid", lic["id"].lower()); await pg.click("#vf button"); await pg.wait_for_selector(".verdict")
        ver = await pg.inner_text("#vr")
        check("Verify: the number is found in the register and shown as valid; this device remembers what was bought on it", "Valid license" in ver and lic["id"] in ver and "Bought on this device" in mine and lic["id"] in mine, ver[:160])
        await pg.screenshot(path=f"{SHOTS}/03-verify.png", full_page=True)
        await pg.fill("#vid", "VL-2026-NOSUCH0000"); await pg.click("#vf button"); await until(pg, "document.querySelector('#vr').textContent.includes('No license found')")
        await pg.fill("#vid", "hello"); await pg.click("#vf button"); await until(pg, "document.querySelector('#vr').textContent.includes('looks like')")
        check("Verify: an unknown number is not found, and a wrong shape gets a hint", True)

        # ---------- buy, with a slow message from the provider and no name typed ----------
        get("/__shop?delay=3")
        await open_license(pg); await pg.check("input[name=t][value=buy]"); await until(pg, "document.querySelector('#licPay').textContent === 'Pay €49'")
        await pg.fill("#licName", ""); await pg.check("#licOk"); await pg.click("#licPay"); await pg.wait_for_selector("#pay"); await pg.click("#pay")
        await pg.wait_for_selector("#thx"); first = await pg.inner_text("#thx"); n_before = len(state()["licenses"])
        await pg.wait_for_selector(".cert", timeout=20000); text = await pg.inner_text("#thx"); lic2 = state()["licenses"][-1]
        check("when the provider's message is late the thanks page waits, then shows the license", "being prepared" in first and n_before == 1 and lic2["type"] == "buy" and lic2["id"] in text and "for life" in text, first[:80])
        check("no name typed: the license carries the name the buyer paid with", lic2["buyer_name"] == "Paying Name" and "Paying Name" in text and "Publish by" not in text, lic2["buyer_name"])
        get("/__shop?delay=0")

        # ---------- a refund ----------
        get("/__refund?id=" + lic["id"])
        await pg.goto(BASE + "#/verify?id=" + lic["id"]); await pg.wait_for_selector(".verdict")
        ver = await pg.inner_text("#vr")
        check("a refunded license shows as no longer valid on the Verify page", "Not valid any more" in ver and "Refunded" in ver and await pg.evaluate("!document.querySelector('#vr [data-getsong]')"), ver[:160])

        # ---------- the buyer creates an account later: the licenses are there ----------
        get("/__add_user?email=buyer@example.test&password=a-good-password&name=Lina")
        await pg.goto(BASE + "#/account"); await pg.wait_for_selector("#si")
        await pg.fill("#em", "buyer@example.test"); await pg.fill("#pw", "a-good-password"); await pg.click("#si button[type=submit]")
        await pg.wait_for_selector("[data-mylic]"); rows = await pg.inner_text("#acct")
        check("signing in with the email used for paying lists those licenses in the account (the refunded one is marked)", lic["id"] in rows and lic2["id"] in rows and "refunded" in rows and all(l.get("user") for l in state()["licenses"]), rows[:300])
        await pg.click("[data-mylic]"); await pg.wait_for_selector("#mBody .cert")
        check("a license in the account opens its certificate", "Velora License Certificate" in await pg.inner_text("#mBody"))
        await pg.screenshot(path=f"{SHOTS}/04-account-licenses.png", full_page=True)
        await pg.click("#mClose"); await pg.click("#so"); await pg.wait_for_selector("#si")

        # ---------- Premium ----------
        get("/__add_user?email=member@example.test&password=a-good-password&name=Mo%20Member")
        await pg.goto(BASE + "#/pricing"); await pg.wait_for_selector("[data-sub]"); await pg.click("[data-sub]"); await pg.wait_for_selector("#lic")
        sub = await pg.evaluate("({checked: document.querySelector('input[name=t]:checked').value, pay: document.querySelector('#licPay').textContent, note: !document.querySelector('#paySub').hidden, tickHidden: document.querySelector('#payBuy').hidden})")
        await pg.click("#licPay"); await pg.wait_for_selector("#premAuth #si")
        check("Premium: the window explains the monthly renewal, and asks a signed-out visitor to sign in first", sub == {"checked": "sub", "pay": "Start Premium · €14 a month", "note": True, "tickHidden": True} and len(state()["checkouts"]) == 2, str(sub))
        await pg.fill("#em", "member@example.test"); await pg.fill("#pw", "a-good-password"); await pg.click("#si button[type=submit]")
        await pg.wait_for_selector("#licPay"); await until(pg, "document.querySelector('input[name=t]:checked').value === 'sub'")
        await pg.click("#licPay"); await pg.wait_for_selector("#pay"); prem_page = await pg.inner_text("body")
        await pg.click("#pay"); await until(pg, "document.querySelector('#thx').textContent.includes('Premium is active')", 20000)
        check("Premium: after signing in the payment page opens for the monthly plan; back on the site Premium is active", "Premium, every month" in prem_page and "14.00 EUR" in prem_page and "kind=premium" in pg.url and True in state()["premium"].values(), prem_page[:100])
        await pg.screenshot(path=f"{SHOTS}/05-premium-active.png", full_page=True)
        await open_license(pg, "rm-0003")
        member = await pg.evaluate("({box: !!document.querySelector('#memGet'), kinds: [...document.querySelectorAll('input[name=t]')].map(x => x.value)})")
        await pg.click("#memGet"); await pg.wait_for_selector("#mBody .cert"); mtext = await pg.inner_text("#mBody"); plic = state()["licenses"][-1]
        check("a member gets the certificate of any song at once, without paying again", member == {"box": True, "kinds": ["rent", "buy", "excl"]} and plic["type"] == "premium" and plic["id"] in mtext and "Mo Member" in mtext and "while Premium is active" in mtext, mtext[:200])
        await pg.click("#mClose"); await open_license(pg, "rm-0003"); await pg.click("#memGet"); await pg.wait_for_selector("#mBody .cert")
        check("asking again for the same song gives the same certificate", plic["id"] in await pg.inner_text("#mBody") and sum(1 for l in state()["licenses"] if l["type"] == "premium") == 1)
        await pg.goto(BASE + "#/account"); await pg.wait_for_selector("#premManage"); await pg.screenshot(path=f"{SHOTS}/06-account-premium.png", full_page=True)
        await pg.click("#premManage"); await pg.wait_for_selector("#cancel"); await pg.click("#cancel")
        await pg.wait_for_selector("#so"); await until(pg, "!document.querySelector('#premManage')")
        await pg.goto(BASE + "#/verify?id=" + plic["id"]); await pg.wait_for_selector(".verdict"); ver = await pg.inner_text("#vr")
        check("a member cancels Premium from the account (on the provider's page); the Premium license then shows as ended", "Not valid any more" in ver and "membership has ended" in ver, ver[:200])

        # ---------- the server's own rules ----------
        clean_so_far = list(pg.problems)        # the refusals below are asked for on purpose, and the browser logs each one
        bad = await pg.evaluate("""async (api) => {
            const send = async body => { const r = await fetch(api + "/functions/v1/checkout", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)}); return [r.status, (await r.json()).error || ""]; };
            const base = {kind: "rent", song_id: "rm-0007", song_title: "x", consent: true, return_url: location.href};
            const rpc = async (fn, args) => (await fetch(api + "/rest/v1/rpc/" + fn, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(args)})).status;
            return {elsewhere: await send({...base, return_url: "https://evil.example/x"}), noConsent: await send({...base, consent: false}), badSong: await send({...base, song_id: "../x"}), kind: await send({...base, kind: "free"}),
                    premiumGuest: await send({kind: "premium", return_url: location.href}), write: await rpc("record_purchase", {p: {kind: "buy", song_id: "rm-0007", payment_ref: "cs_test_" + "a".repeat(40)}}), short: await (await fetch(api + "/rest/v1/rpc/claim_purchase", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({p_ref: "cs_test"})})).json()}; }""", API)
        check("the server refuses: another site's return address, no consent, an unknown song or kind, Premium without an account, writing a license from the browser, a guessed short reference",
              bad["elsewhere"][0] == 400 and bad["noConsent"][0] == 400 and bad["badSong"][0] == 400 and bad["kind"][0] == 400 and bad["premiumGuest"][0] == 401 and bad["write"] == 401 and bad["short"] is None, str(bad))
        await pg.goto(BASE + "#/thanks?ref=nope"); await pg.wait_for_selector("main .btn")
        check("the thanks page without a real payment reference says there is nothing to show", "no payment to show" in await pg.inner_text("main"))
        check("no page of the payment flow had a script error", not clean_so_far and not [x for x in pg.problems if x.startswith("error:")], str((clean_so_far + pg.problems)[:3]))
        await b.close()
    print(f"\n{sum(results)} of {len(results)} payment checks passed")
    sys.exit(0 if all(results) else 1)

asyncio.run(main())
