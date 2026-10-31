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

    def test_authenticated_info(self):
        with patch.object(api,"TOKEN","x"*32):
            code,body=self.request("GET","/api/lab","x"*32)
            self.assertEqual(code,200)
            self.assertIn('"r1"',body)
            self.assertIn('"pc2"',body)

    def test_unknown_action_does_not_run_process(self):
        with patch.object(api,"TOKEN","x"*32),patch.object(api.subprocess,"run") as run:
            code,_=self.request("POST","/api/lab/shell","x"*32)
            self.assertEqual(code,404)
            run.assert_not_called()


if __name__=="__main__":
    unittest.main()
