#!/usr/bin/env python3
"""Unit checks for the local API. No Docker or HTTP listener required."""
import importlib.util
import pathlib
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("aglab_api", ROOT / "api.py")
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)


class APITests(unittest.TestCase):
    def test_dashboard_is_local_and_has_controls(self):
        page = (ROOT / "dashboard.html").read_text(encoding="utf-8")
        for action in ("info", "status", "start", "stop"):
            self.assertIn('data-action="' + action + '"', page)
        self.assertIn("'/api/lab'", page)
        self.assertNotIn("localStorage", page)
        self.assertIn('type="password"', page)

    def test_fixed_actions(self):
        self.assertEqual(set(api.ACTIONS), {"start", "stop", "status"})
        self.assertEqual(api.DEVICES, {"r1", "r2", "pc1", "pc2"})

    def test_operation_lock_prevents_overlap(self):
        self.assertTrue(api.OPERATION_LOCK.acquire(blocking=False))
        try:
            self.assertFalse(api.OPERATION_LOCK.acquire(blocking=False))
        finally:
            api.OPERATION_LOCK.release()
        self.assertTrue(api.OPERATION_LOCK.acquire(blocking=False))
        api.OPERATION_LOCK.release()

    def test_token_is_required_to_serve(self):
        with patch.object(api, "TOKEN", ""):
            with self.assertRaises(SystemExit):
                api.main()

    def test_not_bound_publicly(self):
        with patch.object(api, "TOKEN", "x" * 32):
            with patch.object(api, "ThreadingHTTPServer") as server:
                server.return_value.serve_forever.side_effect = RuntimeError("stop")
                with self.assertRaisesRegex(RuntimeError, "stop"):
                    api.main()
                self.assertEqual(server.call_args.args[0], ("127.0.0.1", 8765))


if __name__ == "__main__":
    unittest.main()
