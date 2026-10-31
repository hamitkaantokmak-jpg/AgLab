"""Student boundary tests use real HTTP, without Docker or administrator API."""
import http.client
import json
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from pathlib import Path
from student_api import make_server
import student_api
from export_student_snapshot import export_snapshot


class StudentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'snapshot.json'
        self.snapshot = {'captured_at': time.time(), 'diagnostics': {
            'r1': {'routes': {'ok': True, 'output': 'route data', 'secret': 'hidden'}},
            'r2': {'routes': {'ok': True, 'output': 'other student'}}},
            'admin_token': 'must never appear'}
        self.write()
        self.server = make_server('s' * 40, self.path, frozenset({'r1'}), port=0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def write(self):
        self.path.write_text(json.dumps(self.snapshot), encoding='utf-8')

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.tmp.cleanup()

    def request(self, path, method='GET', token='s' * 40):
        conn = http.client.HTTPConnection(*self.server.server_address, timeout=3)
        conn.request(method, path, headers={'Authorization': 'Bearer ' + token})
        response = conn.getresponse()
        result = response.status, response.read().decode(), dict(response.getheaders())
        conn.close()
        return result

    def test_success_projects_only_approved_fields(self):
        code, body, headers = self.request('/api/diagnostics/r1/routes')
        self.assertEqual(code, 200)
        data = json.loads(body)
        self.assertEqual(data['output'], 'route data')
        self.assertNotIn('secret', body)
        self.assertNotIn('admin_token', body)
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')
        self.assertNotIn('Access-Control-Allow-Origin', headers)

    def test_auth_and_scopes_fail_closed(self):
        for token in ('', 'wrong', 'a' * 40, 'é' * 40):
            self.assertEqual(self.request('/api/diagnostics/r1/routes', token=token)[0], 401)
        for path in ('/api/diagnostics/r2/routes', '/api/diagnostics/r1/configure',
                     '/api/diagnostics/r1/routes?cmd=sh', '/api/diagnostics/../routes',
                     '/api/diagnostics/%72%31/routes', '/api/lab', '/'):
            self.assertEqual(self.request(path)[0], 404)

    def test_no_mutating_methods(self):
        for method in ('POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'):
            for path in ('/api/lab/start', '/api/lab/stop', '/api/diagnostics/r1/routes'):
                self.assertEqual(self.request(path, method)[0], 405)

    def test_unavailable_stale_corrupt_and_failed_snapshot_redacted(self):
        cases = [dict(self.snapshot, captured_at=time.time()-61),
                 dict(self.snapshot, captured_at=time.time()+60),
                 dict(self.snapshot, captured_at=True),
                 dict(self.snapshot, diagnostics={'r1': {'routes': {'ok': False, 'output': 'sensitive error'}}})]
        for snapshot in cases:
            self.path.write_text(json.dumps(snapshot), encoding='utf-8')
            code, body, _ = self.request('/api/diagnostics/r1/routes')
            self.assertEqual(code, 503)
            self.assertNotIn('sensitive', body)
        for raw in ('broken', '{"captured_at": NaN}', 'x' * 1000001):
            self.path.write_text(raw, encoding='utf-8')
            self.assertEqual(self.request('/api/diagnostics/r1/routes')[0], 503)
        self.path.unlink()
        self.assertEqual(self.request('/api/diagnostics/r1/routes')[0], 503)

    def test_invalid_configuration_rejected(self):
        for token, routers in (('', {'r1'}), ('short', {'r1'}), ('é'*40, {'r1'}),
                               ('s'*40, set()), ('s'*40, {'r3'})):
            with self.assertRaises(ValueError):
                make_server(token, self.path, routers, port=0)

    def test_admin_environment_is_rejected_before_binding(self):
        with patch.dict('os.environ', {'AGLAB_LAB_TOKEN': 'admin-secret'}), patch.object(student_api, 'make_server') as bind:
            with self.assertRaises(SystemExit):
                student_api.main()
            bind.assert_not_called()

    def test_output_is_bounded(self):
        self.snapshot['diagnostics']['r1']['routes']['output'] = 'x' * 13000
        self.write()
        code, body, _ = self.request('/api/diagnostics/r1/routes')
        self.assertEqual(code, 200)
        self.assertEqual(len(json.loads(body)['output']), 12000)

    def test_export_projects_fields_and_failure_preserves_previous_snapshot(self):
        calls = []
        def fetch(router, view):
            calls.append((router, view))
            return {'ok': True, 'output': 'approved', 'admin_secret': 'hidden'}
        export_snapshot(self.path, 'a'*40, {'r1'}, fetch=fetch)
        self.assertEqual(calls, [('r1', 'routes'), ('r1', 'interfaces'), ('r1', 'neighbors')])
        self.assertNotIn('r2', json.loads(self.path.read_text())['diagnostics'])
        self.assertNotIn('admin_secret', self.path.read_text())
        previous = self.path.read_bytes()
        with self.assertRaises(ValueError):
            export_snapshot(self.path, 'a'*40, {'r1'}, fetch=lambda *_: {'ok': False, 'output': 'secret'})
        self.assertEqual(self.path.read_bytes(), previous)


if __name__ == '__main__':
    unittest.main()
