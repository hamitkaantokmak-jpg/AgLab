#!/usr/bin/env python3
"""Exercise local API HTTP auth and dashboard without Docker."""
import contextlib
import http.client
import importlib.util
import pathlib
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("aglab_live_api",ROOT/"api.py")
api=importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)


class LocalHTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(("127.0.0.1",0),api.API)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=3)

    def request(self,method,path,token=None):
        conn=http.client.HTTPConnection("127.0.0.1",self.server.server_address[1],timeout=3)
        headers={"Authorization":"Bearer "+token} if token else {}
        conn.request(method,path,headers=headers)
        response=conn.getresponse()
        data=response.read().decode("utf-8")
        code=response.status
        conn.close()
        return code,data

    def test_dashboard_is_served(self):
        code,body=self.request("GET","/")
        self.assertEqual(code,200)
        self.assertIn("Gerçek Lab",body)

    def test_unauthorized_access(self):
        with patch.object(api,"TOKEN","x"*32):
            for method,path in (("GET","/api/lab"),("POST","/api/lab/start")):
                code,_=self.request(method,path)
                self.assertEqual(code,401)

    def test_duplicate_authorization_headers_are_rejected(self):
        with patch.object(api, "TOKEN", "x"*32), patch.object(api.subprocess, "run") as run:
            conn=http.client.HTTPConnection("127.0.0.1",self.server.server_address[1],timeout=3)
            try:
                conn.putrequest("POST", "/api/lab/start")
                conn.putheader("Authorization", "Bearer " + "x"*32)
                conn.putheader("Authorization", "Bearer " + "x"*32)
                conn.putheader("Content-Length", "0")
                conn.endheaders()
                response=conn.getresponse()
                self.assertEqual(response.status,401)
                response.read()
            finally:
                conn.close()
            run.assert_not_called()

    def test_authenticated_info(self):
        with patch.object(api,"TOKEN","x"*32):
            code,body=self.request("GET","/api/lab","x"*32)
            self.assertEqual(code,200)
            self.assertIn('"r1"',body)
            self.assertIn('"pc2"',body)

    def test_diagnostics_requires_auth_and_allowlist(self):
        with patch.object(api, "TOKEN", "x"*32), patch.object(api, "diagnose") as diagnose:
            code,_=self.request("GET","/api/diagnostics/r1/routes")
            self.assertEqual(code,401)
            for path in ("/api/diagnostics/r3/routes",
                         "/api/diagnostics/r1/configure",
                         "/api/diagnostics/r1/routes/extra",
                         "/api/diagnostics/r1/routes?cmd=sh"):
                code,_=self.request("GET",path,"x"*32)
                self.assertEqual(code,404)
            diagnose.assert_not_called()

    def test_authenticated_diagnostics_read_only(self):
        with patch.object(api, "TOKEN", "x"*32), patch.object(api, "diagnose") as diagnose:
            diagnose.return_value={"router":"r2","view":"interfaces","ok":True,"output":"eth0 up"}
            code,body=self.request("GET","/api/diagnostics/r2/interfaces","x"*32)
            self.assertEqual(code,200)
            self.assertIn("eth0 up",body)
            diagnose.assert_called_once_with("r2","interfaces")

    def test_failed_diagnostics_returns_bad_gateway(self):
        with patch.object(api,"TOKEN","x"*32),patch.object(api,"diagnose") as diagnose:
            diagnose.return_value={"router":"r1","view":"neighbors","ok":False,"output":"Docker unavailable"}
            code,body=self.request("GET","/api/diagnostics/r1/neighbors","x"*32)
            self.assertEqual(code,502)
            self.assertIn("Docker unavailable",body)

    def test_diagnostics_rejected_while_lab_operation_running(self):
        with patch.object(api, "TOKEN", "x"*32), patch.object(api, "diagnose") as diagnose:
            self.assertTrue(api.OPERATION_LOCK.acquire(blocking=False))
            try:
                code,body=self.request("GET","/api/diagnostics/r1/routes","x"*32)
                self.assertEqual(code,409)
                self.assertIn("another lab operation",body)
                diagnose.assert_not_called()
            finally:
                api.OPERATION_LOCK.release()

    def test_diagnostic_unexpected_error_is_redacted_and_lock_released(self):
        with patch.object(api, "TOKEN", "x"*32), patch.object(api, "diagnose") as diagnose:
            diagnose.side_effect=RuntimeError("sensitive internal detail")
            code,body=self.request("GET","/api/diagnostics/r1/routes","x"*32)
            self.assertEqual(code,503)
            self.assertIn("diagnostic unavailable",body)
            self.assertNotIn("sensitive internal detail",body)
            # Reading the response can beat the handler's finally block on
            # another thread. A leaked lock must still fail within one second.
            self.assertTrue(api.OPERATION_LOCK.acquire(timeout=1))
            api.OPERATION_LOCK.release()

    def test_dashboard_has_diagnostic_controls(self):
        code,body=self.request("GET","/")
        self.assertEqual(code,200)
        self.assertIn('data-action="diagnostics"',body)
        self.assertIn('id="diag-router"',body)
        self.assertIn('id="diag-view"',body)

    def test_unknown_action_does_not_run_process(self):
        with patch.object(api,"TOKEN","x"*32),patch.object(api.subprocess,"run") as run:
            code,_=self.request("POST","/api/lab/shell","x"*32)
            self.assertEqual(code,404)
            run.assert_not_called()


if __name__=="__main__":
    unittest.main()
