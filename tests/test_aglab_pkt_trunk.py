"""Synthetic PT XML: trunk operations preserve VLAN membership and source bytes."""

import base64
from convert_pkt_to_aglab import convert
from xml.sax.saxutils import escape


def topology(commands):
    lines = ["interface GigabitEthernet0/1", "switchport mode trunk"] + commands
    xml = (
        "<PACKETTRACER5><NETWORK><DEVICES><DEVICE><ENGINE>"
        '<TYPE model="2960">Switch</TYPE><NAME>SW1</NAME><RUNNINGCONFIG>'
        + "".join("<LINE>" + escape(line) + "</LINE>" for line in lines)
        + "</RUNNINGCONFIG></ENGINE></DEVICE></DEVICES><LINKS/>"
        "</NETWORK></PACKETTRACER5>"
    ).encode()
    obj, report = convert(xml)
    assert base64.b64decode(obj["sourceArchive"]["decodedXmlBase64"]) == xml
    return obj["devices"][0], report


cases = [
    (
        [
            "switchport trunk allowed vlan 10,20-22",
            "switchport trunk allowed vlan add 30",
            "switchport trunk allowed vlan remove 20-21",
        ],
        [10, 22, 30],
    ),
    (["switchport trunk allowed vlan 10", "switchport trunk allowed vlan none"], []),
    (["switchport trunk allowed vlan none", "switchport trunk allowed vlan add 20"], [20]),
    (
        ["switchport trunk allowed vlan all", "switchport trunk allowed vlan remove 20"],
        [v for v in range(1, 4095) if v != 20],
    ),
]
for commands, expected in cases:
    device, report = topology(commands)
    assert device["interfaces"]["gi0/1"]["allowed"] == expected, commands
    assert device["vlans"] == [1], "Trunk references must not create VLANs"
    assert not report["unmodeledConfigLines"], report["unmodeledConfigLines"]

# Unsupported/malformed syntax must not partially overwrite valid membership.
for command in ["10,bad", "4095", "20-10", "except 20"]:
    device, report = topology(
        ["switchport trunk allowed vlan 10", "switchport trunk allowed vlan " + command]
    )
    assert device["interfaces"]["gi0/1"]["allowed"] == [10], command
    assert any(row["command"].endswith(command) for row in report["unmodeledConfigLines"]), command
print("PASS: 8 PT trunk operation and rejection scenarios; source XML preserved")
