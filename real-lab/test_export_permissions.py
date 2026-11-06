"""Atomic snapshot publication must preserve least-privilege reader access."""
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import Mock, patch
from export_student_snapshot import export_snapshot


class ExportConfigurationTests(unittest.TestCase):
    def test_invalid_reader_group_rejected_before_fetch(self):
        for group in (-1, True, 'not-a-group', 2**40):
            fetch = Mock()
            with self.assertRaises(ValueError):
                export_snapshot('unused.json', 'a'*40, {'r1'}, fetch=fetch, reader_gid=group)
            fetch.assert_not_called()


@unittest.skipUnless(os.name == 'posix', 'POSIX file permissions require Linux/Unix')
class ExportPermissionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp.name)
        self.folder.chmod(0o750)
        self.path = self.folder / 'snapshot.json'
        self.fetch = Mock(return_value={'ok': True, 'output': 'approved'})

    def tearDown(self):
        self.temp.cleanup()

    def publish(self, **kwargs):
        export_snapshot(self.path, 'a'*40, {'r1'}, fetch=self.fetch, **kwargs)

    def test_initial_and_refresh_publish_with_exact_reader_permissions(self):
        self.publish(reader_gid=os.getgid())
        first_inode = self.path.stat().st_ino
        # Do not copy unsafe permissions from an existing destination.
        self.path.chmod(0o666)
        self.publish(reader_gid=os.getgid())
        self.assertNotEqual(self.path.stat().st_ino, first_inode)
        self.assertEqual(stat.S_IMODE(self.path.stat().st_mode), 0o640)
        self.assertEqual(self.path.stat().st_gid, os.getgid())

    def test_default_remains_private(self):
        self.publish()
        self.assertEqual(stat.S_IMODE(self.path.stat().st_mode), 0o600)

    def test_permissions_are_ready_before_atomic_replace(self):
        self.path.write_text('previous')
        replace = os.replace
        def inspect_then_replace(source, target):
            self.assertEqual(self.path.read_text(), 'previous')
            self.assertEqual(stat.S_IMODE(Path(source).stat().st_mode), 0o640)
            self.assertEqual(Path(source).stat().st_gid, os.getgid())
            replace(source, target)
        with patch('export_student_snapshot.os.replace', side_effect=inspect_then_replace):
            self.publish(reader_gid=os.getgid())

    def test_group_writable_directory_rejected_before_fetch(self):
        self.path.write_text('previous')
        self.folder.chmod(0o770)
        with self.assertRaises(PermissionError):
            self.publish(reader_gid=os.getgid())
        self.fetch.assert_not_called()
        self.assertEqual(self.path.read_text(), 'previous')

    def test_group_assignment_failure_keeps_previous_and_removes_temporary(self):
        self.path.write_text('previous')
        with patch('export_student_snapshot.os.fchown', side_effect=PermissionError('denied')):
            with self.assertRaises(PermissionError):
                self.publish(reader_gid=os.getgid())
        self.assertEqual(self.path.read_text(), 'previous')
        self.assertEqual(sorted(p.name for p in self.folder.iterdir()), ['snapshot.json'])

    def test_permission_failure_never_publishes(self):
        self.path.write_text('previous')
        with patch('export_student_snapshot.os.fchmod', side_effect=PermissionError('denied')):
            with self.assertRaises(PermissionError):
                self.publish(reader_gid=os.getgid())
        self.assertEqual(self.path.read_text(), 'previous')
        self.assertEqual(sorted(p.name for p in self.folder.iterdir()), ['snapshot.json'])


if __name__ == '__main__':
    unittest.main()
