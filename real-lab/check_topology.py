#!/usr/bin/env python3
"""Check the real-lab prototype without requiring Docker; --live performs an actual ping."""
import argparse
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
TOPOLOGY = ROOT / "topology.clab.yml"
EXPECTED = {
    "r1": {"192.168.10.1/24", "10.0.12.1/30", "192.168.20.0/24 10.0.12.2"},
    "r2": {"192.168.20.1/24", "10.0.12.2/30", "192.168.10.0/24 10.0.12.1"},
}


def validate_files():
    topo = TOPOLOGY.read_text(encoding="utf-8")
    assert "name: aglab-real-mvp" in topo
    # The configuration files must be resolved relative to this topology.
    for config in ("r1/frr.conf", "r2/frr.conf"):
        assert ("startup-config: " + config) in topo
        assert (ROOT / config).is_file()

    for node in ("r1", "r2", "pc1", "pc2"):
        assert re.search(r"^    " + node + r":$", topo, re.M), node
    for endpoints in (
        "[pc1:eth1, r1:eth1]",
        "[r1:eth2, r2:eth2]",
        "[r2:eth1, pc2:eth1]",
    ):
        assert topo.count(endpoints) == 1, endpoints
    for node, expected in EXPECTED.items():
        cfg = (ROOT / node / "frr.conf").read_text(encoding="utf-8")
        for value in expected:
            prefix = "ip route " if " " in value else "ip address "
            assert prefix + value in cfg, (node, value)
    assert "192.168.10.10/24 dev eth1" in topo
    assert "192.168.20.10/24 dev eth1" in topo
    assert "192.168.20.0/24 via 192.168.10.1" in topo
    assert "192.168.10.0/24 via 192.168.20.1" in topo
    print("PASS: real lab static topology and routing checks")


def live_ping():
    command = ["docker", "exec", "clab-aglab-real-mvp-pc1", "ping", "-c", "3", "-W", "2", "192.168.20.10"]
    result = subprocess.run(command, check=False, timeout=20)
    if result.returncode:
        raise SystemExit(f"FAIL: real PC-to-PC ping, exit {result.returncode}")
    print("PASS: real PC-to-PC ping")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Run actual Docker ping after containerlab deploy")
    args = parser.parse_args()
    validate_files()
    if args.live:
        live_ping()
