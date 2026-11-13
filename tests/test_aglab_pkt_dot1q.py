"""Synthetic Packet Tracer XML -> JSON -> Chromium inter-VLAN regression."""

import base64
import json
import tempfile
from pathlib import Path
import xml.etree.ElementTree as ET
from aglab_test_support import ROOT, launch_chromium, import_topology, assert_cli_path_matches
from convert_pkt_to_aglab import convert
from playwright.sync_api import sync_playwright

B = ROOT
root = ET.Element("PACKETTRACER5")
network = ET.SubElement(root, "NETWORK")
devices = ET.SubElement(network, "DEVICES")
links = ET.SubElement(network, "LINKS")


def device(name, kind, config=(), ip=None, gateway=None):
    engine = ET.SubElement(ET.SubElement(devices, "DEVICE"), "ENGINE")
    for key, value in [
        ("TYPE", kind),
        ("NAME", name),
        ("SAVE_REF_ID", name),
        ("IP", ip),
        ("GATEWAY", gateway),
    ]:
        if value is not None:
            ET.SubElement(engine, key).text = value
    running = ET.SubElement(engine, "RUNNINGCONFIG")
    for line in config:
        ET.SubElement(running, "LINE").text = line


def cable(a, pa, b, pb):
    node = ET.SubElement(ET.SubElement(links, "LINK"), "CABLE")
    for key, value in [("FROM", a), ("TO", b), ("PORT", pa), ("PORT", pb)]:
        ET.SubElement(node, key).text = value


device(
    "R1",
    "Router",
    [
        "interface GigabitEthernet0/0",
        "no shutdown",
        "interface GigabitEthernet0/0.100",
        "encapsulation dot1Q 10",
        "ip address 192.168.10.1 255.255.255.0",
        "interface GigabitEthernet0/0.200",
        "encapsulation dot1Q 20",
        "ip address 192.168.20.1 255.255.255.0",
    ],
)
device(
    "SW1",
    "Switch",
    [
        "vlan 10",
        "vlan 20",
        "interface FastEthernet0/1",
        "switchport access vlan 10",
        "interface FastEthernet0/2",
        "switchport access vlan 20",
        "interface GigabitEthernet0/1",
        "switchport mode trunk",
        "switchport trunk allowed vlan 10,20",
    ],
)
device("PC10", "PC", ip="192.168.10.2", gateway="192.168.10.1")
device("PC20", "PC", ip="192.168.20.2", gateway="192.168.20.1")
cable("R1", "GigabitEthernet0/0", "SW1", "GigabitEthernet0/1")
cable("SW1", "FastEthernet0/1", "PC10", "FastEthernet0")
cable("SW1", "FastEthernet0/2", "PC20", "FastEthernet0")
xml = ET.tostring(root)
topology, report = convert(xml)
assert_cli_path_matches(topology)
router = topology["devices"][0]
for vlan in (10, 20):
    name = "g0/0." + str(vlan * 10)
    interface = router["interfaces"][name]
    assert interface.get("encapsulation") == "dot1q", interface
    assert interface.get("vlan") == vlan, interface
    assert interface.get("parent") == "g0/0", interface
    assert name not in router["ports"], "Logical subinterfaces are not cable ports"
assert not report["unmodeledConfigLines"], report["unmodeledConfigLines"]
assert base64.b64decode(topology["sourceArchive"]["decodedXmlBase64"]) == xml

# Unsupported or invalid encapsulations remain explicit in the report.
for encapsulation in [
    "encapsulation dot1Q 20 native",
    "encapsulation dot1Q 4095",
    "encapsulation isl 20",
]:
    changed = ET.fromstring(xml)
    for line in changed.iter("LINE"):
        if line.text == "encapsulation dot1Q 20":
            line.text = encapsulation
    rejected, rejected_report = convert(ET.tostring(changed))
    assert "encapsulation" not in rejected["devices"][0]["interfaces"]["g0/0.200"]
    assert any(row["command"] == encapsulation for row in rejected_report["unmodeledConfigLines"])

# A physical parent outside the default port inventory is still created.
changed = xml.replace(b"GigabitEthernet0/0", b"GigabitEthernet1/0")
parent_topology, _ = convert(changed)
assert_cli_path_matches(parent_topology)
assert "g1/0" in parent_topology["devices"][0]["ports"]
assert parent_topology["devices"][0]["interfaces"]["g1/0.200"]["parent"] == "g1/0"

with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    browser = launch_chromium(pw, args=["--no-sandbox"])
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.set_content((B / "AgLab_Final_PKT_Import.html").read_text(), wait_until="domcontentloaded")
    path = Path(tmp) / "dot1q.json"
    path.write_text(json.dumps(topology))
    import_topology(page, path)

    def command(device_id, text):
        page.evaluate(
            """([id, text]) => {
            document.querySelector('#ptCliDevice').value = id;
            document.querySelector('#ptCliInput').value = text;
            document.querySelector('#ptCliForm').requestSubmit();
        }""",
            [device_id, text],
        )
        return page.locator("#ptTerminal").inner_text()

    def ping(success):
        before = page.locator("#ptTerminal").inner_text()
        output = command("d3", "ping 192.168.20.2")[len(before) :]
        expected = "Success rate is 100 percent (5/5)" if success else "Success rate is 0 percent"
        assert expected in output, output[-1600:]

    ping(True)
    for text in ["enable", "configure terminal", "interface g0/0.200"]:
        command("d1", text)
    before = page.locator("#ptTerminal").inner_text()
    output = command("d1", "encapsulation dot1q 20")[len(before) :]
    assert "802.1Q encapsulation dot1Q 20 yapılandırıldı." in output, output
    for invalid in [
        "encapsulation dot1q 20.5",
        "encapsulation dot1q 0",
        "encapsulation dot1q 4095",
        "encapsulation dot1q 20 native",
        "encapsulation dot1q 20 extra",
        "encapsulation dot1q",
        "encapsulation isl 20",
    ]:
        command("d1", invalid)
        assert "outerr" in (
            page.locator("#ptTerminal > div").last.get_attribute("class") or ""
        ), invalid
    # An independent subinterface number above the VLAN range is not a VLAN ID.
    for text in [
        "exit",
        "interface GigabitEthernet0/0.5000",
        "encapsulation dot1q 30",
        "ip address 192.168.30.1 255.255.255.0",
        "end",
    ]:
        command("d1", text)
    output = command("d1", "show running-config")
    assert "interface g0/0.5000" in output and "encapsulation dot1Q 30" in output, output[-2000:]
    page.evaluate("showArea('lab')")
    page.locator("#uxMoreLabActions").click()
    with page.expect_download() as download:
        page.locator("#ptExport").click()
    exported = Path(tmp) / "cli-roundtrip.json"
    download.value.save_as(str(exported))
    saved = json.loads(exported.read_text())
    saved_router = next(d for d in saved["devices"] if d["id"] == "d1")
    assert saved_router["interfaces"]["g0/0.200"]["vlan"] == 20
    assert saved_router["interfaces"]["g0/0.5000"]["vlan"] == 30
    assert saved_router["interfaces"]["g0/0.5000"]["parent"] == "g0/0"
    assert "g0/0.5000" not in saved_router["ports"]
    import_topology(page, exported)
    ping(True)  # invalid commands did not replace the imported VLAN 20 binding
    for text in ["enable", "configure terminal", "interface g0/0.200", "shutdown", "end"]:
        command("d1", text)
    ping(False)
    for text in ["configure terminal", "interface g0/0.200", "no shutdown", "end"]:
        command("d1", text)
    ping(True)
    for text in ["enable", "configure terminal", "interface g0/0", "shutdown", "end"]:
        command("d1", text)
    ping(False)
    for text in ["configure terminal", "interface g0/0", "no shutdown", "end"]:
        command("d1", text)
    ping(True)
    for text in [
        "enable",
        "configure terminal",
        "interface gi0/1",
        "switchport trunk allowed vlan 10",
        "end",
    ]:
        command("d2", text)
    ping(False)
    # Physical parents imported outside the default g0/0 inventory work in CLI too.
    path.write_text(json.dumps(parent_topology))
    import_topology(page, path)
    for text in [
        "enable",
        "configure terminal",
        "interface GigabitEthernet1/0.5000",
        "encapsulation dot1q 30",
        "ip address 192.168.30.1 255.255.255.0",
        "end",
    ]:
        command("d1", text)
    output = command("d1", "show running-config")
    assert "interface g1/0.5000" in output, output[-2000:]
    command("d1", "configure terminal")
    for invalid in ["interface g9/9.20", "interface g1/0.4294967296", "interface g1/0.1.5"]:
        command("d1", invalid)
        assert "outerr" in (
            page.locator("#ptTerminal > div").last.get_attribute("class") or ""
        ), invalid
    assert not errors, errors
    browser.close()
print(
    "PASS: PT/CLI dot1Q consistency, invalid syntax rejection, physical parents, JSON roundtrip and inter-VLAN ping/shutdown"
)
