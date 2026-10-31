#!/usr/bin/env python3
"""Allowlisted read-only FRR diagnostics; never accepts free-form shell input."""
import argparse
import subprocess

ROUTERS = frozenset({"r1", "r2"})
SHOW = {
    "routes": ["show", "ip", "route"],
    "interfaces": ["show", "interface", "brief"],
    "neighbors": ["show", "ip", "ospf", "neighbor"],
}
LAB = "aglab-real-mvp"


def diagnose(router, view, runner=subprocess.run):
    if router not in ROUTERS or view not in SHOW:
        raise ValueError("unsupported router or diagnostic")
    command = ["docker", "exec", "clab-" + LAB + "-" + router, "vtysh", "-c", " ".join(SHOW[view])]
    result = runner(command, capture_output=True, text=True, timeout=15, check=False)
    return {"router": router, "view": view, "ok": result.returncode == 0,
            "output": (result.stdout + result.stderr)[-12000:]}


def main():
    parser = argparse.ArgumentParser(description="Fixed read-only FRRouting diagnostics")
    parser.add_argument("router", choices=sorted(ROUTERS))
    parser.add_argument("view", choices=sorted(SHOW))
    args = parser.parse_args()
    result = diagnose(args.router, args.view)
    print(result["output"])
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
