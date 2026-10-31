#!/usr/bin/env python3
"""Local, administrator-only real-lab runner. No remote HTTP or arbitrary shell."""
import argparse
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent
TOPOLOGY = ROOT / 'topology.clab.yml'
ACTIONS = {'start': 'deploy', 'stop': 'destroy', 'status': 'inspect'}


def command(action):
    if action not in ACTIONS:
        raise ValueError('Unknown lab action')
    binary = shutil.which('containerlab')
    if not binary:
        raise RuntimeError('containerlab is not installed or not in PATH')
    return [binary, ACTIONS[action], '-t', str(TOPOLOGY)]


def main(argv=None):
    parser = argparse.ArgumentParser(description='Manage the one bundled AğLab lab locally')
    parser.add_argument('action', choices=sorted(ACTIONS))
    parser.add_argument('--execute', action='store_true', help='Actually run Containerlab')
    args = parser.parse_args(argv)
    if not args.execute:
        print('DRY RUN: action', args.action, 'target', TOPOLOGY)
        print('Add --execute on a trusted Linux lab host.')
        return 0
    try:
        result = subprocess.run(command(args.action), cwd=ROOT, timeout=180, check=False)
    except (RuntimeError, subprocess.TimeoutExpired) as exc:
        print('ERROR:', exc, file=sys.stderr)
        return 1
    return result.returncode


if __name__ == '__main__':
    raise SystemExit(main())
