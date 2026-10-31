#!/usr/bin/env python3
"""Operator-only export through the locked admin API; never run as the student user."""
import json
import argparse
import os
import signal
import stat
import sys
import tempfile
import time
import urllib.request
from pathlib import Path


def validate_configuration(destination, token, routers, reader_gid):
    if len(token) < 32 or not token.isascii():
        raise ValueError('Administrator token required')
    routers = frozenset(routers)
    if not routers or not routers <= {'r1', 'r2'}:
        raise ValueError('Explicit router scope required')
    destination = Path(destination)
    if reader_gid is not None:
        if type(reader_gid) is not int or not 0 <= reader_gid <= 2147483647:
            raise ValueError('Reader group must be a non-negative numeric GID')
        if os.name != 'posix':
            raise ValueError('Reader group publication requires POSIX file permissions')
        directory = destination.parent.stat()
        if directory.st_uid != os.geteuid() or stat.S_IMODE(directory.st_mode) & 0o022:
            raise PermissionError('Snapshot directory must be exporter-owned and not group/other writable')
    return destination, routers


def export_snapshot(destination, token, routers, fetch=None, *, reader_gid=None):
    destination, routers = validate_configuration(destination, token, routers, reader_gid)
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
    if not 0 <= time.time() - snapshot['captured_at'] < 60:
        raise ValueError('Collection expired; snapshot not published')
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=destination.parent,
                                         delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(snapshot, stream)
            if reader_gid is not None:
                # Fully write while private; grant only group read before the
                # atomic replace. Failure never changes the published file.
                stream.flush()
                os.fchown(stream.fileno(), -1, reader_gid)
                os.fchmod(stream.fileno(), 0o640)
        os.replace(temporary, destination)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def watch_snapshots(destination, token, routers, *, reader_gid=None, interval=20):
    if type(interval) is not int or not 5 <= interval <= 30:
        raise ValueError('Refresh interval must be 5–30 seconds')
    destination, routers = validate_configuration(destination, token, routers, reader_gid)
    healthy = None
    if not destination.parent.is_dir():
        raise ValueError('Snapshot parent directory must already exist')
    while True:
        try:
            export_snapshot(destination, token, routers, reader_gid=reader_gid)
            if healthy is not True:
                print('Snapshot refresh active', flush=True)
            healthy = True
        except (OSError, ValueError):
            if healthy is not False:
                print('Snapshot refresh failed; previous snapshot retained', flush=True)
            healthy = False
        # Wait after both success and failure; never overlap or catch up in a tight loop.
        time.sleep(interval)


def interrupt_refresh(signum, frame):
    raise KeyboardInterrupt


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--watch', action='store_true', help='Refresh until Ctrl+C or SIGTERM')
    parser.add_argument('--interval', type=int, help='Seconds after each collection (5–30; default 20)')
    args = parser.parse_args(argv)
    if args.interval is not None and not args.watch:
        parser.error('--interval requires --watch')
    previous_handler = None
    try:
        group = os.environ.get('AGLAB_STUDENT_READER_GID')
        options = dict(reader_gid=int(group) if group is not None else None)
        positional = (os.environ['AGLAB_STUDENT_SNAPSHOT'], os.environ.get('AGLAB_LAB_TOKEN', ''),
                      os.environ.get('AGLAB_STUDENT_ROUTERS', '').split(','))
        if args.watch:
            previous_handler = signal.signal(signal.SIGTERM, interrupt_refresh)
            watch_snapshots(*positional, interval=args.interval if args.interval is not None else 20, **options)
        else:
            export_snapshot(*positional, **options)
        return 0
    except KeyboardInterrupt:
        print('Snapshot exporter stopped', flush=True)
        return 0
    except Exception:
        print('Snapshot export failed; no new snapshot published', file=sys.stderr)
        return 1
    finally:
        if previous_handler is not None:
            signal.signal(signal.SIGTERM, previous_handler)


if __name__ == '__main__':
    raise SystemExit(main())
