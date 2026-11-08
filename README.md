# Velora (working name)

Robert's full-song music library website: Artlist-style library, a Suno-style full-song player with section map, a homepage radio, three ways to pay (rent, buy usage rights, Premium), dated license certificates, and a YouTube Shorts section.

**Status:** working prototype. Songs, prices, channel links and videos are **example data**. Checkout is a demo and charges nothing.

**Live preview:** https://velora-preview-robertmonther.vercel.app (Vercel project `velora-preview`)

## How it is built

A plain static site with no build step and no framework, so anyone can open and edit it:

| File | What it does |
|---|---|
| `index.html` | Page shell: top bar, footer, fixed bottom player, license modal |
| `styles.css` | Design system (Italian aged palette, rounded corners, dark Spotify/Artlist look) |
| `app.js` | All logic: hash router, views, player, radio, checkout demo, certificates, verify |
| `data/catalogue.js` | The song catalogue (`window.VELORA_DATA`) the site reads |
| `data/catalogue.json` | Same catalogue as JSON, for tools and imports |
| `audio/` | Placeholder demo audio (demo-1..6.mp3, included); real songs go here |
| `scripts/` | Generators for the example catalogue and the placeholder demo audio |

### Pages (hash routes)
- `#/` Home: hero, Velora Radio card with today's schedule and mood tuning, genres, new songs, Shorts, pricing tiers
- `#/library` Library with genre and mood filters, search, pagination (20 per page)
- `#/song/<id>` Song page: facts, Play, Rent and Buy buttons, song map with section start/end times, provenance record with date, lyrics
- `#/radio` Radio schedule
- `#/videos` YouTube Shorts grid (placeholders)
- `#/pricing` Three tiers and exclusivity FAQ
- `#/verify?id=VL-...` Verify a license ID (demo: stored in the browser's localStorage)

### Key behaviours
- **Player:** full songs; waveform; clickable section markers (Intro, Verse, Chorus...) showing where each part starts and ends; "Jump to best part"; keyboard arrows seek 5 s.
- **Radio:** one station across genres. Time slots in `RADIO` in `app.js` (06-10 Morning Warmth, 10-14 Daylight Focus, 14-18 Afternoon Energy, 18-22 Golden Evening, 22-02 After Dark, 02-06 Late Night 18+). Mood chips override the slot.
- **Listen to pay in two clicks:** "License" on any card or the player opens the modal with Rent preselected; "Pay (demo)" issues the certificate.
- **Exclusivity rule (Robert's decision):** buying usage rights is non-exclusive and the song stays in the catalogue; it is removed for new buyers only if the buyer asks (Exclusive, on request).
- **Certificates:** license ID, song, type, issue date/time, song creation date, SHA-256 fingerprint.
- **Out of scope by Robert's request:** no cartoon radio host, no podcast elements.

### Prices
Example only, in `PRICES` at the top of `app.js`. Robert sets the real ones.

## Run locally
```bash
bash scripts/generate-demo-audio.sh   # creates audio/demo-1..6.mp3 (needs ffmpeg)
python3 -m http.server 4173           # open http://localhost:4173
```

## Deploy
Static files only. On Vercel: framework "Other", no build command, output = repo root.

## Adding real songs
See `docs/ADDING-SONGS.md`.

## Not done yet (needs Robert)
- Real songs, covers, lyrics, prices, channel links and YouTube Shorts
- Real payments (Stripe or similar) and real accounts/database (Supabase is connected but unused)
- Final name and domain

Full technical specification: `docs/Velora-Technical-Spec.pdf` is kept outside the repo; ask for it or see the chat.

## Robert's real songs (added 8 Nov 2026)

The first five catalogue entries (`real: true`, ids `rm-0001`…`rm-0005`) are Robert's real songs:
Off the Clock, The Skeleton Key, Those Billions, Count to Three, If We Burn.

- Files live in `media/audio/` (MP3), `media/covers/` (`*-art.jpg` cover, `*-poster.jpg` video poster) and `media/shorts/` (vertical MP4 videos).
- They appear first in the home page, the library (genre "Robert's Originals"), Velora Radio (played in order first, then mixed with the rotation) and the Shorts/Videos section (click to watch).
- BPM, key, mood and section times are automatic estimates (`sectionsEstimated: true`). Edit them in `data/catalogue.json`, then regenerate `data/catalogue.js` (it is `window.VELORA_DATA=` + the same JSON).
- **Hosting:** on localhost, media loads from the local folder. On the hosted site, `app.js` loads audio, covers and videos from this GitHub repo through the jsDelivr CDN (`https://cdn.jsdelivr.net/gh/robertmonther/velora-@main/`), so the Vercel deployment only needs `index.html`, `styles.css`, `app.js`, `data/catalogue.js` and `vercel.json`. Change `MEDIA_BASE` in `app.js` if media moves elsewhere (it requires the repo to stay public).
