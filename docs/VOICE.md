# Voice: ask for a song by voice

Status on 15 November 2026: **built, checked with stand-ins for the microphone, and tried by Robert with his own
voice in the Android test app the same day: it worked.** On the Android emulators the phone's own "allow the
microphone?" question and the listening state were seen too. Not tried yet: an iPhone, and the microphone on the
plain website link. Cost: nothing (no paid speech or AI service).

Tap a microphone and say what you want, in English or in Arabic (Lebanese first):

| You say | What happens |
| --- | --- |
| A song: "play The Skeleton Key", "skeleton key", a clear part of a title, or a line of its lyrics | That song plays and its screen opens |
| A mood or genre: "something romantic", "sad songs", "classy music", "workout music" | A row of songs of that mood plays |
| An artist: "songs by VOLUPTRA" | That artist's songs, shuffled |
| "Play the radio" | Velora Radio |
| "Anything", "surprise me", "play music" | All songs, shuffled |
| "Pause", "play", "next", "go back", "again" | The player does it |
| "Louder", "quieter", "the chorus", "show me the lyrics", "more like this", "what is this song" | The same, by voice |

The Arabic sentences for all of these are in `data/voice-words.js`. English titles inside an Arabic sentence work,
also when the phone writes the English title in Arabic letters (the site compares how the words sound).

When it is not sure, it does not guess: it shows the closest songs to tap, or moods to tap. A genre that has no
songs yet says so. A mood that has no songs yet plays its neighbours and says which ("No Sad songs yet. Playing
the closest: Melancholic, Tender, Slowed").

## Where the microphones are

- In the top search field (computer) and in the Search page's field.
- In the player (Now Playing), next to Share.
- A floating button, **off since the evening of 15 November 2026 (Robert)**: it covered the radio's list and the
  search tiles, and the search field and the player already have a microphone. `config.js` > `voice.place`: `"off"`
  none, `"fab"` a round button bottom right, `"pill"` a wide button bottom centre, `"top"` an icon in the top bar.
  A visitor can still switch it on for their own device in Settings > Voice. (That morning he had picked the round
  button "for now", after three pictures.)

The sheet has a language switch (English, Arabic), examples to tap, and a field to type the same sentence
(for a noisy place, or a browser that cannot listen). The sheet's own words are English only, like the rest of the site.
The music pauses while it listens, and comes back if the sheet is closed without a request.

## How it hears

- **On the web:** the browser's own speech service (the Web Speech API). Chrome, Edge, Safari and Samsung Internet
  have it; Firefox and the small browsers inside other apps (a link opened inside Instagram, for example) do not:
  there the sheet says so and offers typing. The speech service needs an internet connection.
- **Inside the phone app:** a web page inside an app has no speech service, so the app uses the phone's own through
  the plugin `@capgo/capacitor-speech-recognition` (`app/README.md`). The phone asks for the microphone once.
- One language per request: a browser's speech service, and the phone's, listen in one language at a time, so an
  Arabic sentence heard as English comes out as noise (Robert found this on 15 November 2026). So:
  - the first time, Velora starts with the first of English or Arabic in the phone's own list of languages
    (a phone set to Arabic starts in Arabic; any other phone in English);
  - the sheet says which language it is listening in ("Listening in English…") and has the switch at the top;
  - after a miss it offers the other language as one button ("Say it in Arabic"), which listens again at once;
  - the language of a request that worked is remembered on the device, so the next tap starts in it.
  Arabic hears English titles too (written in Arabic letters, found by sound). The codes asked for are in
  `config.js` > `voice.langs` (`en-US`, `ar-LB`); if a phone does not know one, the next is tried.
- One tap per request. A website cannot listen for a wake word.

## How it understands (`voice.js`, first half)

1. Spelling is evened out (capitals, accents, Arabic vowel marks and letter forms).
2. Polite words and "play ..." are taken off. A title said exactly wins over everything ("Play With Us" is a song).
3. A command? ("stop", "next", "the radio").
4. Moods and genres: every category of the catalogue answers to its own name and search words; `data/voice-words.js`
   adds everyday words in both languages and says which neighbours fill a thin mood.
5. Titles: exact, part of a title, small hearing mistakes, and by sound (also across the two scripts). Artists the same way.
6. A line of the lyrics, when exactly one song has it.
7. The phone often gives several guesses of what it heard; the one that makes the most sense is taken.

## Privacy

The browser or the phone turns the voice into text with its own speech service (Google's or Apple's, under that
company's terms). Velora gets only the text, uses it once, and keeps nothing; nothing is recorded or sent by the
site. The privacy page says so (`legal.js`). The server allows the microphone for the site's own pages only
(`hosting/.htaccess`, `vercel.json`: `Permissions-Policy`). For the stores, see `app/README.md` (privacy forms).

## Files

| File | What it is |
| --- | --- |
| `voice.js` | Understanding (plain text in, "what to do" out) and the microphone in the page |
| `data/voice-words.js` | The dictionary: commands, moods, small words, in English and Arabic; the sheet's texts. **The one site file with Arabic text** |
| `config.js` > `voice` | On or off, the floating button, the language codes, the owner's own words |
| `tests/voice.mjs` | 48 checks of the understanding, on the real catalogue, no browser |
| `tests/voice.py` | 31 checks in a phone-size browser, on a computer screen and inside the app, with stand-ins for the speech services |

## Adding words

- A new way to say a command, or a new word for a mood: add it to the right list in `data/voice-words.js`.
- A word of your own that plays chosen categories: `config.js` > `voice.words` (the example is in the file).
- "Classy music" is Claude's guess (the soft side of the library, no explicit lyrics): the `classy` entry in
  `data/voice-words.js`. Robert can say what it should play.
- After a change: `node tests/voice.mjs`, then raise the `?v=` number in `index.html`.

## Limits, and what is not built

- Not tried with a real voice yet. Speech services mishear; the lists of what is "close enough" may need tuning
  after the first real tests.
- Very short titles said in an Arabic sentence ("Used", "Tip") are offered to tap, not played at once.
- iPhone Safari only starts a song from a tap; the tap on the mic is used for that. Not tried on a real iPhone.
- The answer is shown, not spoken. A talking radio host is an idea for later.
- Not built: asking the car's or the phone's own assistant ("Hey Google, play ... on Velora") and smart speakers.
  Those need the store apps and each platform's own programme (Android media session and Android Auto, Siri and
  CarPlay, an Alexa skill, Cast). Noted on the Notion page as levels 2 and 3.
