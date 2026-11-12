"""Prints the SQL that tells the server which bundled songs exist (id and title), so it only sells songs it knows.

    python3 scripts/shop_songs_sql.py

Run it after adding or renaming a bundled song in data/catalogue.json, and apply the output in the Supabase SQL
editor. Songs uploaded through the site are known to the server already; this is only for the bundled ones."""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
songs = json.load(open(os.path.join(ROOT, "data", "catalogue.json"), encoding="utf-8"))["songs"]
q = lambda v: "'" + str(v).replace("'", "''") + "'"
rows = ",\n  ".join(f"({q(s['id'])}, {q(s['title'][:160])})" for s in songs)
print("insert into private.bundled_songs (id, title) values\n  " + rows + "\non conflict (id) do update set title = excluded.title;")
