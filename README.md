# Velora (working name)

Robert Monther's song library: full-song listening like Spotify, a non-stop radio, licensing like Artlist (rent, buy, Premium), and since 11 Nov 2026 **the place where songs are uploaded**: the questions of LANDR's release form, synced lyrics, mastering, a dated ownership record, live at once. Lyrics and song design by Robert; music made with Suno (AI-assisted).

**Status (11 Nov 2026, branch `upload-studio`):** working prototype with 25 of Robert's songs bundled, plus the upload studio for the owner's account. Listening, search, radio, lyrics, videos, the age gate and uploading are real. **Prices, checkout and license certificates are a demo**: nothing is charged.

- Test link: `https://raw.githack.com/robertmonther/velora-/<commit ID>/index.html` (a link with the commit ID always shows exactly that version). On this shared test address you sign in again after a reload.
- Change log, decisions and open items: the Notion pages "Music World" and "Velora: song library site"

## What is in the box

| Path | What it is |
| --- | --- |
| `index.html` | The page shell: top bar with the menu and the Upload button, tab bar, mini player, Now Playing, windows |
| `styles.css` | All styles of the site (dark theme, the Italian broken colours: blue, red, pink) |
| `config.js` | **Settings**: media version, prices, radio schedule, ads, channels, age gate, upload limits, the server's address and public key |
| `app.js` | The app: search, player, radio, pages, menu, age gate, router. No framework, no build step |
| `backend.js` | Accounts and server calls (Supabase). The account library loads only when someone signs in or uploads |
| `studio.js`, `studio-audio.js`, `encoder-worker.js`, `studio.css` | The upload pages and their sound tools. Loaded only when someone opens them. See `docs/UPLOAD-STUDIO.md` |
| `data/catalogue.js` / `.json` | The bundled songs: genres, moods, collections, artists, lyrics with times, song parts, covers |
| `data/taxonomy.js` | The genre, sub-genre, mood and language lists of the upload form |
| `media/` | Bundled songs (`audio/`), covers (`covers/`), artist pictures (`artists/`), vertical videos (`shorts/`) |
| `assets/` | Fonts (Inter, Playfair Display, served from the site) and app icons |
| `manifest.json` | Lets phones install the site as an app (name, icons, colours) |
| `supabase/schema.sql` | The whole database: accounts, artists, songs, ownership records, file storage rules. **Applied** to the project "velora" |
| `supabase/functions/owner-setup/` | The one-time setup of the owner's account |
| `vendor/` | Self-hosted, unchanged libraries: `supabase.js` (MIT), `lame.min.js` (lamejs, LGPL-3.0) |
| `tests/run.py` | Automated walk-through of the site on a phone-size screen (63 checks) |
| `tests/upload.py`, `tests/fake_backend.py` | The whole upload, against a stand-in server on this computer (50 checks) |
| `docs/` | `ARCHITECTURE.md`, `UPLOAD-STUDIO.md`, `ADDING-SONGS.md` |

## Run it

```bash
python3 tests/server.py . 4173      # then open http://localhost:4173
python3 tests/run.py                # all lines must say PASS (needs playwright, pillow, Chrome)
python3 tests/upload.py             # the same for the upload (also needs ffmpeg)
```

## Pages

`#/` Home · `#/search` Search (titles, artists, genres, moods, "explicit", "video", lyrics) · `#/genre/<id>` Genre, mood or collection · `#/song/<id>` Song page · `#/artist/<id>` Artist page · `#/radio` Radio · `#/videos` Music videos and shorts · `#/pricing` Pricing · `#/verify` Verify a license · `#/upload` Upload a song · `#/studio` My songs · `#/settings` Settings · `#/account` Account

## What it does

- **Listening like Spotify:** tap a song and its full screen opens in the cover's colours, with synced lyrics (tap a line to jump), song parts, video, credits, the artist, license buttons and similar songs. Mini player, lock-screen controls, bottom tab bar on phones. Explicit songs carry an "E" badge.
- **English only.** Every word on screen is English (Robert's rule for all his apps).
- **Adults only, behind an age question:** sensual and explicit songs carry an 18+ mark, never start by themselves, and ask once "Are you 18 or older?". After "No" they are hidden everywhere on that device. One switch in `config.js` (`ageGate`) turns the question off.
- **Uploading (owner's account):** eight short steps modelled on LANDR's release form; lyrics synced by tapping along; optional mastering; an ownership record with fingerprints; the song is live at once. `docs/UPLOAD-STUDIO.md` has every detail.
- **Velora Radio, one station for everyone:** the schedule is calculated from the clock (station time in `config.js`), so every listener hears the same song at the same moment. No skipping or seeking on the radio; after a pause it returns to the live moment. Each genre and mood also has its own personal station.
- **Ads, ready but off:** audio spots between songs and quiet banners. Nothing shows until `ads.enabled` is true and a spot is listed in `config.js`. Premium members never get ads.
- **Videos:** vertical shorts today; a section for wide (16:9) music videos is ready (add `clip` to a song).
- **Licensing (demo):** rent, buy (non-exclusive), exclusive on request, Premium. Two taps from hearing to paying. A demo certificate with a license ID that the Verify page can check, in the same browser only.

## Working on this site (Claude and Grok take turns)

1. Pull the newest branch before starting; one at a time.
2. Run `python3 tests/run.py` and `python3 tests/upload.py` before pushing.
3. After changing any script or style file, raise the `?v=` number on their lines in `index.html`, so phones don't keep an old copy. (The upload files take the same number from `app.js`.)
4. New or changed bundled media (songs, covers, videos): push them first, then set `mediaRev` in `config.js` to that commit's full ID (`git rev-parse HEAD`) and push again. A jsDelivr `@main` link can stay cached for hours.
5. A change to the database goes into `supabase/schema.sql` **and** is applied to the project as a migration; the two must say the same.
6. Log what changed on the Notion page, with the commit link for testing.
7. Rollback point from before 9 Nov: branch `before-claude-player`. GitHub keeps every version.
8. Never put Suno song IDs, secret keys, the setup code or personal data in this public repo. The publishable key in `config.js` is the only key that belongs here.

## Known limits (see `docs/ARCHITECTURE.md` and `docs/UPLOAD-STUDIO.md`)

- The repo is public and the bundled songs sit in it, so they can be downloaded. Uploaded songs sit in the server's storage, where files open by address; real protection needs private storage with signed links.
- Checkout, certificates and license checks are a browser-only demo. Real ones need a payment provider and a server.
- The server runs on a free plan: about 150 to 230 uploaded songs fit, and it pauses after a week without visits until it is resumed by hand.
- The lyrics of the bundled songs were written down from the recordings; some words may be wrong. Genres, moods and artist names of the bundled songs are proposals until Robert confirms them.
