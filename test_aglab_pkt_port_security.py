"""PT wired MAC provenance and port-security -> shared Ethernet ingress engine."""
import base64
import copy
import json
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET
from playwright.sync_api import sync_playwright
from convert_pkt_to_aglab import convert, PacketTracerError
from test_aglab_pkt_config_context import topology

ROOT = Path(__file__).resolve().parent
MAC1 = '02:aa:00:00:00:11'
MAC2 = '02:aa:00:00:00:22'
OTHER = '02:bb:00:00:00:33'


def source(commands, macs=(MAC1, MAC2)):
    obj, _ = topology('Switch', commands, hosts=True)
    root = ET.fromstring(base64.b64decode(obj['sourceArchive']['decodedXmlBase64']))
    for engine, mac in zip(list(root.find('NETWORK/DEVICES'))[1:], macs):
        engine = engine.find('ENGINE')
        # Ignore an unrelated service MAC; only the single wired NIC is authoritative.
        ET.SubElement(ET.SubElement(engine, 'SERVICE'), 'MACADDRESS').text = OTHER
        port = ET.SubElement(ET.SubElement(engine, 'MODULE'), 'PORT')
        for key, value in [('TYPE', 'eCopperFastEthernet'), ('IP', engine.findtext('IP')),
                           ('SUBNET', '255.255.255.0'), ('MACADDRESS', mac)]:
            if value is not None:
                ET.SubElement(port, key).text = value
    return ET.tostring(root)


def imported(commands, macs=(MAC1, MAC2)):
    xml = source(commands, macs)
    obj, report = convert(xml, b'original-pkt')
    assert base64.b64decode(obj['sourceArchive']['decodedXmlBase64']) == xml
    assert base64.b64decode(obj['sourceArchive']['originalPacketBase64']) == b'original-pkt'
    return obj, report


class PortSecurityImportTests(unittest.TestCase):
    def test_static_mac_modes_and_wired_provenance(self):
        for mode in ['shutdown', 'restrict', 'protect']:
            obj, report = imported(['interface fa0/1', 'switchport port-security',
                'switchport port-security maximum 2', 'switchport port-security violation '+mode,
                'switchport port-security mac-address 02aa.0000.0011',
                'switchport port-security mac-address 02-AA-00-00-00-22'])
            self.assertEqual(obj['devices'][1].get('mac'), MAC1)
            self.assertEqual(obj['devices'][2].get('mac'), MAC2)
            self.assertEqual(obj['devices'][0]['interfaces']['fa0/1'].get('portSecurity'),
                             {'enabled': True, 'max': 2, 'violation': mode, 'macs': [MAC1, MAC2]})
            self.assertEqual(report['unmodeledConfigLines'], [])

    def test_invalid_commands_preserve_last_valid_policy(self):
        bad = ['switchport port-security maximum 0', 'switchport port-security maximum 1025',
               'switchport port-security violation unexpected',
               'switchport port-security mac-address 01:00:5e:00:00:01',
               'switchport port-security mac-address 00:00:00:00:00:00',
               'switchport port-security mac-address broken',
               'switchport port-security mac-address sticky',
               'switchport port-security mac-address sticky '+MAC1,
               'switchport port-security maximum 2 extra']
        obj, report = imported(['interface fa0/1', 'switchport port-security',
                               'switchport port-security mac-address '+MAC1, *bad])
        self.assertEqual(obj['devices'][0]['interfaces']['fa0/1'].get('portSecurity'),
                         {'enabled': True, 'max': 1, 'violation': 'shutdown', 'macs': [MAC1]})
        self.assertEqual([r['command'] for r in report['unmodeledConfigLines']], bad)

    def test_remove_disable_and_range_capacity_are_atomic(self):
        commands = ['interface range fa0/1 - 2', 'switchport port-security',
                    'switchport port-security maximum 2', 'switchport port-security mac-address '+MAC1,
                    'exit', 'interface fa0/2', 'switchport port-security mac-address '+MAC2,
                    'exit', 'interface range fa0/1 - 2', 'switchport port-security maximum 1',
                    'no switchport port-security mac-address '+MAC1, 'no switchport port-security']
        obj, report = imported(commands)
        for name, macs in [('fa0/1', []), ('fa0/2', [MAC2])]:
            self.assertEqual(obj['devices'][0]['interfaces'][name].get('portSecurity'),
                             {'enabled': False, 'max': 2, 'violation': 'shutdown', 'macs': macs})
        self.assertEqual([(r['line'], r['command']) for r in report['unmodeledConfigLines']],
                         [(10, 'switchport port-security maximum 1')])

    def test_invalid_duplicate_and_ambiguous_source_macs(self):
        for macs in [(MAC1, MAC1), ('00:00:00:00:00:00', MAC2), ('01:00:5e:00:00:01', MAC2), ('', MAC2)]:
            with self.subTest(macs=macs), self.assertRaises(PacketTracerError):
                imported([], macs)
        root = ET.fromstring(source([]))
        host = list(root.find('NETWORK/DEVICES'))[1].find('ENGINE')
        module = host.find('MODULE')
        module.append(copy.deepcopy(module.find('PORT')))
        obj, report = convert(ET.tostring(root))
        self.assertNotIn('mac', obj['devices'][1])
        self.assertFalse(obj['devices'][1]['interfaces']['eth0']['enabled'])
        self.assertEqual(report['linksImported'], 1)

    def test_browser_static_policy_modes_recovery_and_round_trip(self):
        with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto((ROOT/'AgLab_Final_PKT_Import.html').as_uri())
            def commands(device, block):
                return page.evaluate('''([device,block])=>{
                    const terminal=document.querySelector('#ptTerminal'),before=terminal.innerText.length;
                    const select=document.querySelector('#ptCliDevice');select.value=device;
                    select.dispatchEvent(new Event('change'));
                    for(const command of block){document.querySelector('#ptCliInput').value=command;document.querySelector('#ptCliForm').requestSubmit();}
                    return terminal.innerText.slice(before);
                }''', [device, block])
            for mode in ['shutdown', 'restrict', 'protect']:
                for allowed in [MAC1, OTHER]:
                    with self.subTest(mode=mode, allowed=allowed):
                        obj, report = imported(['vlan 10', 'interface range fa0/1 - 2',
                            'switchport access vlan 10', 'exit', 'interface fa0/1',
                            'switchport port-security', 'switchport port-security violation '+mode,
                            'switchport port-security mac-address '+allowed])
                        self.assertEqual(report['unmodeledConfigLines'], [])
                        path = Path(tmp)/'security.json'
                        path.write_text(json.dumps(obj), encoding='utf-8')
                        before = len(page.locator('#ptTerminal').inner_text())
                        page.locator('#ptImportFile').set_input_files(str(path))
                        page.wait_for_function('n=>document.querySelector("#ptTerminal").innerText.length>n', arg=before)
                        self.assertIn('3 cihaz, 2 bağlantı', page.locator('#ptTerminal').inner_text()[before:])
                        output = commands('d2', ['ping 10.10.10.2'])
                        self.assertIn('100 percent' if allowed==MAC1 else '0 percent (0/5)', output)
                        iface = page.evaluate('academyEngine.snapshot().devices[0].interfaces["fa0/1"]')
                        self.assertEqual(bool(iface.get('errdisabled')), allowed!=MAC1 and mode=='shutdown')
                        if allowed!=MAC1:
                            commands('d1', ['enable','configure terminal','interface fa0/1',
                                'no switchport port-security mac-address '+OTHER,
                                'switchport port-security mac-address '+MAC1,'shutdown','no shutdown','end'])
                            self.assertIn('100 percent', commands('d2', ['ping 10.10.10.2']))
                        self.assertIn('02aa.0000.0011', commands('d1', ['show mac address-table']))
                        expected = page.evaluate('academyEngine.snapshot().devices')
                        page.reload()
                        self.assertEqual(page.evaluate('academyEngine.snapshot().devices'), expected)
                        with page.expect_download() as download:
                            page.evaluate('document.getElementById("ptExport").click()')
                        saved = Path(tmp)/'exported.json'
                        download.value.save_as(str(saved))
                        exported = json.loads(saved.read_text())
                        self.assertEqual(exported['devices'], expected)
                        self.assertEqual(exported['sourceArchive'], obj['sourceArchive'])
            dynamic, _ = imported(['vlan 10','interface range fa0/1 - 2','switchport access vlan 10',
                                   'exit','interface fa0/1','switchport port-security'])
            page.evaluate('(t)=>academyEngine.load(t)', dynamic)
            self.assertIn('100 percent', commands('d2', ['ping 10.10.10.2']))
            self.assertEqual(page.evaluate('academyEngine.snapshot().devices[0].interfaces["fa0/1"].portSecurity.macs'), [MAC1])
            self.assertEqual(errors, [])
            browser.close()

    def test_browser_invalid_mac_import_preserves_current_work(self):
        obj, _ = imported([])
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto((ROOT/'AgLab_Final_PKT_Import.html').as_uri())
            page.evaluate('(t)=>academyEngine.load(t)', obj)
            expected = page.evaluate('academyEngine.snapshot()')
            for mac in [None, '00:00:00:00:00:00', '01:00:5e:00:00:01', 'bad', MAC2]:
                bad = copy.deepcopy(obj)
                bad['devices'][1]['mac'] = mac
                self.assertTrue(page.evaluate('(t)=>{try{academyEngine.load(t);return false}catch(e){return true}}', bad))
                self.assertEqual(page.evaluate('academyEngine.snapshot()'), expected)
            browser.close()

    def test_server_and_missing_mac_compatibility(self):
        root = ET.fromstring(source([], (MAC1, None)))
        list(root.find('NETWORK/DEVICES'))[1].find('ENGINE/TYPE').text = 'Server'
        obj, report = convert(ET.tostring(root))
        self.assertEqual(obj['devices'][1]['mac'], MAC1)
        self.assertEqual(obj['devices'][1]['type'], 'Server')
        self.assertNotIn('mac', obj['devices'][2])
        self.assertTrue(any('H2' in note and 'sentetik MAC' in note for note in report['notes']))
        self.assertEqual(report['endpointPorts'][0]['sourceMac'], MAC1)

    def test_security_is_rejected_outside_physical_switch_context(self):
        command = 'switchport port-security'
        obj, report = imported([command, 'interface Vlan10', command, '!',
                               'interface range fa0/1, bad', command])
        self.assertTrue(all('portSecurity' not in iface for iface in obj['devices'][0]['interfaces'].values()))
        self.assertEqual([r['command'] for r in report['unmodeledConfigLines']],
                         [command, command, 'interface range fa0/1, bad', command])


if __name__ == '__main__':
    unittest.main()
