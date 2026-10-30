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
    page.select_option('#academySelect','AGL-005')
    page.click('#academyStart')
    page.select_option('#ptCliDevice',label='SW1')
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
