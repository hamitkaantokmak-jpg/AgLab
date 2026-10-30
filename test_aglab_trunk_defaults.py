"""PT default trunk permissions and CLI all must include future VLANs."""
import json
import tempfile
from pathlib import Path
import xml.etree.ElementTree as ET
from convert_pkt_to_aglab import convert
from playwright.sync_api import sync_playwright

B = Path('/mnt/data') if Path('/mnt/data').is_dir() else Path(__file__).resolve().parent
ALL = list(range(1, 4095))


def switch(config):
    xml = ('<PACKETTRACER5><NETWORK><DEVICES><DEVICE><ENGINE>'
           '<TYPE>Switch</TYPE><NAME>SW</NAME><RUNNINGCONFIG>' +
           ''.join('<LINE>' + line + '</LINE>' for line in config) +
           '</RUNNINGCONFIG></ENGINE></DEVICE></DEVICES><LINKS/>'
           '</NETWORK></PACKETTRACER5>').encode()
    obj, _ = convert(xml)
    return obj['devices'][0]


for config, expected in [
    (['switchport mode trunk'], ALL),
    (['switchport mode trunk', 'switchport trunk allowed vlan remove 77'], [v for v in ALL if v != 77]),
    (['switchport trunk allowed vlan 77', 'switchport mode trunk'], [77]),
    (['switchport trunk allowed vlan none', 'switchport mode trunk'], []),
    (['switchport mode trunk', 'switchport mode access', 'switchport mode trunk'], ALL),
    (['switchport trunk allowed vlan remove 77', 'switchport mode trunk'], [v for v in ALL if v != 77]),
]:
    device = switch(['interface GigabitEthernet0/1'] + config)
    assert device['interfaces']['gi0/1']['allowed'] == expected, config
    assert device['vlans'] == [1], device['vlans']

# Two switches, two hosts, and a trunk with no explicit allowed-list command.
root = ET.Element('PACKETTRACER5')
network = ET.SubElement(root, 'NETWORK')
devices = ET.SubElement(network, 'DEVICES')
links = ET.SubElement(network, 'LINKS')
for number in (1, 2):
    engine = ET.SubElement(ET.SubElement(devices, 'DEVICE'), 'ENGINE')
    for key, value in [('TYPE', 'Switch'), ('NAME', 'SW' + str(number)), ('SAVE_REF_ID', 'SW' + str(number))]:
        ET.SubElement(engine, key).text = value
    config = ET.SubElement(engine, 'RUNNINGCONFIG')
    for line in ['vlan 77', 'interface FastEthernet0/1', 'switchport access vlan 77',
                 'interface GigabitEthernet0/1', 'switchport mode trunk']:
        ET.SubElement(config, 'LINE').text = line
    engine = ET.SubElement(ET.SubElement(devices, 'DEVICE'), 'ENGINE')
    for key, value in [('TYPE', 'PC'), ('NAME', 'PC' + str(number)),
                       ('SAVE_REF_ID', 'PC' + str(number)), ('IP', '192.168.77.' + str(number))]:
        ET.SubElement(engine, key).text = value
for a, pa, b, pb in [('SW1', 'GigabitEthernet0/1', 'SW2', 'GigabitEthernet0/1'),
                     ('SW1', 'FastEthernet0/1', 'PC1', 'FastEthernet0'),
                     ('SW2', 'FastEthernet0/1', 'PC2', 'FastEthernet0')]:
    cable = ET.SubElement(ET.SubElement(links, 'LINK'), 'CABLE')
    for key, value in [('FROM', a), ('TO', b), ('PORT', pa), ('PORT', pb)]:
        ET.SubElement(cable, key).text = value
obj, report = convert(ET.tostring(root))
assert not report['unmodeledConfigLines'], report

with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_content((B / 'AgLab_Final_PKT_Import.html').read_text(), wait_until='domcontentloaded')
    path = Path(tmp) / 'default-trunk.json'
    path.write_text(json.dumps(obj))
    page.locator('#ptImportFile').set_input_files(str(path))
    page.wait_for_timeout(150)

    def command(device, text):
        before = page.locator('#ptTerminal').inner_text()
        page.evaluate('''([id, text]) => {
            document.querySelector('#ptCliDevice').value = id;
            document.querySelector('#ptCliInput').value = text;
            document.querySelector('#ptCliForm').requestSubmit();
        }''', [device, text])
        return page.locator('#ptTerminal').inner_text()[len(before):]

    def ping(expected):
        out = command('d2', 'ping 192.168.77.2')
        assert ('Success rate is 100 percent' if expected else 'Success rate is 0 percent') in out, out

    ping(True)
    for text in ['enable', 'configure terminal', 'interface gi0/1', 'switchport trunk allowed vlan none', 'end']:
        command('d1', text)
    ping(False)
    for text in ['configure terminal', 'interface gi0/1', 'switchport trunk allowed vlan all', 'end']:
        command('d1', text)
    ping(True)
    # 'all' must already include a VLAN that does not exist yet.
    for device_id in ('d1', 'd3'):
        for text in ['configure terminal', 'vlan 333', 'exit', 'interface fa0/1',
                     'switchport access vlan 333', 'end']:
            command(device_id, text)
    ping(True)
    page.evaluate("showArea('lab')")
    page.locator('#fileTopologyDetails > summary').click()
    with page.expect_download() as download:
        page.locator('#ptExport').click()
    exported = Path(tmp) / 'export.json'
    download.value.save_as(str(exported))
    saved = json.loads(exported.read_text())
    for device in saved['devices']:
        if device['type'] == 'Switch':
            assert device['interfaces']['gi0/1']['allowed'] == ALL
            assert device['vlans'] == [1, 77, 333], device['vlans']
    assert not errors, errors
    browser.close()
print('PASS: 6 default/order cases; VLAN 77/333 ping, deny/all restore and JSON export')
