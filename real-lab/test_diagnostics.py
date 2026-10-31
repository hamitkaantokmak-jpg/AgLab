#!/usr/bin/env python3
import unittest
from unittest.mock import Mock
from diagnostics import diagnose


class DiagnosticsTests(unittest.TestCase):
    def test_routes_command_is_fixed(self):
        run = Mock(return_value=Mock(returncode=0, stdout="route table", stderr=""))
        result = diagnose("r1", "routes", runner=run)
        self.assertEqual(run.call_args.args[0],
                         ["docker", "exec", "clab-aglab-real-mvp-r1", "vtysh", "-c", "show ip route"])
        self.assertTrue(result["ok"])

    def test_unexpected_device_or_command_rejected(self):
        run = Mock()
        for device, view in [("other", "routes"), ("r2", "configure"), ("r1; echo bad", "routes")]:
            with self.assertRaises(ValueError):
                diagnose(device, view, runner=run)
        run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
