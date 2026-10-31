#!/usr/bin/env python3
"""Loopback-only, bearer-authenticated API for a single trusted real lab.

This is an administrator prototype, NOT a multi-tenant/public Docker API.
"""
import hmac
import json
import os
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ACTIONS = {"start": "start", "stop": "stop", "status": "status"}
DEVICES = {"r1", "r2", "pc1", "pc2"}
TOKEN = os.getenv("AGLAB_LAB_TOKEN", "")
OPERATION_LOCK = threading.Lock()
if __name__ == "__main__" and len(TOKEN) < 32:
    raise SystemExit("Set AGLAB_LAB_TOKEN to a random secret of at least 32 characters")


class API(BaseHTTPRequestHandler):
    def respond(self, code, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def authorized(self):
        supplied = self.headers.get("Authorization", "")
        return len(TOKEN) >= 32 and hmac.compare_digest(supplied, "Bearer " + TOKEN)

    def do_GET(self):
        if self.path == "/":
            page = (ROOT / "dashboard.html").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'")
            self.send_header("Content-Length", str(len(page)))
            self.end_headers()
            self.wfile.write(page)
            return
        if not self.authorized():
            return self.respond(401, {"error": "unauthorized"})
        if self.path == "/api/lab":
            return self.respond(200, {"lab": "aglab-real-mvp", "devices": sorted(DEVICES)})
        return self.respond(404, {"error": "unknown endpoint"})

    def do_POST(self):
        if not self.authorized():
            return self.respond(401, {"error": "unauthorized"})
        if self.path not in ("/api/lab/start", "/api/lab/stop", "/api/lab/status"):
            return self.respond(404, {"error": "unknown endpoint"})
        if self.headers.get("Content-Length") not in (None, "0"):
            return self.respond(400, {"error": "request bodies not accepted"})
        action = self.path.rsplit("/", 1)[-1]
        if not OPERATION_LOCK.acquire(blocking=False):
            return self.respond(409, {"error": "another lab operation is running"})
        try:
            try:
                result = subprocess.run(
                    [sys.executable, str(ROOT / "manage.py"), ACTIONS[action], "--execute"],
                    cwd=ROOT, capture_output=True, text=True, timeout=200, check=False,
                )
            except (OSError, subprocess.TimeoutExpired):
                return self.respond(503, {"error": "lab operation unavailable"})
            return self.respond(200 if result.returncode == 0 else 502,
                                {"action": action, "ok": result.returncode == 0,
                                 "output": (result.stdout + result.stderr)[-4000:]})
        finally:
            OPERATION_LOCK.release()

    def log_message(self, fmt, *args):
        pass


def main():
    if len(TOKEN) < 32:
        raise SystemExit("AGLAB_LAB_TOKEN must have at least 32 characters")
    server = ThreadingHTTPServer(("127.0.0.1", 8765), API)
    print("Real Lab API listening only on 127.0.0.1:8765", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
