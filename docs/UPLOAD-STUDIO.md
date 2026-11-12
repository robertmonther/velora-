# Upload studio: how songs get onto Velora

Written 11 Nov 2026. For Robert, for a programmer, or for another AI picking up the project.

**In one paragraph.** A signed-in uploader (today only Robert, the owner) opens **Upload**, answers the same questions LANDR's release form asks, syncs the lyrics by tapping along with the song, picks a cover, optionally masters the sound, confirms the rights, checks the artist profile and presses **Publish**. The song is live for every visitor at once, and the server writes a dated ownership record that cannot be changed later. All sound work (loudness, mastering, MP3) happens in the browser; the server only stores and checks.

**Status.** Phase 1 (the owner's account) is built and tested. Phase 2 (accounts for other creators, paying per song) is designed for and not built: see section 8.

---

## 1. Where it is in the site

- **Menu (☰) → Upload a song**, and the **Upload** button in the top bar. Both open `#/upload`.
- **Menu → My songs** (`#/studio`): the uploaded songs, each with its ownership record and a switch to take it off the public list or put it back.
- Files: `studio.js` (the pages), `studio-audio.js` (sound tools), `encoder-worker.js` (MP3 in the background), `studio.css`, `backend.js` (server calls). They load only when someone opens the upload pages; listeners never download them.

## 2. The eight steps

| # | Step | What it asks | Checks |
| --- | --- | --- | --- |
| 1 | Song file | WAV, MP3, FLAC or M4A | 30 s to 20 min, up to 250 MB. Shows length, loudness (LUFS) and peak. Reads title, lyrics and date from the file's own tags when they are there |
| 2 | Song details | Title, version (Slowed, Remix, …), artist name, featured artists, genre and sub-genre (dropdowns), up to 3 moods, language, clean or explicit, "for adults", release date, the day it was made | Title, artist, genre, one mood, language and release date are required. A sensual mood or explicit lyrics switch "for adults" on and lock it |
| 3 | Credits and AI | Lyrics by, music by, produced by, extra credits (role + name); **was AI used**, what it made (music, voice, lyrics, cover) and which tool. Folded away and optional: label, publisher, composition owner (©) and year, recording owner (℗) and year, ISRC | Lyricist and producer required. ISRC must have the right form |
| 4 | Lyrics | A lyrics box, or "no lyrics". Then **sync**: play the song and tap as each line starts | `[Chorus]`, `[Verse 2]` and the like become parts of the song map; other notes in brackets are left out. Lyrics must be synced, or "skip for now" ticked on purpose |
| 5 | Cover | JPG or PNG | LANDR's rule: a perfect square, 1500 × 1500 to 6000 × 6000 pixels. Not square: one button crops the middle. Smaller than 1500 (down to 600): allowed for Velora only, after pressing "Use it on Velora anyway" |
| 6 | Mastering | "Master it" (Warm, Balanced or Open) or "Keep my sound"; before/after listening at the same spot; the "best part" marker | – |
| 7 | Rights | "Is this a cover?" (covers are not accepted); three ticks: I own the rights; nothing is taken from others; keep a dated record | All three ticks, and not a cover |
| 8 | Artist and publish | The artist profile (photo, tagline, about) and a summary of the song | Publish runs: master → MP3 → send the song → send the cover → save the artist → publish and write the record |

What you fill in stays while the page is open; nothing is sent before Publish. The next upload starts with the same artist, genre, moods and credits as the last one.

## 3. LANDR's form, question by question

Read on 11 Nov 2026 from LANDR's help centre (support.landr.com, articles 115009567567, 115009562127, 115009568447, 31619635245591, 23716156904983 and 115009736668), blog.landr.com/music-metadata and landr.com/pricing/release.

| LANDR asks | On Velora |
| --- | --- |
| Audio file (WAV, FLAC or AIFF; 16-bit / 44.1 kHz or better) | Step 1. MP3 and M4A are accepted too, with a note that stores want WAV |
| Track title, version | Step 2 |
| Primary artist, featured artists | Step 2 |
| Genre, subgenre | Step 2 (dropdowns) |
| Lyrics language, explicit content | Step 2 |
| Release date | Step 2 |
| Composer, lyricist (legal names), producers, additional contributors | Step 3 |
| AI disclosure | Step 3 |
| Label name, publisher, ISRC | Step 3, folded block |
| Composition owner + year, master recording owner + year | Step 3, folded block (the © and ℗ lines) |
| Lyrics | Step 4 (LANDR sends synced lyrics through a paid partner; Velora syncs them itself) |
| Cover art: 1:1, 1500–6000 px, JPG or PNG, no web addresses, social handles or logos | Step 5: size and shape are checked by the page; the content rules are shown as text (a person must judge them) |
| Cover-song question | Step 7 |
| Proof of rights | Step 7: a confirmation, recorded with date and fingerprints |
| Release type (single, EP, album) | Not asked: Velora publishes single songs. Stored as `type: "single"` |

Two things could not be copied one to one, and are marked **To check**:
- **LANDR's exact genre list** sits behind its login. Velora's dropdown is the standard list the stores use (`data/taxonomy.js`, 26 genres with sub-genres). With a screenshot of LANDR's dropdown it can be matched word for word.
- **LANDR's rules for AI music** on that date: disclosure at upload, at most 12 AI-generated songs per calendar month, and several services not accepting them. They explain the idea behind this page; re-check before quoting them in public.

## 4. What happens in the browser

`studio-audio.js`, no server involved:

1. **Open the file**: decoded to 44.1 kHz stereo. Its tags are read (ID3 in MP3, INFO and ID3 in WAV). A comment that carries a private ID from the music tool is thrown away and never stored.
2. **Loudness**: a meter built to the ITU-R BS.1770 standard (the "LUFS" that Spotify and YouTube use). Checked against ffmpeg's meter in the tests: same value within 0.4.
3. **Mastering** (optional): a 25 Hz low cut, a gentle tone curve for the chosen style, the loudness set to −14 LUFS, and a limiter that lets no sample pass −1 dB. For a song that is already loud this mostly turns it down to the common level.
4. **MP3**: 192 kbps, made in a background worker by lamejs. A 3-minute song gives a file of about 4 MB.
5. **Fingerprints** (SHA-256) of the original file, the MP3, the cover and the lyrics.
6. **Cover**: cropped to the middle square, stored as a 1200 × 1200 JPEG; its main colour tints the player.

Measured on the test machine with a 3-minute WAV of 30 MB: about 1 second to open and measure, under 1 second to master, about 9 seconds for the MP3. A phone will take longer; the page says so.

**Not stored: the original file.** Only the 192 kbps MP3 goes to the server, plus the fingerprint of the original. Keep the WAV. (Storing originals is a storage-cost decision for later; see section 7.)

## 5. The server

A Supabase project named **velora** (region eu-central-1, free plan). `supabase/schema.sql` is the whole database in one file; `supabase/functions/owner-setup/` is the one small server function.

- **Tables**: `profiles` (role: listener, creator or owner), `artists`, `songs`, `ownership_records`, plus `entitlements` and `licenses` for the paid side later.
- **Nothing is written from the browser directly.** Every change goes through a checked server function: `reserve_song`, `save_artist`, `publish_song`, `set_song_listed`. Each checks who is asking and that the uploader owns what they touch.
- **Visitors** can only call `public_catalogue` (published songs), `song_record` (a song's public record) and `verify_license`.
- **Files**: one bucket, `media`. Anyone can open a file by its address; nobody can list the files. An uploader can add files only inside their own folder, only MP3 and JPEG, 50 MB at most. Files are named after their own fingerprint, and the site never replaces one: a second try with the same file just finds it in place. The server also refuses to replace the sound or cover file of a published song, and there is no way to delete files from the site.
- **Ownership records**: one row per event (published, taken off the list, put back). The server sets the time. Each row carries a fingerprint of itself and of the row before it, so changing or removing an old row would break the chain; the database also refuses updates and deletes on that table. The public record shows the fingerprints and never the name of the uploaded file.

  The record's fingerprint is the SHA-256 of: `previous fingerprint | song ID | owner ID | kind | time (UTC, to the millisecond) | title | artist | rights holder | details`.

- **Keys**: the site carries only the *publishable* key (public by design, in `config.js`). Secret keys exist only inside Supabase. Never put one in this repo.

### The one-time owner setup

The first account is made on the site itself: **Upload → "First time here? Set up the owner account"**: name, email, a password of 12 characters or more, and the **setup code**. The code was given to Robert in the chat on 11 Nov 2026; the server holds only its fingerprint, it works once, and ten wrong tries lock it. After that the door is closed for good: every later account starts as a listener.

Recommended once the owner account exists: in the Supabase dashboard, switch off "Allow new users to sign up" until creator accounts open.

## 6. What a visitor sees of an uploaded song

- It appears in search, on its genre and mood pages, in stations and on the radio, like the bundled songs, the moment it is published.
- The lyrics light up line by line; tapping a line jumps there. The song map shows the parts.
- **Credits** show who wrote, who produced, what the AI made and with which tool, and the release details.
- The song page shows the **ownership record** (number, date, rights holder); "Show the full record" opens the fingerprints.
- A song marked for adults (sensual or explicit) sits behind the age question, like every other adult song.

## 7. Limits and costs (checked 11 Nov 2026)

| | Free plan | What it means here |
| --- | --- | --- |
| File storage | 1 GB | About 150 to 230 songs (4 to 6 MB each with the cover) |
| Traffic | 5 GB a month | About 1,000 full plays of uploaded songs a month |
| Largest file | 50 MB | Far above a 20-minute MP3 at 192 kbps |
| Database | 500 MB | Not a limit for years |
| Projects | 2 active | "velora" is the second in Robert's organisation |
| **Pausing** | After 1 week without activity | Supabase pauses the project, with a warning email first. Uploaded songs then stop playing until "Resume project" is pressed in the dashboard; the bundled songs keep playing. Visits to the site count as activity |

Source: supabase.com/pricing and Supabase's guide "Project Pausing".

For 1,000 or more songs, or for real traffic, the choice is the Pro plan (from $25 a month: 100 GB storage, 250 GB traffic, no pausing) or cheaper file storage next to the same database. **A Money Map decision, not taken yet.**

Other honest limits:
- The confirmation of rights is the uploader's own statement. Nothing checks it. The record is evidence of what was uploaded and when; it is not a copyright registration and not legal advice.
- The AI answer is also the uploader's own statement.
- The upload pages were tested in desktop Chrome at phone size, against a stand-in server on the test machine, and the real server was tested from inside its own database. The first upload from a real phone to the real server is Robert's.
- A very long WAV on an old phone can run out of memory (the whole song is held in memory while it is processed).
- Songs taken off the list keep their files and their records; removing files for good is done in the Supabase dashboard.

## 8. Phase 2: every AI-music creator (designed for, not built)

The vision (Robert, 11 Nov 2026): one page where any AI-music creator uploads a song, answers the questions, pays once (around $1 to $2) and gets mastering, a permanent listing, an ownership record, synced lyrics and optional priority placement, live at once.

What is already in place for it:
- **Roles**: every account has one. `can_upload()` is true for `creator` and `owner`. Opening creator accounts is a switch of role, not a rebuild.
- **Everything belongs to an account**: songs, artists, records and files carry their owner. Each uploader's files sit in their own folder.
- **`priority`** on a song (default 0) is already used to order the public list: paid priority placement only has to set it.
- **`entitlements`** and **`licenses`** tables exist for what an account has paid for.

What phase 2 still needs, in order:
1. A payment provider that accepts AI music and the adult songs, and a server hook that marks a song as paid (the per-song fee).
2. Sign-up for creators (email confirmation, a real email sender), and terms they accept.
3. Review before a creator's song goes public: at least for adult content, covers and rights complaints (a `review` status between draft and published).
4. A way to report a song and to take it down.
5. Storage that is paid for (see section 7).
6. The owner's dashboard: creators, songs waiting, income.

**To check before any public claim** (questions for an IP lawyer, see the Notion page): the comparative ad naming DistroKid, LANDR, Spotify and MusixMatch; the word "distribute" (Velora publishes on Velora; it does not send songs to Spotify or other stores); what the platform is responsible for when other people upload (EU Digital Services Act, takedowns); the EU rules on labelling AI-generated audio.

## 9. Tests

```bash
python3 tests/upload.py      # 50 checks: the whole upload on a phone-size screen, against tests/fake_backend.py
python3 tests/run.py         # 66 checks: the rest of the site
```

`tests/fake_backend.py` plays the server on this computer with the same functions and rules, so the tests never touch the real project. `tests/upload.py` keeps a screenshot of every step in `tests/shots/upload/`.

What only the real server can prove was checked against it directly on 11 Nov 2026 (owner setup with a wrong and the right code, sign-in, every server function, uploads into the own folder and refused ones, publishing, the public list, taking a song off the list, the record chain, the refusal to change records, files fixed after publishing), and the project was left empty.

## 10. Open-source parts

- **lamejs 1.2.1** (`vendor/lame.min.js`, unchanged), the MP3 encoder, licence LGPL-3.0. It is a JavaScript version of the LAME encoder: https://lame.sourceforge.io
- **supabase-js 2.119.0** (`vendor/supabase.js`, unchanged), licence MIT.

Both are named in the site under Settings → About.
