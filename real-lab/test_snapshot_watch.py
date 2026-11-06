"""Refresh failures must not cause tight loops, credential leaks or partial files."""
import contextlib
import io
import json
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
import export_student_snapshot as exporter


class SnapshotWatchTests(unittest.TestCase):
    def test_invalid_interval_rejected_before_network(self):
        for interval in (0, 4, 31, True, '20'):
            with patch.object(exporter, 'export_snapshot') as publish:
                with self.assertRaises(ValueError):
                    exporter.watch_snapshots('unused', 'a'*40, {'r1'}, interval=interval)
                publish.assert_not_called()

    def test_invalid_configuration_fails_before_loop(self):
        with patch.object(exporter, 'export_snapshot') as publish:
            with self.assertRaises(ValueError):
                exporter.watch_snapshots('unused', 'short', {'r1'})
            publish.assert_not_called()

    def test_failure_recovery_keeps_previous_and_waits_between_attempts(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'snapshot.json'
            path.write_text('previous')
            attempts = []
            real_export = exporter.export_snapshot
            def publish(*args, **kwargs):
                attempts.append(path.read_text())
                if len(attempts) == 1:
                    raise OSError('sensitive token aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
                real_export(*args, **kwargs, fetch=lambda *_: {'ok': True, 'output': 'recovered'})
            waits = []
            def wait(seconds):
                waits.append(seconds)
                if len(waits) == 2:
                    raise KeyboardInterrupt
            output = io.StringIO()
            with patch.object(exporter, 'export_snapshot', side_effect=publish), \
                 patch.object(exporter.time, 'sleep', side_effect=wait), contextlib.redirect_stdout(output):
                with self.assertRaises(KeyboardInterrupt):
                    exporter.watch_snapshots(path, 'a'*40, {'r1'}, interval=5)
            self.assertEqual(attempts, ['previous', 'previous'])
            self.assertEqual(waits, [5, 5])
            self.assertEqual(json.loads(path.read_text())['diagnostics']['r1']['routes']['output'], 'recovered')
            self.assertNotIn('sensitive', output.getvalue())
            self.assertNotIn('a'*40, output.getvalue())
            self.assertEqual(sorted(p.name for p in Path(directory).iterdir()), ['snapshot.json'])

    def test_interrupted_write_keeps_previous_and_removes_temporary(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'snapshot.json'
            path.write_text('previous')
            with patch.object(exporter.json, 'dump', side_effect=KeyboardInterrupt):
                with self.assertRaises(KeyboardInterrupt):
                    exporter.export_snapshot(path, 'a'*40, {'r1'},
                                             fetch=lambda *_: {'ok': True, 'output': 'data'})
            self.assertEqual(path.read_text(), 'previous')
            self.assertEqual(sorted(p.name for p in Path(directory).iterdir()), ['snapshot.json'])

    def test_slow_collection_does_not_publish_already_expired_data(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'snapshot.json'
            path.write_text('previous')
            with patch.object(exporter.time, 'time', side_effect=[100, 161]):
                with self.assertRaises(ValueError):
                    exporter.export_snapshot(path, 'a'*40, {'r1'},
                                             fetch=lambda *_: {'ok': True, 'output': 'too old'})
            self.assertEqual(path.read_text(), 'previous')


if __name__ == '__main__':
    unittest.main()
