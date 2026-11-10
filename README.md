# Velora (working name)

Robert Monther's song library: full-song listening like Spotify, a non-stop radio, and licensing like Artlist (rent, buy, Premium). Lyrics and song design by Robert; music made with Suno (AI-assisted).

**Status (10 Nov 2026):** working prototype with Robert's 11 real songs. Listening, search, radio, lyrics and videos are real. **Prices, checkout, certificates and accounts are a demo**: nothing is charged and nothing personal is collected.

- Test link: `https://raw.githack.com/robertmonther/velora-/<commit ID>/index.html` (a link with the commit ID always shows exactly that version)
- Change log, decisions and open items: the Notion page "Velora: song library site"

## What is in the box

| Path | What it is |
| --- | --- |
| `index.html` | The page shell: top bar, tab bar, mini player, Now Playing, windows |
| `styles.css` | All styles (dark theme, the Italian broken colours: blue, red, pink) |
| `config.js` | **Settings**: media version, prices, radio schedule, ads, channels, accounts |
| `app.js` | The app: search, player, radio, pages, router. No framework, no build step |
| `account.js` | Accounts (email-link sign-in through Supabase). Off until configured |
| `data/catalogue.js` / `.json` | The songs: categories, lyrics with times, song parts, covers |
| `media/` | Songs (`audio/`), covers (`covers/`), vertical videos (`shorts/`) |
| `assets/` | Fonts (Inter, Playfair Display, served from the site) and app icons |
| `manifest.json` | Lets phones install the site as an app (name, icons, colours) |
| `supabase/schema.sql` | Database plan for accounts, Premium and licenses, with access rules. Not applied yet |
| `vendor/supabase.js` | Self-hosted copy of the Supabase library (loaded only when accounts are on) |
| `tests/run.py` | Automated walk-through on a phone-size screen (39 checks) |
| `docs/` | `ARCHITECTURE.md` (how it works, what is real, the road to the app stores), `ADDING-SONGS.md` |

## Run it

```bash
python3 tests/server.py . 4173      # then open http://localhost:4173
python3 tests/run.py                # all lines must say PASS (needs playwright and Chrome)
```

## Pages

`#/` Home · `#/search` Search (English and Arabic: titles, categories, moods, lyrics) · `#/genre/<id>` Category · `#/song/<id>` Song page · `#/radio` Radio · `#/videos` Music videos and shorts · `#/pricing` Pricing · `#/verify` Verify a license · `#/account` Account

## What it does

- **Listening like Spotify:** tap a song and its full screen opens in the cover's colours, with synced lyrics (tap a line to jump), song parts, video, license buttons and similar songs. Mini player, lock-screen controls, bottom tab bar on phones. No singer name: the category shows where Spotify shows the artist. Explicit songs carry an "E" badge.
- **Velora Radio, one station for everyone:** the schedule is calculated from the clock (station time in `config.js`), so every listener hears the same song at the same moment, with no server needed yet. No skipping or seeking on the radio; after a pause it returns to the live moment. Each category also has its own personal station.
- **Ads, ready but off:** audio spots between songs (radio and Spotify-style listening) and quiet banners (home, player). Nothing shows until `ads.enabled` is true and a spot is listed in `config.js`. Premium members never get ads.
- **Videos:** vertical shorts today; a section for wide (16:9) music videos is ready (add `clip` to a song).
- **Licensing (demo):** rent, buy (non-exclusive), exclusive on request, Premium. Two taps from hearing to paying. A demo certificate with a license ID that the Verify page can check, in the same browser only.
- **Accounts (off):** the Account page explains what is coming and collects nothing. The sign-in code and the database rules are written but not live or tested yet.

## Working on this site (Claude and Grok take turns)

1. Pull the newest `main` before starting; one at a time.
2. Run `python3 tests/run.py` before pushing.
3. After changing `app.js`, `styles.css`, `config.js`, `account.js` or `data/catalogue.js`, raise the `?v=` number on their lines in `index.html`, so phones don't keep an old copy.
4. New or changed media (songs, covers, videos): push them first, then set `mediaRev` in `config.js` to that commit's full ID (`git rev-parse HEAD`) and push again. A jsDelivr `@main` link can stay cached for hours.
5. Log what changed on the Notion page, with the commit link for testing.
6. Rollback point from before 9 Nov: branch `before-claude-player`. GitHub keeps every version.
7. Never put Suno song IDs, keys or personal data in this public repo.

## Known limits (see `docs/ARCHITECTURE.md`)

- The repo is public and the songs sit in it, so they can be downloaded. Real protection needs private storage with signed links.
- Checkout, certificates and license checks are a browser-only demo. Real ones need a payment provider and a server.
- The lyrics were written down from the recordings; some words may be wrong.
