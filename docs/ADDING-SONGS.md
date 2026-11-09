# Adding Robert's real songs

1. Convert each master to a web file: `ffmpeg -i song.wav -codec:a libmp3lame -q:a 5 media/audio/<file>.mp3`
2. Add an entry to `data/catalogue.json` and regenerate `data/catalogue.js` (`window.VELORA_DATA = {...};`).

Entry fields:
```json
{
  "id": "rm-0012",
  "title": "Song title",
  "genre": "Soft Sensual",         // main category: a name from "categories"
  "tags": ["Romantic"],            // optional extra categories
  "mood": "Dreamy",
  "bpm": 92,
  "duration": 214,                 // seconds
  "audio": "media/audio/song-12-title.mp3",
  "sections": [{"name":"Intro","start":0},{"name":"Verse","start":12},{"name":"Chorus","start":48}],
  "bestPart": 48,                  // seconds, used by "Jump to best part"
  "explicit": false,
  "published": "2026-11-08",       // provenance date shown on the song page
  "hue": 0,                        // cover colour: 0 blue, 1 red, 2 pink
  "lyrics": [[15.6, "First line"], [22.1, "Second line"]],   // [seconds, line]
  "lyricsNote": "Written down from the recording. Robert will check every word."
}
```
3. Sections can be estimated from loudness/energy changes or entered by hand from the Suno song structure tags.

Optional fields used by Robert's real songs and the Spotify-style player:
```json
{
  "real": true,                                   // Robert's real song (all songs now)
  "art": "media/covers/<id>-art.jpg",             // square cover
  "poster": "media/covers/<id>-poster.jpg",       // first frame of the video
  "video": "media/shorts/<id>.mp4",               // plays muted in Now Playing, following the audio
  "color": "#6b574d",                             // Now Playing background colour, taken from the cover
  "provenance": "Made with Suno, by @robertmonther"
}
```
4. After adding covers, run `python3 scripts/cover_colors.py --write` to fill in `color` and regenerate `data/catalogue.js`.
5. A new category: add it to `categories` in `data/catalogue.json` (id, name, Arabic name `ar`, colour, search words in English and Arabic). It appears on the site as soon as one song uses it.
6. Never put Suno song IDs in the public files; they stay in the private Notion song records.
7. After pushing the new files, set `MEDIA_REV` in `app.js` to that commit's full ID and push again (see README, "Working on this site").
