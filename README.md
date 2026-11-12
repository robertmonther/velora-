# Velora (working name)

Robert Monther's song library: full-song listening like Spotify, a non-stop radio, licensing like Artlist (rent, buy, Premium), and **the place where songs are uploaded**: the questions of LANDR's release form, synced lyrics, mastering, a dated ownership record, live at once.

**Status (12 Nov 2026, branch `upload-studio`):** working prototype with 25 of Robert's songs bundled. Real: listening, search, radio, lyrics, videos, uploading (owner's account), accounts for everyone, the legal pages (drafts). **Built and switched off:** payments, license certificates and Premium (the shop is closed on the server; until it opens, the checkout is a demo that charges nothing). A phone app exists as a test project. Not launched: the site runs only on test links. What is left, in order: `docs/GO-LIVE.md`.

- Test link: `https://raw.githack.com/robertmonther/velora-/<commit ID>/index.html` (a link with the commit ID always shows exactly that version). On this shared test address you sign in again after a reload.
- Change log, decisions and open items: the Notion pages "Music World" and "Velora: song library site"

## What is in the box

| Path | What it is |
| --- | --- |
| `index.html` | The page shell: top bar with the menu and the Upload button, tab bar, mini player, Now Playing, windows |
| `styles.css` | All styles of the site (dark theme, the Italian broken colours: blue, red, pink) |
| `config.js` | **Settings**: media version and where media comes from, prices shown while the shop is closed, radio schedule, ads, channels, accounts, business details, upload limits, the server's address and public key |
| `app.js` | The app: search, player, radio, pages, accounts, the license window and certificates, menu, router. No framework, no build step |
| `backend.js` | Accounts, server calls and the shop calls (Supabase). The account library loads only when someone signs in or uploads |
| `studio.js`, `studio-audio.js`, `encoder-worker.js`, `studio.css` | The upload pages and their sound tools. Loaded only when someone opens them. See `docs/UPLOAD-STUDIO.md` |
| `legal.js` | The six legal pages (drafts), loaded when one is opened. See `docs/LEGAL.md` |
| `data/catalogue.js` / `.json` | The bundled songs: genres, moods, collections, artists, lyrics with times, song parts, covers |
| `data/taxonomy.js` | The genre, sub-genre, mood and language lists of the upload form |
| `media/` | Bundled songs (`audio/`), covers (`covers/`), artist pictures (`artists/`), vertical videos (`shorts/`) |
| `assets/` | Fonts (Inter, Playfair Display, served from the site) and app icons |
| `manifest.json` | Lets phones install the site as an app (name, icons, colours) |
| `supabase/schema.sql` | The whole database: accounts, artists, songs, ownership records, file storage rules, the shop, licenses, Premium. **Applied** to the project "velora" |
| `supabase/functions/` | `owner-setup` (the one-time setup of the owner's account), `checkout` and `payment-webhook` (payments; see `docs/PAYMENTS.md`). All three are deployed |
| `vendor/` | Self-hosted, unchanged libraries: `supabase.js` (MIT), `lame.min.js` (lamejs, LGPL-3.0) |
| `tests/run.py` | Automated walk-through of the site on a phone-size screen (66 checks) |
| `tests/upload.py`, `tests/accounts.py`, `tests/payments.py`, `tests/fake_backend.py` | The whole upload (50 checks), accounts (19) and payments (27), against a stand-in server and a stand-in payment page on this computer |
| `tests/payments_server.mjs`, `tests/app_mode.py` | The two payment functions' own code (32 checks, with the provider's real message shapes); the site as it runs inside the phone app (9 checks) |
| `app/` | The phone app: Android and iOS projects (Capacitor), icon, store pictures and draft store texts. See `app/README.md` |
| `hosting/`, `scripts/build_site.py` | The server settings for our own hosting and the script that builds the folder to host. See `docs/GO-LIVE.md` |
| `.github/workflows/` | Free builds on GitHub: the Android test file (`app.yml`) and the ready-to-host copy of the site on the branch `site` (`site.yml`) |
| `docs/` | `GO-LIVE.md` (what is left, in order), `ARCHITECTURE.md`, `UPLOAD-STUDIO.md`, `PAYMENTS.md`, `LEGAL.md`, `SECURITY.md`, `ADDING-SONGS.md`, `upload-flow/` (pictures) |

## Run it

```bash
python3 tests/server.py . 4173      # then open http://localhost:4173
python3 tests/run.py                # all lines must say PASS (needs playwright, pillow, Chrome)
python3 tests/upload.py             # the same for the upload (also needs ffmpeg)
python3 tests/accounts.py           # accounts
python3 tests/payments.py           # payments, with a stand-in payment page
node --experimental-strip-types tests/payments_server.mjs   # the payment functions
python3 tests/app_mode.py           # the site inside the phone app
```

## Pages

`#/` Home · `#/search` Search (titles, artists, genres, moods, "explicit", "video", lyrics) · `#/genre/<id>` Genre, mood or collection · `#/song/<id>` Song page · `#/artist/<id>` Artist page · `#/radio` Radio · `#/videos` Music videos and shorts · `#/pricing` Pricing · `#/verify` Verify a license · `#/upload` Upload a song · `#/studio` My songs · `#/settings` Settings · `#/account` Account

## What it does

- **Listening like Spotify:** tap a song and its full screen opens in the cover's colours, with synced lyrics (tap a line to jump), song parts, video, credits, the artist, license buttons and similar songs. Mini player, lock-screen controls, bottom tab bar on phones. Explicit songs carry an "E" badge.
- **English only.** Every word on screen is English (Robert's rule for all his apps).
- **Explicit songs like Spotify:** an "E" mark, no age question. One switch in Settings hides them on a device. (The age question is still in the code behind `ageGate` in `config.js`, switched off by Robert's decision.)
- **Accounts for everyone:** create an account, confirm by email (link or code), sign in, change name and password, forgotten password, delete the account. New accounts are listeners; only the owner uploads.
- **Uploading (owner's account):** eight short steps modelled on LANDR's release form; lyrics synced by tapping along; optional mastering; an ownership record with fingerprints; the song is live at once. `docs/UPLOAD-STUDIO.md` has every detail.
- **Velora Radio, one station for everyone:** the schedule is calculated from the clock (station time in `config.js`), so every listener hears the same song at the same moment. No skipping or seeking on the radio; after a pause it returns to the live moment. Each genre and mood also has its own personal station.
- **Ads, ready but off:** audio spots between songs and quiet banners. Nothing shows until `ads.enabled` is true and a spot is listed in `config.js`. Premium members never get ads.
- **Videos:** vertical shorts today; a section for wide (16:9) music videos is ready (add `clip` to a song).
- **Licensing:** rent, buy (non-exclusive), exclusive on request, Premium. Two taps and one tick from hearing to paying. Built for real (payment at the provider, certificate, public Verify page, licenses in the account, cancelling Premium) and switched off on the server; while the shop is closed the site shows a demo that charges nothing. `docs/PAYMENTS.md`.
- **Phone app:** the same pages in a native shell for Android and iPhone, without the shop. A test project, not in any store. `app/README.md`.

## Working on this site (Claude and Grok take turns)

1. Pull the newest branch before starting; one at a time.
2. Run the checks under "Run it" before pushing.
3. After changing any script or style file, raise the `?v=` number on their lines in `index.html`, so phones don't keep an old copy. (The upload files take the same number from `app.js`.)
4. New or changed bundled media (songs, covers, videos): push them first, then set `mediaRev` in `config.js` to that commit's full ID (`git rev-parse HEAD`) and push again. A jsDelivr `@main` link can stay cached for hours.
5. A change to the database goes into `supabase/schema.sql` **and** is applied to the project as a migration; the two must say the same.
6. Log what changed on the Notion page, with the commit link for testing.
7. Rollback point from before 9 Nov: branch `before-claude-player`. GitHub keeps every version.
8. Never put Suno song IDs, secret keys, the setup code or personal data in this public repo. The publishable key in `config.js` is the only key that belongs here.

## Known limits (see `docs/ARCHITECTURE.md` and `docs/UPLOAD-STUDIO.md`)

- The repo is public and the bundled songs sit in it, so they can be downloaded. Uploaded songs sit in the server's storage, where files open by address; real protection needs private storage with signed links.
- Payments are built but closed: opening them needs a registered business, a payment provider account and a few settings (`docs/PAYMENTS.md`). A license holder downloads the same MP3 that plays on the site; voice-tagged previews are not built.
- The legal pages are drafts until a lawyer has read them. The Strix security run has not happened yet (`docs/SECURITY.md`).
- The server runs on a free plan: about 150 to 230 uploaded songs fit, and it pauses after a week without visits until it is resumed by hand.
- The lyrics of the bundled songs were written down from the recordings; some words may be wrong. Genres, moods and artist names of the bundled songs are proposals until Robert confirms them.
