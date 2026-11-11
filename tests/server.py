"""Static file server with HTTP Range support (like real hosting/CDNs), for local testing only."""
import os, re, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
class H(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def send_head(self):
        path = self.translate_path(self.path)
        rng = self.headers.get("Range")
        if not rng or not os.path.isfile(path):
            return super().send_head()
        m = re.match(r"bytes=(\d*)-(\d*)", rng)
        size = os.path.getsize(path)
        start = int(m.group(1)) if m.group(1) else 0
        end = int(m.group(2)) if m.group(2) else size - 1
        end = min(end, size - 1)
        f = open(path, "rb"); f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._remaining = end - start + 1
        return f
    def copyfile(self, src, dst):
        rem = getattr(self, "_remaining", None)
        if rem is None:
            return super().copyfile(src, dst)
        while rem > 0:
            chunk = src.read(min(65536, rem))
            if not chunk: break
            try: dst.write(chunk)
            except (BrokenPipeError, ConnectionResetError): break
            rem -= len(chunk)
if __name__ == "__main__":
    os.chdir(sys.argv[1])
    ThreadingHTTPServer(("127.0.0.1", int(sys.argv[2])), H).serve_forever()
