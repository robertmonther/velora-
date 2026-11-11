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
| Age gate for sensual and explicit songs | Real, remembered on the device. It is a question, not an identity check |
| Uploading (owner's account), synced lyrics, mastering, ownership records | Real. Details in `UPLOAD-STUDIO.md` |
| Radio | Real schedule, calculated in the browser from the clock. Every listener gets the same song at the same moment. It is not one audio stream from a server, so two phones can differ by a second or two |
| Prices, checkout, certificates, Verify page | Demo. Nothing is charged; a "license" is a record in the visitor's own browser |
| Accounts for listeners, Premium | Not open. Only the owner's account exists; the tables for paid things are in the database, unused |
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
- **No tracking, no cookies, no personal data.** The browser remembers recently played songs and demo licenses on the device (`localStorage`, keys starting with `velora_`); the Account page has a button that clears them.
- **Accounts:** only the owner's account exists, with email and password (12 characters or more). It is created once on the site with a setup code; the server keeps only that code's fingerprint. The browser only ever holds the public key. `supabase/schema.sql` turns on row-level security on every table: a person can read only their own rows, and nothing is written from the browser directly; every change goes through a server function that checks who is asking. Uploaded files can be added only to the uploader's own folder, only as MP3 or JPEG, and cannot be replaced once the song is published. On a shared test address (githack) the sign-in is kept in memory only.
- **Ownership records** cannot be updated or deleted, and each carries the fingerprint of the one before it.
- **Age gate:** one answer per device, kept in the browser. Adult songs never start by themselves before the answer.
- **Limits of a static site:** a static host cannot send security headers such as HSTS or frame-ancestors; set them at the real host. Anything shown in the browser can be copied; the Premium flag in the browser only hides ads. Real rights (clean files, licenses) must be enforced on the server.
- Before launch: a Strix security test (Robert's rule), and `noindex` comes off.

## 7. What a real launch still needs

1. **Hosting decision:** a stable address (own domain) on a static host; songs in private storage with short-lived signed links.
2. **Payments:** a provider that allows the explicit songs; a webhook that writes licenses and Premium into the database; VAT and business registration (see the Notion plan).
3. **Server for real use:** the free plan pauses after a week without visits and holds about 150 to 230 songs; decide on a paid plan or other storage before the full catalogue goes in (see `UPLOAD-STUDIO.md`, section 7). Switch off open sign-up until creator accounts are wanted.
4. **Legal pages:** license terms, terms of sale, privacy, business details; the IP-lawyer questions in Notion.
5. **Robert checks the lyrics** or supplies his own text.

## 8. Road to Google Play and the App Store

The site is already installable from the browser (manifest and icons). For the stores:

- **Google Play:** wrap the hosted site as a Trusted Web Activity (Bubblewrap) or with Capacitor. Needs a stable https domain, a Play developer account (one-time fee), a privacy policy and a content rating. A service worker for offline start is a small addition once the domain is fixed.
- **App Store:** Capacitor (a native shell around the same code), an Apple developer account (yearly fee) and a Mac to build. Apple reviews web-wrapper apps strictly: it expects app-like features (background audio, lock-screen controls, CarPlay audio later) and its own in-app purchase for digital subscriptions.
- **Both stores restrict sexual content.** The explicit songs and covers need an age rating, and may have to be hidden in the store builds and stay on the website. To check against the store rules before building.
- **Cars:** phones already play the site through Bluetooth. Showing up on the car screen (Android Auto, CarPlay) needs the native apps.
