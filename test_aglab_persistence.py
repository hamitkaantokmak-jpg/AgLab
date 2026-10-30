"""Real origin and disk-backed browser profile: topology persistence and recovery."""
import functools
import http.server
import json
import tempfile
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent
KEY = 'aglab-topology-v23'
fixture = json.loads((ROOT / 'static-routing-two-routers.aglab.json').read_text())
expected_report = fixture['importReport']
expected_archive = fixture['sourceArchive']
switch_id = next(d['id'] for d in fixture['devices'] if d['name'] == 'SW1')


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/AgLab_Final_PKT_Import.html'
try:
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
        profile = str(Path(tmp) / 'profile')
        errors = []

        def open_context():
            context = pw.chromium.launch_persistent_context(profile, headless=True)
            page = context.pages[0]
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(url)
            page.evaluate("showArea('lab')")
            return context, page

        def saved(page):
            return page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY)

        def command(page, device_id, text):
            before = page.locator('#ptTerminal').inner_text()
            page.evaluate('''([id, text]) => {
                document.querySelector('#ptCliDevice').value = id;
                document.querySelector('#ptCliInput').value = text;
                document.querySelector('#ptCliForm').requestSubmit();
            }''', [device_id, text])
            return page.locator('#ptTerminal').inner_text()[len(before):]

        def verify(page):
            snapshot = saved(page)
            assert snapshot.get('importReport') == expected_report, 'Import coverage report lost'
            assert snapshot['sourceArchive'] == expected_archive, 'Source archive changed'
            device = next(d for d in snapshot['devices'] if d['id'] == switch_id)
            assert device['name'] == 'KALICI-SW'
            assert 77 in device['vlans']
            assert device['interfaces']['fa0/24']['allowed'] == [77]
            assert device['interfaces']['fa0/24']['enabled'] is False
            output = command(page, 'd3', 'ping 192.168.2.2')
            assert 'Success rate is 100 percent (5/5)' in output, output
            return snapshot

        context, page = open_context()
        page.locator('#ptImportFile').set_input_files(str(ROOT / 'static-routing-two-routers.aglab.json'))
        expect(page.locator('#ptTerminal')).to_contain_text('8 cihaz, 7 bağlantı')
        assert saved(page).get('importReport') == expected_report, 'Import report not persisted'
        for text in ['enable', 'configure terminal', 'hostname KALICI-SW', 'vlan 77',
                     'interface fa0/24', 'switchport mode trunk', 'switchport trunk allowed vlan 77',
                     'shutdown', 'end']:
            command(page, switch_id, text)
        verify(page)
        page.reload()
        page.evaluate("showArea('lab')")
        expect(page.locator('#ptTerminal')).to_contain_text('Kaydedilmiş topoloji doğrulanarak yüklendi.')
        expect(page.locator('#ptTerminal')).to_contain_text('CLI KAPSAM UYARISI:')
        verify(page)
        context.close()

        # A fresh Chromium process reopens the same on-disk profile.
        context, page = open_context()
        verify(page)
        previous = page.evaluate('(key) => localStorage.getItem(key)', KEY)
        invalid = Path(tmp) / 'invalid.json'
        invalid.write_text('{"app":"AgLab","devices":[],"links":[{"a":"missing"}]}')
        page.locator('#ptImportFile').set_input_files(str(invalid))
        expect(page.locator('#ptTerminal')).to_contain_text('İçe aktarma başarısız:')
        assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == previous

        # Simulated storage quota failure must retain the last good disk snapshot.
        page.evaluate('''() => {
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = function(key, value) {
                if (key === 'aglab-topology-v23') throw new DOMException('test quota', 'QuotaExceededError');
                return original.call(this, key, value);
            };
        }''')
        for text in ['enable', 'configure terminal', 'hostname BELLEKTE-SW', 'end']:
            command(page, switch_id, text)
        expect(page.locator('#aglabSaveWarning')).to_be_visible()
        assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == previous
        page.locator('#uxMoreLabActions').click()
        with page.expect_download() as download:
            page.locator('#ptExport').click()
        exported = Path(tmp) / 'recovered.json'
        download.value.save_as(str(exported))
        recovery = json.loads(exported.read_text())
        assert recovery['importReport'] == expected_report
        assert recovery['sourceArchive'] == expected_archive
        assert next(d for d in recovery['devices'] if d['id'] == switch_id)['name'] == 'BELLEKTE-SW'
        context.close()

        context, page = open_context()
        verify(page)  # only the last successful disk save survived the quota failure
        page.evaluate('''() => {
            document.querySelector('#sharedScenarioSelect').value = 'access-vlan';
            document.querySelector('#sharedScenarioLoad').click();
        }''')
        scenario = saved(page)
        assert 'importReport' not in scenario and 'sourceArchive' not in scenario
        page.locator('#ptImportFile').set_input_files(str(ROOT / 'static-routing-two-routers.aglab.json'))
        expect(page.locator('#ptTerminal')).to_contain_text('8 cihaz, 7 bağlantı')
        page.locator('#uxMoreLabActions').click()
        page.locator('#ptReset').click()
        clean = saved(page)
        assert 'importReport' not in clean and 'sourceArchive' not in clean
        assert len(clean['devices']) == 6
        assert not errors, errors
        context.close()
finally:
    server.shutdown()
    server.server_close()
print('PASS: reload, fresh browser session, VLAN/port state, source report/archive, invalid import and quota recovery')
