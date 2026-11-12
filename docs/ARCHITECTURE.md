# Velora: how it works

For a programmer, an investor or another AI reading the project for the first time.

## 1. Shape

A static site: plain HTML, CSS and JavaScript, no framework, no build step. Four scripts load in order: `config.js` (settings), `data/catalogue.js` (the bundled songs), `backend.js` (server calls, tiny until someone signs in), `app.js` (everything else). The upload pages (`studio.js`, `studio-audio.js`, `studio.css`, `data/taxonomy.js`) and the account library load only when someone opens them. Addresses are hash routes (`#/song/rm-0006`), so any static host works.

Bundled media (songs, covers, videos) loads from the GitHub repo through the jsDelivr CDN, pinned to one commit (`mediaRev`), and from the local folder on localhost.

Since 11 Nov 2026 there is also a server: a Supabase project (database, sign-in, file storage) that holds the songs uploaded through the site. The site asks it once per visit for the published songs and adds them to the bundled ones. If the server can't be reached, the site works from the bundled catalogue alone.

## 2. What is real and what is a demo

| Part | Today |
| --- | --- |
| Catalogue, search, player, lyrics, videos, artists, credits | Real |
| Explicit songs | Real: an "E" mark and a switch in Settings that hides them on the device. The age question is in the code, switched off (`ageGate`) |
| Uploading (owner's account), synced lyrics, mastering, ownership records | Real. Details in `UPLOAD-STUDIO.md` |
| Radio | Real schedule, calculated in the browser from the clock. Every listener gets the same song at the same moment. It is not one audio stream from a server, so two phones can differ by a second or two |
| Prices, checkout, certificates, Verify page | Built for real and switched off: the shop is closed on the server and no payment key exists. Until it opens, the site shows a demo that charges nothing. `PAYMENTS.md` |
| Accounts for listeners | Real: sign-up with email confirmation, password reset, account deletion. Public sign-up emails need our own email sender first (`GO-LIVE.md`) |
| Premium | Built with the payments, switched off with them |
| Phone app | A test project for Android and iPhone (`app/`), without the shop. Not in any store |
| Ads | Off. The code path is tested with a fake spot (`tests/run.py`) |
| Download protection | Weak. No download button and the save menu is blocked, but the files open by address |

## 3. Data model

**Bundled songs** (`data/catalogue.json`): `categories` (every genre, mood and collection, with `kind`), `artists` (id, name, tagline, bio, image), and `songs`. A song has one musical `genre` and a `subgenre`, `tags` (its moods and collections), a main `mood`, `language`, `explicit`, `adult`, an `artist` id, duration, `sections` (song parts with start seconds), `bestPart`, `lyrics` as `[seconds, line]`, `art`, optional `video` (vertical) and `clip` (wide), `created`.

`catalogue.js` is the same data wrapped as `window.VELORA_DATA=…` so the site also opens from a file. At 1,000 songs the lyrics should move to one small file per song, loaded when a song opens; lists already show 50 songs at a time.

**Uploaded songs** live in the server's `songs` table and arrive in the same shape, with a few more fields: `credits`, `ai` (what the AI made), `release` (label, publisher, ISRC, owner lines), `holder` and `record` (the ownership record). `app.js → cleanRemoteSong()` takes over plain data only and accepts media only from the site's own storage.

A category shows in search when one song has it, on the browse page with two, and gets a home shelf, a station and a pill with three.

## 4. Radio

`config.js` lists time slots (station time zone, default Europe/Amsterdam) and the categories each slot plays. For a slot, the songs are put in an order that depends only on the date and the slot (a seeded shuffle), repeated to fill the slot. "What is on air now" is then just arithmetic on the clock: `radioTimeline()` in `app.js`. On the radio there is no skipping and no seeking; after a pause of 20 seconds or more the player returns to the live moment.

Later, for one true stream that also feeds YouTube and car apps: a small server (for example Liquidsoap with Icecast) plays the same schedule and the site plays its stream address.

## 5. Ads

`config.js → ads`. Audio spots play after every N songs that end by themselves (never on a manual skip), with the controls locked until the spot ends; banners are text or image cards in two slots (`home`, `player`). `adsOn()` is false for Premium members. Links may only be `https://` or pages of the site. An ad image from another host must be added to the Content-Security-Policy in `index.html`.

## 6. Security and privacy

- **Content-Security-Policy** in `index.html`: scripts only from the site itself (no inline scripts, no third-party scripts); images and media only from the site and jsDelivr; connections only to the site and Supabase.
- **No HTML from data:** every title, id, lyric line and address parameter passes through `esc()`; colours and links are checked; cover paths are encoded. `tests/run.py` loads a hostile song and hostile addresses and checks that nothing runs.
- **No tracking, no cookies.** The browser remembers recently played songs, settings, demo licenses and the numbers of licenses bought on the device (`localStorage`, keys starting with `velora_`); Settings has a button that clears them. Personal data exists only with an account or a purchase (`legal.js`, privacy page).
- **Accounts:** email and password (10 characters or more on the site). The owner's account is created once with a setup code; the server keeps only that code's fingerprint. Everyone else gets a listener account. The browser only ever holds the public key. `supabase/schema.sql` turns on row-level security on every table: a person can read only their own rows, and nothing is written from the browser directly; every change goes through a function that checks who is calling. Money and rights (licenses, Premium) are written only with the server's own key, after the payment provider's signed message.
- **Ownership records** cannot be updated or deleted, and each carries the fingerprint of the one before it.
- **Explicit songs:** no age question (Robert's decision). The code for one is kept behind `ageGate`.
- **Headers:** a page cannot send HSTS or "nobody may frame this site" for itself. `hosting/.htaccess` (our own hosting) and `vercel.json` send them; the githack test link does not have them. Anything shown in the browser can be copied; real rights are enforced on the server.
- The security review of 12 Nov 2026 and what is still open: `SECURITY.md`. Before launch: the Strix run (Robert's rule), and `robots.txt` lets search engines in.

## 7. What a real launch still needs

The full list, in order, is `GO-LIVE.md`. In short:

1. **The move to our own hosting:** the ready-to-host copy of the site is on the branch `site`; Hostinger takes it from there. Then the site's address and our own email sender are set in the Supabase dashboard.
2. **Payments:** built and closed. Opening needs a registered business, the provider account, its answer on explicit songs, and VAT (`PAYMENTS.md`).
3. **Server for real use:** the free plan pauses after a week without visits and holds about 150 to 230 songs; decide on a paid plan or other storage before the full catalogue goes in (`UPLOAD-STUDIO.md`, section 7).
4. **Legal pages** out of draft: one session with an IP lawyer (`LEGAL.md`).
5. **Security:** the Strix run (`SECURITY.md`).
6. **Robert checks the lyrics** or supplies his own text.

## 8. The phone app and the stores

`app/` holds a Capacitor 8 project for Android and iOS: the same pages in a native shell, built without the songs (they load from the web). Inside the app there is no shop, the phone's share sheet is used, and the page keeps clear of the status bar. GitHub builds an Android test file on every change in `app/` and checks that the iOS project builds. Details, and everything a store release still needs (developer accounts, signing, a real-phone test, the 12-tester rule on Google Play, age rating, background play on Android), are in `app/README.md`.

- **Both stores restrict sexual content.** The explicit songs and covers need an honest age rating, and some covers may have to stay on the website. To check against the store rules before a release.
- **Apple may see a wrapped website** (guideline 4.2). Native value such as background play and lock-screen controls helps; no promise can be made.
- **Cars:** phones already play the site through Bluetooth. Showing up on the car screen (Android Auto, CarPlay) needs more native work.
