#!/usr/bin/env python3
import unittest
import subprocess
from unittest.mock import Mock
from diagnostics import diagnose


class DiagnosticsTests(unittest.TestCase):
    def test_routes_command_is_fixed(self):
        run = Mock(return_value=Mock(returncode=0, stdout="route table", stderr=""))
        result = diagnose("r1", "routes", runner=run)
        self.assertEqual(run.call_args.args[0],
                         ["docker", "exec", "clab-aglab-real-mvp-r1", "vtysh", "-c", "show ip route"])
        self.assertTrue(result["ok"])

    def test_allowed_commands_and_output_limit(self):
        commands = {"routes": "show ip route", "interfaces": "show interface brief",
                    "neighbors": "show ip ospf neighbor"}
        for router in ("r1", "r2"):
            for view, command in commands.items():
                with self.subTest(router=router, view=view):
                    run = Mock(return_value=Mock(returncode=0, stdout="x" * 13000, stderr=""))
                    result = diagnose(router, view, runner=run)
                    self.assertEqual(run.call_args.args[0],
                                     ["docker", "exec", "clab-aglab-real-mvp-" + router,
                                      "vtysh", "-c", command])
                    self.assertTrue(result["ok"])
                    self.assertEqual(len(result["output"]), 12000)

    def test_failed_command_is_reported(self):
        run = Mock(return_value=Mock(returncode=1, stdout="", stderr="no route"))
        self.assertEqual(diagnose("r2", "routes", runner=run),
                         {"router": "r2", "view": "routes", "ok": False, "output": "no route"})

    def test_timeout_is_reported_without_traceback(self):
        run = Mock(side_effect=subprocess.TimeoutExpired(cmd=["docker"], timeout=15))
        result = diagnose("r1", "neighbors", runner=run)
        self.assertFalse(result["ok"])
        self.assertIn("15 saniye", result["output"])

    def test_docker_unavailable_is_reported_without_traceback(self):
        run = Mock(side_effect=FileNotFoundError("docker"))
        result = diagnose("r2", "interfaces", runner=run)
        self.assertFalse(result["ok"])
        self.assertIn("Docker", result["output"])

    def test_unexpected_device_or_command_rejected(self):
        run = Mock()
        for device, view in [("other", "routes"), ("r2", "configure"), ("r1; echo bad", "routes")]:
            with self.assertRaises(ValueError):
                diagnose(device, view, runner=run)
        run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
