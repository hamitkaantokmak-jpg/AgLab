#!/usr/bin/env python3
"""Build the single offline AğLab HTML from the sources under src/.

The committed ``AgLab_Final_PKT_Import.html`` is a build *output* only. Edit the
files under ``src/``, ``simulator/`` and ``academy/`` and run this script (or the
compatibility wrappers ``build_simulator.py`` / ``build_academy.py``).

Two kinds of placeholders are expanded:

* ``@@include <path>@@`` in ``src/index.html`` and in the files it includes:
  replaced verbatim by the content of ``<path>`` (relative to the repo root).
* A line ``//@@module <TITLE>@@`` (optionally indented) inside JavaScript sources: replaced by a
  ``// BEGIN <TITLE> GENERATED`` ... ``// END <TITLE> GENERATED`` block whose
  body comes from ``MODULES``. The markers are kept in the output because
  regression tests and release verification look for them.

Usage:
    python tools/build_html.py          # write the HTML
    python tools/build_html.py --check  # fail if the committed HTML is stale
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "src" / "index.html"
OUTPUT = ROOT / "AgLab_Final_PKT_Import.html"
DIGEST = ROOT / "html-build.sha256"

INCLUDE = re.compile(r"@@include ([\w./-]+)@@")
# Formatters indent the placeholder inside the main IIFE; the indentation is dropped.
MODULE = re.compile(r"^[ \t]*//@@module ([A-Z ]+)@@\n", re.M)

# Title -> source files concatenated (in order) into the generated block.
MODULES: dict[str, list[str]] = {
    "ENGINE": [
        "src/engine/ipv4.js",
        "src/engine/topology.js",
        "src/engine/routing.js",
        "src/engine/stp.js",
        "src/engine/acl.js",
    ],
    "MAC ADDRESS": ["simulator/mac-address.js"],
    "SWITCH MANAGEMENT": ["simulator/switch-management.js"],
    "MAC LEARNING": ["simulator/mac-learning.js"],
    "ETHERNET FORWARDING": ["simulator/ethernet-forwarding.js"],
    "ROUTING PATH": ["simulator/routing-path.js"],
    "ROUTED ETHERNET": ["simulator/routed-ethernet.js"],
    "ICMP": ["simulator/icmp.js"],
    "TRACEROUTE": ["simulator/traceroute.js"],
    "PACKET EVENTS": ["simulator/packet-events.js"],
    "PACKET DETECTIVE UI": ["simulator/packet-detective-ui.js"],
    "DEVICE CLI": ["simulator/device-cli.js"],
    "NETWORK PROTOCOLS": ["simulator/network-protocols.js"],
    "PORT SECURITY": ["simulator/port-security.js"],
    "NETWORK SCENARIOS": ["simulator/network-scenarios.js"],
    "SIMULATION PLAYBACK": ["simulator/simulation-playback.js"],
    "BORCK ENGINE": ["simulator/borck-engine.generated.js"],
    "ENGINE MANAGER": ["simulator/engine-manager.js"],
    "ENGINE MANAGER UI": ["simulator/engine-manager-ui.js"],
    "BORCK UI": ["simulator/borck-ui.js"],
    "LAB EVIDENCE": ["simulator/lab-evidence.js"],
    "LAB EVIDENCE UI": ["simulator/lab-evidence-ui.js"],
    "SIMULATION UI": ["simulator/simulation-ui.js"],
    "ACADEMY": [
        "academy/student-data.js",
        "academy/grading-verdict.js",
        "academy/vlan-health.js",
        "academy/routing-grading.js",
        "academy/academy.js",
    ],
}


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def module_block(title: str) -> str:
    if title not in MODULES:
        raise SystemExit(f"Unknown module placeholder: {title}")
    body = "".join(read(p) for p in MODULES[title])
    if title == "NETWORK SCENARIOS":
        # Scenario data is embedded as a JS literal, never evaluated as code from JSON.
        body = (
            "const sharedNetworkScenarios="
            + read("simulator/network-scenarios.json")
            + ";\n"
            + body
        )
    return f"// BEGIN {title} GENERATED\n{body}\n// END {title} GENERATED\n"


def expand(text: str, seen: tuple[str, ...] = ()) -> str:
    def include(match: re.Match[str]) -> str:
        rel = match.group(1)
        if rel in seen:
            raise SystemExit("Include cycle: " + " -> ".join(seen + (rel,)))
        return expand(read(rel), seen + (rel,))

    text = INCLUDE.sub(include, text)
    return MODULE.sub(lambda m: module_block(m.group(1)), text)


def build() -> str:
    html = expand(TEMPLATE.read_text(encoding="utf-8"))
    used = set(re.findall(r"// BEGIN ([A-Z ]+) GENERATED\n", html))
    missing = set(MODULES) - used
    if missing:
        raise SystemExit("Modules never placed in the template: " + ", ".join(sorted(missing)))
    return html


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--check", action="store_true", help="only verify the committed HTML is up to date"
    )
    args = parser.parse_args()
    html = build().encode("utf-8")
    digest = hashlib.sha256(html).hexdigest()
    if args.check:
        current = OUTPUT.read_bytes() if OUTPUT.exists() else b""
        if current != html:
            print(f"{OUTPUT.name} is stale; run: python tools/build_html.py", file=sys.stderr)
            return 1
        print(f"{OUTPUT.name} up to date ({digest})")
        return 0
    OUTPUT.write_bytes(html)
    DIGEST.write_text(f"{digest}  {OUTPUT.name}\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUTPUT.name} ({len(html)} bytes, sha256 {digest})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
