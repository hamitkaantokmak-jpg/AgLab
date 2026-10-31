#!/usr/bin/env python3
"""Opt-in Linux account-isolation test; synthetic data, real UID and Docker socket."""
import argparse
import http.client
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parent


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def request(token, path='/api/diagnostics/r1/routes', method='GET', port=8766):
    connection = http.client.HTTPConnection('127.0.0.1', port, timeout=2)
    try:
        connection.request(method, path, headers={'Authorization': 'Bearer ' + token})
        response = connection.getresponse()
        return response.status, response.read().decode('utf-8')
    finally:
        connection.close()


def execute(*, live_admin_token=None):
    require(sys.platform == 'linux' and os.geteuid() == 0, 'Requires a dedicated Linux runner and root')
    import pwd
    from export_student_snapshot import export_snapshot
    account = pwd.getpwnam('nobody')
    require(account.pw_uid != 0, 'Test account must be unprivileged')
    require(Path('/var/run/docker.sock').is_socket(), 'Real Docker socket required; test cannot be skipped')
    student_token = secrets.token_urlsafe(36)
    admin_token = live_admin_token or secrets.token_urlsafe(36)
    identity = dict(user=account.pw_uid, group=account.pw_gid, extra_groups=[])
    with tempfile.TemporaryDirectory(prefix='aglab-student-isolation-') as directory:
        folder = Path(directory)
        os.chown(folder, 0, account.pw_gid)
        folder.chmod(0o750)
        shutil.copyfile(ROOT / 'student_api.py', folder / 'student_api.py')
        (folder / 'student_api.py').chmod(0o644)
        secret = folder / 'admin.secret'
        secret.write_text(admin_token, encoding='utf-8')
        secret.chmod(0o600)
        snapshot = folder / 'snapshot.json'
        if live_admin_token is None:
            export_snapshot(snapshot, admin_token, {'r1'},
                            fetch=lambda *_: {'ok': True, 'output': 'synthetic route'})
        else:
            # Production exporter, real HTTP admin API and real Docker/FRR.
            export_snapshot(snapshot, admin_token, {'r1'})
            require(request(student_token, '/api/lab', port=8765)[0] == 401,
                    'Student credential accepted by admin service')
        exported = json.loads(snapshot.read_text(encoding='utf-8'))
        expected = exported['diagnostics']['r1']
        if live_admin_token is not None:
            require('192.168.20.0/24' in expected['routes']['output'], 'Expected real route missing')
        os.chown(snapshot, 0, account.pw_gid)
        snapshot.chmod(0o640)
        # Same UID/GID and empty supplementary groups as the server below.
        probe = '''
import errno, os, pathlib, socket
assert os.geteuid() != 0
assert not os.getgroups()
assert 'AGLAB_LAB_TOKEN' not in os.environ
assert pathlib.Path('snapshot.json').read_text()
for path, mode in [('admin.secret', 'r'), ('snapshot.json', 'w'), ('new-file', 'w')]:
    try:
        with open(path, mode):
            pass
    except PermissionError:
        continue
    raise RuntimeError('Unexpected file access: ' + path)
with socket.socket(socket.AF_UNIX) as client:
    try:
        client.connect('/var/run/docker.sock')
    except PermissionError as error:
        assert error.errno == errno.EACCES
    else:
        raise RuntimeError('Student can access Docker socket')
'''
        environment = {'PATH': os.defpath, 'AGLAB_STUDENT_TOKEN': student_token,
                       'AGLAB_STUDENT_SNAPSHOT': str(snapshot), 'AGLAB_STUDENT_ROUTERS': 'r1',
                       'PYTHONDONTWRITEBYTECODE': '1'}
        subprocess.run([sys.executable, '-c', probe], cwd=folder, env=environment,
                       check=True, timeout=10, **identity)
        process = subprocess.Popen([sys.executable, str(folder / 'student_api.py')],
                                   cwd=folder, env=environment, stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL, **identity)
        try:
            for attempt in range(50):
                require(process.poll() is None, 'Student process exited before readiness')
                try:
                    code, body = request(student_token)
                    break
                except OSError:
                    time.sleep(0.1)
            else:
                raise RuntimeError('Student process readiness timed out')
            require(code == 200 and json.loads(body)['output'] == expected['routes']['output'], 'Scoped read failed')
            for view in ('routes', 'interfaces', 'neighbors'):
                status, response = request(student_token, '/api/diagnostics/r1/' + view)
                payload = json.loads(response)
                require(status == 200 and payload['output'] == expected[view]['output'], 'Exported diagnostic differs')
                require(payload['router'] == 'r1' and payload['view'] == view, 'Incorrect diagnostic identity')
                require(set(payload) == {'router', 'view', 'captured_at', 'ok', 'output'}, 'Unexpected response fields')
                require(admin_token not in response and student_token not in response, 'Credential in response')
            require(request(admin_token)[0] == 401, 'Admin credential accepted by student service')
            require(request(student_token, '/api/diagnostics/r2/routes')[0] == 404, 'Router scope bypass')
            require(request(student_token, '/api/lab')[0] == 404, 'Admin endpoint exposed')
            for method in ('POST', 'PUT', 'PATCH', 'DELETE'):
                require(request(student_token, '/api/lab/start', method)[0] == 405, 'Mutation accepted')
            data = json.loads(snapshot.read_text(encoding='utf-8'))
            require(set(data['diagnostics']) == {'r1'}, 'Export leaked another router')
            data['captured_at'] = time.time() - 61
            snapshot.write_text(json.dumps(data), encoding='utf-8')
            require(request(student_token)[0] == 503, 'Stale snapshot served')
            snapshot.unlink()
            require(request(student_token)[0] == 503, 'Missing snapshot did not fail closed')
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
    print('PASS: unprivileged student HTTP, scope, secret/file isolation and denied Docker socket')
    if live_admin_token is not None:
        print('PASS: real FRR -> admin HTTP -> scoped exporter -> unprivileged student HTTP (three views)')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    args = parser.parse_args(argv)
    if not args.execute:
        print('DRY RUN: Linux UID, file permissions, HTTP and Docker-socket isolation checks')
        return 0
    execute()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
