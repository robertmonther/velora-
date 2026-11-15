# Velora (working name)

Robert Monther's song library: his songs as **full songs to listen to, like Spotify**, **one non-stop radio**, and
**licenses for creators, like Artlist** (rent a song, buy the rights, or Premium for the whole library), with **voice
control in English and Arabic** and the owner's **upload studio**. One code base runs as a website and as a phone app
(Android and iPhone).

**Status on 15 November 2026: round one is finished.** This branch, `main`, is the only working version. Next phase:
getting the phone app ready for Google Play and the App Store (order of work below). 25 of Robert's songs are bundled.

- **Real today:** listening, search, radio, lyrics, videos, sharing, voice, accounts for everyone, the upload studio
  (owner's account), the Android test app.
- **Built and switched off:** payments, license certificates and Premium (the shop stays closed until the business
  exists; the site shows a demo that charges nothing), ads.
- **Drafts:** the six legal pages, until a lawyer has read them.

## Where everything is (three copies)

| Place | What is there |
| --- | --- |
| **GitHub** (this repo) | The code, branch `main`. The branch `site` is an automatic ready-to-host copy made from `main` (never edit it). The pre-release "android-test" holds the newest Android test file and its emulator pictures. |
| **Google Drive**, folder "Velora" | The lifeline copy: a start-here document (features, status, how to restore), the code, the media (songs, covers, videos) and the Android test file. |
| **Notion**, page "Velora: song library site" (under "Music World") | The one page with the status, the features, Robert's decisions, the open questions and the newest test link. |

- Test the site: `https://raw.githack.com/robertmonther/velora-/<commit ID>/index.html` (a link with the commit ID
  always shows exactly that version; the Notion page has the newest one). Open it in Chrome itself for the microphone.
- Android test app (always the newest build): https://github.com/robertmonther/velora-/releases/download/android-test/velora-android-test.apk
  From build 5 on, a new build installs over the old one.

## What it does

**Listening**
- Full songs, never snippets. Tap a song and Now Playing opens in the cover's colours: synced lyrics (tap a line to
  jump there), the song's parts (intro, verse, chorus) as jump buttons, a "best part" button, the video in sync,
  credits, the artist, Rent and Buy, Up next and similar songs. Mini player, lock-screen controls, bottom tab bar.
- Home like Spotify: Today's pick (with "Rent €9" next to the play button), recommended for today, recents,
  stations, a row per genre and mood, videos.
- Search like Spotify: titles, artists, genres, moods, lyrics, "explicit", "video"; Browse tiles for every genre and mood.
- Share in one tap: a song card, or a lyrics card with the lines you pick, to WhatsApp, Stories or a contact.
- Explicit songs carry an "E" mark, like Spotify; one switch in Settings hides them on a device.

**Velora Radio**
- One non-stop station for everyone: the schedule comes from the station clock (Amsterdam), so every listener hears
  the same song at the same moment, like a radio in the car. Coming up, today's programme, back to live after a pause,
  no skipping. Every genre and mood also has its own station.

**Voice**
- Tap the microphone in the search field or in the player and say a song, part of a title, a line of the lyrics, a
  mood ("something romantic", "classy music"), an artist, or a command (pause, next, play the radio, louder, the
  chorus, lyrics, more like this), in English or Arabic. English titles are found even when the phone writes them in
  Arabic letters. When it is not sure it shows the closest songs to tap; it never plays a guess.
- It starts in the phone's own language (English or Arabic), offers the other one in one tap after a miss, and
  remembers the language that worked. Free: the browser's or the phone's own speech service hears it; nothing is
  recorded or kept. `docs/VOICE.md`.

**Licenses for creators (the money)**
- Rent a track: €9, 30 days, one channel. Buy usage rights: €49, lifetime, non-exclusive (exclusive on request).
  Premium: €14 a month, every song for the content published while a member, and what was published stays licensed.
  (Example prices, in `config.js`.)
- Two taps and one tick from hearing a song to paying. A dated certificate with a number, a public page where anyone
  can check a license number, licenses in the account, Premium cancelled from the account. The Premium tab leads the
  way Spotify's does: a wall of covers, one sentence, one white button, "Why join Premium?".
- Payment at the provider (Stripe Checkout), checked against Stripe's own test account. `docs/PAYMENTS.md`.

**Accounts**
- Sign up with an email confirmation (link or code), sign in, forgotten password, change name and password, delete
  the account. New accounts are listeners; only the owner uploads.

**Upload studio (the owner's account)**
- Eight short steps modelled on LANDR's release form: the song file, details, credits and what the AI made, lyrics
  synced by tapping along, the cover checked, optional mastering, rights, the artist profile and Publish. The song is
  live at once, with a dated ownership record (file fingerprints) that cannot be changed. `docs/UPLOAD-STUDIO.md`.

**Phone app**
- The same pages in a native shell for Android and iPhone (Capacitor 8), without the shop (store rules). Voice uses
  the phone's own speech service. Every Android test build is opened on Android 14 and 16 emulators on GitHub before
  it reaches a phone. `app/README.md`.

**Trust**
- English only on screen (Robert's rule for all his apps; the voice dictionary is the one file with Arabic).
- A strict content-security policy, no third-party scripts, every visitor's text escaped, a security review by hand
  (`docs/SECURITY.md`). The legal pages: terms of use, license terms, terms of sale, privacy, content rules, who we are
  (`docs/LEGAL.md`).
- Honest about AI: the music is made with Suno; lyrics and song design are Robert's. Uploads record what the AI made,
  and the song page shows it.

## What comes next (Robert's order of work, 14 November 2026)

1. Robert sends what is still missing or needs finishing.
2. The phone app ready for Google Play and the App Store. To settle first: the developer account (a company with a
   D-U-N-S number, or a personal Google Play account with a closed test of 12 testers for 14 days), and the store
   rules for the explicit songs. Store pictures (`app/store/pictures/`, remade on 15 November 2026) and draft store
   texts (`app/store/LISTING.md`) are ready to start from.
3. A presentation in English for users and funders: one visual deck and one video.
4. Publishing. Updates are made here first, then sent to the stores.
5. Funders.

Before other people may upload songs: a Report button on every song, hiding or removing a song from the owner's
side, blocking an uploader, and a takedown route for rights holders (both stores require this).
The website itself goes live by `docs/GO-LIVE.md` (hosting, the name and domain, then the shop once the business exists).

## What is in the box

| Path | What it is |
| --- | --- |
| `index.html` | The page shell: top bar with the menu and the Upload button, tab bar, mini player, Now Playing, windows |
| `styles.css` | All styles of the site (dark theme; pink is kept for what is chosen or playing) |
| `config.js` | **Settings**: media version and where media comes from, prices shown while the shop is closed, radio schedule, ads, voice, channels, accounts, business details, upload limits, the server's address and public key |
| `app.js` | The app: search, player, radio, pages, accounts, the license window and certificates, menu, router. No framework, no build step |
| `backend.js` | Accounts, server calls and the shop calls (Supabase). The account library loads only when someone signs in or uploads |
| `studio.js`, `studio-audio.js`, `encoder-worker.js`, `studio.css` | The upload pages and their sound tools. Loaded only when someone opens them |
| `legal.js` | The six legal pages (drafts), loaded when one is opened |
| `voice.js`, `data/voice-words.js` | Voice. The second file is the dictionary (the one site file with Arabic text) |
| `data/catalogue.js` / `.json` | The bundled songs: genres, moods, collections, artists, lyrics with times, song parts, covers |
| `data/taxonomy.js` | The genre, sub-genre, mood and language lists of the upload form |
| `media/` | Bundled songs (`audio/`), covers (`covers/`), artist pictures (`artists/`), vertical videos (`shorts/`) |
| `assets/` | Fonts (Inter, Playfair Display, served from the site) and app icons |
| `manifest.json` | Lets phones install the site as an app (name, icons, colours) |
| `supabase/schema.sql` | The whole database: accounts, artists, songs, ownership records, file storage rules, the shop, licenses, Premium. **Applied** to the project "velora" |
| `supabase/functions/` | `owner-setup` (the owner's one-time setup), `checkout` and `payment-webhook` (payments). All three are deployed |
| `vendor/` | Self-hosted, unchanged libraries: `supabase.js` (MIT), `lame.min.js` (lamejs, LGPL-3.0) |
| `app/` | The phone app: Android and iOS projects, icon, store pictures, draft store texts, the emulator check (`ci/look.py`) and the public test-signing key |
| `hosting/`, `scripts/build_site.py` | Server settings for our own hosting and the script that builds the folder to host |
| `.github/workflows/` | Free builds on GitHub for every push to `main`: the Android test file with its emulator pictures (`app.yml`) and the ready-to-host copy on the branch `site` (`site.yml`) |
| `tests/` | The checks (286 in all, below) and the stand-in servers they use |
| `docs/` | `GO-LIVE.md` (what is left for the website, in order), `ARCHITECTURE.md`, `UPLOAD-STUDIO.md`, `PAYMENTS.md`, `LEGAL.md` (the lawyer's questions), `SECURITY.md`, `VOICE.md`, `ADDING-SONGS.md`, `upload-flow/` (pictures of the upload) |

## Run it

```bash
python3 tests/server.py . 4173      # then open http://localhost:4173
python3 tests/run.py                # the site on a phone-size screen: 68 checks (needs playwright, pillow, Chrome)
python3 tests/upload.py             # the upload: 50 (also needs ffmpeg)
python3 tests/accounts.py           # accounts: 19
python3 tests/payments.py           # payments, with a stand-in payment page: 27
node --experimental-strip-types tests/payments_server.mjs   # the payment functions' own code: 32
python3 tests/app_mode.py           # the site inside the phone app, the Android shell: 11
node tests/voice.mjs                # voice: what the sentences mean, English and Arabic: 48
python3 tests/voice.py              # voice: the microphone in the page and in the app: 31
```

All lines must say PASS.

## Pages

`#/` Home · `#/search` Search · `#/genre/<id>` Genre, mood or collection · `#/song/<id>` Song page · `#/artist/<id>`
Artist page · `#/radio` Radio · `#/stream` Stream · `#/videos` Music videos and shorts · `#/pricing` Premium (the
three ways to use the music) · `#/verify` Verify a license · `#/upload` Upload a song · `#/my-songs` · `#/account` ·
`#/settings` · `#/legal/<page>`

## Working on it (Claude and Grok take turns)

1. One at a time. Pull `main` before starting; work on `main`; GitHub keeps every earlier version in its history.
2. Run the checks under "Run it" before pushing.
3. After changing a script or style file, raise the `?v=` number on their lines in `index.html`, so phones don't keep
   an old copy. For a new Android test build, raise the number in `app/BUILD`.
4. New or changed bundled media: push them first, then set `mediaRev` in `config.js` to that commit's full ID and push again.
5. A change to the database goes into `supabase/schema.sql` **and** is applied to the project as a migration.
6. When a round of changes is finished: update the Notion page and the Google Drive folder (Robert's rule: the
   newest version in all three places, nothing old beside it), and send Robert the new Android test file.
7. Never put Suno song IDs, secret keys, the setup code or personal data in this public repo. The publishable key in
   `config.js` is the only key that belongs here.

## Known limits

- The repo is public and the bundled songs sit in it, so they can be downloaded. Uploaded songs sit in the server's
  storage, where files open by address; real protection needs private storage with signed links.
- Payments are closed until a business is registered and the provider account is set up (`docs/PAYMENTS.md`). A
  license holder downloads the same MP3 that plays on the site; voice-tagged previews are not built.
- The legal pages are drafts until a lawyer has read them. The Strix security run has not happened yet.
- A browser listens in one language at a time, so voice needs one tap to change language (it then remembers).
- The server runs on a free plan: about 150 to 230 uploaded songs fit, and it pauses after a week without visits.
- The lyrics of the bundled songs were written down from the recordings; some words may be wrong. Genres, moods and
  artist names of the bundled songs are proposals until Robert confirms them.
