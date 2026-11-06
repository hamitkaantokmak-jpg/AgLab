"""Öğrenci v23 arayüzü için gerçek Chromium görünürlük, gezinme ve CLI kontrolleri."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':1280,'height':900})
    page.set_default_timeout(10000)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto((ROOT/'AgLab_Final_PKT_Import.html').as_uri())
    expect(page.locator('#studentFlow')).to_be_visible()
    expect(page.locator('[data-area="learn"]')).to_be_visible()
    page.click('[data-area="learn"]')
    expect(page.locator('#studentFlow')).to_be_visible()
    expect(page.locator('#lessonNav')).not_to_be_visible()  # Eski öğrenme araçları isteğe bağlı
    page.click('[data-area="lab"]')
    expect(page.locator('#ux14Guided')).to_be_visible()
    expect(page.locator('#ux14Free')).to_be_visible()
    expect(page.locator('#academyPanel')).to_be_visible()
    # Optional guide must not rewrite the student's topology or fabricate ping evidence.
    guide_snapshot = page.evaluate('academyEngine.snapshot()')
    page.locator('#aglabFirstNetworkGuide summary').click()
    expect(page.locator('#firstGuideSteps li')).to_have_count(9)
    expect(page.locator('#firstGuidePing')).to_be_disabled()
    expect(page.locator('#firstGuideStatus')).to_contain_text('1 / 9')
    assert page.evaluate('academyEngine.snapshot()') == guide_snapshot
    page.click('#firstGuideRefresh')
    assert page.evaluate('academyEngine.snapshot()') == guide_snapshot
    page.locator('#aglabFirstNetworkGuide summary').click()
    # Search selects a lab without replacing the current topology or starting it.
    before_search = page.evaluate('academyEngine.snapshot()')
    page.select_option('#academyProgressFilter','completed')
    expect(page.locator('#academySearchStatus')).to_contain_text('0 / 40')
    page.select_option('#academyProgressFilter','remaining')
    expect(page.locator('#academySearchStatus')).to_contain_text('40 / 40')
    page.select_option('#academyProgressFilter','all')
    page.fill('#academySearch','AGL-024')
    expect(page.locator('#academySearchStatus')).to_contain_text('1 / 40')
    page.click('#academySearchFind')
    expect(page.locator('#academySelect')).to_have_value('AGL-024')
    assert page.evaluate('academyEngine.snapshot()') == before_search
    page.fill('#academySearch','not-a-lab-999')
    expect(page.locator('#academySearchFind')).to_be_disabled()
    page.fill('#academySearch','')
    expect(page.locator('#academySearchStatus')).to_contain_text('40 / 40')
    expect(page.locator('#packetDetectiveEmptyGuide')).to_be_visible()
    page.select_option('#packetDetectiveViewMode','simple')
    expect(page.locator('#packetDetectiveRaw')).to_be_hidden()
    page.select_option('#packetDetectiveViewMode','technical')
    expect(page.locator('#packetDetectiveRaw')).not_to_be_hidden()
    page.click('#packetDetectiveOpenCli')
    expect(page.locator('#ptCliInput')).to_be_focused()
    page.select_option('#academySelect','AGL-005')
    page.click('#academyStart')
    if page.locator('#academyReplacePrompt').is_visible():
        page.click('#academyReplaceContinue')
    page.select_option('#ptCliDevice','SW1')
    for cmd in ('enable','configure terminal','interface fa0/2','no shutdown','end'):
        page.fill('#ptCliInput',cmd)
        page.press('#ptCliInput','Enter')
    page.click('#academyCheck')
    expect(page.locator('#academyResult')).to_contain_text('100/100')
    saved = page.evaluate('academyEngine.snapshot()')
    page.click('#ux14Free')
    expect(page.locator('#academyPanel')).not_to_be_visible()
    assert saved == page.evaluate('academyEngine.snapshot()'), 'Mod değiştirirken topoloji kayboldu'
    page.click('#uxMoreLabActions')
    expect(page.locator('#ptExport')).to_be_visible()
    page.click('[data-area="troubleshoot"]')
    expect(page.locator('#mission')).to_be_visible()
    page.fill('#command','help')
    page.press('#command','Enter')
    expect(page.locator('#terminal')).not_to_be_empty()
    for width in (390,1280):
        page.set_viewport_size({'width':width,'height':900})
        for area in ('learn','lab','troubleshoot'):
            page.click(f'[data-area="{area}"]')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1'),(width,area)
    assert not errors, errors
    browser.close()
print('PASS UI v23: Öğren, Akademi CLI 100/100, mod geçişi, gelişmiş araçlar, Sorun Çöz, 390/1280')
