# Velora (working name)

Robert's full-song music library website: Artlist-style library, a Suno-style full-song player with section map, a homepage radio, three ways to pay (rent, buy usage rights, Premium), dated license certificates, and a YouTube Shorts section.

**Status:** working prototype with Robert's 11 real songs only (the example songs were removed on 9 Nov 2026). Prices and channel links are **example data**. Checkout is a demo and charges nothing.

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
| `media/` | Robert's songs: `audio/` (web MP3s), `covers/` (square covers, video posters), `shorts/` (vertical videos) |
| `scripts/cover_colors.py` | Takes each song's colour from its cover for the player background |

### Pages (hash routes)
- `#/` Home, laid out like Spotify: category pills, Today's pick, Recommended for today, Recommended Stations (one per category), Recents, More like…, one row per category, videos, Velora Radio, pricing
- `#/search` Search (also `#/library`): "Browse all" category tiles and every song; typing searches titles, categories, moods and lyrics in English **and Arabic** (حسي، رومانسي، ترند، ثوري…)
- `#/genre/<id>` Category page: play, shuffle, the category's radio, numbered song list
- `#/song/<id>` Song page: facts, Play, Rent and Buy buttons, lyrics (tap a line to play from there), song map with section start/end times, provenance record with date
- `#/radio` Radio schedule and stations
- `#/videos` The song videos
- `#/pricing` Three tiers and exclusivity FAQ
- `#/verify?id=VL-...` Verify a license ID (demo: stored in the browser's localStorage)

### Key behaviours
- **Player (Spotify-style, added 9 Nov 2026):** see the section below.
- **Radio:** one station that follows the time of day. Slots in `RADIO` in `app.js` (06-10 Morning Light, 10-14 Rise Up, 14-18 Afternoon Fire, 18-22 Golden Evening, 22-02 After Dark, 02-06 Late Night), each playing songs from listed categories. Every category also has its own station.
- **Listen to pay in two clicks:** "License" on any card or the player opens the modal with Rent preselected; "Pay (demo)" issues the certificate.
- **Exclusivity rule (Robert's decision):** buying usage rights is non-exclusive and the song stays in the catalogue; it is removed for new buyers only if the buyer asks (Exclusive, on request).
- **Certificates:** license ID, song, type, issue date/time, song creation date, SHA-256 fingerprint.
- **Out of scope by Robert's request:** no cartoon radio host, no podcast elements.

### Prices
Example only, in `PRICES` at the top of `app.js`. Robert sets the real ones.

## Spotify-style player (added 9 Nov 2026 by Claude)

- **Phones:** a compact top bar (logo and a search icon) and a bottom tab bar like Spotify: Home, Search, Stream, Radio, Premium. Videos and Verify a license are in the footer.
- **Mini player:** hidden until a song plays, then a slim bar above the tab bar (cover, title, License, play/pause, thin progress line). Tap it to open Now Playing. On desktop it is a bottom bar with previous/play/next, a progress bar with the song's section marks, Jump to best part and License.
- **Now Playing (full screen):** the background takes its colour from the song's cover (the `color` field, or sampled from the cover in the browser). Big cover, title, License button, progress bar with section marks, shuffle/previous/play/next/best part, section chips (tap to jump), then cards: synced lyrics (the line being sung lights up, tap a line to jump there, Show all for the full text), the song's video (plays muted and follows the audio, so the song never plays twice), Rent/Buy, About the song, Up next and More like this. Tap the down arrow, press Escape or use the phone's back button to close it.
- **Stream** (tab and top-bar link) opens Now Playing; if nothing is playing it starts Robert's songs. `#/stream` does the same.
- **Autoplay:** when a list ends, similar songs keep playing.
- **Lock screen:** title, "Velora · category", cover and controls show on the phone's lock screen (Media Session API).
- **No singer name:** where Spotify shows the artist, Velora shows the song's category. Robert appears only as the rights holder (certificates, credits).
- **Downloads made harder:** no download button anywhere; the save menu is blocked on covers and videos; videos hide their download option. Real protection needs the media moved out of this public repo (open item on the Notion page).
- Icons are SVG (no emoji). Browser storage is wrapped in try/catch so the demo never breaks when storage is blocked.

## Working on this site (Claude and Grok take turns)

1. Before you start, pull the latest `main`.
2. When you finish, add a dated line to the Change log on the Notion page "Velora: song library site" saying what you changed.
3. Every version stays in GitHub. The branch `before-claude-player` keeps the site exactly as it was before the 9 Nov player work, so going back is one step.
4. The Vercel preview is deployed from the CLI, not from GitHub: after pushing, redeploy it so the preview link shows the new version.
5. New or changed media (songs, covers, videos): push them first, then set `MEDIA_REV` at the top of `app.js` to that commit's full ID (`git rev-parse HEAD`) and push again. A jsDelivr `@main` link can stay cached for hours, so without this new covers or songs don't show.
6. After changing `app.js`, `styles.css` or `data/catalogue.js`, raise the `?v=` number on their lines in `index.html`, so phones don't keep an old copy.
7. To test a version for sure, use the link with the commit ID: `https://raw.githack.com/robertmonther/velora-/<commit ID>/index.html` (the `main` link can show an older version for a while).

## Run locally
```bash
python3 -m http.server 4173           # open http://localhost:4173
```

## Deploy
Static files only. On Vercel: framework "Other", no build command, output = repo root.

## Adding real songs
See `docs/ADDING-SONGS.md`.

## Not done yet (needs Robert)
- The rest of Robert's 1,000+ songs, his checked lyrics, prices, channel links and YouTube Shorts
- Real payments (Stripe or similar) and real accounts/database (Supabase is connected but unused)
- Final name and domain

Full technical specification: `docs/Velora-Technical-Spec.pdf` is kept outside the repo; ask for it or see the chat.

## Robert's real songs (added 8 Nov 2026)

The first five catalogue entries (`real: true`, ids `rm-0001`…`rm-0005`) are Robert's real songs:
Off the Clock, The Skeleton Key, Those Billions, Count to Three, If We Burn.

- Files live in `media/audio/` (MP3), `media/covers/` (`*-art.jpg` cover, `*-poster.jpg` video poster) and `media/shorts/` (vertical MP4 videos).
- They appear first in the home page, the library (genre "Robert's Originals"), Velora Radio (played in order first, then mixed with the rotation) and the Shorts/Videos section (click to watch).
- BPM, key, mood and section times are automatic estimates (`sectionsEstimated: true`). Edit them in `data/catalogue.json`, then regenerate `data/catalogue.js` (it is `window.VELORA_DATA=` + the same JSON).
- **Hosting:** on localhost, media loads from the local folder. On the hosted site, `app.js` loads audio, covers and videos from this GitHub repo through the jsDelivr CDN (`https://cdn.jsdelivr.net/gh/robertmonther/velora-@<MEDIA_REV>/`, pinned to a commit), so the Vercel deployment only needs `index.html`, `styles.css`, `app.js`, `data/catalogue.js` and `vercel.json`. Change `MEDIA_BASE` in `app.js` if media moves elsewhere (it requires the repo to stay public).

### Six more songs (added 9 Nov 2026 by Claude)

`rm-0006` to `rm-0011`: BAREFOOT, Live Footage of Me Ruining This, USED, Your Eyes Still Own Me, Obey Me, She's Better.

- Converted from Robert's Suno WAV files to web MP3s (about 120 kbps) with title, artist and copyright inside each file. The WAVs stay with Robert as the clean files for buyers.
- Categories: Soft Sensual (BAREFOOT, Obey Me); Pop (Live Footage of Me Ruining This, a new category); Explicit Sensual, 18+ (USED, Your Eyes Still Own Me, She's Better).
- Section names follow the lyrics; their times, the BPM and the key are automatic estimates. `created` holds the Suno creation date read from each file.
- No covers yet: the player shows the title on a coloured card until the Suno covers are added.
- **Explicit songs:** an "E" badge next to the artist (like Spotify) and "Explicit lyrics" in the song facts. No age question: they play like every other song (Robert's decision, 9 Nov 2026).

### Real songs only, categories, lyrics and covers (9 Nov 2026, Claude)

- **Example songs removed:** the 60 example songs (`vl-…`, "Robert Mo"), their test-tone audio and the two generator scripts are gone. Only Robert's 11 songs remain.
- **Categories** live in `data/catalogue.json` → `categories` (name, Arabic name, colour, search words). A song has one main category (`genre`) and optional extra ones (`tags`, e.g. `["Romantic"]`). Only categories with songs are shown. Now: Soft Sensual (حسي ناعم), Explicit Sensual (حسي صريح), Romantic (رومانسي), Pop (بوب), Trend (Arena) (ترند · أرينا: Robert's genre of songs in the Hunger Games style, the first five songs).
- **Lyrics:** `lyrics` is a list of `[seconds, "line"]`, written down from each recording and timed to the audio. Robert still has to check the words (`lyricsNote` says so on the site). Song parts (`sections`) now follow the lyrics for all 11 songs.
- **Covers:** the six new songs got designed covers (`media/covers/song-06-art.jpg` … `song-11-art.jpg`), drawn as SVG and saved as JPEG; free, no AI credits used. Replace them any time with Robert's own covers and run `scripts/cover_colors.py --write`.
