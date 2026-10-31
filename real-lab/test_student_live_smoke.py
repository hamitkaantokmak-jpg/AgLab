"""Lifecycle regression tests; no real containers, accounts or HTTP required."""
import subprocess
import contextlib
import unittest
from unittest.mock import Mock, patch
import student_live_smoke as smoke


class StudentLiveLifecycleTests(unittest.TestCase):
    def test_dry_run_never_touches_host(self):
        with patch.object(smoke.subprocess, 'run') as run, patch.object(smoke.subprocess, 'Popen') as start:
            self.assertEqual(smoke.main([]), 0)
            run.assert_not_called()
            start.assert_not_called()

    def run_live(self, run, **patches):
        with patch.object(smoke.sys, 'platform', 'linux'), patch.object(smoke.os, 'geteuid', return_value=0, create=True), \
             patch.object(smoke.subprocess, 'run', side_effect=run), \
             (patch.multiple(smoke, **patches) if patches else contextlib.nullcontext()):
            return smoke.main(['--execute'])

    def test_existing_lab_is_never_destroyed(self):
        run = Mock(return_value=subprocess.CompletedProcess([], 0, stdout='clab-aglab-real-mvp-r1\n'))
        with self.assertRaisesRegex(RuntimeError, 'pre-existing'):
            self.run_live(run)
        self.assertEqual(run.call_count, 1)

    def test_partial_deploy_failure_still_cleans_containers(self):
        calls = []
        def run(command, **kwargs):
            calls.append(command)
            if 'deploy' in command:
                raise subprocess.CalledProcessError(1, command)
            return subprocess.CompletedProcess(command, 0, stdout='')
        with self.assertRaises(subprocess.CalledProcessError):
            self.run_live(run)
        self.assertIn('destroy', calls[-1])

    def test_student_failure_stops_admin_and_cleans_containers(self):
        calls = []
        def run(command, **kwargs):
            calls.append(command)
            return subprocess.CompletedProcess(command, 0, stdout='')
        process = Mock()
        process.poll.return_value = None
        with patch.object(smoke.subprocess, 'Popen', return_value=process):
            with self.assertRaisesRegex(RuntimeError, 'student chain failed'):
                self.run_live(run, request=Mock(return_value=(200, '{"output":"192.168.20.0/24"}')),
                              execute=Mock(side_effect=RuntimeError('student chain failed')))
        process.terminate.assert_called_once()
        process.wait.assert_called_once_with(timeout=5)
        self.assertIn('destroy', calls[-1])

    def test_api_stop_failure_does_not_skip_container_cleanup(self):
        calls = []
        def run(command, **kwargs):
            calls.append(command)
            return subprocess.CompletedProcess(command, 0, stdout='')
        process = Mock()
        process.poll.return_value = None
        with patch.object(smoke.subprocess, 'Popen', return_value=process):
            with self.assertRaisesRegex(OSError, 'stop failed'):
                self.run_live(run, request=Mock(return_value=(200, '{"output":"192.168.20.0/24"}')),
                              execute=Mock(), stop_process=Mock(side_effect=OSError('stop failed')))
        self.assertIn('destroy', calls[-1])


if __name__ == '__main__':
    unittest.main()
