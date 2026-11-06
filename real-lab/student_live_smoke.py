#!/usr/bin/env python3
"""Opt-in full FRR/admin/exporter/student chain on a dedicated Linux runner."""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
import time
from student_isolation_smoke import execute, request, require

ROOT = Path(__file__).resolve().parent
TOPOLOGY = ROOT / 'topology.clab.yml'


def stop_process(process):
    if process is not None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def verify_watch(token):
    with tempfile.TemporaryDirectory(prefix='aglab-live-refresh-') as directory:
        snapshot = Path(directory) / 'snapshot.json'
        environment = {'PATH': os.defpath, 'AGLAB_LAB_TOKEN': token,
                       'AGLAB_STUDENT_SNAPSHOT': str(snapshot), 'AGLAB_STUDENT_ROUTERS': 'r1',
                       'PYTHONDONTWRITEBYTECODE': '1'}
        process = subprocess.Popen([sys.executable, str(ROOT / 'export_student_snapshot.py'),
                                    '--watch', '--interval', '5'], cwd=ROOT, env=environment,
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            first_capture = None
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                require(process.poll() is None, 'Refresh process exited unexpectedly')
                if snapshot.exists():
                    data = json.loads(snapshot.read_text(encoding='utf-8'))
                    require(set(data['diagnostics']) == {'r1'}, 'Refresh router scope leaked')
                    require('192.168.20.0/24' in data['diagnostics']['r1']['routes']['output'],
                            'Refresh did not collect real router data')
                    if first_capture is None:
                        first_capture = data['captured_at']
                    elif data['captured_at'] > first_capture:
                        break
                time.sleep(0.2)
            else:
                raise RuntimeError('Continuous exporter did not publish two live snapshots')
        finally:
            stop_process(process)
        require(process.returncode == 0, 'Continuous exporter did not stop cleanly on SIGTERM')
        require(sorted(p.name for p in Path(directory).iterdir()) == ['snapshot.json'],
                'Continuous exporter left temporary files')
    print('PASS: continuous live snapshots and graceful SIGTERM cleanup')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args(argv)
    if not args.execute:
        print('DRY RUN: deploy FRR, start admin API, export scoped snapshot, test student as nobody, clean up')
        return 0
    require(sys.platform == 'linux' and os.geteuid() == 0, 'Requires a dedicated Linux runner and root')
    existing = subprocess.run(['docker', 'ps', '-a', '--format', '{{.Names}}'],
                              check=True, capture_output=True, text=True, timeout=10)
    require(not any(name.startswith('clab-aglab-real-mvp-') for name in existing.stdout.splitlines()),
            'Refusing to touch a pre-existing real lab')
    token = secrets.token_urlsafe(36)
    admin = None
    try:
        subprocess.run(['containerlab', 'deploy', '-t', str(TOPOLOGY)], cwd=ROOT,
                       check=True, timeout=240)
        environment = {'PATH': os.defpath, 'AGLAB_LAB_TOKEN': token, 'PYTHONDONTWRITEBYTECODE': '1'}
        admin = subprocess.Popen([sys.executable, str(ROOT / 'api.py')], cwd=ROOT,
                                 env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for attempt in range(50):
            require(admin.poll() is None, 'Admin process exited before readiness')
            try:
                code, body = request(token, port=8765)
                if code == 200 and '192.168.20.0/24' in json.loads(body).get('output', ''):
                    break
            except (OSError, ValueError):
                pass
            time.sleep(0.2)
        else:
            raise RuntimeError('Real FRR/admin readiness timed out')
        verify_watch(token)
        execute(live_admin_token=token)
    finally:
        # Even failure to stop the API must not skip container cleanup.
        try:
            stop_process(admin)
        finally:
            subprocess.run(['containerlab', 'destroy', '-t', str(TOPOLOGY), '--cleanup'],
                           cwd=ROOT, check=True, timeout=120)
    print('PASS: live student chain and cleanup')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
