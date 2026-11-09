"""Give every song with a cover an accent colour, used by the Spotify-style player
(the Now Playing background and the mini player take this colour).

Usage (from the repo root):
  python3 scripts/cover_colors.py            # show the colour found for each cover
  python3 scripts/cover_colors.py --write    # save missing colours into data/catalogue.json
                                             # and regenerate data/catalogue.js
Needs Pillow (pip install pillow). The site also samples the cover in the browser
when a song has no "color", so this step is optional but makes the colour instant.
"""
import colorsys, json, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
JSON_PATH = ROOT / "data" / "catalogue.json"
JS_PATH = ROOT / "data" / "catalogue.js"


def accent(path, min_share=0.015):
    """Most vivid colour that still covers a real part of the image."""
    im = Image.open(path).convert("RGB").resize((64, 64))
    px = list(im.get_flattened_data()) if hasattr(im, "get_flattened_data") else list(im.getdata())
    buckets = {}
    for r, g, b in px:
        _, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if l < 0.12 or l > 0.88:
            continue
        bk = buckets.setdefault((r >> 5, g >> 5, b >> 5), [0, 0, 0, 0, 0.0])
        bk[0] += 1; bk[1] += r; bk[2] += g; bk[3] += b; bk[4] += s
    cands = [v for v in buckets.values() if v[0] >= len(px) * min_share] or list(buckets.values())
    if not cands:
        return None
    best = max(cands, key=lambda v: v[0] * ((v[4] / v[0]) ** 2 + 0.01))
    n = best[0]
    return "#%02x%02x%02x" % (round(best[1] / n), round(best[2] / n), round(best[3] / n))


def main():
    write = "--write" in sys.argv
    raw = JSON_PATH.read_text()
    data = json.loads(raw)
    changed = 0
    for s in data["songs"]:
        if not s.get("art"):
            continue
        cover = ROOT / s["art"]
        if not cover.exists():
            print(f"{s['id']}: cover not found ({s['art']})")
            continue
        colour = accent(cover)
        print(f"{s['id']} {s['title']}: {colour}" + ("" if s.get("color") else "  (new)"))
        if write and colour and not s.get("color"):
            s["color"] = colour
            changed += 1
    if write and changed:
        JSON_PATH.write_text(json.dumps(data, indent=1) + ("\n" if raw.endswith("\n") else ""))
        body = {k: v for k, v in data.items() if k != "note"}
        JS_PATH.write_text("window.VELORA_DATA=" + json.dumps(body) + ";\n")
        print(f"Saved {changed} colour(s) and regenerated data/catalogue.js")


if __name__ == "__main__":
    main()
