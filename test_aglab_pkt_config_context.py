"""PKT unsupported IOS syntax must preserve source without mutating modeled state."""
import base64
import unittest
import tempfile
from unittest.mock import patch
from convert_pkt_to_aglab import main, PacketTracerError
import xml.etree.ElementTree as ET
from pathlib import Path
from convert_pkt_to_aglab import convert
from playwright.sync_api import sync_playwright


def topology(kind, commands):
    root = ET.Element('PACKETTRACER5')
    network = ET.SubElement(root, 'NETWORK')
    devices = ET.SubElement(network, 'DEVICES')
    engine = ET.SubElement(ET.SubElement(devices, 'DEVICE'), 'ENGINE')
    ET.SubElement(engine, 'TYPE').text = kind
    ET.SubElement(engine, 'NAME').text = 'D1'
    config = ET.SubElement(engine, 'RUNNINGCONFIG')
    for command in commands:
        ET.SubElement(config, 'LINE').text = command
    ET.SubElement(network, 'LINKS')
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
                    'interface range FastEthernet0/1 - 2', 'shutdown']
        obj, report = topology('Switch', commands)
        switch = obj['devices'][0]
        self.assertEqual(switch['interfaces']['fa0/1']['vlan'], 10)
        self.assertTrue(switch['interfaces']['fa0/1']['enabled'])
        self.assertNotIn('range', switch['ports'])
        self.assertEqual([r['command'] for r in report['unmodeledConfigLines']], commands[2:])

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
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto((Path(__file__).resolve().parent / 'AgLab_Final_PKT_Import.html').as_uri())
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
