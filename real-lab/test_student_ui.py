"""Real Chromium and student HTTP boundary; no administrator token or Docker."""
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from playwright.sync_api import sync_playwright, expect
from student_api import make_server

TOKEN = 'student-browser-test-key-' * 2


class StudentBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.snapshot = Path(cls.temp.name) / 'snapshot.json'
        cls.server = make_server(TOKEN, cls.snapshot, {'r1'}, port=0)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)
        cls.url = 'http://127.0.0.1:' + str(cls.server.server_address[1])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)
        cls.temp.cleanup()

    def write_snapshot(self, age=0):
        self.snapshot.write_text(json.dumps({'captured_at': time.time()-age, 'diagnostics': {
            'r1': {view: {'ok': True, 'output': output} for view, output in (
                ('routes', 'route data'), ('interfaces', '<img src=x onerror="window.injected=true">'),
                ('neighbors', ''))}}}), encoding='utf-8')

    def setUp(self):
        self.write_snapshot()
        self.context = self.browser.new_context(viewport={'width': 1000, 'height': 850})
        self.page = self.context.new_page()
        self.errors = []
        self.requests = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('request', lambda request: self.requests.append(request))
        self.page.goto(self.url)

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def connect(self, token=TOKEN):
        self.page.get_by_label('Öğrenci erişim anahtarı', exact=True).fill(token)
        self.page.get_by_role('button', name='Bağlan', exact=True).click()

    def connected(self):
        self.connect()
        expect(self.page.locator('#diagnostics-panel')).to_be_visible()

    def show(self):
        self.page.get_by_role('button', name='Tanıyı göster', exact=True).click()

    def test_invalid_key_never_exposes_diagnostics(self):
        self.connect('wrong-key-' * 5)
        expect(self.page.locator('#status')).to_contain_text('geçersiz')
        expect(self.page.locator('#diagnostics-panel')).to_be_hidden()
        self.assertFalse(any('/api/diagnostics/' in r.url for r in self.requests))

    def test_scoped_read_text_safety_and_no_persistent_key(self):
        self.connected()
        self.assertEqual(self.page.locator('#router option').all_text_contents(), ['r1'])
        self.assertEqual(self.page.locator('#access-key').input_value(), '')
        self.show()
        expect(self.page.locator('#output')).to_have_text('route data')
        self.page.locator('#view').select_option('interfaces')
        self.show()
        expect(self.page.locator('#output')).to_contain_text('<img')
        self.assertEqual(self.page.locator('#output img').count(), 0)
        self.assertIsNone(self.page.evaluate('window.injected'))
        self.assertEqual(self.page.evaluate('localStorage.length + sessionStorage.length'), 0)
        self.assertEqual(self.context.cookies(), [])
        for request in self.requests:
            self.assertEqual(request.method, 'GET')
            self.assertTrue(request.url.startswith(self.url + '/'))
            self.assertNotIn('/api/lab', request.url)
            self.assertNotIn(TOKEN, request.url)
        output = Path(__file__).resolve().parents[1] / 'dist'
        output.mkdir(exist_ok=True)
        self.page.screenshot(path=str(output / 'student-ui.png'), full_page=True)
        self.page.set_viewport_size({'width': 375, 'height': 820})
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))

    def test_unavailable_snapshot_clears_previous_output(self):
        self.connected()
        self.show()
        expect(self.page.locator('#output')).to_have_text('route data')
        self.write_snapshot(age=61)
        self.show()
        expect(self.page.locator('#status')).to_contain_text('yenilemesini iste')
        expect(self.page.locator('#output')).not_to_contain_text('route data')

    def test_display_expires_without_another_request(self):
        self.page.clock.install()
        self.connected()
        self.show()
        expect(self.page.locator('#output')).to_have_text('route data')
        self.page.clock.fast_forward(61000)
        expect(self.page.locator('#output')).to_contain_text('süresi doldu')
        expect(self.page.locator('#captured')).to_have_text('')

    def test_disconnect_cancels_late_response_and_allows_reconnect(self):
        self.connected()
        delayed = []
        self.page.route('**/api/diagnostics/**', lambda route: delayed.append(route))
        with self.page.expect_request('**/api/diagnostics/**'):
            self.show()
        expect(self.page.locator('#refresh')).to_be_disabled()
        self.page.get_by_role('button', name='Bağlantıyı kapat').click()
        expect(self.page.locator('#access-panel')).to_be_visible()
        self.assertEqual(len(delayed), 1)
        delayed[0].fulfill(status=200, content_type='application/json', body=json.dumps({
            'ok': True, 'router': 'r1', 'view': 'routes', 'captured_at': time.time(), 'output': 'late secret'}))
        self.page.unroute('**/api/diagnostics/**')
        self.connected()
        expect(self.page.locator('#router')).to_be_enabled()
        expect(self.page.locator('#output')).not_to_contain_text('late secret')
        self.show()
        expect(self.page.locator('#output')).to_have_text('route data')


if __name__ == '__main__':
    unittest.main()
