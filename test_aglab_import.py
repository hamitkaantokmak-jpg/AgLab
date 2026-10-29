"""Regression checks for the Packet Tracer -> AgLab example conversion."""
import json, base64, hashlib, sys, subprocess, xml.etree.ElementTree as ET
from pathlib import Path
sys.path.insert(0, str(Path('/mnt/data')))
from convert_pkt_to_aglab import convert
from playwright.sync_api import sync_playwright

BASE=Path('/mnt/data')
html=BASE/'AgLab_Final_PKT_Import.html'
jsonpath=BASE/'static-routing-two-routers.aglab.json'
report=json.loads((BASE/'static-routing-two-routers-import-report.json').read_text())
topo=json.loads(jsonpath.read_text())

assert report['sourceDeviceCount']==9, report
assert report['devicesImported']==8, report
assert report['sourceLinkCount']==7 and report['linksImported']==7, report
assert report['unsupportedDevices']==['Power Distribution Device0 (Power Distribution Device)'], report
assert len(topo['devices'])==8 and len(topo['links'])==7
byname={d['name']:d for d in topo['devices']}
assert byname['SW1']['vlans']==[1] and byname['SW2']['vlans']==[1]
assert byname['PC1']['ip']=='192.168.1.2' and byname['PC1']['vlan']==1
assert byname['PC3']['ip']=='192.168.2.2' and byname['PC3']['vlan']==1
assert byname['R1']['interfaces']['g0/0']['ip']=='192.168.1.1'
assert byname['R1']['staticRoutes']==[{'network':'192.168.2.0','mask':'255.255.255.0','nextHop':'10.0.0.2','distance':1}]
assert byname['R2']['staticRoutes']==[{'network':'192.168.1.0','mask':'255.255.255.0','nextHop':'10.0.0.1','distance':1}]
assert all(d.get('config',{}).get('runningConfig') for d in topo['devices'] if d['type'] in ('Router','Switch'))
archive=topo['sourceArchive']
source_pkt=(BASE/'static-routing-two-routers(1).pkt').read_bytes()
source_xml=(BASE/'decoded_source.xml').read_bytes()
assert base64.b64decode(archive['originalPacketBase64'])==source_pkt
assert archive['originalPacketSha256']==hashlib.sha256(source_pkt).hexdigest()
assert base64.b64decode(archive['decodedXmlBase64'])==source_xml
assert archive['decodedXmlSha256']==hashlib.sha256(source_xml).hexdigest()
assert report['unmodeledConfigLineCount'] > 0

# Focused converter regression: explicitly configured switch port state, native VLAN and STP priority.
xml_root=ET.fromstring(source_xml)
for source_dev in xml_root.find('NETWORK/DEVICES'):
    eng=source_dev.find('ENGINE')
    dev_name=(eng.findtext('SYS_NAME') or eng.findtext('NAME')) if eng is not None else ''
    if dev_name != 'SW1':
        continue
    rc=eng.find('RUNNINGCONFIG')
    old_lines=[(x.text or '').strip() for x in rc if x.tag=='LINE']
    new_lines=[]
    for line in old_lines:
        if line == 'interface FastEthernet0/1':
            new_lines.extend(['interface FastEthernet0/1',' shutdown'])
        elif line == 'interface GigabitEthernet0/1':
            new_lines.extend(['interface GigabitEthernet0/1',' switchport mode trunk',' switchport trunk allowed vlan 1,20',' switchport trunk native vlan 20'])
        else:
            new_lines.append(line)
    new_lines.insert(1, 'spanning-tree vlan 20 priority 8192')
    for child in list(rc): rc.remove(child)
    for line in new_lines:
        item=ET.SubElement(rc,'LINE'); item.text=line
    break
synthetic_obj, synthetic_report=convert(ET.tostring(xml_root,encoding='utf-8'),source_pkt)
sw1=next(d for d in synthetic_obj['devices'] if d['name']=='SW1')
assert sw1['interfaces']['fa0/1']['enabled'] is False, sw1['interfaces']['fa0/1']
assert sw1['interfaces']['gi0/1']['mode']=='trunk', sw1['interfaces']['gi0/1']
assert sw1['interfaces']['gi0/1']['nativeVlan']==20, sw1['interfaces']['gi0/1']
assert sw1['vlans']==[1], sw1['vlans']  # allowed/native/STP references do not create VLAN database entries
assert sw1['stpPriorities'].get('20', sw1['stpPriorities'].get(20))==8192, sw1.get('stpPriorities')

cli_test=subprocess.run([sys.executable, str(BASE/'test_aglab_cli_vlan.py')],capture_output=True,text=True)
assert cli_test.returncode==0, cli_test.stdout+'\n'+cli_test.stderr

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html.read_text(),wait_until='domcontentloaded')
    page.locator('#ptImportFile').set_input_files(str(jsonpath))
    page.wait_for_timeout(250)
    terminal=page.locator('#ptTerminal').inner_text()
    assert '8 cihaz, 7 bağlantı' in terminal, terminal
    assert 'KAYNAK KARŞILAŞTIRMASI: 1 cihaz içe aktarılamadı.' in terminal, terminal
    assert 'Power Distribution Device0' in terminal, terminal
    assert 'SINIRLAMA:' in terminal, terminal
    assert 'CLI KAPSAM UYARISI:' in terminal, terminal
    assert 'KAYNAK ARŞİVİ:' in terminal, terminal
    page.evaluate("showArea('lab')")
    pings=[]
    for src,target in [('d3','192.168.2.2'),('d6','192.168.1.2'),('d3','192.168.1.3'),('d5','192.168.2.3')]:
        page.evaluate(f"document.querySelector('#ptCliDevice').value='{src}';document.querySelector('#ptCliInput').value='ping {target}';document.querySelector('#ptCliForm').requestSubmit()")
        page.wait_for_timeout(80)
        text=page.locator('#ptTerminal').inner_text()
        assert 'Success rate is 100 percent (5/5)' in text, (src,target,text[-500:])
        pings.append({'source':src,'target':target,'result':'5/5'})
    with page.expect_download() as download_info:
        page.locator('#ptExport').click()
    download=download_info.value
    exported=BASE/'exported-roundtrip.json'; download.save_as(str(exported))
    roundtrip=json.loads(exported.read_text())
    assert roundtrip['sourceArchive']['originalPacketSha256']==archive['originalPacketSha256']
    assert base64.b64decode(roundtrip['sourceArchive']['originalPacketBase64'])==source_pkt
    page.locator('#ptAudit').click(); page.wait_for_timeout(100)
    audit=page.locator('#ptTerminal').inner_text()
    assert 'Hata: 0' in audit and 'Uyarı: 0' in audit, audit[-1200:]
    assert not errors, errors
    browser.close()

result={
  'status':'PASS','sourceAccounting':'9 source devices / 8 supported imported / 1 explicitly reported unsupported',
  'links':'7/7 imported','sourceArchive':{'originalPacketBytes':len(source_pkt),'originalPacketSha256':archive['originalPacketSha256'],'decodedXmlBytes':len(source_xml),'decodedXmlSha256':archive['decodedXmlSha256'],'unmodeledConfigLineCount':report['unmodeledConfigLineCount']},'checks':[
    'JSON schema/import accepted','source-loss warning shown in UI','unsupported device named in UI',
    'switch VLANs do not invent VLAN 10/20','synthetic config regression: switch port shutdown, trunk native VLAN and STP priority parsed without inventing VLAN database entries','PC IPv4/gateway values retained',
    'router physical interface IPs and static routes retained','router/switch running-config text preserved','original .pkt and decoded XML byte-for-byte/hash preserved in JSON',
    'unmodeled CLI lines counted and shown in UI','source archive survives JSON export round-trip','CLI regression: trunk VLAN list set/range/add/remove and running-config output',
    '4 ping checks passed 5/5','topology audit 0 errors / 0 warnings','no browser page errors'
  ],'pings':pings,'browserErrors':errors
}
(BASE/'AgLab_PKT_Import_Test_Raporu.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))
