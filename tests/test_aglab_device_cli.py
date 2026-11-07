"""Device-local CLI interactions in Chromium: click, drag, cabling and mobile."""
import json
import os
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

from aglab_test_support import ROOT, launch_chromium
TOPOLOGY = {'app': 'AgLab', 'version': 23, 'devices': [
    {'id': 'pc', 'name': 'PC-Test', 'type': 'PC', 'x': 170, 'y': 120, 'w': 104, 'h': 72,
     'enabled': True, 'ip': '192.168.10.10', 'mask': '255.255.255.0', 'gateway': '192.168.10.1',
     'ports': ['eth0'], 'interfaces': {'eth0': {'enabled': True}}},
    {'id': 'router', 'name': 'Router-Test', 'type': 'Router', 'x': 630, 'y': 270, 'w': 108, 'h': 72,
     'enabled': True, 'ports': ['g0/0'], 'interfaces': {
         'g0/0': {'ip': '192.168.10.1', 'mask': '255.255.255.0', 'enabled': True}}}],
    'links': [], 'nextId': 3}

with sync_playwright() as pw:
    browser = launch_chromium(pw)
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
        # A real tap/click can include a few pixels of hand movement. It must
        # not be mistaken for a deliberate drag or silently stop opening CLI.
        pc.scroll_into_view_if_needed();box=pc.bounding_box()
        x,y=box['x']+box['width']/2,box['y']+box['height']/2
        if mobile:
            touch=context.new_cdp_session(page)
            touch.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
            touch.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+4,'y':y+1}]})
            touch.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        else:
            page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+2,y+2);page.mouse.up()
        expect(dialog).to_be_visible()
        page.keyboard.press('Escape')
        router = page.locator('#ptCanvas g[data-id="router"]')
        router.focus()
        router.press('Enter')
        expect(dialog).to_be_visible()
        expect(page.locator('#ptCliDevice')).to_have_value('router')
        expect(page.locator('#ptPrompt')).to_have_text('Router-Test>')
        page.locator('#ptCliInput').press('ArrowUp')
        expect(page.locator('#ptCliInput')).to_have_value('')
        for command in ('enable', 'configure terminal', 'interface g0/0', 'shutdown', 'end'):
            page.locator('#ptCliInput').fill(command)
            page.locator('#ptCliInput').press('Enter')
        state = page.evaluate('academyEngine.snapshot()')
        assert state['devices'][1]['interfaces']['g0/0']['enabled'] is False
        assert state['devices'][0]['interfaces']['eth0']['enabled'] is True
        page.get_by_role('button', name='CLI penceresini kapat').click()
        expect(dialog).not_to_be_visible()
        pc.tap() if mobile else pc.click()
        page.locator('#ptCliInput').press('ArrowUp')
        expect(page.locator('#ptCliInput')).to_have_value('ipconfig')
        page.keyboard.press('Escape')
        # Cabling uses a fresh topology: the router port above was deliberately shut down.
        page.evaluate('(topology) => academyEngine.load(topology)', TOPOLOGY)
        pc.scroll_into_view_if_needed()
        before = page.evaluate('academyEngine.snapshot()')
        bounds = pc.bounding_box()
        x, y = bounds['x'] + bounds['width']/2, bounds['y'] + bounds['height']/2
        if mobile:
            touch.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
            for i in range(1,9):touch.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+35*i/8,'y':y+20*i/8}]})
            touch.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        else:
            page.mouse.move(x, y);page.mouse.down();page.mouse.move(x+35, y+20, steps=8);page.mouse.up()
        expect(dialog).not_to_be_visible()
        after = page.evaluate('academyEngine.snapshot()')
        assert after['devices'][0]['x'] != before['devices'][0]['x']
        page.click('#ptConnectMode')
        pc.tap() if mobile else pc.click()
        router.tap() if mobile else router.click()
        expect(dialog).not_to_be_visible()
        final_state = page.evaluate('academyEngine.snapshot()')
        assert len(final_state['links']) == 1, final_state
        # The completed cable gesture leaves CLI clicks usable again.
        pc.tap() if mobile else pc.click()
        expect(dialog).to_be_visible()
        page.keyboard.press('Escape')
        closed=page.evaluate('academyEngine.snapshot()')
        assert {k:v for k,v in closed.items() if k!='selected'}=={k:v for k,v in final_state.items() if k!='selected'}
        page.click('#ptConnectMode');page.keyboard.press('Escape')
        router.tap() if mobile else router.click()
        expect(dialog).to_be_visible();page.keyboard.press('Escape')
        router.focus();router.press('Space');expect(dialog).to_be_visible()
        expect(page.locator('#ptCliDevice')).to_have_value('router')
        page.keyboard.press('Escape')
        assert not errors, errors
        context.close()
    # Real clicks on the shipped initial topology and after mode/import/reload
    # transitions. No direct openDeviceCli call is used anywhere in this test.
    for mobile in (False,True):
        context=browser.new_context(viewport={'width':390 if mobile else 1366,'height':900},has_touch=mobile,is_mobile=mobile)
        page=context.new_page();page.goto((ROOT/'AgLab_Final_PKT_Import.html').as_uri());page.click('[data-area="lab"]')
        def open_and_close(kind=None,device_id=None):
            if kind or device_id:
                target=next(d for d in page.evaluate('aglabEngines.capture().devices') if d['id']==device_id or device_id is None and d['type']==kind)
                node=page.locator('#ptCanvas g[data-id="'+target['id']+'"]')
            else:node=page.locator('#ptCanvas g[data-id]').first
            node.tap() if mobile else node.click()
            expect(page.locator('#ptDeviceCliDialog')).to_be_visible()
            expect(page.locator('#ptCliDevice')).to_have_value(node.get_attribute('data-id'))
            expect(page.locator('#ptCliInput')).to_be_focused()
            page.keyboard.press('Escape')
        for kind in ('PC','Switch','Router'):open_and_close(kind)
        page.click('#ux14Guided');open_and_close()
        page.click('#academyStart')
        if page.locator('#academyReplaceContinue').is_visible():page.click('#academyReplaceContinue')
        open_and_close()
        page.click('#ux14Free');previous_ids={d['id'] for d in page.evaluate('aglabEngines.capture().devices')}
        page.click('[data-pt-add="Switch"]')
        added=next(d for d in page.evaluate('aglabEngines.capture().devices') if d['id'] not in previous_ids)
        open_and_close(device_id=added['id'])
        with tempfile.TemporaryDirectory() as tmp:
            file=Path(tmp)/'topology.json';file.write_text(json.dumps(TOPOLOGY))
            page.locator('#ptImportFile').set_input_files(str(file))
            page.wait_for_function('aglabEngines.capture().devices.some(d=>d.id==="pc")')
            open_and_close('PC')
        page.reload();page.click('[data-area="lab"]');page.click('#ux14Free');open_and_close('Router')
        if not mobile:
            # Pointer selection of another visible device while CLI is open.
            page.locator('[data-id="pc"]').click()
            page.fill('#ptCliInput','shutdown')
            page.locator('[data-id="router"]').click()
            expect(page.locator('#ptCliDevice')).to_have_value('router')
            expect(page.locator('#ptCliInput')).to_have_value('')
            page.keyboard.press('Escape')
        else:
            page.locator('[data-id="pc"]').tap();page.fill('#ptCliInput','shutdown')
            page.select_option('#ptCliDevice','router')
            expect(page.locator('#ptCliInput')).to_have_value('')
            expect(page.locator('#ptDeviceCliTitle')).to_contain_text('Router-Test')
            page.keyboard.press('Escape')
        context.close()
    browser.close()
print('PASS device CLI: click/keyboard, correct device, commands, drag, cabling and 390/1280 viewport')
