#!/usr/bin/env python3
"""Mock the real-lab deploy/ping/destroy lifecycle; never touches Docker."""
import contextlib
import io
import pathlib
import sys
import unittest
from unittest.mock import patch
import subprocess

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import live_smoke


class LiveSmokeTests(unittest.TestCase):
    def test_default_is_non_destructive(self):
        with patch.object(live_smoke, "run") as run, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(live_smoke.main([]), 0)
            run.assert_not_called()

    def test_success_always_destroys(self):
        seen = []
        def fake(cmd, timeout):
            seen.append((cmd, timeout))
        with patch.object(live_smoke, "run", side_effect=fake), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(live_smoke.main(["--execute"]), 0)
        self.assertEqual([c[0][1] for c in seen], ["deploy", "exec", "destroy"])

    def test_ping_failure_still_destroys(self):
        seen = []
        def fake(cmd, timeout):
            seen.append(cmd)
            if cmd[0] == "docker":
                raise subprocess.CalledProcessError(1, cmd)
        with patch.object(live_smoke, "run", side_effect=fake), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(live_smoke.main(["--execute"]), 1)
        self.assertEqual(seen[-1][1], "destroy")

    def test_deploy_failure_still_attempts_destroy(self):
        seen = []
        def fake(cmd, timeout):
            seen.append(cmd)
            if cmd[1] == "deploy":
                raise subprocess.CalledProcessError(1, cmd)
        with patch.object(live_smoke, "run", side_effect=fake), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(live_smoke.main(["--execute"]), 1)
        self.assertEqual([c[1] for c in seen], ["deploy", "destroy"])

    def test_cleanup_failure_is_failure(self):
        def fake(cmd, timeout):
            if cmd[1] == "destroy":
                raise subprocess.CalledProcessError(1, cmd)
        with patch.object(live_smoke, "run", side_effect=fake), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(live_smoke.main(["--execute"]), 1)


if __name__ == "__main__":
    unittest.main()
