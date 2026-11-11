"""Draws the app icon, the adaptive-icon layers and the splash screens from the Velora mark (the gradient record
that the website already uses), plus two more icon ideas to choose from later.

    python3 store/make_icons.py          (run inside the app folder; needs: pip install pillow numpy fonttools brotli)

Writes app/assets/*.png (the sources that `npm run icons` turns into every size Android and iOS need) and
app/store/icon-options/*.png (the three ideas side by side)."""
import io, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__)); APP = os.path.dirname(HERE); ROOT = os.path.dirname(APP)
INK = (18, 18, 20)                      # the site's near-black
CREAM = (243, 236, 226)                 # the certificate's cream
BLUE, PINK, RED = (91, 122, 153), (224, 169, 176), (176, 82, 74)   # the Italian "broken" colours of the site

def disc(size, radius, hole, center=None, ss=2):
    """The record: a conic gradient blue -> pink -> red -> blue, with a hole. Returns an RGBA image."""
    n = size * ss; cx, cy = (center or (size / 2, size / 2)); cx *= ss; cy *= ss
    y, x = np.mgrid[0:n, 0:n].astype(np.float32); dx, dy = x - cx, y - cy
    r = np.hypot(dx, dy); ang = (np.degrees(np.arctan2(dx, -dy)) + 360) % 360          # 0 = top, clockwise
    stops = np.array([BLUE, PINK, RED, BLUE], dtype=np.float32); seg = np.minimum((ang // 120).astype(int), 2); t = (ang - seg * 120) / 120
    t = t * t * (3 - 2 * t)                                                             # soft steps between the colours
    rgb = stops[seg] * (1 - t[..., None]) + stops[seg + 1] * t[..., None]
    alpha = ((r <= radius * n) & (r >= hole * n)).astype(np.float32) * 255
    img = Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), "RGBA")
    return img.resize((size, size), Image.LANCZOS)

def flat(size, color): return Image.new("RGBA", (size, size), color + (255,))
def on(bg, fg): out = bg.copy(); out.alpha_composite(fg); return out

def serif(px):
    """The site's headline font (Playfair Display 700), read from the woff2 the site ships."""
    from fontTools.ttLib import TTFont
    f = TTFont(os.path.join(ROOT, "assets", "fonts", "playfair-700-latin.woff2")); f.flavor = None
    buf = io.BytesIO(); f.save(buf); buf.seek(0)
    return ImageFont.truetype(buf, px)

def icon_a(size=1024): return on(flat(size, INK), disc(size, 0.383, 0.076))                 # the mark as it is on the site
def icon_b(size=1024): return on(flat(size, CREAM), disc(size, 0.383, 0.076))               # the same record on sun-washed cream
def icon_c(size=1024):                                                                      # a serif V on the gradient
    y, x = np.mgrid[0:size, 0:size].astype(np.float32); t = np.clip((x * 0.55 + y * 0.45) / size, 0, 1)
    stops = np.array([BLUE, PINK, RED], dtype=np.float32); seg = np.minimum((t * 2).astype(int), 1); u = t * 2 - seg
    rgb = stops[seg] * (1 - u[..., None]) + stops[seg + 1] * u[..., None]
    img = Image.fromarray(np.dstack([rgb, np.full((size, size), 255, np.float32)]).astype(np.uint8), "RGBA")
    d = ImageDraw.Draw(img); f = serif(int(size * 0.7)); box = d.textbbox((0, 0), "V", font=f)
    d.text(((size - (box[2] - box[0])) / 2 - box[0], (size - (box[3] - box[1])) / 2 - box[1] - size * 0.01), "V", font=f, fill=INK + (255,))
    return img

def rounded(img, r=0.2237):
    """How a phone shows it: the icon inside a rounded square."""
    s = img.size[0] * 2; m = Image.new("L", (s, s), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * r), fill=255)
    out = img.copy(); out.putalpha(m.resize(img.size, Image.LANCZOS)); return out

def main():
    os.makedirs(os.path.join(APP, "assets"), exist_ok=True); os.makedirs(os.path.join(HERE, "icon-options"), exist_ok=True)
    a = icon_a(); a.convert("RGB").save(os.path.join(APP, "assets", "icon-only.png"))                      # iOS wants no transparency
    disc(1024, 0.27, 0.054).save(os.path.join(APP, "assets", "icon-foreground.png"))                        # Android: inside the safe middle
    flat(1024, INK).convert("RGB").save(os.path.join(APP, "assets", "icon-background.png"))
    sp = flat(2732, INK); mark = disc(640, 0.363, 0.073)                                                    # a small record in the middle
    sp.alpha_composite(mark, ((2732 - 640) // 2, (2732 - 640) // 2)); sp = sp.convert("RGB")
    sp.save(os.path.join(APP, "assets", "splash.png")); sp.save(os.path.join(APP, "assets", "splash-dark.png"))
    icons = {"A-record-on-black": a, "B-record-on-cream": icon_b(), "C-serif-V": icon_c()}
    for name, im in icons.items(): im.convert("RGB").save(os.path.join(HERE, "icon-options", name + ".png"))
    # One sheet to compare them: big, and at the size they have on a phone's home screen.
    W, H = 1800, 1120; sheet = Image.new("RGB", (W, H), (30, 30, 34)); d = ImageDraw.Draw(sheet); f = serif(54); small = serif(34)
    for i, (name, im) in enumerate(icons.items()):
        x = 90 + i * 570; big = rounded(im.resize((480, 480), Image.LANCZOS)); sheet.paste(big, (x, 150), big)
        for j, px in enumerate((180, 120, 60)):
            t = rounded(im.resize((px, px), Image.LANCZOS)); sheet.paste(t, (x + [0, 210, 370][j], 700 + (180 - px)), t)
        d.text((x, 60), name[0], font=f, fill=CREAM); d.text((x + 60, 76), name[2:].replace("-", " "), font=small, fill=(190, 184, 176))
    d.text((90, 960), "A is in the test app today.  B and C are ideas for later.", font=small, fill=(190, 184, 176))
    sheet.save(os.path.join(HERE, "icon-options", "icon-options.png"))
    print("icons written")

if __name__ == "__main__": main()
