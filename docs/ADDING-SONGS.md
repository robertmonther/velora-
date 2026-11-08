# Adding Robert's real songs

1. Convert each master to a web file: `ffmpeg -i song.wav -b:a 192k audio/<id>.mp3`
2. Add an entry to `data/catalogue.json` and regenerate `data/catalogue.js` (`window.VELORA_DATA = {...};`).

Entry fields:
```json
{
  "id": "vl-0001",
  "title": "Song title",
  "artist": "Robert Mo",
  "genre": "Soul",                 // one of the 10 genres
  "mood": "Warm",
  "bpm": 92,
  "duration": 214,                 // seconds
  "audio": "audio/vl-0001.mp3",
  "sections": [{"name":"Intro","start":0},{"name":"Verse","start":12},{"name":"Chorus","start":48}],
  "bestPart": 48,                  // seconds, used by "Jump to best part"
  "explicit": false,
  "published": "2026-11-08",       // provenance date shown on the song page
  "hue": 0,                        // cover colour: 0 blue, 1 red, 2 pink
  "lyrics": "..."
}
```
3. Sections can be estimated from loudness/energy changes or entered by hand from the Suno song structure tags.
