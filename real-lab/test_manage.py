#!/usr/bin/env python3
"""Safe local lifecycle helper unit tests. No Docker daemon required."""
import contextlib
import io
import pathlib
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import manage


class LifecycleTests(unittest.TestCase):
    def test_action_allowlist(self):
        with patch.object(manage.shutil, "which", return_value="/usr/local/bin/containerlab"):
            for action, verb in manage.ACTIONS.items():
                self.assertEqual(manage.command(action), ["/usr/local/bin/containerlab", verb, "-t", str(manage.TOPOLOGY)])
            with self.assertRaises(ValueError):
                manage.command("shell")

    def test_missing_binary(self):
        with patch.object(manage.shutil, "which", return_value=None):
            with self.assertRaisesRegex(RuntimeError, "not installed"):
                manage.command("start")

    def test_default_never_launches(self):
        with patch.object(manage.subprocess, "run") as run, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(manage.main(["start"]), 0)
            run.assert_not_called()

    def test_explicit_execute(self):
        with patch.object(manage.shutil, "which", return_value="/usr/bin/containerlab"), patch.object(manage.subprocess, "run") as run:
            run.return_value.returncode = 0
            self.assertEqual(manage.main(["status", "--execute"]), 0)
            run.assert_called_once_with(
                ["/usr/bin/containerlab", "inspect", "-t", str(manage.TOPOLOGY)],
                cwd=manage.ROOT, timeout=180, check=False
            )

    def test_timeout_fails_closed(self):
        import subprocess
        with patch.object(manage.shutil, "which", return_value="/usr/bin/containerlab"), patch.object(manage.subprocess, "run", side_effect=subprocess.TimeoutExpired("containerlab", 180)), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(manage.main(["start", "--execute"]), 1)


if __name__ == "__main__":
    unittest.main()
