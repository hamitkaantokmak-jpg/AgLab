"""Student-only journey: solve, resume across processes, reset and retain progress."""
import functools
import http.server
import json
import tempfile
import threading
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}/AgLab_Final_PKT_Import.html'
try:
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
        errors = []
        def open_student(mobile=False):
            context = pw.chromium.launch_persistent_context(str(Path(tmp) / 'profile'), headless=True, viewport={'width':390,'height':844} if mobile else {'width':1280,'height':900})
            page = context.pages[0]
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(url)
            page.click('[data-area="lab"]')
            page.click('#ux14Guided')
            return context, page
        def cli(page, device, commands):
            page.select_option('#ptCliDevice', device)
            for command in commands:
                page.fill('#ptCliInput', command)
                page.locator('#ptCliInput').press('Enter')
        def resume(page, lab):
            expect(page.locator('#academySelect')).to_have_value(lab)
            expect(page.locator('#academyCheck')).to_be_enabled()
            expect(page.locator('#academyLesson')).to_contain_text(lab)
        context, page = open_student()
        page.select_option('#academySelect', 'AGL-005')
        page.click('#academyStart')
        page.click('#academyHint')
        page.click('#academyCheck')
        expect(page.locator('#academyResult h3')).not_to_contain_text('100/100')
        cli(page, 'SW1', ['enable', 'configure terminal', 'interface fa0/2', 'no shutdown', 'end'])
        page.click('#academyCheck')
        expect(page.locator('#academyResult h3')).to_contain_text('100/100')
        page.reload()
        page.click('[data-area="lab"]')
        page.click('#ux14Guided')
        resume(page, 'AGL-005')
        expect(page.locator('#academyHints li')).to_have_count(1)
        expect(page.locator('#academyResult h3')).to_contain_text('100/100')
        expect(page.locator('#academyProgress')).to_contain_text('1/30')
        context.close()
        context, page = open_student(mobile=True)
        resume(page, 'AGL-005')
        expect(page.locator('#academyProgress')).to_contain_text('1/30')

        # Answers and hints survive, without loading teacher target topology.
        page.select_option('#academySelect', 'AGL-001')
        page.click('#academyStart')
        page.select_option('#academyAnswer-router_required', 'false')
        page.click('#academyHint')
        page.reload()
        page.click('[data-area="lab"]')
        page.click('#ux14Guided')
        resume(page, 'AGL-001')
        expect(page.locator('#academyAnswer-router_required')).to_have_value('false')
        expect(page.locator('#academyHints li')).to_have_count(1)
        for host in ('PC1', 'PC2'):
            page.select_option('#ptSource', host)
            page.select_option('#ptTarget', 'SW1')
            page.click('#ptMakeLink')
        page.click('#academyCheck')
        expect(page.locator('#academyResult h3')).to_contain_text('100/100')
        expect(page.locator('#academyProgress')).to_contain_text('2/30')
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'Student journey overflows mobile viewport'

        # Resume recomputes grade: editing a solved network cannot restore stale 100.
        cli(page, 'SW1', ['enable', 'configure terminal', 'interface fa0/2', 'shutdown', 'end'])
        expect(page.locator('#academyResult')).to_contain_text('Yeniden kontrol et')
        page.reload()
        page.click('[data-area="lab"]')
        page.click('#ux14Guided')
        resume(page, 'AGL-001')
        expect(page.locator('#academyResult h3')).not_to_contain_text('100/100')
        expect(page.locator('#academyProgress')).to_contain_text('2/30')
        page.click('#academyReset')
        expect(page.locator('#academyAnswer-router_required')).to_have_value('')
        expect(page.locator('#academyHints li')).to_have_count(0)
        expect(page.locator('#academyResult')).to_be_empty()
        expect(page.locator('#academyProgress')).to_contain_text('2/30')
        initial = json.loads((ROOT / 'academy/student/AGL-001.json').read_text())['initial_topology']
        assert page.evaluate('academyEngine.snapshot()') == initial

        # Invalid session JSON must not replace the student's active work.
        snapshot = page.evaluate("localStorage.getItem('aglab-topology-v23')")
        invalid = json.loads(snapshot)
        invalid['academySession']['labId'] = 'UNKNOWN-LAB'
        path = Path(tmp) / 'invalid-session.json'
        path.write_text(json.dumps(invalid))
        page.locator('#ptImportFile').set_input_files(str(path))
        expect(page.locator('#ptTerminal')).to_contain_text('İçe aktarma başarısız:')
        assert page.evaluate("localStorage.getItem('aglab-topology-v23')") == snapshot
        page.locator('#ptImportFile').set_input_files(str(ROOT / 'static-routing-two-routers.aglab.json'))
        expect(page.locator('#academyCheck')).to_be_disabled()
        expect(page.locator('#academyProgress')).to_contain_text('2/30')
        assert not errors, errors
        context.close()
finally:
    server.shutdown()
    server.server_close()
print('PASS: student CLI/cabling journey, answers/hints/grade resume, fresh process, reset, progress and external import')
