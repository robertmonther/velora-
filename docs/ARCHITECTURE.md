# Velora: how it works

For a programmer, an investor or another AI reading the project for the first time.

## 1. Shape

A static site: plain HTML, CSS and JavaScript, no framework, no build step, no server. Three scripts load in order: `config.js` (settings), `data/catalogue.js` (songs), `account.js` (optional accounts), `app.js` (everything else). Addresses are hash routes (`#/song/rm-0006`), so any static host works.

Media (songs, covers, videos) loads from the GitHub repo through the jsDelivr CDN, pinned to one commit (`mediaRev`), and from the local folder on localhost.

## 2. What is real and what is a demo

| Part | Today |
| --- | --- |
| Catalogue, search, player, lyrics, videos | Real |
| Radio | Real schedule, calculated in the browser from the clock. Every listener gets the same song at the same moment. It is not one audio stream from a server, so two phones can differ by a second or two |
| Prices, checkout, certificates, Verify page | Demo. Nothing is charged; a "license" is a record in the visitor's own browser |
| Accounts, Premium | Off. Code and database rules are written, not live, not tested against a real project |
| Ads | Off. The code path is tested with a fake spot (`tests/run.py`) |
| Download protection | Weak. No download button and the save menu is blocked, but the files are public |

## 3. Data model (`data/catalogue.json`)

`categories`: id, name, Arabic name, colour, search words. A song has one main category (`genre`), optional extra ones (`tags`), a mood, duration, BPM, key, `sections` (song parts with start seconds), `bestPart`, `lyrics` as `[seconds, line]`, `art`, optional `video` (vertical) and `clip` (wide), `explicit`, `created`.

`catalogue.js` is the same data wrapped as `window.VELORA_DATA=…` so the site also opens from a file. Today it is 31 KB for 11 songs. At 1,000 songs the lyrics should move to one small file per song, loaded when a song opens; lists already show 50 songs at a time.

## 4. Radio

`config.js` lists time slots (station time zone, default Europe/Amsterdam) and the categories each slot plays. For a slot, the songs are put in an order that depends only on the date and the slot (a seeded shuffle), repeated to fill the slot. "What is on air now" is then just arithmetic on the clock: `radioTimeline()` in `app.js`. On the radio there is no skipping and no seeking; after a pause of 20 seconds or more the player returns to the live moment.

Later, for one true stream that also feeds YouTube and car apps: a small server (for example Liquidsoap with Icecast) plays the same schedule and the site plays its stream address.

## 5. Ads

`config.js → ads`. Audio spots play after every N songs that end by themselves (never on a manual skip), with the controls locked until the spot ends; banners are text or image cards in two slots (`home`, `player`). `adsOn()` is false for Premium members. Links may only be `https://` or pages of the site. An ad image from another host must be added to the Content-Security-Policy in `index.html`.

## 6. Security and privacy

- **Content-Security-Policy** in `index.html`: scripts only from the site itself (no inline scripts, no third-party scripts); images and media only from the site and jsDelivr; connections only to the site and Supabase.
- **No HTML from data:** every title, id, lyric line and address parameter passes through `esc()`; colours and links are checked; cover paths are encoded. `tests/run.py` loads a hostile song and hostile addresses and checks that nothing runs.
- **No tracking, no cookies, no personal data.** The browser remembers recently played songs and demo licenses on the device (`localStorage`, keys starting with `velora_`); the Account page has a button that clears them.
- **Accounts (planned):** sign-in by email link, no passwords. The browser only ever holds the public key. `supabase/schema.sql` turns on row-level security on every table: a person can read only their own rows; Premium status and licenses can be written only by the server (payment webhook), never from the browser. The public license check returns only what a certificate shows.
- **Limits of a static site:** a static host cannot send security headers such as HSTS or frame-ancestors; set them at the real host. Anything shown in the browser can be copied; the Premium flag in the browser only hides ads. Real rights (clean files, licenses) must be enforced on the server.
- Before launch: a Strix security test (Robert's rule), and `noindex` comes off.

## 7. What a real launch still needs

1. **Hosting decision:** a stable address (own domain) on a static host; songs in private storage with short-lived signed links.
2. **Payments:** a provider that allows the explicit songs; a webhook that writes licenses and Premium into the database; VAT and business registration (see the Notion plan).
3. **Accounts on:** create the Supabase project, apply `schema.sql`, set the address and public key in `config.js`, add the site address to Supabase's allowed redirect list, then test sign-in, sign-out and the rules.
4. **Legal pages:** license terms, terms of sale, privacy, business details; the IP-lawyer questions in Notion.
5. **Robert checks the lyrics** or supplies his own text.

## 8. Road to Google Play and the App Store

The site is already installable from the browser (manifest and icons). For the stores:

- **Google Play:** wrap the hosted site as a Trusted Web Activity (Bubblewrap) or with Capacitor. Needs a stable https domain, a Play developer account (one-time fee), a privacy policy and a content rating. A service worker for offline start is a small addition once the domain is fixed.
- **App Store:** Capacitor (a native shell around the same code), an Apple developer account (yearly fee) and a Mac to build. Apple reviews web-wrapper apps strictly: it expects app-like features (background audio, lock-screen controls, CarPlay audio later) and its own in-app purchase for digital subscriptions.
- **Both stores restrict sexual content.** The explicit songs and covers need an age rating, and may have to be hidden in the store builds and stay on the website. To check against the store rules before building.
- **Cars:** phones already play the site through Bluetooth. Showing up on the car screen (Android Auto, CarPlay) needs the native apps.
