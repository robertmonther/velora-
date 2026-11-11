/* Velora settings. Everything a non-programmer may want to change lives here.
   After changing this file, raise the ?v= number on its line in index.html. */
window.VELORA_CONFIG = {
  /* Media (songs, covers, videos) is served from this GitHub repo through the jsDelivr CDN.
     mediaRev pins it to one commit, because an "@main" link can stay cached for hours.
     After pushing new or changed media, put that commit's full ID here (git rev-parse HEAD). */
  mediaRepo: "robertmonther/velora-",
  mediaRev: "782d21f7c4ec31fae8e351f8639d25903e9a243e",

  /* true while prices and checkout are examples: shows the preview banner and "(demo)" labels. */
  demo: true,

  /* EXAMPLE prices: Robert decides the real ones. */
  prices: {
    rent: { label: "Rent a track", price: "€9", per: "30 days, one channel" },
    buy:  { label: "Buy usage rights", price: "€49", per: "one-time, lifetime use" },
    excl: { label: "Exclusive rights", price: "On request", per: "negotiated" },
    sub:  { label: "Premium", price: "€14", per: "per month, whole library" }
  },

  /* Velora Radio: one station, the same for every listener. It follows the clock of stationTimeZone.
     Each slot plays songs from the listed categories (a genre, a mood or a collection from data/catalogue.json).
     adult: false leaves out adult (sensual) songs in that slot; explicit: false leaves out explicit lyrics.
     Hours run 2 to 26 (26 = 2 at night). */
  stationTimeZone: "Europe/Amsterdam",
  radio: [
    { from: 6,  to: 10, name: "Morning Light",  cats: ["Pop", "R&B / Soul"], adult: false },
    { from: 10, to: 14, name: "Rise Up",        cats: ["Arena Anthems", "Empowering"], adult: false },
    { from: 14, to: 18, name: "Afternoon Fire", cats: ["Arena Anthems", "Pop"], adult: false },
    { from: 18, to: 22, name: "Golden Evening", cats: ["Romantic", "Sensual"], explicit: false },
    { from: 22, to: 26, name: "After Dark",     cats: ["Sensual"] },
    { from: 2,  to: 6,  name: "Late Night",     cats: ["Sensual", "Slowed"] }
  ],

  /* Ads: OFF. Nothing is shown or played until enabled is true AND a spot or banner is listed.
     Premium members never get ads.
     - audio spots play between songs: after every radioEvery songs on the radio,
       and every streamEvery songs when listening Spotify-style.
       { id: "house-1", title: "Use this music in your videos", audio: "media/ads/house-1.mp3", link: "#/pricing" }
     - banners are quiet text or image cards. Slots: "home" (home page) and "player" (Now Playing).
       home: { text: "Follow the YouTube radio", link: "https://…" }   or   { image: "media/ads/x.jpg", alt: "…", link: "https://…" } */
  ads: {
    enabled: false,
    radioEvery: 3,
    streamEvery: 4,
    audio: [],
    banners: {}
  },

  /* Channels shown in the footer. Only the ones with a real https address appear. */
  channels: [
    { name: "Spotify", url: "" },
    { name: "Apple Music", url: "" },
    { name: "YouTube Radio", url: "" },
    { name: "Instagram", url: "" },
    { name: "TikTok", url: "" },
    { name: "X", url: "" }
  ],

  /* Adults only: sensual songs ("adult" in the catalogue, and every explicit song) ask the visitor's age
     the first time one is opened; until then they carry an "18+" mark and never start by themselves.
     false = no age question at all (explicit songs then only carry the E badge, like Spotify). */
  ageGate: true,

  /* Upload page (Menu → Upload a song). The numbers below are what the form checks.
     Cover: the same rule as LANDR (square, JPG or PNG, 1500 to 6000 px). coverMinOwn is the smallest cover
     the site itself accepts when the uploader chooses "use it on Velora anyway". */
  upload: {
    maxFileMB: 250,            /* biggest song file the browser will open */
    minSeconds: 30, maxSeconds: 1200,
    mp3Kbps: 192,              /* quality of the file that is stored and streamed */
    coverMin: 1500, coverMax: 6000, coverMinOwn: 600, coverStore: 1200,
    masterLufs: -14, masterPeakDb: -1,
    tapDelay: 0.18             /* seconds taken off each tap when syncing lyrics (people tap a little late) */
  },

  /* Accounts and uploads: a Supabase project. Put its address and its public (anon / publishable) key here.
     The public key is safe to publish; the database rules in supabase/schema.sql protect the data.
     Never put the service_role (secret) key in this file. Empty = accounts and uploads are off.
     Project "velora" (Frankfurt), free plan, created 11 Nov 2026. */
  supabase: { url: "https://jbnburfenipnpruhqyst.supabase.co", anonKey: "sb_publishable_vnOMaRS-CgPd3ccliksCfw_Yn_kfCN5" }
};
