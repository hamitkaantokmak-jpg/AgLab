"""Executable scope matrix: authentic encrypted PKT and labeled synthetic XML."""

import base64
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from aglab_test_support import ROOT
from convert_pkt_to_aglab import convert, decrypt_pkt

matrix = json.loads((ROOT / "pkt-sample-matrix.json").read_text())
assert matrix["schemaVersion"] == 1
assert matrix["cases"] and len({case["id"] for case in matrix["cases"]}) == len(matrix["cases"])


def subset(actual, expected):
    for key, value in expected.items():
        if isinstance(value, dict):
            subset(actual[key], value)
        else:
            assert actual[key] == value, (key, actual[key], value)


for case in matrix["cases"]:
    assert case["coverage"] and case["limitations"], case["id"]
    if case["sourceKind"] == "pkt":
        raw = (ROOT / case["file"]).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == case["sha256"]
        archived = json.loads((ROOT / case["archive"]).read_text())
        xml = decrypt_pkt(raw)  # Verify the real encrypted sample, not only cached XML.
        assert xml == base64.b64decode(archived["sourceArchive"]["decodedXmlBase64"])
        obj, report = convert(xml, raw)
        assert obj == archived, "Cached normalized topology is stale: " + case["id"]
        if case.get("report"):
            assert report == json.loads((ROOT / case["report"]).read_text()), (
                "Cached import report is stale: " + case["id"]
            )
        subset(report, case["expected"])
        assert obj["sourceArchive"]["originalPacketSha256"] == case["sha256"]
        assert base64.b64decode(obj["sourceArchive"]["originalPacketBase64"]) == raw
        for expected_device in archived["devices"]:
            actual = next(d for d in obj["devices"] if d["name"] == expected_device["name"])
            if actual["type"] == "Router":
                assert actual["staticRoutes"] == expected_device["staticRoutes"]
    elif case["sourceKind"] == "synthetic-xml":
        root = ET.Element("PACKETTRACER5")
        network = ET.SubElement(root, "NETWORK")
        devices = ET.SubElement(network, "DEVICES")
        ET.SubElement(network, "LINKS")
        engine = ET.SubElement(ET.SubElement(devices, "DEVICE"), "ENGINE")
        ET.SubElement(engine, "TYPE").text = case["deviceType"]
        ET.SubElement(engine, "NAME").text = case["id"]
        config = ET.SubElement(engine, "RUNNINGCONFIG")
        for command in case["config"]:
            ET.SubElement(config, "LINE").text = command
        xml = ET.tostring(root)
        obj, report = convert(xml)
        subset(obj["devices"][0], case["expectedDevice"])
        assert report["devicesImported"] == 1
        if "expectedUnmodeled" in case:
            assert [row["command"] for row in report["unmodeledConfigLines"]] == case[
                "expectedUnmodeled"
            ], case["id"]
        assert base64.b64decode(obj["sourceArchive"]["decodedXmlBase64"]) == xml
    else:
        raise AssertionError("Unknown source kind: " + case["sourceKind"])
    print("PASS matrix:", case["id"], "source:", case["sourceKind"])
print(
    f"PASS: {len(matrix['cases'])} sample-matrix cases; real PKT authentication/decryption and source preservation"
)
