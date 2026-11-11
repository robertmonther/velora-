# Adding songs to the bundled catalogue

There are two ways a song gets on the site:

1. **The upload page** (Menu → Upload a song): for the owner's account. The song goes live at once. See `docs/UPLOAD-STUDIO.md`.
2. **The bundled catalogue** (`data/catalogue.json`): the songs that ship with the site itself. This page is about that file.

## Steps

1. Convert the master to a web file, without the tags inside the file (they can hold a Suno song ID):
   `ffmpeg -i song.wav -vn -map_metadata -1 -ac 2 -ar 44100 -c:a libmp3lame -q:a 5 -metadata title="Song title" media/audio/song-26-title.mp3`
2. Put a square cover in `media/covers/` (JPG, 900 px is enough for the site).
3. Add an entry to `data/catalogue.json`, then regenerate `data/catalogue.js`
   (`python3 scripts/cover_colors.py --write` does both: it fills in `color` and rewrites `catalogue.js`).
4. Push, then set `mediaRev` in `config.js` to that commit's full ID, raise the `?v=` numbers in `index.html`, and push again.

## A song entry

```json
{
  "id": "rm-0026",
  "title": "Song title",
  "genre": "Pop",                      // one musical genre: a name from "categories" with kind "genre"
  "subgenre": "Electropop",
  "tags": ["Sensual", "Slowed"],       // moods and collections: names from "categories"
  "mood": "Seductive",                 // one word shown next to the genre
  "language": "English",
  "explicit": false,                   // explicit lyrics: shows the E badge, like Spotify
  "adult": true,                       // sensual songs: adults only (the age gate). Explicit songs are always adult.
  "bpm": 92, "key": "Bb minor", "duration": 214,
  "audio": "media/audio/song-26-title.mp3",
  "art": "media/covers/song-26-art.jpg",
  "sections": [{"name": "Intro", "start": 0}, {"name": "Verse 1", "start": 12}, {"name": "Chorus", "start": 48}],
  "bestPart": 48,                      // seconds, used by "Jump to best part"
  "lyrics": [[15.6, "First line"], [22.1, "Second line"]],   // [seconds, line]; leave out when there are no lyrics yet
  "lyricsNote": "Written down from the recording; a few words may differ.",
  "created": "2026-06-16",             // the date the song was made, when known
  "published": "2026-11-11",           // the date it was added to the site
  "artist": "voluptra",                // optional: an id from "artists"
  "color": "#4b0c14"                   // filled in by scripts/cover_colors.py
}
```

Optional: `"video"` (vertical short, with `"poster"`), `"clip"` (wide music video, with `"clipPoster"`),
`"credits"` (a list of `{ "group", "name", "roles" }`; without it the standard credits are shown).

## Categories

`categories` in `data/catalogue.json` lists every genre, mood and collection (`kind`: `genre`, `mood` or `collection`),
with a colour and extra search words. A category appears on the site as soon as a song uses it:
in search with 1 song, under "Browse all" with 2, and as a shelf and a station on the home page with 3.
The same lists feed the upload form through `data/taxonomy.js`.

## Artists

`artists` lists the artist names: `{ "id", "name", "tagline", "bio", "image", "color" }`.
A song points to its artist with `"artist": "<id>"`. A song without an artist shows its genre under the title.

## Rules

- The site is in English only.
- Never put Suno song IDs in the public files; they stay in the private Notion song records.
- Genres, moods and artist links proposed by Claude are Robert's to change.
