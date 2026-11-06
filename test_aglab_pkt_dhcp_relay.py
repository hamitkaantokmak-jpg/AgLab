"""Synthetic PT helper-address config -> real shared DHCP/route engine."""
import base64
import json
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET
from playwright.sync_api import sync_playwright
from convert_pkt_to_aglab import convert, PacketTracerError

ROOT = Path(__file__).resolve().parent
SERVER = '10.20.0.10'


def imported(commands, tagged=False, blocked=False):
    root = ET.Element('PACKETTRACER5')
    network = ET.SubElement(root, 'NETWORK')
    devices = ET.SubElement(network, 'DEVICES')
    links = ET.SubElement(network, 'LINKS')
    for name, kind, ip, mask, gateway in [
        ('R1', 'Router', None, None, None),
        ('PC1', 'PC', '169.254.30.8', '255.255.0.0', '0.0.0.0'),
        ('DHCP-SRV', 'Server', SERVER, '255.255.255.0', '10.20.0.1')]:
        engine = ET.SubElement(ET.SubElement(devices, 'DEVICE'), 'ENGINE')
        for key, value in [('NAME', name), ('TYPE', kind), ('SAVE_REF_ID', name),
                           ('IP', ip), ('SUBNET', mask), ('GATEWAY', gateway)]:
            if value is not None:
                ET.SubElement(engine, key).text = value
        config = ET.SubElement(engine, 'RUNNINGCONFIG')
        if kind == 'Router':
            for command in commands:
                ET.SubElement(config, 'LINE').text = command
    if tagged:
        engine = ET.SubElement(ET.SubElement(devices, 'DEVICE'), 'ENGINE')
        for key, value in [('NAME','SW1'),('TYPE','Switch'),('SAVE_REF_ID','SW1')]:
            ET.SubElement(engine,key).text=value
        config=ET.SubElement(engine,'RUNNINGCONFIG')
        for command in ['vlan 10','vlan 20','interface fa0/1','switchport access vlan 10','!',
                        'interface gi0/1','switchport mode trunk',
                        'switchport trunk allowed vlan '+('20' if blocked else '10,20')]:
            ET.SubElement(config,'LINE').text=command
        connections=[('R1','GigabitEthernet0/0','SW1','GigabitEthernet0/1'),
                     ('SW1','FastEthernet0/1','PC1','FastEthernet0'),
                     ('R1','GigabitEthernet0/1','DHCP-SRV','FastEthernet0')]
    else:
        connections=[('R1','GigabitEthernet0/0','PC1','FastEthernet0'),
                     ('R1','GigabitEthernet0/1','DHCP-SRV','FastEthernet0')]
    for a,pa,b,pb in connections:
        cable = ET.SubElement(ET.SubElement(links, 'LINK'), 'CABLE')
        for key, value in [('FROM', a), ('PORT', pa), ('TO', b), ('PORT', pb)]:
            ET.SubElement(cable, key).text = value
    xml = ET.tostring(root)
    obj, report = convert(xml, b'synthetic-original-pkt')
    assert base64.b64decode(obj['sourceArchive']['decodedXmlBase64']) == xml
    assert base64.b64decode(obj['sourceArchive']['originalPacketBase64']) == b'synthetic-original-pkt'
    return obj, report


class DhcpRelayImportTests(unittest.TestCase):
    def test_physical_and_subinterface_targets(self):
        obj, report = imported(['interface GigabitEthernet0/0', 'ip helper-address '+SERVER,
            '!', 'interface GigabitEthernet0/1.10', 'encapsulation dot1q 10',
            'ip helper-address 192.0.2.10'])
        interfaces = obj['devices'][0]['interfaces']
        self.assertEqual(interfaces['g0/0'].get('helperAddress'), SERVER)
        self.assertEqual(interfaces['g0/1.10'].get('helperAddress'), '192.0.2.10')
        self.assertEqual(report['unmodeledConfigLines'], [])

    def test_removal_is_targeted_and_duplicate_is_idempotent(self):
        for ending, expected in [(['no ip helper-address 192.0.2.10'], SERVER),
                                 (['no ip helper-address '+SERVER], None),
                                 (['no ip helper-address'], None)]:
            obj, report = imported(['interface g0/0', 'ip helper-address '+SERVER,
                                   'ip helper-address '+SERVER, *ending])
            self.assertEqual(obj['devices'][0]['interfaces']['g0/0'].get('helperAddress'), expected)
            self.assertEqual(report['unmodeledConfigLines'], [])

    def test_invalid_and_out_of_context_commands_do_not_mutate(self):
        bad = ['ip helper-address 999.20.0.1', 'ip helper-address 224.0.0.1',
               'ip helper-address 0.0.0.0', 'ip helper-address 255.255.255.255',
               'ip helper-address '+SERVER+' vrf BLUE', 'no ip helper-address broken']
        commands = ['ip helper-address '+SERVER, 'interface g0/0',
                    'ip helper-address '+SERVER, *bad, 'exit', 'no ip helper-address']
        obj, report = imported(commands)
        self.assertEqual(obj['devices'][0]['interfaces']['g0/0'].get('helperAddress'), SERVER)
        self.assertEqual([r['command'] for r in report['unmodeledConfigLines']],
                         [commands[0], *bad, commands[-1]])

    def test_switch_and_ignored_router_interfaces_reject_helper(self):
        obj, report = imported(['interface Vlan10','ip helper-address '+SERVER])
        self.assertTrue(all('helperAddress' not in value for value in obj['devices'][0]['interfaces'].values()))
        self.assertIn('ip helper-address '+SERVER, [r['command'] for r in report['unmodeledConfigLines']])
        obj, _ = imported(['interface g0/0','ip helper-address '+SERVER])
        root=ET.fromstring(base64.b64decode(obj['sourceArchive']['decodedXmlBase64']))
        root.find('NETWORK/DEVICES/DEVICE/ENGINE/TYPE').text='Switch'
        obj, report=convert(ET.tostring(root))
        self.assertTrue(all('helperAddress' not in value for value in obj['devices'][0]['interfaces'].values()))
        self.assertIn('ip helper-address '+SERVER, [r['command'] for r in report['unmodeledConfigLines']])

    def test_multiple_active_helpers_are_explicitly_rejected(self):
        commands = ['interface g0/0', 'ip helper-address '+SERVER, 'ip helper-address 192.0.2.10']
        with self.assertRaisesRegex(PacketTracerError, 'helper'):
            imported(commands)
        obj, report = imported(commands+['no ip helper-address 192.0.2.10'])
        self.assertEqual(obj['devices'][0]['interfaces']['g0/0'].get('helperAddress'), SERVER)
        self.assertEqual(report['unmodeledConfigLines'], [])

    def test_browser_lease_failures_and_cli_recovery(self):
        base = ['interface g0/0', 'ip address 192.168.10.1 255.255.255.0',
                'no shutdown', '!', 'interface g0/1',
                'ip address 10.20.0.1 255.255.255.0', 'no shutdown', '!']
        cases = [(['interface g0/0', 'ip helper-address '+SERVER], True),
                 ([], False), (['interface g0/0', 'ip helper-address 10.20.0.99'], False),
                 (['interface g0/0', 'ip helper-address '+SERVER, 'shutdown'], False),
                 (['interface g0/0', 'ip helper-address '+SERVER, '!', 'interface g0/1', 'shutdown'], False)]
        cases=[(extra,expected,False,False) for extra,expected in cases]+[
            (['interface g0/0.10','encapsulation dot1q 10','ip address 192.168.10.1 255.255.255.0','ip helper-address '+SERVER], True, True, False),
            (['interface g0/0.10','encapsulation dot1q 10','ip address 192.168.10.1 255.255.255.0','ip helper-address '+SERVER], False, True, True)]
        with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            page = browser.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto((ROOT/'AgLab_Final_PKT_Import.html').as_uri())
            def commands(device, block):
                return page.evaluate('''([device,block])=>{
                    const terminal=document.querySelector('#ptTerminal'),before=terminal.innerText.length;
                    const select=document.querySelector('#ptCliDevice');select.value=device;select.dispatchEvent(new Event('change'));
                    for(const command of block){document.querySelector('#ptCliInput').value=command;document.querySelector('#ptCliForm').requestSubmit();}
                    return terminal.innerText.slice(before);
                }''', [device, block])
            for extra, expected, tagged, blocked in cases:
                with self.subTest(extra=extra, tagged=tagged, blocked=blocked):
                    source_commands=base+extra
                    if tagged: source_commands=['interface g0/0','no shutdown','!']+base[4:]+extra
                    obj, report = imported(source_commands, tagged, blocked)
                    self.assertEqual(report['unmodeledConfigLines'], [])
                    path = Path(tmp)/'relay.json'
                    path.write_text(json.dumps(obj), encoding='utf-8')
                    before = len(page.locator('#ptTerminal').inner_text())
                    page.locator('#ptImportFile').set_input_files(str(path))
                    page.wait_for_function('n=>document.querySelector("#ptTerminal").innerText.length>n', arg=before)
                    self.assertIn('4 cihaz, 3 bağlantı' if tagged else '3 cihaz, 2 bağlantı', page.locator('#ptTerminal').inner_text()[before:])
                    # PT server service/pool import is outside scope; activate the existing service via CLI.
                    commands('d3', ['service dhcp on'])
                    output = commands('d2', ['ipconfig /renew'])
                    self.assertEqual(bool(page.evaluate('academyEngine.snapshot().devices[1].dhcpLease')), expected, output)
                    if not expected:
                        self.assertEqual(page.evaluate('academyEngine.snapshot().devices[1].ip'), '169.254.30.8')
                        commands('d1', ['enable','configure terminal','interface '+('g0/0.10' if tagged else 'g0/0'),
                            'ip helper-address '+SERVER,'no shutdown','exit','interface g0/1','no shutdown','end'])
                        if blocked:
                            commands('d4', ['enable','configure terminal','interface gi0/1','switchport trunk allowed vlan 10,20','end'])
                        commands('d2', ['ipconfig /renew'])
                    pc = page.evaluate('academyEngine.snapshot().devices[1]')
                    self.assertTrue(pc['dhcpLease'])
                    self.assertEqual(pc['gateway'], '192.168.10.1')
                    self.assertTrue(pc['ip'].startswith('192.168.10.'))
                    self.assertIn('100 percent', commands('d2', ['ping '+SERVER]))
                    state = page.evaluate('academyEngine.snapshot().devices')
                    page.reload()
                    self.assertEqual(page.evaluate('academyEngine.snapshot().devices'), state)
            self.assertEqual(errors, [])
            browser.close()


if __name__ == '__main__':
    unittest.main()
