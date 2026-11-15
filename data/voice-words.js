/* Velora voice: the words the microphone understands, in English and in Arabic (Lebanese first).

   This is the one file of the site that holds Arabic text. The site itself stays in English (Robert's rule);
   these are the words people SAY to the microphone, and a few example sentences to say.

   How to add a word: put it in the right list, the way people say or write it. Capital letters, accents,
   Arabic vowel marks and the different forms of alef, ya and ta marbuta do not matter (voice.js evens them out).
   A phrase of two or three words is fine. Nothing else needs changing; raise the ?v= number in index.html after. */
(function (root) {
  const WORDS = {

    /* 1. Said to be polite or to get attention. Taken out wherever they stand. */
    polite: {
      en: ["hey velora", "ok velora", "okay velora", "hi velora", "velora", "please", "pls", "can you", "could you", "would you", "will you",
        "i want you to", "i need you to", "for me", "for us", "right now", "now", "thank you", "thanks", "okay", "ok", "hey", "alright", "um", "uh"],
      ar: ["يا فيلورا", "فيلورا", "لو سمحت", "لو سمحتي", "إذا بتريد", "إذا بتريدي", "إذا سمحت", "بليز", "من فضلك", "عمول معروف", "الله يخليك",
        "بدي ياك", "بدي منك", "ممكن", "فيك", "فيكي", "بتقدر", "هلق", "هلأ", "هلا", "الآن", "هسا", "دلوقتي", "طيب", "اوكي", "اوك", "يلا", "يا",
        "لي", "لنا", "إلي", "إلنا", "ياها", "ياه", "بس"]
    },

    /* 2. "Play ..." in its many forms. Only taken off the START of what was said. */
    verbs: {
      en: ["i want to listen to", "i would like to listen to", "i would like to hear", "i want to hear", "i wanna listen to", "i wanna hear",
        "i d like to hear", "id like to hear", "let me listen to", "let me hear", "lets hear", "let s hear", "start playing", "listen to",
        "put on", "turn on", "switch on", "throw on", "queue up", "search for", "look for", "look up", "find me", "give me", "play me", "play us",
        "play", "put", "start", "find", "search", "open", "queue", "spin", "i need", "i want", "we want", "hear"],
      ar: ["بدي اسمع", "بدنا نسمع", "بحب اسمع", "حابب اسمع", "حابة اسمع", "عايز اسمع", "عاوز اسمع", "عايزة اسمع", "ابي اسمع", "ابغى اسمع",
        "اريد ان اسمع", "اريد سماع", "خليني اسمع", "خلينا نسمع", "دورلي على", "دور على", "فتشلي على", "فتش على", "ابحث عن",
        "شغللي", "شغل لي", "شغلي", "شغلنا", "شغل", "تشغللي", "تشغلي", "تشغل", "حطلي", "حط لي", "حطيلي", "حطلنا", "حطي", "حط", "تحطلي", "تحط",
        "سمعني", "سمعيني", "سمعنا", "اسمعني", "تسمعني", "هاتلي", "هات", "جبلي", "جيبلي", "جيب", "دورلي", "دور", "ابحث", "افتحلي", "افتح",
        "عطيني", "اعطيني", "ضعلي", "ضع", "لعب", "العب", "بدي", "بدنا", "اريد", "عايز", "عاوز", "ابي", "ابغى"]
    },

    /* 3. Small words around a request ("a song", "some music"). Ignored when looking for a mood. */
    filler: {
      en: ["song", "songs", "music", "track", "tracks", "tune", "tunes", "the", "a", "an", "some", "something", "me", "us", "my", "called", "named",
        "titled", "kind", "sort", "type", "of", "style", "vibes", "vibe", "mood", "feeling", "feel", "stuff", "one", "ones", "that", "is", "it",
        "this", "to", "in", "for", "with", "by", "bit", "little", "really", "very", "so", "more", "like", "just", "and", "or", "i", "am", "im"],
      ar: ["شي", "شيء", "اشي", "حاجة", "غنية", "الغنية", "أغنية", "الأغنية", "أغاني", "الأغاني", "غناني", "الغناني", "أغنيات", "موسيقى", "الموسيقى",
        "موسيقة", "مزيكا", "ميوزك", "ميوزيك", "تراك", "التراك", "لحن", "ألحان", "نغمة", "هالغنية", "هيدي", "هاي", "هيدا", "هذا", "هذه", "هاد",
        "يلي", "اللي", "تبع", "تاع", "بتاع", "اسمها", "اسمو", "اسمه", "عنوانها", "نوع", "ستايل", "جو", "أجواء", "مود", "مزاج", "مزاجي", "شوية",
        "شوي", "كتير", "كثير", "جدا", "عن", "على", "عل", "من", "مع", "في", "ب", "ل", "و", "أو", "أنا", "حاسس", "حاسة", "حالي", "هيك", "متل",
        "زي", "واحدة", "وحدة", "واحد"]
    },

    /* 4. Words that say "I mean a kind of music, not a title". */
    moodHint: {
      en: ["music", "songs", "something", "mood", "vibes", "vibe", "stuff", "tunes", "tracks", "playlist", "mix"],
      ar: ["شي", "موسيقى", "أغاني", "غناني", "جو", "أجواء", "مود", "مزاج", "ستايل", "نوع"]
    },

    /* 5. "Romantic radio", "a sad playlist": these words only say "a row of songs". */
    station: {
      en: ["radio", "station", "mix", "playlist", "channel"],
      ar: ["راديو", "محطة", "إذاعة", "قناة", "ميكس", "بلايليست"]
    },

    /* 6. What a command may point at ("stop THE SONG", "skip THIS ONE"). */
    objects: {
      en: ["the", "this", "that", "it", "song", "track", "one"],
      ar: ["الغنية", "الأغنية", "هالغنية", "التراك", "هيدي", "هاي", "هيدا"]
    },

    /* 6b. Words that announce a line of the lyrics ("the one that goes ..."). What follows is looked up in the lyrics. */
    lyricLead: {
      en: ["the song that goes", "the one that goes", "the song that says", "the one that says", "the song with the words", "the song with the lyrics",
        "the song with the line", "the song that starts with", "that goes", "that says", "with the words", "with the lyrics", "that song about"],
      ar: ["الغنية يلي بتقول", "الغنية اللي بتقول", "الأغنية يلي بتقول", "الأغنية اللي بتقول", "يلي بتقول", "اللي بتقول", "يلي فيها", "اللي فيها",
        "اللي كلماتها", "يلي كلماتها", "بتقول"]
    },

    /* 7. Commands: what is said -> what happens. The whole sentence must be one of these (after 1, 2 and 6). */
    commands: {
      pause: {
        en: ["pause", "stop", "stop playing", "stop the music", "pause the music", "stop the radio", "pause the radio", "hold on", "wait",
          "quiet", "be quiet", "silence", "shut up", "mute", "enough", "that s enough", "thats enough"],
        ar: ["وقف", "وقفها", "وقفلي", "وقفو", "وقفي", "اوقف", "اوقفها", "توقف", "إيقاف", "إيقاف مؤقت", "وقف الموسيقى", "وقف الراديو", "سكت",
          "سكتها", "اسكت", "سكوت", "طفي", "طفيها", "اطفي", "اطفيها", "خلص", "خلاص", "بيكفي", "بس", "بس خلص", "ستوب", "بوز", "استنى"]
      },
      play: {
        en: ["resume", "continue", "keep playing", "keep going", "go on", "carry on", "unpause", "unmute", "go ahead", "play on"],
        ar: ["كمل", "كملي", "كملها", "كفي", "كفيها", "تابع", "تابعي", "استمر", "اكمل", "رجع شغل", "رجع شغلها", "رجع حطها", "شغلها", "حطها",
          "بلاي", "ريزيوم", "استئناف"]
      },
      next: {
        en: ["next", "next song", "next track", "next one", "skip", "skip song", "skip track", "another one", "another song", "different song",
          "a different one", "something else", "change it", "change the song", "change song", "change", "forward"],
        ar: ["التالي", "التالية", "اللي بعدها", "اللي بعدو", "يلي بعدها", "يلي بعدو", "بعدها", "بعدو", "اللي بعد", "غير", "غيرها", "غيرلي",
          "غير الغنية", "وحدة تانية", "وحدة غيرها", "غنية تانية", "غنية غيرها", "شي تاني", "شي غيرها", "تاني", "التاني", "نكست", "سكيب",
          "فوتها", "اقلب", "اقلبها", "قلب", "قلبها", "عدي", "عديها", "الأغنية التالية", "الغنية التالية", "التراك التالي"]
      },
      prev: {
        en: ["previous", "previous song", "previous track", "previous one", "back", "go back", "back one", "last song", "last one",
          "the one before", "the song before", "before"],
        ar: ["السابق", "السابقة", "اللي قبلها", "اللي قبلو", "يلي قبلها", "يلي قبلو", "قبلها", "قبلو", "اللي قبل", "رجع", "رجعلي", "ارجع", "رجوع",
          "لورا", "ورا", "الغنية السابقة", "الأغنية السابقة", "رجع اللي قبلها", "رجعلي اللي قبلها", "بريفيوس", "باك"]
      },
      restart: {
        en: ["again", "play it again", "play again", "replay", "replay it", "restart", "restart it", "start over", "from the beginning",
          "from the start", "from the top", "repeat", "repeat it", "repeat this", "repeat that", "one more time", "once more"],
        ar: ["عيد", "عيدها", "عيدلي", "عيدي", "أعد", "أعدها", "من الأول", "من البداية", "من أولها", "رجعها من الأول", "كمان مرة", "مرة تانية",
          "مرة ثانية", "ريبيت", "كرر", "كررها"]
      },
      radio: {
        en: ["radio", "the radio", "velora radio", "live radio", "the live radio", "live", "go live", "on air", "the station"],
        ar: ["الراديو", "راديو", "الإذاعة", "إذاعة", "البث", "البث المباشر", "المباشر", "لايف", "راديو فيلورا", "على الهوا"]
      },
      stream: {
        en: ["anything", "something", "whatever", "surprise me", "shuffle", "shuffle all", "shuffle everything", "shuffle songs", "random",
          "random song", "something random", "something good", "something nice", "something new", "anything good", "all songs", "everything", "your choice",
          "you choose", "you pick", "i don t care", "i dont care", "music", "some music"],
        ar: ["أي شي", "أي شيء", "أي حاجة", "أي غنية", "أي أغنية", "شي حلو", "شي حلوة", "غنية حلوة", "على ذوقك", "عذوقك", "فاجئني", "فاجأني",
          "عشوائي", "شفل", "خلط", "كل الأغاني", "كل الغناني", "اللي بدك", "شو ما كان", "متل ما بدك", "شي جديد", "نقي انت", "نقيلي", "اختار انت",
          "اختارلي"]
      },
      what: {
        en: ["what is this", "what s this", "whats this", "what is this song", "what s this song", "whats this song", "what song is this",
          "which song is this", "what s playing", "whats playing", "what is playing", "what am i listening to", "what are we listening to",
          "who is this", "who s this", "who sings this", "who is singing", "who s singing", "name of this song", "what s the name of this song",
          "what is it called", "what s it called", "song name", "what track is this"],
        ar: ["شو هاي", "شو هيدي", "شو هالغنية", "شو هي", "شو اسمها", "شو اسم الغنية", "شو اسم هالغنية", "شو عم يشتغل", "شو عم بسمع", "مين عم يغني",
          "مين بيغني", "مين المغني", "مين الفنان", "ما اسم الأغنية", "ما هذه الأغنية", "اسم الغنية", "اسم الأغنية", "ايه الأغنية دي", "ايش الأغنية"]
      },
      louder: {
        en: ["louder", "volume up", "turn it up", "turn up", "turn up the volume", "raise the volume", "increase the volume", "crank it up",
          "make it louder", "up"],
        ar: ["علي", "عليها", "علي الصوت", "عليلي الصوت", "أعلى", "ارفع", "ارفع الصوت", "ارفعها", "زيد الصوت", "صوت أعلى", "قوي الصوت", "قويها"]
      },
      quieter: {
        en: ["quieter", "volume down", "turn it down", "turn down", "turn down the volume", "lower the volume", "decrease the volume", "softer",
          "lower", "make it quieter", "down", "too loud"],
        ar: ["وطي", "وطيها", "وطي الصوت", "وطيلي الصوت", "أوطى", "اخفض", "اخفض الصوت", "نزل الصوت", "نزلها", "خفف الصوت", "خففها", "صوت أوطى",
          "هدي الصوت"]
      },
      best: {
        en: ["best part", "the best part", "jump to the best part", "skip to the best part", "go to the best part", "the chorus", "chorus",
          "the hook", "hook", "skip to the chorus", "go to the chorus", "the good part", "skip to the good part", "the drop"],
        ar: ["أحلى مقطع", "أحلى شي", "المقطع الحلو", "أحلى جزء", "اللازمة", "الكورس", "الهوك", "روح عالكورس", "جيب الكورس"]
      },
      lyrics: {
        en: ["lyrics", "the lyrics", "show lyrics", "show the lyrics", "show me the lyrics", "open the player", "open player", "show the song",
          "full screen"],
        ar: ["الكلمات", "كلمات الغنية", "كلمات الأغنية", "فرجيني الكلمات", "ورجيني الكلمات", "افتح المشغل", "افتح الغنية", "كبرها"]
      },
      similar: {
        en: ["more like this", "more like that", "similar", "similar songs", "something similar", "something like this", "songs like this",
          "like this", "like this one", "more of this", "more of the same", "same vibe", "same mood", "same style", "keep this vibe"],
        ar: ["متلها", "متل هيدي", "شي متلها", "شي متل هيدي", "زيها", "زي هاي", "شبهها", "شي شبهها", "مشابه", "أغاني مشابهة", "من نفس النوع",
          "نفس الجو", "نفس الستايل"]
      }
    },

    /* 8. Moods and genres: what is said -> the categories of the catalogue it plays, best first.
          When the first category has few songs (or none yet), the next ones fill the row, and the site says so.
          all: true = always mix all the listed categories. clean: true = leave out songs with explicit lyrics.
          Every category also answers to its own name and search words (data/catalogue.json), without being listed here. */
    moods: [
      { id: "romantic", play: ["Romantic", "Tender", "Dreamy"],
        en: ["romantic", "romance", "love", "lovers", "loving", "valentine", "date night", "passionate", "passion", "in love"],
        ar: ["رومانسي", "رومانسية", "رومنسي", "رومنسية", "رومانس", "حب", "الحب", "غرام", "عشق", "عشاق", "العشاق", "غزل", "حبيبي", "حبيبتي",
          "عاطفي", "عاطفية"] },
      { id: "sensual", play: ["Sensual"],
        en: ["sensual", "sexy", "seductive", "hot", "steamy", "spicy", "naughty", "bedroom", "sultry", "after dark"],
        ar: ["حسي", "حسية", "مثير", "مثيرة", "سكسي", "جريء", "جريئة", "ساخن", "ساخنة", "إغراء", "مغري", "مغرية", "هوت", "حميمي", "حميمية"] },
      { id: "playful", play: ["Playful", "Happy"],
        en: ["playful", "flirty", "sassy", "cheeky", "fun", "teasing", "cute"],
        ar: ["مرح", "مرحة", "لعوب", "دلع", "دلوعة", "مزح", "غنج", "شقي", "شقية", "خفيف دم", "مهضوم", "مهضومة"] },
      { id: "happy", play: ["Happy", "Playful", "Uplifting", "Hopeful", "Energetic"],
        en: ["happy", "joyful", "joy", "cheerful", "bright", "feel good", "feelgood", "good mood", "upbeat", "smile", "sunny", "positive"],
        ar: ["فرح", "فرحان", "فرحانة", "مفرح", "مفرحة", "سعيد", "سعيدة", "مبسوط", "مبسوطة", "بهجة", "مبهج", "مبهجة", "فرفشة", "بيفرح", "بتفرح",
          "انبساط", "سعادة"] },
      { id: "sad", play: ["Sad", "Melancholic", "Tender", "Slowed"],
        en: ["sad", "heartbreak", "heartbroken", "broken heart", "crying", "cry", "tears", "breakup", "break up", "lonely", "alone", "blue",
          "depressed", "hurt"],
        ar: ["حزين", "حزينة", "حزن", "زعلان", "زعلانة", "بكي", "بكا", "دموع", "فراق", "مكسور", "مكسورة", "قلب مكسور", "وجع", "موجوع", "موجوعة",
          "كئيب", "كئيبة", "مهموم", "وحيد", "وحيدة", "مجروح", "مجروحة"] },
      { id: "melancholic", play: ["Melancholic", "Nostalgic", "Sad", "Tender"],
        en: ["melancholic", "melancholy", "bittersweet", "nostalgic", "nostalgia", "memories", "wistful", "longing"],
        ar: ["شجن", "شجي", "حنين", "نوستالجيا", "ذكريات", "مشتاق", "مشتاقة", "اشتياق", "شوق"] },
      { id: "chill", play: ["Chill", "Peaceful", "Slowed", "Dreamy", "Tender"],
        en: ["chill", "chilled", "chilling", "relaxed", "relaxing", "relax", "calm", "calming", "mellow", "easy", "laid back", "quiet", "peaceful",
          "peace", "soft", "slow", "sleep", "sleepy", "sleeping", "bedtime", "study", "studying", "focus", "reading", "unwind", "soothing"],
        ar: ["هادي", "هادية", "هادئ", "هادئة", "رايق", "رايقة", "روقان", "ترويق", "مريح", "مريحة", "استرخاء", "هدوء", "ناعم", "ناعمة", "خفيف",
          "خفيفة", "بطيء", "بطيئة", "للنوم", "نوم", "نعسان", "دراسة", "للدراسة", "تركيز", "للتركيز", "قراية", "سلام", "ريلاكس", "تشيل", "بيروق"] },
      { id: "energetic", play: ["Energetic", "Empowering", "Arena Anthems", "Uplifting", "Defiant"],
        en: ["energetic", "energy", "hype", "hyped", "pump", "pumped", "pump up", "workout", "gym", "running", "run", "training", "power",
          "powerful", "party", "dance", "dancing", "loud", "fast", "banger", "bangers", "wake up", "adrenaline", "fire"],
        ar: ["حماس", "حماسي", "حماسية", "طاقة", "نشاط", "نشيط", "نشيطة", "قوي", "قوية", "رياضة", "للرياضة", "تمرين", "للتمرين", "جيم", "للجيم",
          "ركض", "للركض", "رقص", "للرقص", "سهرة", "للسهرة", "حفلة", "للحفلة", "صاخب", "صاخبة", "سريع", "سريعة", "نار", "بيصحي", "هايب"] },
      { id: "empowering", play: ["Empowering", "Uplifting", "Arena Anthems", "Defiant", "Hopeful"],
        en: ["empowering", "empowered", "motivation", "motivational", "motivating", "motivate", "motivated", "discipline", "confidence",
          "confident", "strong", "strength", "inspire", "inspiring", "inspirational", "boss", "winner", "winning", "success"],
        ar: ["تحفيز", "تحفيزي", "تحفيزية", "محفز", "محفزة", "ثقة", "ثقة بالنفس", "قوة", "إرادة", "انضباط", "إلهام", "ملهم", "ملهمة", "تشجيع",
          "نجاح", "عزيمة", "همة"] },
      { id: "anthems", play: ["Arena Anthems"],
        en: ["anthem", "anthems", "arena", "stadium", "protest", "revolution", "rebellion", "freedom", "march", "choir", "crowd", "rise",
          "resistance", "trend"],
        ar: ["نشيد", "أناشيد", "ملعب", "ملاعب", "ثورة", "ثوري", "ثورية", "حرية", "مظاهرة", "هتاف", "جمهور", "مسيرة", "انتفاضة", "مقاومة"] },
      { id: "defiant", play: ["Defiant", "Angry", "Empowering", "Arena Anthems"],
        en: ["defiant", "rebel", "rebellious", "angry", "anger", "rage", "attitude", "bold", "fierce", "fight", "mad"],
        ar: ["تمرد", "متمرد", "متمردة", "غضب", "غاضب", "غاضبة", "عصبي", "عصبية", "معصب", "معصبة", "تحدي", "عنيد", "عنيدة", "ثاير", "ثايرة"] },
      { id: "dark", play: ["Dark", "Mysterious", "Dramatic", "Melancholic"],
        en: ["dark", "moody", "shadow", "shadowy", "gloomy", "night", "midnight", "mysterious", "mystery", "noir"],
        ar: ["غامق", "داكن", "داكنة", "مظلم", "مظلمة", "سوداوي", "سوداوية", "غامض", "غامضة", "ليلي", "ليلية", "ظلام", "عتمة", "دارك"] },
      { id: "dreamy", play: ["Dreamy", "Tender", "Slowed"],
        en: ["dreamy", "dream", "dreaming", "floating", "ethereal", "airy", "hazy"],
        ar: ["حالم", "حالمة", "أحلام", "حلم", "خيالي", "خيالية"] },
      { id: "tender", play: ["Tender", "Romantic", "Dreamy"],
        en: ["tender", "gentle", "comfort", "comforting", "warm", "cozy", "cosy", "sweet"],
        ar: ["حنون", "حنونة", "حنان", "دافي", "دافية", "دافئ", "دافئة", "لطيف", "لطيفة", "رقيق", "رقيقة"] },
      { id: "epic", play: ["Epic", "Dramatic", "Arena Anthems"],
        en: ["epic", "big", "huge", "cinematic", "movie", "film", "grand", "massive", "heroic"],
        ar: ["ملحمي", "ملحمية", "سينمائي", "سينمائية", "فخم", "فخمة", "ضخم", "ضخمة", "عظيم", "عظيمة", "بطولي"] },
      { id: "dramatic", play: ["Dramatic", "Epic", "Dark"],
        en: ["dramatic", "drama", "intense", "intensity"],
        ar: ["درامي", "درامية", "دراما"] },
      { id: "hopeful", play: ["Hopeful", "Uplifting", "Empowering"],
        en: ["hopeful", "hope", "optimistic", "uplifting"],
        ar: ["أمل", "الأمل", "متفائل", "متفائلة", "تفاؤل", "إيجابي", "إيجابية", "معنويات"] },
      { id: "slowed", play: ["Slowed"],
        en: ["slowed", "slowed down", "slow reverb", "reverb", "slow version", "slowed version"],
        ar: ["سلو", "سلوود", "مبطأ", "مبطأة", "ريفيرب", "سلو ريفيرب"] },
      /* "Classy music": Claude's guess until Robert says what it should play (15 Nov 2026): the soft, tasteful side of
         the library, without explicit lyrics. */
      { id: "classy", name: "Classy mix", all: true, clean: true,
        play: ["R&B / Soul", "Tender", "Dreamy", "Romantic", "Melancholic"],
        en: ["classy", "elegant", "sophisticated", "chic", "fancy", "refined", "luxury", "luxurious", "smooth", "tasteful", "posh", "high class",
          "dinner", "wine"],
        ar: ["راقي", "راقية", "أناقة", "أنيق", "أنيقة", "شيك", "كلاس", "كلاسي", "كلاسية", "مرتب", "مرتبة", "ذوق", "محترم", "محترمة", "هاي كلاس",
          "للعشا", "عشا"] },
      { id: "pop", play: ["Pop"], en: ["pop"], ar: ["بوب"] },
      { id: "rnb", play: ["R&B / Soul"], en: ["rnb", "soul", "slow jam"], ar: ["ار اند بي", "ارانبي", "ار ان بي", "سول"] },
      { id: "rap", play: ["Hip-Hop / Rap"], en: ["rap", "hip hop", "trap"], ar: ["راب", "هيب هوب", "تراب"] },
      { id: "jazz", play: ["Jazz"], en: ["jazz"], ar: ["جاز"] },
      { id: "rock", play: ["Rock"], en: ["rock"], ar: ["روك"] },
      { id: "classical", play: ["Classical"], en: ["classical", "piano", "orchestra"], ar: ["كلاسيك", "كلاسيكي", "كلاسيكية", "بيانو", "أوركسترا"] },
      { id: "dancefloor", play: ["Dance"], en: ["techno", "house music", "edm", "disco"], ar: ["دانس", "تكنو", "هاوس", "ديسكو"] },
      { id: "arabic", play: ["World"], en: ["arabic", "oriental"], ar: ["عربي", "عربية", "شرقي", "شرقية"] },
      { id: "kids", play: ["Children's Music"], en: ["kids", "children", "lullaby"], ar: ["أطفال", "للأطفال", "ولاد", "للولاد"] }
    ],

    /* 9. Search words of the catalogue that are too general to stand alone ("new" must not mean "New Age"). */
    notAlone: ["new", "age", "easy", "listening", "spoken", "word", "laid", "back", "down", "hip", "hop", "big", "huge", "hot", "adult", "rise",
      "trend", "strong", "jam", "rhythm", "score", "film", "house", "club", "world", "bright", "warm", "soft", "quiet", "slow", "funny", "fun"],

    /* 10. Example sentences shown under "Try saying", per spoken language. {song} becomes a real title. */
    tips: {
      en: ["Play {song}", "Something romantic", "Play the radio", "Next"],
      ar: ["حطلي {song}", "شي رومانسي", "شغّل الراديو", "التالي"]
    },

    /* 11. What the listening sheet says. The site is in English only, so this is too, whatever language is spoken.
           {x} and {y} are filled in by voice.js. */
    text: {
      langs: { en: "English", ar: "Arabic" },
      title: "Voice", langLabel: "The language you speak", tap: "Tap the mic and speak", stop: "Stop listening",
      starting: "One moment…", listening: "Listening…", thinking: "One moment…", tryLabel: "Try saying",
      typeLabel: "Type instead of speaking", type: "Or type it: a song, a mood, “next”…", go: "Go",
      blocked: "The microphone is blocked for this site. Allow it in your browser's site settings, then tap the mic again.",
      blockedApp: "The microphone is off for Velora. Allow it in the phone's settings (Apps, Velora, Permissions), then tap the mic again.",
      silent: "I didn't hear anything. Tap the mic and try again.",
      offline: "Voice needs an internet connection.",
      unsupported: "This browser can't listen. Type what you would say below, or open Velora in Chrome, Edge or Safari.",
      unavailable: "This phone has no speech service switched on. Type what you would say below.",
      failed: "That didn't work. Tap the mic and try again.",
      none: "I didn't find “{x}”.", pickMood: "Pick a mood, or tap the mic and try again:", choices: "Did you mean…", closestTitle: "Closest songs:",
      empty: "There are no {x} songs in the library yet.",
      paused: "Paused", playing: "Playing", next: "Next song", prev: "Previous song", restart: "From the start", radio: "Velora Radio",
      shuffle: "Shuffling all songs", volume: "Volume {x}%", volumePhone: "Use the phone's volume buttons.",
      live: "This is live radio: it can't skip or go back. Say a song or a mood instead.",
      ad: "The music continues right after this message.", nothing: "Nothing is playing yet.", nowPlaying: "“{x}” · {y}",
      song: "▶ {x}", mix: "{x} · {y} songs", mixOne: "{x} · 1 song", closest: "No “{x}” songs yet. Playing the closest: {y}", similar: "Similar to “{x}”"
    }
  };
  root.VELORA_VOICE_WORDS = WORDS;
  if (typeof module !== "undefined" && module.exports) module.exports = WORDS;
})(typeof window !== "undefined" ? window : globalThis);
