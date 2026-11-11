"""Velora upload checks: walks the whole upload like the owner on a phone, against a stand-in server
(tests/fake_backend.py), and keeps a screenshot of every step in tests/shots/upload/.

    python3 tests/upload.py        (needs: pip install playwright pillow, Chrome and ffmpeg)

The real server is never touched. What only the real server can prove (sign-in, the database rules,
file storage) was checked against it directly on 11 Nov 2026: see docs/UPLOAD-STUDIO.md."""
import asyncio, json, os, re, subprocess, sys, urllib.request
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fake_backend

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8793
BASE = f"http://localhost:{PORT}/index.html"
API = f"http://localhost:{PORT}/__supa"
SHOTS = os.path.join(ROOT, "tests", "shots", "upload")
TMP = os.path.join(ROOT, "tests", "tmp")
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
results = []
LYRICS = """[Verse 1]
You've been watching the doorway
Since a quarter past eight
[Kick and claps, soft]
Checking your reflection
Like that could change your fate
[Chorus]
Tick-tock, tick-tock, I'm in no rush at all
Should I grace you with an entrance or not show up at all"""

def check(name, ok, detail=""):
    results.append(ok); print(("PASS  " if ok else "FAIL  ") + name + (f"   [{detail}]" if detail and not ok else ""), flush=True)
def state(): return json.loads(urllib.request.urlopen(API + "/__state").read())
async def until(page, expr, timeout=30000):
    # the page forbids eval, so the condition is sent as a function
    await page.wait_for_function("() => { try { return (" + expr + "); } catch (e) { return false; } }", timeout=timeout)
def lufs_of(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=sample", "-f", "null", "-"], capture_output=True, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", out)[-1])

def fixtures():
    os.makedirs(TMP, exist_ok=True); os.makedirs(SHOTS, exist_ok=True)
    src = os.path.join(ROOT, "media", "audio", "song-13-fashionably-late.mp3")
    wav = os.path.join(TMP, "Fashionably_Late_slowed.wav"); mp3 = os.path.join(TMP, "tagged.mp3")
    if not os.path.exists(wav): subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "40", "-t", "45", "-i", src, "-ar", "48000", "-ac", "2", "-af", "volume=5dB", "-metadata", "title=Fashionably Late", "-metadata", "comment=made with a tool; created=2026-06-01T10:11:12Z; id=PRIVATE-ID-123", wav], check=True)
    if not os.path.exists(mp3): subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "40", "-t", "31", "-i", src, "-c:a", "libmp3lame", "-b:a", "128k", "-id3v2_version", "3", "-metadata", "title=Tagged Song", "-metadata", "lyrics-eng=[Verse 1]\nFirst line here\nSecond line here", "-metadata", "comment=created=2026-09-19T08:00:00Z; id=PRIVATE-ID-456", mp3], check=True)
    quiet = os.path.join(TMP, "quiet.wav")
    if not os.path.exists(quiet): subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", "40", "-t", "30", "-i", src, "-ar", "44100", "-ac", "2", "-af", "volume=-12dB", quiet], check=True)
    from PIL import Image, ImageDraw
    def img(name, w, h, fmt):
        p = os.path.join(TMP, name)
        if not os.path.exists(p):
            im = Image.new("RGB", (w, h), "#3a0f1a"); d = ImageDraw.Draw(im)
            for i in range(0, max(w, h), 40): d.ellipse((w / 2 - i, h / 2 - i, w / 2 + i, h / 2 + i), outline=(176 + i % 60, 82, 110))
            d.rectangle((w * .3, h * .3, w * .7, h * .7), fill="#e0a9b0"); im.save(p, fmt, quality=90)
        return p
    return wav, mp3, img("cover-small.png", 1000, 1000, "PNG"), img("cover-wide.jpg", 2000, 1500, "JPEG"), img("photo.jpg", 900, 900, "JPEG")

async def main():
    wav, mp3, cover_small, cover_wide, photo = fixtures()
    fake_backend.serve(ROOT, PORT)
    cfg = open(os.path.join(ROOT, "config.js"), encoding="utf-8").read()
    cfg = re.sub(r'supabase:\s*\{[^}]*\}', f'supabase: {{ url: "{API}", anonKey: "sb_publishable_stand_in_key_0000000000" }}', cfg)
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=["--autoplay-policy=no-user-gesture-required"])
        async def visitor(adult=True, w=390, h=844, mobile=True):
            c = await b.new_context(viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
            if adult: await c.add_init_script("try{ localStorage.setItem('velora_age', JSON.stringify('adult')); }catch(e){}")
            await c.route("**/config.js*", lambda r: r.fulfill(body=cfg, content_type="application/javascript"))
            pg = await c.new_page(); pg.problems = []
            pg.on("pageerror", lambda e: pg.problems.append("error: " + str(e) + " @ " + " | ".join((getattr(e, "stack", "") or "").split("\n")[1:4])))
            pg.on("console", lambda m: pg.problems.append("console: " + m.text) if m.type == "error" else None)
            return pg
        shot_n = [0]
        async def shot(pg, name, full=True):
            shot_n[0] += 1; await pg.screenshot(path=f"{SHOTS}/{shot_n[0]:02d}-{name}.png", full_page=full)

        pg = await visitor()
        # ---- 0. the sound tools on their own: tags and loudness ----
        await pg.goto(BASE + "#/upload"); await pg.wait_for_selector("#stAuth form")
        tags = await pg.evaluate("""async (u) => { const b = await (await fetch(u)).arrayBuffer(); const t = VeloraAudio.readTags(b); return {title: t.title, lyrics: t.lyrics, created: t.created, keys: Object.keys(t), kind: VeloraAudio.kind(b, 'x.mp3')}; }""", "/tests/tmp/tagged.mp3")
        check("the file's own tags are read (title, lyrics, date) and the private comment is dropped", tags["title"] == "Tagged Song" and "First line here" in tags["lyrics"] and tags["created"] == "2026-09-19" and "comment" not in tags["keys"] and tags["kind"] == "MP3", str(tags))
        wtags = await pg.evaluate("""async (u) => { const b = await (await fetch(u)).arrayBuffer(); const t = VeloraAudio.readTags(b); const a = await VeloraAudio.decode(b); const m = VeloraAudio.loudness(VeloraAudio.channels(a), a.sampleRate); return {title: t.title, created: t.created, wav: t.wav, rate: a.sampleRate, dur: a.duration, lufs: m.lufs, peak: m.peakDb}; }""", "/tests/tmp/Fashionably_Late_slowed.wav")
        ref = lufs_of(wav)
        check("WAV details are read and the song is opened at 44.1 kHz", wtags["wav"] == {"channels": 2, "sampleRate": 48000, "bits": 16} and wtags["rate"] == 44100 and abs(wtags["dur"] - 45) < 0.1 and wtags["created"] == "2026-06-01", str(wtags))
        check(f"loudness matches ffmpeg's meter ({ref} LUFS)", abs(wtags["lufs"] - ref) < 0.4, f"{wtags['lufs']:.2f} vs {ref}")

        quiet = await pg.evaluate("""async (u) => { const b = await (await fetch(u)).arrayBuffer(); const a = await VeloraAudio.decode(b); const before = VeloraAudio.loudness(VeloraAudio.channels(a), a.sampleRate);
            const cl = a.getChannelData(0), cr = a.getChannelData(1); for (let k = 1; k <= 20; k++) { const at = Math.floor(k * a.sampleRate * 1.3); for (let i = 0; i < 220; i++) { const v = 0.9 * Math.sin(2 * Math.PI * 1000 * i / a.sampleRate); cl[at + i] = v; cr[at + i] = v; } }
            const r = await VeloraAudio.master(a, {style: 'balanced', lufs: -14, peakDb: -1}); let max = 0; for (let i = 0; i < r.L.length; i++) { const v = Math.max(Math.abs(r.L[i]), Math.abs(r.R[i])); if (v > max) max = v; }
            return {before: before.lufs, after: r.after.lufs, peak: 20 * Math.log10(max), limited: r.limited, gain: r.gainDb}; }""", "/tests/tmp/quiet.wav")
        check("mastering lifts a quiet song to -14 LUFS and no sample passes -1 dB", quiet["before"] < -22 and abs(quiet["after"] + 14) < 0.7 and quiet["peak"] <= -0.999 and quiet["limited"], str(quiet))

        # ---- 1. the door: sign-in and the one-time owner setup ----
        await shot(pg, "door-signed-out")
        await pg.click("#toSetup"); await pg.fill("#snm", "Robert Monther"); await pg.fill("#sem", "owner@example.test"); await pg.fill("#spw", "a-long-password-1"); await pg.fill("#spw2", "a-long-password-1"); await pg.fill("#scode", "WRONG-CODE-0000")
        await shot(pg, "owner-setup")
        await pg.click("#su button[type=submit]"); await until(pg, "document.querySelector('#suMsg').textContent.length > 0")
        check("a wrong setup code is refused", "not right" in await pg.inner_text("#suMsg"))
        await pg.fill("#scode", fake_backend.SETUP_CODE); await pg.click("#su button[type=submit]"); await pg.wait_for_selector(".st .drop", timeout=15000)
        check("the right code creates the owner account and opens the upload", (await pg.inner_text(".st-title")) == "Song file" and state()["users"][0]["role"] == "owner")

        # ---- 2. step 1: the song file ----
        await shot(pg, "step1-song-file")
        await pg.click("#stNext"); check("can't continue without a file", "Choose the song file" in await pg.inner_text("#stMsg"))
        await pg.set_input_files("#fileIn", wav); await pg.wait_for_selector("#fWave", timeout=60000)
        info = await pg.evaluate("({name: document.querySelector('.filehead b').textContent, tech: document.querySelector('.filehead small').textContent, facts: [...document.querySelectorAll('.st-facts .fact')].map(e=>e.textContent)})")
        check("the file card shows format, length and loudness", "WAV · 16-bit · 48 kHz · stereo" in info["tech"] and "0:45" in info["facts"][0] and "LUFS" in info["facts"][1], str(info))
        await pg.click("#fPlay"); await pg.wait_for_timeout(900); playing = await pg.evaluate("!document.querySelector('#stAudio').paused && document.querySelector('#stAudio').currentTime > 0.3"); await pg.click("#fPlay")
        check("the song can be played back before going on", playing)
        await shot(pg, "step1-file-read")
        await pg.click("#stNext"); await pg.wait_for_selector("#dTitle")

        # ---- 3. step 2: details ----
        d = await pg.evaluate("({title: document.querySelector('#dTitle').value, version: document.querySelector('#dVersion').value, created: document.querySelector('#dCreated').value, genres: document.querySelectorAll('#dGenre option').length, moods: document.querySelectorAll('[data-mood]').length})")
        check("title, version and date come filled in from the file", d["title"] == "Fashionably Late" and d["version"] == "Slowed" and d["created"] == "2026-06-01" and d["genres"] > 20 and d["moods"] > 15, str(d))
        await pg.click("#stNext"); check("the form says what is missing", "artist" in (await pg.inner_text("#stMsg")).lower())
        await pg.select_option("#dArtist", "+"); await pg.fill("#dArtistNew", "Test Artist"); await pg.fill("#dFeat", "Guest One")
        await pg.select_option("#dGenre", "Pop"); await until(pg, "document.querySelectorAll('#dSub option').length > 3"); await pg.select_option("#dSub", "Dance Pop")
        await pg.click("[data-mood='Playful']"); await pg.click("[data-mood='Sensual']")
        locked = await pg.evaluate("document.querySelector('#dAdult').checked && document.querySelector('#dAdult').disabled")
        check("choosing the Sensual mood marks the song for adults", locked)
        await shot(pg, "step2-details")
        await pg.click("#stNext"); await pg.wait_for_selector("#cLyr")

        # ---- 4. step 3: credits and AI ----
        c = await pg.evaluate("({lyr: document.querySelector('#cLyr').value, prod: document.querySelector('#cProd').value, ai: document.querySelector('[data-ai=\"1\"]').classList.contains('on'), tool: document.querySelector('#aiTool').value, music: document.querySelector('#aiMusic').checked})")
        check("credits start with the owner's name; the AI question is asked", c["lyr"] == "Robert Monther" and c["prod"] == "Robert Monther" and c["ai"] and c["tool"] == "Suno" and c["music"], str(c))
        await pg.click("#cAdd"); await pg.select_option("#cRole0", "Mixing"); await pg.fill("#cName0", "Mix Person")
        await shot(pg, "step3-credits-ai")
        folded = await pg.evaluate("!document.querySelector('#cMore').open")
        await pg.click("#cMore summary"); await pg.fill("#rLabel", "Test Label"); await pg.fill("#rIsrc", "NL-A01-26"); await pg.click("#stNext")
        bad = await pg.inner_text("#stMsg"); still = await pg.evaluate("document.querySelector('#cMore').open && document.querySelector('#rLabel').value")
        await pg.fill("#rIsrc", "nl-a01-26-00042")
        own = await pg.evaluate("[document.querySelector('#rCO').value, document.querySelector('#rPO').value, document.querySelector('#rCY').placeholder]")
        check("the store questions (label, publisher, owners, ISRC) are folded away, optional and checked", folded and "ISRC" in bad and still == "Test Label" and own == ["Robert Monther", "Robert Monther", "2026"], f"{folded} {bad} {still} {own}")
        await shot(pg, "step3-release-details")
        await pg.click("#stNext"); await pg.wait_for_selector("#lText")

        # ---- 5. step 4: lyrics and syncing ----
        await pg.click("#stNext"); check("lyrics are asked for (or the 'no lyrics' tick)", "lyrics" in (await pg.inner_text("#stMsg")).lower())
        await pg.fill("#lText", LYRICS); await pg.wait_for_timeout(150)
        await shot(pg, "step4-lyrics")
        await pg.click("#stNext"); check("lyrics must be synced or skipped on purpose", "Sync" in await pg.inner_text("#stMsg"))
        await pg.click("#lSync"); await pg.wait_for_selector("#syTap")
        n_lines = await pg.evaluate("document.querySelectorAll('#syList li').length"); marks = await pg.evaluate("[...document.querySelectorAll('#syList em')].map(e=>e.textContent)")
        check("bracket lines become song parts; stage notes are left out", n_lines == 6 and marks == ["Verse 1", "Chorus"], f"{n_lines} {marks}")
        await pg.click("#syTap"); await pg.wait_for_timeout(1200)                    # the first tap starts the song
        await shot(pg, "step4-syncing", full=False)
        for i in range(6): await pg.click("#syTap"); await pg.wait_for_timeout(700)
        times = await pg.evaluate("VeloraStudio._state().lines.map(l => l.t)")
        check("each tap gives the next line its moment, in order", len(times) == 6 and all(t is not None for t in times) and all(a < b for a, b in zip(times, times[1:])) and 0.7 < times[0] < 2 and 0.4 < times[1] - times[0] < 1.2, str(times))
        await pg.click("[data-redo='4']"); await pg.wait_for_timeout(500)
        redo = await pg.evaluate("VeloraStudio._state().lines.map(l => l.t)")
        await pg.wait_for_timeout(1500); await pg.click("#syTap"); await pg.wait_for_timeout(500); await pg.click("#syTap"); await pg.wait_for_timeout(300)
        after = await pg.evaluate("VeloraStudio._state().lines.map(l => l.t)")
        check("tapping a line in the list redoes the timing from there", redo[4] is None and redo[5] is None and redo[3] == times[3] and all(t is not None for t in after) and after[4] > after[3], f"{redo} {after}")
        await shot(pg, "step4-synced", full=False)
        await pg.click("#syDone"); await pg.wait_for_selector("#lCard .okdot")
        await pg.click("#stNext"); await pg.wait_for_selector("#coverIn", state="attached")

        # ---- 6. step 5: the cover ----
        await shot(pg, "step5-cover-empty")
        await pg.set_input_files("#coverIn", cover_small); await pg.wait_for_selector(".coverprev")
        small = await pg.inner_text(".coverchecks")
        await pg.click("#stNext"); msg = await pg.inner_text("#stMsg")
        check("a cover below 1500 x 1500 is flagged and stops the upload", "Too small for stores: 1000 × 1000" in small and "below the store size" in msg, small[:200])
        await shot(pg, "step5-cover-too-small")
        await pg.set_input_files("#coverIn", cover_wide); await pg.wait_for_selector("#cCrop")
        wide = await pg.inner_text(".coverchecks"); await pg.click("#stNext"); msg = await pg.inner_text("#stMsg")
        check("a cover that is not square is flagged", "Not a square (2000 × 1500)" in wide and "square" in msg)
        await pg.click("#cCrop"); await until(pg, "document.querySelectorAll('.coverchecks .chk.ok').length === 3")
        await shot(pg, "step5-cover-ok")
        await pg.click("#stNext"); await pg.wait_for_selector("input[name=mOn]")

        # ---- 7. step 6: mastering and the best part ----
        await pg.wait_for_selector("#abPlay", timeout=60000)
        m = await pg.evaluate("(() => { const s = VeloraStudio._state(); return {before: s.loud.lufs, after: s.master.res.after.lufs, peak: s.master.res.after.peakDb, best: s.best}; })()")
        check("mastering brings the song to -14 LUFS with safe peaks", abs(m["after"] + 14) < 0.6 and m["peak"] <= -0.95 and m["before"] > -12, str(m))
        await pg.click("#abPlay"); await pg.wait_for_timeout(700); await pg.click("[data-ab='0']"); await pg.wait_for_timeout(500)
        ab = await pg.evaluate("(() => { const s = VeloraStudio._state().ab; return {playing: s.playing, which: s.which}; })()"); await pg.click("#abPlay")
        check("before and after can be compared while playing", ab["playing"] and ab["which"] == 0, str(ab))
        await pg.click("[data-style='warm']"); await until(pg, "(() => { const m = VeloraStudio._state().master; return !m.working && m.res && m.key.startsWith('warm'); })()", timeout=60000)
        await pg.click("[data-best='5']"); best = await pg.evaluate("VeloraStudio._state().best")
        check("the style can be changed and the best part moved", best == m["best"] + 5)
        await shot(pg, "step6-mastering")
        await pg.click("#stNext"); await pg.wait_for_selector("#rOwn")

        # ---- 8. step 7: rights ----
        await pg.click("#stNext"); check("the rights boxes must be ticked", "Tick all three" in await pg.inner_text("#stMsg"))
        for i in ("#rOwn", "#rClean", "#rRec"): await pg.check(i)
        await pg.click("[data-cov='1']"); await pg.click("#stNext"); cov = await pg.inner_text("#stMsg"); ticks = await pg.evaluate("document.querySelector('#rOwn').checked")
        await pg.click("[data-cov='0']")
        check("a cover of someone else's song is not accepted", "original songs only" in cov and ticks)
        await shot(pg, "step7-rights")
        await pg.click("#stNext"); await pg.wait_for_selector(".artistcard")

        # ---- 9. step 8: artist profile and Publish ----
        await pg.set_input_files("#aPhoto", photo); await until(pg, "document.querySelector('.aphoto').style.backgroundImage.includes('blob:')")
        await pg.fill("#aTag", "Only a test"); await pg.fill("#aBio", "An artist made for the upload check.")
        s = await pg.inner_text(".summary")
        check("the last step shows the artist profile and a summary", "Fashionably Late (Slowed)" in s and "Test Artist" in s and "feat. Guest One" in s and "SYNCED LYRICS" in s.upper() and "18+" in s, s)
        await shot(pg, "step8-artist-and-publish")
        await pg.click("#stNext"); await pg.wait_for_selector(".publog"); await pg.wait_for_timeout(400); await shot(pg, "publishing", full=False)
        await pg.wait_for_selector(".st-done", timeout=180000)
        await shot(pg, "published")
        st = state(); song = next(x for x in st["songs"] if x["status"] == "published"); pay = song["payload"]
        check("Publish stores the song with every answer", song["title"] == "Fashionably Late" and song["version"] == "Slowed" and song["artist_id"] == "test-artist" and song["genre"] == "Pop" and song["subgenre"] == "Dance Pop"
              and song["moods"] == ["Playful", "Sensual"] and song["adult"] and not song["explicit"] and song["language"] == "English" and abs(song["duration"] - 45) < 0.2 and pay["created_on"] == "2026-06-01"
              and pay["rights_confirmed"] is True and pay["ai"] == {"used": True, "music": True, "vocals": True, "lyrics": False, "artwork": False, "tool": "Suno"} and pay["mastered"] is True, json.dumps({k: v for k, v in song.items() if k != "payload"})[:400])
        ly = song["lyrics"]; secs = song["sections"]
        check("synced lyrics and song parts are saved", len(ly) == 6 and ly[0][1] == "You've been watching the doorway" and all(a[0] < b[0] for a, b in zip(ly, ly[1:])) and song["lyrics_synced"] and [x["name"] for x in secs] == ["Verse 1", "Chorus"] and secs[0]["start"] == 0, f"{ly} {secs}")
        check("the release details are stored for stores later", pay["release"] == {"type": "single", "label": "Test Label", "isrc": "NLA012600042", "c_owner": "Robert Monther", "c_year": 2026, "p_owner": "Robert Monther", "p_year": 2026}, str(pay.get("release")))
        cr = {(c["name"], r) for c in pay["credits"] for r in c["roles"]}
        check("credits are saved in full", {("Test Artist", "Main Artist"), ("Guest One", "Featured Artist"), ("Robert Monther", "Lyricist"), ("Robert Monther", "Producer"), ("Mix Person", "Mixing")} <= cr and any(n == "Suno" and r.startswith("AI-made: music, voice") for n, r in cr), str(cr))
        rec = st["records"][0]["details"]
        check("the ownership record holds the fingerprints", st["records"][0]["kind"] == "published" and all(re.fullmatch(r"[0-9a-f]{64}", rec.get(k, "")) for k in ("original_sha256", "audio_sha256", "cover_sha256", "lyrics_sha256")) and rec["original_name"] == "Fashionably_Late_slowed.wav", str(rec))
        import hashlib
        check("the original file's fingerprint is right", rec["original_sha256"] == hashlib.sha256(open(wav, "rb").read()).hexdigest())
        apath = song["audio_path"]; data = urllib.request.urlopen(API + "/__file?name=" + apath).read(); out = os.path.join(TMP, "published.mp3"); open(out, "wb").write(data)
        probe = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration,bit_rate:stream=codec_name,sample_rate,channels:format_tags", "-of", "json", out], capture_output=True, text=True).stdout)
        fm, sm = probe["format"], probe["streams"][0]
        check("the stored file is a real 192 kbps MP3 of the whole song, with no tags inside", sm["codec_name"] == "mp3" and sm["sample_rate"] == "44100" and sm["channels"] == 2 and abs(float(fm["duration"]) - 45) < 0.3 and 185000 < int(fm["bit_rate"]) < 200000 and not fm.get("tags"), json.dumps(probe)[:300])
        check("the stored file's fingerprint matches the record", hashlib.sha256(data).hexdigest() == rec["audio_sha256"] and re.search(r"audio-" + rec["audio_sha256"][:16], apath) is not None)
        loud = lufs_of(out)
        check(f"the stored file plays at the mastered loudness ({loud} LUFS)", abs(loud + 14) < 0.8, str(loud))
        cpath = song["cover_path"]; cdata = urllib.request.urlopen(API + "/__file?name=" + cpath).read(); cp = os.path.join(TMP, "published-cover.jpg"); open(cp, "wb").write(cdata)
        from PIL import Image
        im = Image.open(cp); ap = [k for k in st["files"] if "/artists/" in k]
        check("the cover is stored as a square JPEG; the artist photo too", im.format == "JPEG" and im.size == (1200, 1200) and len(ap) == 1 and st["artists"][0]["image_path"] == ap[0] and st["artists"][0]["tagline"] == "Only a test", f"{im.format} {im.size} {ap}")

        # ---- 10. live at once ----
        await pg.click(".st-done a.btn.primary"); await pg.wait_for_selector(".song-cover")
        page = await pg.inner_text("main")
        kick = [x.strip() for x in page.split("\n")[0].split("·")]
        check("the song page opens right after publishing, with its ownership record", "Fashionably Late (Slowed)" in page and "Test Artist" in page and "Ownership record no. 1" in page and "rights holder Robert Monther" in page
              and "Made with AI: the music and the voice (Suno)" in page and "Lyrics by Robert Monther" in page and len(kick) == len(set(kick)) == 3, page[:200])
        await shot(pg, "song-page-after-publish")
        await pg.click("[data-record]"); await pg.wait_for_selector("#mBody .rec"); full = await pg.inner_text("#mBody")
        check("anyone can open the full record: fingerprints, never the file name", rec["original_sha256"] in full and rec["audio_sha256"] in full and st["records"][0]["hash"] in full and "Fashionably_Late_slowed" not in full and "Published" in full, full[:300])
        await shot(pg, "ownership-record", full=False)
        await pg.keyboard.press("Escape")
        await pg.click("[data-play]"); await pg.wait_for_timeout(2500)
        pl = await pg.evaluate("(() => { const a=document.querySelector('#audio'); return {t:a.currentTime, paused:a.paused, src:a.currentSrc, np:document.querySelector('#np').classList.contains('open'), lines:document.querySelectorAll('#lyrBox .ll').length, lit: !!document.querySelector('#lyrBox .ll.on'), art: getComputedStyle(document.querySelector('#npArt')).backgroundImage.includes('/storage/v1/object/public/media/')}; })()")
        check("it plays from the server's storage, with its cover and lyrics that follow the music", pl["t"] > 1 and not pl["paused"] and "/storage/v1/object/public/media/" in pl["src"] and pl["np"] and pl["lines"] == 6 and pl["lit"] and pl["art"], str(pl))
        await shot(pg, "playing-after-publish", full=False)
        await pg.click("#np [data-credits]"); await pg.wait_for_selector("#mBody .cgroup"); crm = await pg.inner_text("#mBody"); await pg.keyboard.press("Escape")
        check("credits show who did what, the AI part and the release details", all(x in crm for x in ("Test Artist", "Guest One", "Mix Person", "AI-made: music, voice", "Test Label", "NL-A01-26-00042", "© 2026 Robert Monther", "℗ 2026 Robert Monther")), crm[:400])
        await pg.click("#npClose")
        fresh = await visitor()
        await fresh.goto(BASE + "#/search?q=test%20artist"); await fresh.wait_for_selector("#sres .srow")
        v = await fresh.evaluate("({songs: [...document.querySelectorAll('#sres .srow b')].map(e=>e.textContent), artist: document.querySelectorAll('#sres .atile').length, img: getComputedStyle(document.querySelector('#sres .atile-img')).backgroundImage.includes('/artists/')})")
        check("another visitor finds the new song and its artist at once", v["songs"] == ["Fashionably Late (Slowed)"] and v["artist"] == 1 and v["img"], str(v))
        gate = await visitor(adult=False)
        await gate.goto(BASE + "#/search?q=fashionably%20late"); await gate.wait_for_selector("#sres .srow"); await gate.click("#sres .srow >> nth=0"); await gate.wait_for_selector("#ageYes")
        check("an uploaded adult song sits behind the age question too", (await gate.inner_text("#mTitle")) == "Adults only")

        # ---- 11. My songs: off the list and back; the record ----
        await pg.goto(BASE + "#/studio"); await pg.wait_for_selector(".msrow")
        await shot(pg, "my-songs")
        await pg.click("[data-rec]"); await pg.wait_for_selector("#mBody .rec"); recm = await pg.inner_text("#mBody"); await pg.keyboard.press("Escape")
        await pg.click("[data-list]"); await until(pg, "document.querySelector('.msrow small').textContent.includes('Off the list')")
        f2 = await visitor(); await f2.goto(BASE + "#/search?q=test%20artist"); await f2.wait_for_timeout(1200)
        gone = await f2.evaluate("document.querySelectorAll('#sres .srow').length")
        check("a song taken off the list disappears for visitors; its record stays", gone == 0 and "Robert Monther" in recm and len(state()["records"]) == 2 and state()["records"][1]["kind"] == "unlisted", f"{gone}")
        await pg.click("[data-list]"); await until(pg, "document.querySelector('.msrow small').textContent.includes('Live')")
        check("it can be put back", next(x for x in state()["songs"] if x["id"] == song["id"])["status"] == "published")

        # ---- 12. a second upload is mostly filled in; an MP3 with lyrics inside ----
        await pg.goto(BASE + "#/upload"); await pg.wait_for_selector(".st .drop")
        await pg.set_input_files("#fileIn", mp3); await pg.wait_for_selector("#fWave", timeout=60000); await pg.click("#stNext"); await pg.wait_for_selector("#dTitle")
        d2 = await pg.evaluate("({title: document.querySelector('#dTitle').value, artist: document.querySelector('#dArtist').value, genre: document.querySelector('#dGenre').value, sub: document.querySelector('#dSub').value, moods: [...document.querySelectorAll('[data-mood].on')].map(e=>e.dataset.mood), created: document.querySelector('#dCreated').value, lines: VeloraStudio._state().lines.length})")
        check("the next upload remembers the artist, genre and moods, and reads the lyrics from the file", d2["title"] == "Tagged Song" and d2["artist"] == "test-artist" and d2["genre"] == "Pop" and d2["sub"] == "Dance Pop" and sorted(d2["moods"]) == ["Playful", "Sensual"] and d2["created"] == "2026-09-19" and d2["lines"] == 2, str(d2))

        # ---- 13. an account that is not an uploader ----
        urllib.request.urlopen(API + "/__add_listener").read()
        other = await visitor(); await other.goto(BASE + "#/upload"); await other.wait_for_selector("#si")
        await other.fill("#em", "listener@example.test"); await other.fill("#pw", "wrong-password"); await other.click("#si button[type=submit]"); await until(other, "document.querySelector('#siMsg').textContent.length > 0")
        wrong = await other.inner_text("#siMsg")
        await other.fill("#pw", "listener-pass-123"); await other.click("#si button[type=submit]"); await other.wait_for_selector("#gOut")
        check("a wrong password is refused; a listener account can't upload", "Wrong email or password" in wrong and "can't upload yet" in await other.inner_text("main"))
        allp = pg.problems + fresh.problems + gate.problems + f2.problems + other.problems
        allp = [x for x in allp if "400 (Bad Request)" not in x and "403 (Forbidden)" not in x]         # the refused sign-ins above are expected
        check("no errors in the browser during the whole walk", not allp, str(allp[:4]))

        # ---- 14. desktop: the same flow fits a wide screen ----
        dk = await visitor(w=1280, h=860, mobile=False); await dk.goto(BASE + "#/upload"); await dk.wait_for_selector("#si")
        await dk.fill("#em", "owner@example.test"); await dk.fill("#pw", "a-long-password-1"); await dk.click("#si button[type=submit]"); await dk.wait_for_selector(".st .drop")
        await dk.set_input_files("#fileIn", mp3); await dk.wait_for_selector("#fWave", timeout=60000); await dk.click("#stNext"); await dk.wait_for_selector("#dTitle")
        over = await dk.evaluate("document.documentElement.scrollWidth - window.innerWidth"); labels = await dk.evaluate("getComputedStyle(document.querySelector('.st-dots li span')).display")
        await dk.screenshot(path=f"{SHOTS}/desktop-step2.png")
        check("desktop: the steps show their names and nothing overflows", over <= 0 and labels == "block" and not dk.problems, f"{over} {labels} {dk.problems[:2]}")
        await b.close()
    print(f"\n{sum(results)} of {len(results)} upload checks passed")
    sys.exit(0 if all(results) else 1)

asyncio.run(main())
