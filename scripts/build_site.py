"""Builds the folder that goes on the web host: only the site's own files, nothing else from this repo.

    python3 scripts/build_site.py                 -> dist/site, songs and covers loaded from GitHub (as today)
    python3 scripts/build_site.py --media         -> dist/site with the media folder inside; the site serves it itself
    python3 scripts/build_site.py --media --zip   -> also dist/velora-site.zip, to upload by hand
    python3 scripts/build_site.py --out /some/folder

Left out on purpose: tests, docs, the database files, the phone app, scripts, notes.
The GitHub workflow .github/workflows/site.yml runs this with --media and keeps the result on the branch "site"."""
import argparse, os, re, shutil, sys, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ["index.html", "styles.css", "studio.css", "config.js", "app.js", "backend.js", "studio.js", "studio-audio.js", "encoder-worker.js", "legal.js", "manifest.json"]
FOLDERS = ["data", "vendor", "assets"]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--media", action="store_true"); ap.add_argument("--zip", action="store_true"); ap.add_argument("--out", default=os.path.join(ROOT, "dist", "site"))
    a = ap.parse_args(); out = os.path.abspath(a.out)
    if os.path.exists(out): shutil.rmtree(out)
    os.makedirs(out)
    for f in FILES: shutil.copy2(os.path.join(ROOT, f), os.path.join(out, f))
    for d in FOLDERS: shutil.copytree(os.path.join(ROOT, d), os.path.join(out, d))
    for f in (".htaccess", "robots.txt"): shutil.copy2(os.path.join(ROOT, "hosting", f), os.path.join(out, f))
    if a.media:
        shutil.copytree(os.path.join(ROOT, "media"), os.path.join(out, "media"))
        p = os.path.join(out, "config.js"); s = open(p, encoding="utf-8").read()
        s2, n = re.subn(r'mediaFrom:\s*""', 'mediaFrom: "site"', s)
        if n != 1: sys.exit("config.js: could not switch mediaFrom to the site's own folder")
        open(p, "w", encoding="utf-8").write(s2)
    # every script and style the page names must be in the folder
    html = open(os.path.join(out, "index.html"), encoding="utf-8").read()
    missing = [m for m in re.findall(r'(?:src|href)="([^"#?:]+)(?:\?[^"]*)?"', html) if not m.startswith(("http", "data:", "mailto:")) and not os.path.exists(os.path.join(out, m))]
    if missing: sys.exit("the page names files that are not in the build: " + ", ".join(missing))
    size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(out) for f in fs)
    print(f"site built in {out}: {size / 1e6:.1f} MB" + (" (with media)" if a.media else " (media from GitHub)"))
    if a.zip:
        z = os.path.join(os.path.dirname(out), "velora-site.zip")
        with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
            for dp, _, fs in os.walk(out):
                for f in fs: full = os.path.join(dp, f); zf.write(full, os.path.relpath(full, out))
        print(f"zip written: {z} ({os.path.getsize(z) / 1e6:.1f} MB)")

if __name__ == "__main__": main()
