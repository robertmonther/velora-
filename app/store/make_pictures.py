"""Store pictures: screenshots of the app at the sizes Google Play and the App Store ask for, and Play's feature graphic.

    python3 app/store/make_pictures.py        (from the repo folder; needs: pip install playwright pillow numpy fonttools brotli, Chrome)

The screenshots show the real pages as they look inside the app (no shop, no preview banner), with explicit songs
hidden, because store pictures must suit every age. Written to app/store/pictures/."""
import asyncio, os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, "tests")); sys.path.insert(0, HERE)
import app_mode as A
import make_icons as I
from playwright.async_api import async_playwright

OUT = os.path.join(HERE, "pictures")
SIZES = {"play-phone-1080x1920": (360, 640, 3), "apple-iphone-6.9in-1320x2868": (440, 956, 3)}
CLEAN = "try{ localStorage.setItem('velora_explicit', JSON.stringify('hide')); localStorage.setItem('velora_intro_seen', 'true'); }catch(e){}"

async def shots(b, name, w, h, scale):
    folder = os.path.join(OUT, name); os.makedirs(folder, exist_ok=True)
    pg = await A.app_page(b, w, h, scale); await pg.context.add_init_script(CLEAN)
    snap = lambda n: pg.screenshot(path=os.path.join(folder, n + ".jpg"), type="jpeg", quality=92)      # both stores take JPEG; it keeps the repo small
    await pg.goto(A.BASE); await pg.wait_for_selector(".feat"); await pg.wait_for_timeout(1200); await snap("1-home")
    await pg.click(".feat-cover"); await pg.wait_for_selector("#np:not([hidden])"); await pg.wait_for_timeout(2500); await snap("2-player")
    lyr = await pg.query_selector("#np .np-card .lyr, #np [data-lyr], #np .lyrics")
    if lyr: await lyr.scroll_into_view_if_needed(); await pg.wait_for_timeout(600); await snap("3-lyrics")
    await pg.evaluate("document.querySelector('#npClose').click()"); await pg.wait_for_timeout(400)
    await pg.goto(A.BASE + "#/radio"); await pg.wait_for_selector("main h1, main .pagetitle"); await pg.wait_for_timeout(900); await snap("4-radio")
    await pg.goto(A.BASE + "#/search"); await pg.wait_for_selector("main"); await pg.wait_for_timeout(900); await snap("5-browse")
    song = await pg.evaluate("(document.querySelector('[data-song]')||{dataset:{}}).dataset.song || ''")
    if song: await pg.goto(A.BASE + "#/song/" + song); await pg.wait_for_selector("[data-share]"); await pg.wait_for_timeout(900); await snap("6-song")
    await pg.context.close()
    return sorted(os.listdir(folder))

def feature_graphic():
    """Google Play's feature graphic, 1024 x 500: the mark, the working name and one line."""
    W, H = 1024, 500; img = Image.new("RGBA", (W, H), I.INK + (255,))
    img.alpha_composite(I.disc(380, 0.47, 0.095), (70, 60))
    d = ImageDraw.Draw(img); d.text((500, 150), "Velora", font=I.serif(120), fill=I.CREAM + (255,))
    d.text((504, 300), "Every song, whole.", font=I.serif(44), fill=(224, 169, 176, 255))
    img.convert("RGB").save(os.path.join(OUT, "play-feature-graphic-1024x500.png"))
    I.icon_a(512).convert("RGB").save(os.path.join(OUT, "play-icon-512.png"))

async def main():
    os.makedirs(OUT, exist_ok=True); A.serve()
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=A.CHROME, args=["--autoplay-policy=no-user-gesture-required"])
        for name, (w, h, s) in SIZES.items(): print(name, await shots(b, name, w, h, s))
        await b.close()
    feature_graphic(); print("feature graphic and icon written")

if __name__ == "__main__": asyncio.run(main())
