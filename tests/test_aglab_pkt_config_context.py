"""PKT unsupported IOS syntax must preserve source without mutating modeled state."""
import base64
import json
import unittest
import tempfile
from unittest.mock import patch
from aglab_test_support import HTML, launch_chromium
from convert_pkt_to_aglab import main, PacketTracerError
import xml.etree.ElementTree as ET
from pathlib import Path
from convert_pkt_to_aglab import convert
from playwright.sync_api import sync_playwright


def topology(kind, commands, hosts=False):
    root = ET.Element('PACKETTRACER5')
    network = ET.SubElement(root, 'NETWORK')
    devices = ET.SubElement(network, 'DEVICES')
    engine = ET.SubElement(ET.SubElement(devices, 'DEVICE'), 'ENGINE')
    ET.SubElement(engine, 'TYPE').text = kind
    ET.SubElement(engine, 'NAME').text = 'D1'
    ET.SubElement(engine, 'SAVE_REF_ID').text = 'switch'
    config = ET.SubElement(engine, 'RUNNINGCONFIG')
    for command in commands:
        ET.SubElement(config, 'LINE').text = command
    links = ET.SubElement(network, 'LINKS')
    if hosts:
        for index in [1, 2]:
            host = ET.SubElement(ET.SubElement(devices, 'DEVICE'), 'ENGINE')
            for key, value in [('TYPE', 'PC'), ('NAME', 'H'+str(index)),
                               ('SAVE_REF_ID', 'host'+str(index)),
                               ('IP', '10.10.10.'+str(index)), ('SUBNET', '255.255.255.0')]:
                ET.SubElement(host, key).text = value
            cable = ET.SubElement(ET.SubElement(links, 'LINK'), 'CABLE')
            for key, value in [('FROM', 'switch'), ('PORT', 'FastEthernet0/'+str(index)),
                               ('TO', 'host'+str(index)), ('PORT', 'FastEthernet0')]:
                ET.SubElement(cable, key).text = value
    xml = ET.tostring(root)
    obj, report = convert(xml, b'original-pkt')
    assert base64.b64decode(obj['sourceArchive']['decodedXmlBase64']) == xml
    assert base64.b64decode(obj['sourceArchive']['originalPacketBase64']) == b'original-pkt'
    return obj, report


class ConfigContextTests(unittest.TestCase):
    def test_secondary_and_route_options_do_not_overwrite_primary(self):
        unsupported = ['ip address 192.0.2.1 255.255.255.0 secondary',
                       'ip route 203.0.113.0 255.255.255.0 10.0.0.2 name WAN']
        obj, report = topology('Router', ['interface GigabitEthernet0/0',
            'ip address 10.0.0.1 255.255.255.0', *unsupported])
        router = obj['devices'][0]
        self.assertEqual(router['interfaces']['g0/0']['ip'], '10.0.0.1')
        self.assertEqual(router['staticRoutes'], [])
        self.assertEqual([r['command'] for r in report['unmodeledConfigLines']], unsupported)

    def test_interface_boundaries_reject_stale_context(self):
        for boundary in ['!', 'exit', 'end', 'interface range GigabitEthernet0/0 - 1']:
            with self.subTest(boundary=boundary):
                commands = ['interface GigabitEthernet0/0',
                            'ip address 10.0.0.1 255.255.255.0', boundary,
                            'ip address 192.0.2.1 255.255.255.0', 'shutdown']
                obj, report = topology('Router', commands)
                iface = obj['devices'][0]['interfaces']['g0/0']
                self.assertEqual(iface['ip'], '10.0.0.1')
                self.assertTrue(iface['enabled'])
                self.assertNotIn('range', obj['devices'][0]['interfaces'])
                unmodeled = [r['command'] for r in report['unmodeledConfigLines']]
                self.assertIn(commands[-2], unmodeled)
                self.assertIn('shutdown', unmodeled)

    def test_switch_unsupported_header_and_suffix_are_reported(self):
        commands = ['interface FastEthernet0/1', 'switchport access vlan 10',
                    'switchport access vlan 20 unexpected',
                    'interface range FastEthernet0/1 - 99', 'shutdown']
        obj, report = topology('Switch', commands)
        switch = obj['devices'][0]
        self.assertEqual(switch['interfaces']['fa0/1']['vlan'], 10)
        self.assertTrue(switch['interfaces']['fa0/1']['enabled'])
        self.assertNotIn('range', switch['ports'])
        self.assertEqual([r['command'] for r in report['unmodeledConfigLines']], commands[2:])

    def test_switch_range_membership_trunk_operations_and_overrides(self):
        obj, report = topology('Switch', [
            'interface range FastEthernet0/1 - 3, GigabitEthernet0/1 - GigabitEthernet0/2',
            'switchport mode trunk', 'switchport trunk allowed vlan 10,20',
            'switchport trunk allowed vlan add 30',
            'switchport trunk allowed vlan remove 20',
            'switchport trunk native vlan 10', 'shutdown', 'exit',
            'interface FastEthernet0/2', 'switchport mode access',
            'switchport access vlan 20', 'no shutdown',
        ])
        switch = obj['devices'][0]
        for name in ['fa0/1', 'fa0/3', 'gi0/1', 'gi0/2']:
            self.assertEqual(switch['interfaces'][name], {
                'mode': 'trunk', 'vlan': 1, 'allowed': [10, 30],
                'nativeVlan': 10, 'enabled': False})
        self.assertEqual(switch['interfaces']['fa0/2']['mode'], 'access')
        self.assertEqual(switch['interfaces']['fa0/2']['vlan'], 20)
        self.assertTrue(switch['interfaces']['fa0/2']['enabled'])
        self.assertEqual(switch['interfaces']['fa0/4']['mode'], 'access')
        self.assertTrue(switch['interfaces']['fa0/4']['enabled'])
        self.assertEqual(report['unmodeledConfigLines'], [])
        self.assertNotIn('range', switch['ports'])

    def test_invalid_switch_ranges_are_atomic_and_report_original_lines(self):
        invalid = ['FastEthernet0/1 - 99', 'FastEthernet0/3 - 1',
                   'FastEthernet0/1, bad', 'FastEthernet0/1 - GigabitEthernet0/2',
                   'Vlan10 - 20', 'FastEthernet0/1 - 999999999999999999999999',
                   'FastEthernet0/1,', '', 'FastEthernet0/1 - 2 unexpected',
                   'fa0/1, 3', 'fa0/1,'*200]
        for spec in invalid:
            with self.subTest(spec=spec):
                commands = ['interface FastEthernet0/1', 'switchport access vlan 10',
                            'interface range ' + spec, 'shutdown',
                            'switchport access vlan 20', '!']
                obj, report = topology('Switch', commands)
                switch = obj['devices'][0]
                self.assertEqual(switch['interfaces']['fa0/1']['vlan'], 10)
                self.assertTrue(all(i['enabled'] for i in switch['interfaces'].values()))
                self.assertEqual(switch['interfaces']['fa0/2']['vlan'], 1)
                self.assertEqual([(r['line'], r['command']) for r in report['unmodeledConfigLines']],
                                 [(i+1, commands[i].strip()) for i in [2, 3, 4]])
                self.assertEqual(len(switch['ports']), 26)

    def test_range_inventory_is_resolved_at_the_source_line(self):
        obj, report = topology('Switch', [
            'interface range fa1/1 - 2', 'shutdown',
            'interface fa1/1', 'no shutdown', 'interface fa1/2', 'no shutdown',
            'interface range fa1/1 - 2', 'switchport access vlan 30', 'shutdown'])
        switch = obj['devices'][0]
        for name in ['fa1/1', 'fa1/2']:
            self.assertFalse(switch['interfaces'][name]['enabled'])
            self.assertEqual(switch['interfaces'][name]['vlan'], 30)
        self.assertTrue(switch['interfaces']['fa0/1']['enabled'])
        self.assertEqual([(r['line'], r['command']) for r in report['unmodeledConfigLines']],
                         [(1, 'interface range fa1/1 - 2'), (2, 'shutdown')])

    def test_switch_range_duplicates_and_context_boundaries(self):
        for boundary in ['!', 'exit', 'end', 'vlan 30', 'spanning-tree vlan 10 priority 8192',
                         'ip default-gateway 10.0.0.1']:
            with self.subTest(boundary=boundary):
                obj, report = topology('Switch', [
                    'interface range fa0/1 - 2, fa0/2, gi0/1',
                    'switchport access vlan 10', boundary, 'shutdown'])
                switch = obj['devices'][0]
                for name in ['fa0/1', 'fa0/2', 'gi0/1']:
                    self.assertEqual(switch['interfaces'][name]['vlan'], 10)
                    self.assertTrue(switch['interfaces'][name]['enabled'])
                self.assertEqual([r['command'] for r in report['unmodeledConfigLines']], ['shutdown'])

    def test_imported_range_controls_real_ping_and_cli_recovery(self):
        common = ['vlan 10', 'vlan 20', 'interface range FastEthernet0/1 - 2',
                  'switchport mode access', 'switchport access vlan 10', 'no shutdown']
        cases = [([], True),
                 (['exit', 'interface FastEthernet0/2', 'switchport access vlan 20'], False),
                 (['shutdown'], False)]
        with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
            browser = launch_chromium(pw)
            page = browser.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(HTML.as_uri())
            for index, (extra, expected) in enumerate(cases):
                with self.subTest(extra=extra):
                    obj, report = topology('Switch', common+extra, hosts=True)
                    self.assertEqual(report['unmodeledConfigLines'], [])
                    self.assertEqual(len(obj['links']), 2)
                    path = Path(tmp) / ('range-'+str(index)+'.json')
                    path.write_text(json.dumps(obj), encoding='utf-8')
                    before = len(page.locator('#ptTerminal').inner_text())
                    page.locator('#ptImportFile').set_input_files(str(path))
                    page.wait_for_function('n=>document.querySelector("#ptTerminal").innerText.length>n', arg=before)
                    self.assertIn('3 cihaz, 2 bağlantı', page.locator('#ptTerminal').inner_text()[before:])
                    def ping():
                        return page.evaluate('''()=>{
                            const terminal=document.querySelector('#ptTerminal');const before=terminal.innerText.length;
                            document.querySelector('#ptCliDevice').value='d2';
                            document.querySelector('#ptCliInput').value='ping 10.10.10.2';
                            document.querySelector('#ptCliForm').requestSubmit();return terminal.innerText.slice(before);
                        }''')
                    self.assertIn('100 percent' if expected else '0 percent (0/5)', ping())
                    if not expected:
                        page.evaluate('''()=>{
                            document.querySelector('#ptCliDevice').value='d1';
                            for(const command of ['enable','configure terminal','interface fa0/1','no shutdown',
                                'exit','interface fa0/2','switchport access vlan 10','no shutdown','end']){
                                document.querySelector('#ptCliInput').value=command;
                                document.querySelector('#ptCliForm').requestSubmit();
                            }
                        }''')
                        self.assertIn('100 percent', ping())
                    self.assertEqual(page.evaluate('academyEngine.snapshot().devices[0].config.runningConfig'), '\n'.join(common+extra))
            self.assertEqual(errors, [])
            browser.close()

    def test_cli_rejects_colliding_source_output_and_report_before_decrypt(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / 'lab.pkt'
            source.write_bytes(b'keep-original')
            output = Path(tmp) / 'lab.json'
            alias = Path(tmp) / 'alias.pkt'
            alias.symlink_to(source)
            hardlink = Path(tmp) / 'hardlink.pkt'
            hardlink.hardlink_to(source)
            for args in [
                [str(source), '-o', str(source)],
                [str(source), '-o', str(alias)],
                [str(source), '-o', str(hardlink)],
                [str(source), '--report', str(source)],
                [str(source), '-o', str(output), '--report', str(output)],
            ]:
                with self.subTest(args=args), patch('sys.argv', ['convert_pkt_to_aglab.py', *args]), patch('convert_pkt_to_aglab.decrypt_pkt') as decrypt:
                    with self.assertRaises(PacketTracerError):
                        main()
                    decrypt.assert_not_called()
                    self.assertEqual(source.read_bytes(), b'keep-original')

    def test_primary_address_remains_usable_in_browser(self):
        obj, _ = topology('Router', ['interface GigabitEthernet0/0',
            'ip address 10.0.0.1 255.255.255.0',
            'ip address 192.0.2.1 255.255.255.0 secondary'])
        with sync_playwright() as pw:
            browser = launch_chromium(pw)
            page = browser.new_page()
            page.goto(HTML.as_uri())
            page.evaluate('(t)=>academyEngine.load(t)', obj)
            for target, expected in [('10.0.0.1', '100 percent'), ('192.0.2.1', '0 percent (0/5)')]:
                result = page.evaluate('''target=>{
                    const terminal=document.querySelector('#ptTerminal');const before=terminal.innerText.length;
                    document.querySelector('#ptCliDevice').value='d1';
                    document.querySelector('#ptCliInput').value='ping '+target;
                    document.querySelector('#ptCliForm').requestSubmit();return terminal.innerText.slice(before);
                }''', target)
                self.assertIn(expected, result)
            browser.close()


if __name__ == '__main__':
    unittest.main()
