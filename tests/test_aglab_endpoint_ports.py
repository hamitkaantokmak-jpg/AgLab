"""Endpoint physical-port provenance, power and cable aliases from PT XML."""

import base64
import copy
import json
import tempfile
from pathlib import Path
import xml.etree.ElementTree as ET
from aglab_test_support import ROOT, launch_chromium
from convert_pkt_to_aglab import convert
from playwright.sync_api import sync_playwright

base = ET.fromstring(
    base64.b64decode(
        json.loads((ROOT / "static-routing-two-routers.aglab.json").read_text())["sourceArchive"][
            "decodedXmlBase64"
        ]
    )
)


def pc_engine(root):
    return next(
        e for e in root.findall("NETWORK/DEVICES/DEVICE/ENGINE") if e.findtext("NAME") == "PC1"
    )


def physical(root):
    return next(
        p for p in pc_engine(root).findall(".//MODULE/PORT") if "Ethernet" in p.findtext("TYPE", "")
    )


def result(root):
    xml = ET.tostring(root)
    obj, report = convert(xml)
    assert base64.b64decode(obj["sourceArchive"]["decodedXmlBase64"]) == xml
    pc = next(d for d in obj["devices"] if d["name"] == "PC1")
    return obj, report, pc


changed = copy.deepcopy(base)
engine = pc_engine(changed)
noise = ET.Element("UNMODELED_SERVICE")
ET.SubElement(noise, "IP").text = "203.0.113.10"
ET.SubElement(noise, "MASK").text = "255.0.0.0"
engine.insert(0, noise)
engine.remove(engine.find("GATEWAY"))
physical(changed).find("POWER").text = "false"
off, report, pc = result(changed)
assert pc["ip"] == "192.168.1.2" and pc["mask"] == "255.255.255.0", pc
assert pc["gateway"] == "192.168.1.1", pc
assert pc["interfaces"]["eth0"]["enabled"] is False and pc["enabled"] is True, pc

# A GigabitEthernet0 cable on a single wired endpoint maps to eth0.
physical(changed).find("POWER").text = "true"
physical(changed).find("TYPE").text = "eCopperGigabitEthernet"
for cable in changed.findall("NETWORK/LINKS/LINK/CABLE"):
    ports = cable.findall("PORT")
    for index, key in enumerate(("FROM", "TO")):
        if (
            cable.findtext(key, "").replace("save-ref-id:", "").strip()
            == engine.findtext("SAVE_REF_ID", "").replace("save-ref-id:", "").strip()
        ):
            ports[index].text = "GigabitEthernet0"
on, report, pc = result(changed)
assert report["linksImported"] == 7, report["skippedLinks"]
assert pc["interfaces"]["eth0"]["enabled"] is True
port_report = next(p for p in report["endpointPorts"] if p["device"] == "PC1")
assert (
    port_report["sourceWiredPortCount"] == 1
    and port_report["sourcePortType"] == "eCopperGigabitEthernet"
)
assert port_report["modeledPort"] == "eth0"

# Multiple NICs must not be silently collapsed onto one simulated port.
multi = copy.deepcopy(changed)
module = next(m for m in pc_engine(multi).iter("MODULE") if m.find("PORT") is not None)
module.append(copy.deepcopy(physical(multi)))
ambiguous, report, pc = result(multi)
assert report["linksImported"] == 6 and len(report["skippedLinks"]) == 1, report
assert any("PC1" in note and "NIC" in note for note in report["notes"]), report["notes"]
assert not pc["ip"] and pc["interfaces"]["eth0"]["enabled"] is False

# An unknown endpoint port must not alias to the first NIC.
unknown = copy.deepcopy(changed)
for cable in unknown.findall("NETWORK/LINKS/LINK/CABLE"):
    ports = cable.findall("PORT")
    for index, key in enumerate(("FROM", "TO")):
        if (
            cable.findtext(key, "").replace("save-ref-id:", "").strip()
            == engine.findtext("SAVE_REF_ID", "").replace("save-ref-id:", "").strip()
        ):
            ports[index].text = "FastEthernet1"
_, report, _ = result(unknown)
assert report["linksImported"] == 6 and len(report["skippedLinks"]) == 1

with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    browser = launch_chromium(pw)
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
    path = Path(tmp) / "endpoint.json"
    for topology, success in [(on, True), (off, False), (on, True)]:
        path.write_text(json.dumps(topology))
        before = page.locator("#ptTerminal").inner_text()
        page.locator("#ptImportFile").set_input_files(str(path))
        page.wait_for_function(
            'before => document.querySelector("#ptTerminal").innerText.length > before',
            arg=len(before),
        )
        before = page.locator("#ptTerminal").inner_text()
        page.evaluate("""() => {
            document.querySelector('#ptCliDevice').value = 'd3';
            document.querySelector('#ptCliInput').value = 'ping 192.168.2.2';
            document.querySelector('#ptCliForm').requestSubmit();
        }""")
        output = page.locator("#ptTerminal").inner_text()[len(before) :]
        assert (
            "Success rate is 100 percent" if success else "Success rate is 0 percent"
        ) in output, output
    assert not errors, errors
    browser.close()
print(
    "PASS: physical Ethernet address/power provenance, gigabit cable, multi-NIC/unknown-port reporting, ping on/off/recovery"
)
