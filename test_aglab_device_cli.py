"""Device-local CLI interactions in Chromium: click, drag, cabling and mobile."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent
TOPOLOGY = {'app': 'AgLab', 'version': 23, 'devices': [
    {'id': 'pc', 'name': 'PC-Test', 'type': 'PC', 'x': 170, 'y': 120, 'w': 104, 'h': 72,
     'enabled': True, 'ip': '192.168.10.10', 'mask': '255.255.255.0', 'gateway': '192.168.10.1',
     'ports': ['eth0'], 'interfaces': {'eth0': {'enabled': True}}},
    {'id': 'router', 'name': 'Router-Test', 'type': 'Router', 'x': 630, 'y': 270, 'w': 108, 'h': 72,
     'enabled': True, 'ports': ['g0/0'], 'interfaces': {
         'g0/0': {'ip': '192.168.10.1', 'mask': '255.255.255.0', 'enabled': True}}}],
    'links': [], 'nextId': 3}

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    for mobile in (False, True):
        context = browser.new_context(viewport={'width': 390 if mobile else 1280, 'height': 900},
                                      has_touch=mobile, is_mobile=mobile)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto((ROOT / 'AgLab_Final_PKT_Import.html').as_uri())
        page.click('[data-area="lab"]')
        page.click('#ux14Free')
        page.evaluate('(topology) => academyEngine.load(topology)', TOPOLOGY)
        pc = page.locator('#ptCanvas g[data-id="pc"]')
        pc.tap() if mobile else pc.click()
        dialog = page.locator('#ptDeviceCliDialog')
        expect(dialog).to_be_visible()
        expect(dialog).to_contain_text('PC-Test')
        expect(page.locator('#ptCliDevice')).to_have_value('pc')
        expect(page.locator('#ptCliInput')).to_be_focused()
        page.locator('#ptCliInput').fill('ipconfig')
        page.locator('#ptCliInput').press('Enter')
        expect(page.locator('#ptTerminal')).to_contain_text('192.168.10.10')
        bounds = dialog.bounding_box()
        assert bounds and bounds['x'] >= 0 and bounds['x'] + bounds['width'] <= page.viewport_size['width']+1
        assert bounds['y'] >= 0 and bounds['y'] + bounds['height'] <= page.viewport_size['height']+1
        output = Path(os.environ.get('AGLAB_TEST_ARTIFACT_DIR', ROOT / 'dist'))
        output.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(output / ('device-cli-mobile.png' if mobile else 'device-cli.png')))
        page.keyboard.press('Escape')
        expect(dialog).not_to_be_visible()
        expect(pc).to_be_focused()
        router = page.locator('#ptCanvas g[data-id="router"]')
        router.focus()
        router.press('Enter')
        expect(dialog).to_be_visible()
        expect(page.locator('#ptCliDevice')).to_have_value('router')
        expect(page.locator('#ptPrompt')).to_have_text('Router-Test>')
        for command in ('enable', 'configure terminal', 'interface g0/0', 'shutdown', 'end'):
            page.locator('#ptCliInput').fill(command)
            page.locator('#ptCliInput').press('Enter')
        state = page.evaluate('academyEngine.snapshot()')
        assert state['devices'][1]['interfaces']['g0/0']['enabled'] is False
        assert state['devices'][0]['interfaces']['eth0']['enabled'] is True
        page.get_by_role('button', name='CLI penceresini kapat').click()
        expect(dialog).not_to_be_visible()
        # Cabling uses a fresh topology: the router port above was deliberately shut down.
        page.evaluate('(topology) => academyEngine.load(topology)', TOPOLOGY)
        pc.scroll_into_view_if_needed()
        before = page.evaluate('academyEngine.snapshot()')
        bounds = pc.bounding_box()
        x, y = bounds['x'] + bounds['width']/2, bounds['y'] + bounds['height']/2
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x+35, y+20, steps=8)
        page.mouse.up()
        expect(dialog).not_to_be_visible()
        after = page.evaluate('academyEngine.snapshot()')
        assert after['devices'][0]['x'] != before['devices'][0]['x']
        page.click('#ptConnectMode')
        pc.click()
        router.click()
        expect(dialog).not_to_be_visible()
        final_state = page.evaluate('academyEngine.snapshot()')
        assert len(final_state['links']) == 1, final_state
        assert not errors, errors
        context.close()
    browser.close()
print('PASS device CLI: click/keyboard, correct device, commands, drag, cabling and 390/1280 viewport')
