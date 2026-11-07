"""Compatibility wrapper: the whole offline HTML is now built by tools/build_html.py.

Kept so existing CI steps, docs and habits (``python build_simulator.py``) still work.
"""
import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).resolve().parent / "tools" / "build_html.py"), run_name="__main__")
