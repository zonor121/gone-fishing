import os
import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server
import auth
import legacy

class BellsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.original = server.DB
        server.DB = os.path.join(self.tmp.name, 'test.db')
        server.init_db()
        with closing(server.conn()) as c:
            self.uid, _ = auth.register(c, 'angler', 'secret1')
            c.commit()

    def tearDown(self):
        server.DB = self.original
        self.tmp.cleanup()

    def sql(self, query, args=()):
        c = server.conn()
        result = c.execute(query, args).fetchall()
        c.commit(); c.close()
        return result

    def test_purchase_persistent_and_not_repeated(self):
        self.assertFalse(server.get_state(self.uid)['bells_owned'])
        self.assertEqual(server.post_buy({'item': 'bells'}, self.uid)[0], 200)
        state = server.get_state(self.uid)
        self.assertEqual(state['money'], 0)
        self.assertTrue(state['bells_owned'])
        server.init_db()
        self.assertTrue(server.get_state(self.uid)['bells_owned'])
        self.assertEqual(server.post_buy({'item': 'bells'}, self.uid)[0], 409)
        self.assertEqual(server.get_state(self.uid)['money'], 0)
        self.assertEqual(server.get_config()['bells_price'], 200)

    def test_insufficient_money_keeps_state(self):
        self.sql('UPDATE player SET money=199 WHERE user_id=?', (self.uid,))
        code, body = server.post_buy({'item': 'bells'}, self.uid)
        self.assertEqual(code, 400)
        self.assertIn('200', body['error'])
        state = server.get_state(self.uid)
        self.assertEqual(state['money'], 199)
        self.assertFalse(state['bells_owned'])

    def test_bells_do_not_unlock_sea(self):
        self.assertEqual(server.post_buy({'item': 'bells'}, self.uid)[0], 200)
        state = server.get_state(self.uid)
        self.assertTrue(state['bells_owned'])
        self.assertFalse(state['boat_owned'])
        self.assertEqual(server.post_cast({'location': 'sea', 'bait': 'worm'}, self.uid)[0], 403)

    def test_legacy_save_migration_adds_bells(self):
        os.remove(server.DB)
        legacy.build(server.DB)
        c = sqlite3.connect(server.DB)
        c.execute('UPDATE player SET money=4321')
        c.commit(); c.close()
        server.init_db(); server.init_db()
        with closing(server.conn()) as c:
            uid, err = auth.authenticate(c, 'fisherman', 'fisherman')
            self.assertIsNone(err)
        state = server.get_state(uid)
        self.assertEqual(state['money'], 4321)
        self.assertFalse(state['bells_owned'])
        self.assertEqual(server.post_buy({'item': 'bells'}, uid)[0], 200)
        self.assertTrue(server.get_state(uid)['bells_owned'])