"""Velora account checks: create an account, confirm the email (code or link), sign in and out, change name and
password, forgotten password, delete the account. Runs against the stand-in server (tests/fake_backend.py);
the real server is never touched.

    python3 tests/accounts.py        (needs: pip install playwright, Chrome)"""
import asyncio, json, os, re, sys, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fake_backend

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8799
BASE = f"http://localhost:{PORT}/index.html"
API = f"http://localhost:{PORT}/__supa"
SHOTS = os.path.join(ROOT, "tests", "shots", "accounts")
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
results = []

def check(name, ok, detail=""):
    results.append(ok); print(("PASS  " if ok else "FAIL  ") + name + (f"   [{detail}]" if detail and not ok else ""), flush=True)
def get(path): return json.loads(urllib.request.urlopen(API + path).read())
def users(): return {u["email"]: u for u in get("/__state")["users"]}

async def main():
    os.makedirs(SHOTS, exist_ok=True)
    fake_backend.serve(ROOT, PORT)
    cfg = open(os.path.join(ROOT, "config.js"), encoding="utf-8").read()
    cfg = re.sub(r'supabase:\s*\{[^}]*\}', f'supabase: {{ url: "{API}", anonKey: "sb_publishable_stand_in_key_0000000000" }}', cfg)
    cfg_closed = cfg.replace("signup: true", "signup: false"); assert cfg_closed != cfg
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME)
        async def visitor(closed=False):
            c = await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
            await c.route("**/config.js*", lambda r: r.fulfill(body=cfg_closed if closed else cfg, content_type="application/javascript"))
            pg = await c.new_page(); pg.problems = []
            pg.on("pageerror", lambda e: pg.problems.append("error: " + str(e)))
            pg.on("console", lambda m: pg.problems.append("console: " + m.text) if m.type == "error" else None)
            return pg
        async def until(pg, expr, timeout=15000): await pg.wait_for_function("() => { try { return (" + expr + "); } catch (e) { return false; } }", timeout=timeout)
        async def said(pg, sel): await until(pg, f"document.querySelector('{sel}').textContent.length > 0"); return await pg.inner_text(sel)

        pg = await visitor()
        await pg.goto(BASE + "#/account"); await pg.wait_for_selector("#si")
        first = await pg.evaluate("({join: !!document.querySelector('#toJoin'), forgot: !!document.querySelector('#toForgot'), setup: !!document.querySelector('#toSetup')})")
        check("the account page offers sign in, a new account and a forgotten password (the owner setup lives at the upload door)", first == {"join": True, "forgot": True, "setup": False}, str(first))
        await pg.screenshot(path=f"{SHOTS}/01-sign-in.png", full_page=True)

        # ---- create an account ----
        await pg.click("#toJoin"); await pg.wait_for_selector("#ju")
        await pg.fill("#jnm", "Lina <b>Test</b>"); await pg.fill("#jem", "Lina@Example.test"); await pg.fill("#jpw", "short1"); await pg.check("#jok")
        await pg.evaluate("document.querySelector('#jpw').removeAttribute('minlength')"); await pg.click("#ju button[type=submit]")
        short = await said(pg, "#juMsg")
        await pg.fill("#jpw", "a-good-password"); await pg.uncheck("#jok"); await pg.click("#ju button[type=submit]"); await pg.wait_for_timeout(300)
        still = await pg.evaluate("!!document.querySelector('#ju')")
        check("a short password and a missing agreement both stop the form", "10 characters" in short and still and "lina@example.test" not in users(), f"{short} {still}")
        await pg.screenshot(path=f"{SHOTS}/02-create-account.png", full_page=True)
        await pg.check("#jok"); await pg.click("#ju button[type=submit]"); await pg.wait_for_selector("#cf")
        mail = get("/__mail?to=lina@example.test")
        check("creating an account sends a confirmation email; the account waits", mail.get("kind") == "signup" and len(mail.get("code", "")) == 6 and "lina@example.test" in (await pg.inner_text(".auth")).lower(), str(mail))
        await pg.screenshot(path=f"{SHOTS}/03-confirm-email.png", full_page=True)
        await pg.click("#cf button[type=submit]"); not_yet = await said(pg, "#cfMsg")
        await pg.fill("#ccode", "000000" if mail["code"] != "000000" else "111111"); await pg.click("#cf button[type=submit]"); await until(pg, "document.querySelector('#cfMsg').textContent.includes('code')"); wrong = await pg.inner_text("#cfMsg")
        check("without the confirmation nobody gets in; a wrong code is refused", "Not confirmed yet" in not_yet and "not right" in wrong, f"{not_yet} | {wrong}")
        await pg.fill("#ccode", mail["code"]); await pg.click("#cf button[type=submit]"); await pg.wait_for_selector("#so")
        acc = await pg.inner_text("#acct")
        check("the right code signs the new listener in, with a clean name", "Lina bTest/b" in acc and "lina@example.test · Listener" in acc and "<b>" not in await pg.inner_html("#acName") and "No licenses yet" in acc and await pg.evaluate("!!document.querySelector('#delAcc')"), acc[:160])
        await pg.screenshot(path=f"{SHOTS}/04-account.png", full_page=True)

        # ---- name and password ----
        await pg.fill("#acNm", "Lina Test"); await pg.click("#nmForm button"); await until(pg, "document.querySelector('#acName').textContent === 'Lina Test'")
        check("the name can be changed", users()["lina@example.test"]["name"] == "Lina Test")
        await pg.fill("#acPw", "second-password-1"); await pg.click("#pwForm button"); await until(pg, "document.querySelector('#acPw').value === ''")
        await pg.click("#so"); await pg.wait_for_selector("#si")
        await pg.fill("#em", "lina@example.test"); await pg.fill("#pw", "a-good-password"); await pg.click("#si button[type=submit]"); old = await said(pg, "#siMsg")
        await pg.fill("#pw", "second-password-1"); await pg.click("#si button[type=submit]"); await pg.wait_for_selector("#so")
        check("after a password change only the new password works", "Wrong email or password" in old)
        await pg.goto(BASE + "#/upload"); await pg.wait_for_selector("#gOut")
        check("a listener account can't upload", "can't upload yet" in await pg.inner_text("main"))
        await pg.click("#gOut"); await pg.wait_for_selector("#si")
        check("the upload door also offers the one-time owner setup", await pg.evaluate("!!document.querySelector('#toSetup') && !!document.querySelector('#toJoin')"))

        # ---- the same email again; unconfirmed sign-in ----
        await pg.goto(BASE + "#/account"); await pg.wait_for_selector("#si"); await pg.click("#toJoin")
        await pg.fill("#jnm", "Someone"); await pg.fill("#jem", "lina@example.test"); await pg.fill("#jpw", "another-password"); await pg.check("#jok"); await pg.click("#ju button[type=submit]")
        check("an email that already has an account is told to sign in", "already has an account" in await said(pg, "#juMsg"))
        await pg.fill("#jem", "omar@example.test"); await pg.click("#ju button[type=submit]"); await pg.wait_for_selector("#cf")
        await pg.click("#toSignIn"); await pg.wait_for_selector("#si"); await pg.fill("#pw", "another-password"); await pg.click("#si button[type=submit]"); await pg.wait_for_selector("#cf")
        c1 = get("/__mail?to=omar@example.test")["code"]; await pg.click("#reSend"); await until(pg, "document.querySelector('#toast') && /Sent again/.test(document.querySelector('#toast').textContent)")
        c2 = get("/__mail?to=omar@example.test")["code"]
        check("signing in before confirming leads to the confirm step; the email can be sent again", bool(c1) and bool(c2) and len(DB_mail("omar@example.test")) == 2)

        # ---- the link in the email (another visitor, as on another device) ----
        other = await visitor()
        link = get("/__link?email=omar@example.test&type=signup")["hash"]
        await other.goto(BASE + link); await other.wait_for_selector("#so")
        t = await other.evaluate("({hash: location.hash, toast: document.querySelector('#toast').textContent, who: document.querySelector('#acct').innerText})")
        check("the link in the email signs the visitor in and cleans the address", t["hash"] == "#/account" and "confirmed" in t["toast"] and "omar@example.test · Listener" in t["who"], str(t)[:200])

        # ---- forgotten password: by code, and by link ----
        f = await visitor(); await f.goto(BASE + "#/account"); await f.wait_for_selector("#si"); await f.fill("#em", "lina@example.test"); await f.click("#toForgot"); await f.wait_for_selector("#fg")
        kept = await f.input_value("#fem"); await f.click("#fg button[type=submit]"); await f.wait_for_selector("#rs")
        rc = get("/__mail?to=lina@example.test")
        await f.screenshot(path=f"{SHOTS}/05-new-password.png", full_page=True)
        await f.fill("#rcode", "123123" if rc["code"] != "123123" else "321321"); await f.fill("#rpw", "third-password-11"); await f.click("#rs button[type=submit]"); bad = await said(f, "#rsMsg")
        await f.fill("#rcode", rc["code"]); await f.click("#rs button[type=submit]"); await f.wait_for_selector("#so")
        check("a forgotten password is replaced with the code from the email", kept == "lina@example.test" and rc.get("kind") == "recovery" and "not right" in bad and "Lina Test" in await f.inner_text("#acct"), f"{kept} {rc} {bad}")
        f2 = await visitor(); link = get("/__link?email=lina@example.test&type=recovery")["hash"]
        await f2.goto(BASE + link); await f2.wait_for_selector("#npForm")
        await f2.fill("#np1", "fourth-password-1"); await f2.click("#npForm button"); await until(f2, "!document.querySelector('#newPw')")
        await f2.click("#so"); await f2.wait_for_selector("#si"); await f2.fill("#em", "lina@example.test"); await f2.fill("#pw", "third-password-11"); await f2.click("#si button[type=submit]"); old = await said(f2, "#siMsg")
        await f2.fill("#pw", "fourth-password-1"); await f2.click("#si button[type=submit]"); await f2.wait_for_selector("#so")
        check("the reset link opens 'choose a new password', and it works", "Wrong email or password" in old)
        e = await visitor(); await e.goto(BASE + "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"); await e.wait_for_selector("#si")
        msg = await e.inner_text("#acct")
        check("an old or used link says so in plain words", "too old or was already used" in msg and await e.evaluate("location.hash") == "#/account", msg[:120])

        # ---- delete the account ----
        await f2.click("#delAcc"); await f2.wait_for_selector("#delYes"); await f2.screenshot(path=f"{SHOTS}/06-delete.png")
        await f2.click("#delNo"); await f2.wait_for_timeout(200); kept2 = "lina@example.test" in users()
        await f2.click("#delAcc"); await f2.click("#delYes"); await f2.wait_for_selector("#si")
        await f2.fill("#em", "lina@example.test"); await f2.fill("#pw", "fourth-password-1"); await f2.click("#si button[type=submit]"); gone = await said(f2, "#siMsg")
        check("an account can be deleted by its owner, after one more question", kept2 and "lina@example.test" not in users() and "Wrong email or password" in gone, f"{kept2} {gone}")

        # ---- the owner; sign-up switched off ----
        o = await visitor(); await o.goto(BASE + "#/upload"); await o.wait_for_selector("#si"); await o.click("#toSetup")
        await o.fill("#snm", "Robert Monther"); await o.fill("#sem", "owner@example.test"); await o.fill("#spw", "a-long-password-1"); await o.fill("#spw2", "a-long-password-1"); await o.fill("#scode", fake_backend.SETUP_CODE)
        await o.click("#su button[type=submit]"); await o.wait_for_selector(".st .drop", timeout=20000)
        await o.goto(BASE + "#/account"); await o.wait_for_selector("#so")
        own = await o.evaluate("({text: document.querySelector('#acct').innerText, del: !!document.querySelector('#delAcc')})")
        check("the owner's account shows Owner and has no delete button", "owner@example.test · Owner" in own["text"] and not own["del"], str(own)[:160])
        cl = await visitor(closed=True); await cl.goto(BASE + "#/account"); await cl.wait_for_selector("#si")
        check("with sign-up switched off in config.js nobody new can create an account", not await cl.evaluate("!!document.querySelector('#toJoin')") and await cl.evaluate("!!document.querySelector('#toForgot')"))
        probs = [x for pgx in (pg, other, f, f2, e, o, cl) for x in pgx.problems if not re.search(r"status of (400|403|422)", x)]
        check("no errors in the browser during the whole walk", not probs, str(probs[:4]))
        await b.close()
    print(f"\n{sum(results)} of {len(results)} account checks passed")
    sys.exit(0 if all(results) else 1)

def DB_mail(to): return [x for x in fake_backend.DB["mail"] if x["to"] == to]
asyncio.run(main())
