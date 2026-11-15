"""Run all tests offline; never contact a configured Supabase project."""
import os
import sys
from pathlib import Path
import unittest
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
os.environ['DB_BACKEND'] = 'sqlite'
suite = unittest.defaultTestLoader.discover(str(root / 'tests'))
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(not result.wasSuccessful())
