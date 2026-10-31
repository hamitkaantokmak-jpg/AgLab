#!/usr/bin/env python3
"""Unprivileged snapshot reader. No admin API, Docker, subprocess or command input."""
import hmac
import json
import math
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROUTERS = frozenset({'r1', 'r2'})
VIEWS = frozenset({'routes', 'interfaces', 'neighbors'})
MAX_BYTES = 1_000_000
MAX_AGE = 60


def make_server(token, snapshot_path, routers, port=8766):
    routers = frozenset(routers)
    if not token.isascii() or len(token) < 32 or not routers or not routers <= ROUTERS:
        raise ValueError('A separate ASCII student secret (32+ characters) and explicit router scope are required')
    expected = ('Bearer ' + token).encode('ascii')
    snapshot_path = Path(snapshot_path)

    class StudentAPI(BaseHTTPRequestHandler):
        def respond(self, code, payload):
            raw = json.dumps(payload).encode('utf-8')
            self.send_response(code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(raw)

        def do_GET(self):
            supplied = self.headers.get_all('Authorization', [])
            if len(supplied) != 1 or not hmac.compare_digest(supplied[0].encode('utf-8'), expected):
                return self.respond(401, {'error': 'unauthorized'})
            parts = self.path.split('/')
            if (len(parts) != 5 or parts[1:3] != ['api', 'diagnostics']
                    or parts[3] not in routers or parts[4] not in VIEWS):
                return self.respond(404, {'error': 'unknown endpoint'})
            try:
                with snapshot_path.open('rb') as source:
                    raw = source.read(MAX_BYTES + 1)
                if len(raw) > MAX_BYTES:
                    raise ValueError('oversized snapshot')
                data = json.loads(raw)
                captured = data['captured_at']
                if (type(captured) not in (int, float) or not math.isfinite(captured)
                        or not 0 <= time.time() - captured <= MAX_AGE):
                    raise ValueError('stale snapshot')
                result = data['diagnostics'][parts[3]][parts[4]]
                if result['ok'] is not True or not isinstance(result['output'], str):
                    raise ValueError('unavailable diagnostic')
                payload = {'router': parts[3], 'view': parts[4], 'captured_at': captured,
                           'ok': True, 'output': result['output'][:12000]}
            except (OSError, ValueError, KeyError, TypeError, RecursionError):
                return self.respond(503, {'error': 'snapshot unavailable'})
            return self.respond(200, payload)

        def reject_method(self):
            self.close_connection = True
            self.respond(405, {'error': 'read-only service'})

        do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = do_HEAD = reject_method

        def log_message(self, fmt, *args):
            pass

    return ThreadingHTTPServer(('127.0.0.1', port), StudentAPI)


def main():
    # This process must receive only its own credential, never the admin secret.
    if os.getenv('AGLAB_LAB_TOKEN'):
        raise SystemExit('Remove AGLAB_LAB_TOKEN from the student process environment')
    server = make_server(os.environ.get('AGLAB_STUDENT_TOKEN', ''),
                         os.environ['AGLAB_STUDENT_SNAPSHOT'],
                         os.environ.get('AGLAB_STUDENT_ROUTERS', '').split(','))
    print('Student snapshot API listening only on 127.0.0.1:8766', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
