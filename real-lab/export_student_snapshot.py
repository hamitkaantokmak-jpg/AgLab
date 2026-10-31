#!/usr/bin/env python3
"""Operator-only export through the locked admin API; never run as the student user."""
import json
import os
import tempfile
import time
import urllib.request
from pathlib import Path


def export_snapshot(destination, token, routers, fetch=None):
    if len(token) < 32 or not token.isascii():
        raise ValueError('Administrator token required')
    routers = frozenset(routers)
    if not routers or not routers <= {'r1', 'r2'}:
        raise ValueError('Explicit router scope required')
    def admin_fetch(router, view):
        request = urllib.request.Request(
            'http://127.0.0.1:8765/api/diagnostics/' + router + '/' + view,
            headers={'Authorization': 'Bearer ' + token})
        # Do not use environment proxies or follow redirects carrying credentials.
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *args, **kwargs):
                return None
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        with opener.open(request, timeout=20) as response:
            return json.loads(response.read(1000000))
    fetch = fetch or admin_fetch
    snapshot = {'captured_at': time.time(), 'diagnostics': {}}
    for router in sorted(routers):
        snapshot['diagnostics'][router] = {}
        for view in ('routes', 'interfaces', 'neighbors'):
            result = fetch(router, view)
            if result.get('ok') is not True or not isinstance(result.get('output'), str):
                raise ValueError('Diagnostic unavailable; snapshot not published')
            snapshot['diagnostics'][router][view] = {'ok': True, 'output': result['output'][:12000]}
    destination = Path(destination)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=destination.parent,
                                         delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(snapshot, stream)
        os.replace(temporary, destination)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


if __name__ == '__main__':
    try:
        export_snapshot(os.environ['AGLAB_STUDENT_SNAPSHOT'], os.environ.get('AGLAB_LAB_TOKEN', ''),
                        os.environ.get('AGLAB_STUDENT_ROUTERS', '').split(','))
    except Exception:
        raise SystemExit('Snapshot export failed; no new snapshot published') from None
