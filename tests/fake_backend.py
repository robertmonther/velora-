"""A stand-in for the Velora server (Supabase), for the upload checks only.

It serves the site's files and answers the same addresses the real server has, under /__supa/:
sign-in, the owner setup, the server functions, and file storage. It keeps everything in memory and
applies the same main rules as supabase/schema.sql (who may upload, what Publish checks), so the
upload page can be walked through from start to finish without touching the real project.

    python3 tests/fake_backend.py <site folder> <port>
"""
import base64, hashlib, json, os, re, sys, threading, time, uuid
from email.parser import BytesParser
from http.server import ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from server import H

P = "/__supa"
SETUP_CODE = "TEST-CODE-1234"
LOCK = threading.Lock()
DB = {"users": {}, "tokens": {}, "artists": {}, "songs": {}, "records": [], "files": {}, "setup_used": False, "next": 1001, "log": []}

def b64(d): return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")
def token_for(u):
    now = int(time.time())
    return b64({"alg": "HS256", "typ": "JWT"}) + "." + b64({"sub": u["id"], "email": u["email"], "role": "authenticated", "aud": "authenticated", "iat": now, "exp": now + 3600, "session_id": str(uuid.uuid4())}) + ".c2ln"
def user_json(u):
    return {"id": u["id"], "aud": "authenticated", "role": "authenticated", "email": u["email"], "email_confirmed_at": "2026-11-11T10:00:00Z", "phone": "",
            "app_metadata": {"provider": "email", "providers": ["email"]}, "user_metadata": {}, "identities": [], "created_at": "2026-11-11T10:00:00Z", "updated_at": "2026-11-11T10:00:00Z"}
def session(u):
    t = token_for(u); DB["tokens"][t] = u["id"]
    return {"access_token": t, "token_type": "bearer", "expires_in": 3600, "expires_at": int(time.time()) + 3600, "refresh_token": "rt-" + u["id"], "user": user_json(u)}
def add_user(email, password, role="listener", name=""):
    u = {"id": str(uuid.uuid4()), "email": email.lower(), "password": password, "role": role, "name": name}
    DB["users"][u["email"]] = u; return u
def by_id(uid): return next((u for u in DB["users"].values() if u["id"] == uid), None)
def song_json(s):
    rec = next((r for r in DB["records"] if r["song_id"] == s["id"] and r["kind"] == "published"), None)
    title = s["title"] + (f" ({s['version']})" if s.get("version") else "")
    return {"id": s["id"], "title": title, "genre": s["genre"], "subgenre": s.get("subgenre"), "tags": s["moods"], "mood": s["moods"][0], "language": s["language"], "explicit": s["explicit"], "adult": s["adult"],
            "duration": s["duration"], "bpm": None, "key": None, "audio": s["audio_path"], "art": s["cover_path"], "color": s.get("color"), "sections": s["sections"], "bestPart": s["best_part"],
            "lyrics": s["lyrics"], "lyricsSynced": s["lyrics_synced"], "lyricsNote": None if not s["lyrics"] else ("Lyrics from the artist." if s["lyrics_synced"] else "Lyrics from the artist; not timed to the music yet."),
            "created": s.get("created_on") or None, "published": s["published_at"][:10], "artist": s["artist_id"], "credits": s["credits"], "ai": s["ai"], "holder": s["holder"],
            "record": {"id": rec["id"], "at": rec["at"], "hash": rec["hash"]} if rec else None}
def add_record(song, kind, title, artist, holder, details):
    prev = DB["records"][-1]["hash"] if DB["records"] else None
    at = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()) + ".000Z"
    h = hashlib.sha256("|".join([prev or "", song, kind, at, title, artist or "", holder or "", json.dumps(details, sort_keys=True)]).encode()).hexdigest()
    r = {"id": len(DB["records"]) + 1, "song_id": song, "kind": kind, "at": at, "title": title, "artist": artist, "holder": holder, "details": details, "prev": prev, "hash": h}
    DB["records"].append(r); return r

class Err(Exception):
    def __init__(self, msg, status=400, code="P0001"): self.msg, self.status, self.code = msg, status, code

def rpc(fn, args, u):
    """The server functions. u is the signed-in user or None."""
    can = bool(u) and u["role"] in ("owner", "creator")
    if fn == "public_catalogue":
        songs = [song_json(s) for s in sorted(DB["songs"].values(), key=lambda x: x.get("published_at") or "", reverse=True) if s["status"] == "published"]
        ids = {s["artist"] for s in songs}
        return {"complete": True, "songs": songs, "artists": [{"id": a["id"], "name": a["name"], "tagline": a.get("tagline"), "bio": a.get("bio"), "color": a.get("color"), "image": a.get("image_path")} for a in DB["artists"].values() if a["id"] in ids]}
    if fn == "song_record":
        s = DB["songs"].get(args.get("p_song")); return [dict(r) for r in DB["records"] if s and s["status"] == "published" and r["song_id"] == s["id"]]
    if not u: raise Err("permission denied for function " + fn, 401, "42501")
    if fn == "my_profile": return {"role": u["role"], "display_name": u["name"] or None, "premium": False}
    if fn == "my_licenses": return []
    if fn == "my_artists": return [{"id": a["id"], "name": a["name"], "tagline": a.get("tagline"), "bio": a.get("bio"), "color": a.get("color"), "image": a.get("image_path"), "songs": sum(1 for s in DB["songs"].values() if s.get("artist_id") == a["id"] and s["status"] == "published")} for a in DB["artists"].values() if a["owner"] == u["id"]]
    if fn == "my_songs": return [{"id": s["id"], "status": s["status"], "title": s["title"] + (f" ({s['version']})" if s.get("version") else ""), "artist": DB["artists"][s["artist_id"]]["name"], "art": s["cover_path"], "duration": s["duration"], "published_at": s["published_at"], "explicit": s["explicit"], "adult": s["adult"], "record": 1} for s in DB["songs"].values() if s["owner"] == u["id"] and s["status"] != "draft"]
    if fn == "my_records": return [dict(r) for r in DB["records"] if r["song_id"] == args.get("p_song") and DB["songs"].get(r["song_id"], {}).get("owner") == u["id"]]
    if not can: raise Err("Only an uploader account can do this.", 400, "42501")
    if fn == "reserve_song":
        d = next((s for s in DB["songs"].values() if s["owner"] == u["id"] and s["status"] == "draft"), None)
        if d: return d["id"]
        sid = f"vs-{DB['next']:04d}"; DB["next"] += 1; DB["songs"][sid] = {"id": sid, "owner": u["id"], "status": "draft"}; return sid
    if fn == "save_artist":
        p = args.get("p") or {}; aid = (p.get("id") or "").strip().lower(); name = (p.get("name") or "").strip()
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,48}", aid): raise Err("The artist name needs letters or numbers.")
        if not 1 <= len(name) <= 80: raise Err("The artist name must have 1 to 80 characters.")
        img = p.get("image_path") or None
        if img and (not re.fullmatch(re.escape(u["id"]) + r"/artists/[a-z0-9-]{2,49}-[0-9a-f]{8,64}\.jpg", img) or img not in DB["files"]): raise Err("The artist photo was not found.")
        a = DB["artists"].get(aid)
        if a and a["owner"] != u["id"]: raise Err("This artist name is already taken.")
        if not a: a = DB["artists"][aid] = {"id": aid, "owner": u["id"]}
        a.update({"name": name, "tagline": (p.get("tagline") or "").strip() or None, "bio": (p.get("bio") or "").strip() or None})
        if img: a["image_path"] = img
        if re.fullmatch(r"#[0-9a-fA-F]{6}", p.get("color") or ""): a["color"] = p["color"]
        return {"id": a["id"], "name": a["name"], "tagline": a.get("tagline"), "bio": a.get("bio"), "color": a.get("color"), "image": a.get("image_path")}
    if fn == "publish_song":
        p = args.get("p") or {}; s = DB["songs"].get(p.get("id"))
        if not s or s["owner"] != u["id"]: raise Err("This draft was not found.")
        if s["status"] != "draft": raise Err("This song is already published.")
        title = (p.get("title") or "").strip()
        if not 1 <= len(title) <= 120: raise Err("The title must have 1 to 120 characters.")
        a = DB["artists"].get(p.get("artist_id"))
        if not a or a["owner"] != u["id"]: raise Err("Choose an artist name.")
        if not (p.get("genre") or "").strip(): raise Err("Choose a genre.")
        if not (p.get("language") or "").strip(): raise Err("Choose the language.")
        dur = float(p.get("duration") or 0)
        if dur < 20 or dur > 3600: raise Err("The song length is not valid.")
        if p.get("rights_confirmed") is not True: raise Err("Confirm that you own the rights.")
        ap, cp = p.get("audio_path") or "", p.get("cover_path") or ""
        if not re.fullmatch(re.escape(u["id"]) + "/" + re.escape(s["id"]) + r"/audio-[0-9a-f]{8,64}\.mp3", ap) or ap not in DB["files"]: raise Err("The song file was not found on the server.")
        if not re.fullmatch(re.escape(u["id"]) + "/" + re.escape(s["id"]) + r"/cover-[0-9a-f]{8,64}\.jpg", cp) or cp not in DB["files"]: raise Err("The cover was not found on the server.")
        moods = [m.strip() for m in (p.get("moods") or []) if isinstance(m, str) and m.strip()][:3]
        if not moods: raise Err("Choose at least one mood.")
        ly = p.get("lyrics") or None
        if ly and (len(ly) > 400 or any(not (isinstance(l, list) and len(l) == 2 and isinstance(l[0], (int, float)) and isinstance(l[1], str) and len(l[1]) <= 300) for l in ly)): raise Err("The lyrics are not in the right form.")
        s.update({"status": "published", "artist_id": a["id"], "title": title, "version": (p.get("version") or "").strip() or None, "genre": p["genre"], "subgenre": p.get("subgenre") or None, "moods": moods,
                  "language": p["language"], "explicit": bool(p.get("explicit")), "adult": bool(p.get("adult")) or bool(p.get("explicit")), "lyrics": ly, "lyrics_synced": p.get("lyrics_synced", True) is not False,
                  "sections": p.get("sections") or [], "best_part": max(0, min(float(p.get("best_part") or 0), dur)), "duration": dur, "audio_path": ap, "cover_path": cp,
                  "color": p.get("color") if re.fullmatch(r"#[0-9a-fA-F]{6}", p.get("color") or "") else None, "created_on": p.get("created_on") or None, "credits": p.get("credits") or [], "ai": p.get("ai") or {},
                  "mastered": bool(p.get("mastered")), "loudness": p.get("loudness"), "holder": u["name"] or "The uploader", "published_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "payload": p})
        add_record(s["id"], "published", title + (f" ({s['version']})" if s["version"] else ""), a["name"], s["holder"], {k: p.get(k) for k in ("original_name", "original_bytes", "original_sha256", "audio_sha256", "cover_sha256", "lyrics_sha256") if p.get(k)})
        return song_json(s)
    if fn == "set_song_listed":
        s = DB["songs"].get(args.get("p_song"))
        if not s or s["owner"] != u["id"] or s["status"] == "draft": raise Err("This song was not found.")
        want = bool(args.get("p_listed"))
        if want and s["status"] == "unlisted": s["status"] = "published"; add_record(s["id"], "relisted", s["title"], DB["artists"][s["artist_id"]]["name"], s["holder"], {})
        elif not want and s["status"] == "published": s["status"] = "unlisted"; add_record(s["id"], "unlisted", s["title"], DB["artists"][s["artist_id"]]["name"], s["holder"], {})
        return s["status"]
    raise Err("Could not find the function " + fn, 404, "PGRST202")

class Fake(H):
    def _send(self, status, body=b"", ctype="application/json", extra=None):
        if isinstance(body, (dict, list)) or body is None or isinstance(body, (str, bool, int, float)) and ctype == "application/json": body = json.dumps(body).encode()
        self.send_response(status); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD": self.wfile.write(body)
    def _user(self):
        a = self.headers.get("Authorization") or ""
        uid = DB["tokens"].get(a[7:]) if a.startswith("Bearer ") else None
        return by_id(uid) if uid else None
    def _body(self):
        n = int(self.headers.get("Content-Length") or 0); return self.rfile.read(n) if n else b""
    def do_OPTIONS(self):
        if not self.path.startswith(P): return self._send(204, b"", "text/plain")
        self.send_response(204)
        for k, v in (("Access-Control-Allow-Origin", "*"), ("Access-Control-Allow-Headers", "*"), ("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")): self.send_header(k, v)
        self.end_headers()
    def do_GET(self):
        if not self.path.startswith(P): return super().do_GET()
        with LOCK: self._api("GET", b"")
    def do_HEAD(self):
        if not self.path.startswith(P): return super().do_HEAD()
        with LOCK: self._api("GET", b"")
    def do_POST(self):
        if not self.path.startswith(P): return self._send(405, {"message": "no"})
        raw = self._body()
        with LOCK: self._api("POST", raw)
    do_PUT = do_POST
    def do_DELETE(self):
        if self.path.startswith(P): self._body(); return self._send(400, {"statusCode": "403", "error": "Unauthorized", "message": "Access denied"})
        self._send(405, {"message": "no"})
    def _api(self, method, raw):
        url = urlparse(self.path); path = unquote(url.path[len(P):]); q = parse_qs(url.query); u = self._user()
        DB["log"].append((method, path, bool(u)))
        try:
            if path == "/functions/v1/owner-setup":
                b = json.loads(raw or b"{}")
                if DB["setup_used"]: return self._send(403, {"ok": False, "error": "The owner account already exists. Sign in instead."})
                if b.get("code") != SETUP_CODE: return self._send(403, {"ok": False, "error": "The setup code is not right."})
                if len(b.get("password") or "") < 12: return self._send(400, {"ok": False, "error": "Use a password of 12 characters or more."})
                add_user(b["email"], b["password"], "owner", (b.get("name") or "").strip()); DB["setup_used"] = True
                return self._send(200, {"ok": True})
            if path == "/auth/v1/token":
                b = json.loads(raw or b"{}"); grant = (q.get("grant_type") or [""])[0]
                if grant == "password":
                    usr = DB["users"].get((b.get("email") or "").lower())
                    if not usr or usr["password"] != b.get("password"): return self._send(400, {"code": 400, "error_code": "invalid_credentials", "msg": "Invalid login credentials"})
                    return self._send(200, session(usr))
                if grant == "refresh_token":
                    usr = by_id((b.get("refresh_token") or "")[3:])
                    return self._send(200, session(usr)) if usr else self._send(400, {"code": 400, "error_code": "refresh_token_not_found", "msg": "Invalid Refresh Token"})
            if path == "/auth/v1/user": return self._send(200, user_json(u)) if u else self._send(401, {"code": 401, "msg": "no session"})
            if path == "/auth/v1/logout": return self._send(204, b"", "text/plain")
            m = re.fullmatch(r"/rest/v1/rpc/([a-z_]+)", path)
            if m:
                args = json.loads(raw or b"{}") if method == "POST" else {k: v[0] for k, v in q.items()}
                return self._send(200, rpc(m.group(1), args, u))
            m = re.fullmatch(r"/storage/v1/object/media/(.+)", path)
            if m and method == "POST":
                name = m.group(1); ctype = self.headers.get("Content-Type") or ""; data = raw
                if ctype.startswith("multipart/form-data"):
                    msg = BytesParser().parsebytes(b"Content-Type: " + ctype.encode() + b"\r\n\r\n" + raw); data = None
                    for part in msg.walk():
                        if part.get_content_maintype() == "multipart": continue
                        if part.get_filename() is not None or part.get_content_type() in ("audio/mpeg", "image/jpeg", "image/png", "application/octet-stream"):
                            data = part.get_payload(decode=True); ctype = part.get_content_type()
                if not u or u["role"] not in ("owner", "creator") or name.split("/")[0] != u["id"]:
                    return self._send(400, {"statusCode": "403", "error": "Unauthorized", "message": "new row violates row-level security policy"})
                if ctype not in ("audio/mpeg", "image/jpeg"): return self._send(400, {"statusCode": "415", "error": "invalid_mime_type", "message": f"mime type {ctype} is not supported"})
                if data is None or len(data) > 52428800: return self._send(400, {"statusCode": "413", "error": "Payload too large", "message": "The object exceeded the maximum allowed size"})
                DB["files"][name] = (data, ctype)
                return self._send(200, {"Key": "media/" + name, "Id": str(uuid.uuid4())})
            m = re.fullmatch(r"/storage/v1/object/public/media/(.+)", path)
            if m:
                f = DB["files"].get(m.group(1))
                if not f: return self._send(404, {"statusCode": "404", "error": "not_found", "message": "Object not found"})
                data, ctype = f; rng = re.match(r"bytes=(\d*)-(\d*)", self.headers.get("Range") or "")
                if rng:
                    a = int(rng.group(1) or 0); b = min(int(rng.group(2)) if rng.group(2) else len(data) - 1, len(data) - 1)
                    return self._send(206, data[a:b + 1], ctype, {"Accept-Ranges": "bytes", "Content-Range": f"bytes {a}-{b}/{len(data)}"})
                return self._send(200, data, ctype, {"Accept-Ranges": "bytes"})
            if path == "/__state":       # for the checks only
                return self._send(200, {"songs": [{k: v for k, v in s.items() if k != "payload"} | {"payload": s.get("payload")} for s in DB["songs"].values()], "artists": list(DB["artists"].values()), "records": DB["records"],
                                        "files": {k: [len(v[0]), v[1]] for k, v in DB["files"].items()}, "users": [{"email": x["email"], "role": x["role"], "name": x["name"]} for x in DB["users"].values()]})
            if path == "/__file":
                f = DB["files"].get((q.get("name") or [""])[0]); return self._send(200, f[0], f[1]) if f else self._send(404, {"message": "no"})
            if path == "/__add_listener":
                add_user("listener@example.test", "listener-pass-123", "listener", "A Listener"); return self._send(200, {"ok": True})
            return self._send(404, {"message": "not found: " + path})
        except Err as e:
            return self._send(e.status, {"code": e.code, "details": None, "hint": None, "message": e.msg})
        except Exception as e:                               # a mistake in the stand-in itself
            return self._send(500, {"message": "stand-in error: " + repr(e)})

def serve(root, port):
    os.chdir(root)
    srv = ThreadingHTTPServer(("127.0.0.1", port), Fake); srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

if __name__ == "__main__":
    serve(sys.argv[1], int(sys.argv[2])); print("stand-in server on", sys.argv[2], flush=True)
    while True: time.sleep(3600)
