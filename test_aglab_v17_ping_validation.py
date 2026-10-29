from pathlib import Path
from playwright.sync_api import sync_playwright
h=Path('/mnt/data/AgLab_Final_PKT_Import.html').read_text()
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(h,wait_until='domcontentloaded')
 for ip in ['999.1.2.3','192.168.1','hello','-1.0.0.1']:
  page.evaluate("ip=>{document.querySelector('#ptCliInput').value='ping '+ip;document.querySelector('#ptCliForm').requestSubmit()}",ip)
  result=page.locator('#ptTerminal').inner_text()
  assert 'IPv4' in result,(ip,result[-500:])
 assert not errors,errors
 b.close()
print('PASS v17: invalid IPv4 ping targets rejected in Chromium')
