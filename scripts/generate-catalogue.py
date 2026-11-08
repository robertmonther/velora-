"""Generates the EXAMPLE catalogue (data/catalogue.json and data/catalogue.js).
Replace with Robert's real songs. The site reads window.VELORA_DATA from data/catalogue.js."""
import json, random
random.seed(7)
genres=["Hip Hop","Jazz","Blues","House","Soft Sensual","Explicit Sensual","Trend (Arena)","Soul","Lo-fi","Cinematic"]
moods=["Warm","Dark","Uplifting","Dreamy","Tense","Playful","Melancholic","Confident","Romantic","Late night"]
words=["Velvet","Neon","Amber","Midnight","Harbor","Crimson","Paper","Silver","Coastline","Ember","Quiet","Wild","Golden","Static","Rose","Echo","Marble","Low","Hollow","Bright"]
nouns=["Hours","Signal","Mirror","Streets","Tide","Room","Fever","Letters","Arena","Smoke","Window","Motion","Promise","Avenue","Dust","Pulse","Garden","Lights","Oath","Run"]
songs=[]
for i in range(1,61):
  g=genres[(i-1)%10]; dur=60
  songs.append({"id":f"vl-{i:04d}","title":f"{random.choice(words)} {random.choice(nouns)}","artist":"Robert Mo","genre":g,"mood":random.choice(moods),
   "bpm":random.randint(70,128),"duration":dur,"audio":f"audio/demo-{(i-1)%6+1}.mp3",
   "sections":[{"name":"Intro","start":0},{"name":"Verse","start":8},{"name":"Chorus","start":22},{"name":"Verse 2","start":32},{"name":"Bridge","start":42},{"name":"Outro","start":52}],
   "bestPart":22,"explicit":g=="Explicit Sensual","published":f"2026-{random.randint(1,10):02d}-{random.randint(1,28):02d}",
   "hue":random.choice([0,1,2]),"lyrics":"Example lyrics placeholder.\nReal lyrics by Robert will appear here.","example":True})
json.dump({"note":"EXAMPLE catalogue - replace with Robert's real songs","genres":genres,"songs":songs},open("data/catalogue.json","w"),indent=1)
open("data/catalogue.js","w").write("window.VELORA_DATA="+json.dumps({"genres":genres,"songs":songs})+";")
