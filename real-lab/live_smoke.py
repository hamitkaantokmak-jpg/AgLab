#!/usr/bin/env python3
"""Opt-in live Containerlab smoke test with unconditional cleanup."""
import argparse
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent
TOPOLOGY = ROOT / "topology.clab.yml"
PING = ["docker", "exec", "clab-aglab-real-mvp-pc1", "ping", "-c", "3", "-W", "2", "192.168.20.10"]


def run(args, timeout):
    return subprocess.run(args, cwd=ROOT, timeout=timeout, check=True)


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true", help="Deploy real containers; requires privileged lab host")
    args = parser.parse_args(argv)
    if not args.execute:
        print("DRY RUN: would deploy, ping and destroy", TOPOLOGY)
        return 0
    succeeded = False
    try:
        run(["containerlab", "deploy", "-t", str(TOPOLOGY)], 240)
        run(PING, 30)
        succeeded = True
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as error:
        print("Live smoke failed:", error, file=sys.stderr)
    finally:
        try:
            run(["containerlab", "destroy", "-t", str(TOPOLOGY)], 120)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as error:
            print("Cleanup failed; check lab host:", error, file=sys.stderr)
            succeeded = False
    print("PASS: real ICMP and cleanup" if succeeded else "FAIL: live lab or cleanup")
    return 0 if succeeded else 1


if __name__ == "__main__":
    raise SystemExit(main())
