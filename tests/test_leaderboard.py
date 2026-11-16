import http.client
import json
import os
import sys
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch
from contextlib import closing
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server
import auth


class LeaderboardTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.original = server.DB
        server.DB = os.path.join(self.tmp.name, 'lb.db')
        server.init_db()
        self.users = {}
        for name in ('tester', 'alice', 'bob'):
            with closing(server.conn()) as c:
                uid, err = auth.register(c, name, 'secret1')
                self.assertIsNone(err)
                c.commit()
            self.users[name] = uid
        self.httpd = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown(); self.httpd.server_close()
        server.DB = self.original
        self.tmp.cleanup()

    def add_catch(self, user, fish_id, weight, kept=1, price=0):
        with closing(server.conn()) as c:
            c.execute('INSERT INTO catch(user_id,fish_id,location_id,weight_kg,kept,price) VALUES (?,?,?,?,?,?)',
                      (self.users[user], fish_id, 1, weight, kept, price))
            c.commit()

    def board(self, user='tester'):
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        status, data, cookie = None, None, None
        c.request('POST', '/api/login', body=json.dumps({'username': user, 'password': 'secret1'}).encode(),
                  headers={'Content-Type': 'application/json'})
        r = c.getresponse()
        self.assertEqual(r.status, 200)
        cookie = r.getheader('Set-Cookie').split(';', 1)[0]
        r.read()
        c.request('GET', '/api/leaderboard', headers={'Cookie': cookie})
        r = c.getresponse()
        data = r.read()
        status = r.status
        c.close()
        self.assertEqual(status, 200, data)
        return json.loads(data)

    def fish_board(self, lb, fish_id):
        return next(b['rows'] for b in lb['fish'] if b['id'] == fish_id)

    def test_requires_session(self):
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        c.request('GET', '/api/leaderboard')
        r = c.getresponse()
        self.assertEqual(r.status, 401)
        c.close()

    def test_empty_boards_cover_every_species(self):
        lb = self.board()
        self.assertEqual(lb['price'], [])
        with closing(server.conn()) as c:
            ids = [r['id'] for r in c.execute('SELECT id FROM fish ORDER BY price, id')]
        self.assertEqual([b['id'] for b in lb['fish']], ids)
        self.assertTrue(all(b['rows'] == [] for b in lb['fish']))

    def test_weight_board_counts_released_and_keeps_best_per_user(self):
        self.add_catch('alice', 1, 0.9, kept=1, price=142)
        self.add_catch('bob', 1, 1.1, kept=0, price=0)      # отпущенная — всё равно рекорд
        self.add_catch('alice', 1, 0.5, kept=1, price=108)  # хуже прежней — не должна дублировать игрока
        rows = self.fish_board(self.board('alice'), 1)
        self.assertEqual([(r['username'], r['weight']) for r in rows], [('bob', 1.1), ('alice', 0.9)])
        self.assertEqual([r['you'] for r in rows], [False, True])

    def test_price_board_kept_only_and_best_per_user(self):
        self.add_catch('alice', 4, 8.0, kept=1, price=500)
        self.add_catch('alice', 2, 7.0, kept=1, price=400)  # дешевле — в зачёт не идёт
        self.add_catch('bob', 1, 1.2, kept=0, price=0)      # отпущенная не стоит ничего
        self.add_catch('tester', 1, 1.2, kept=1, price=175)
        top = self.board('tester')['price']
        self.assertEqual([(r['username'], r['price'], r['fish']) for r in top],
                         [('alice', 500, 'Щука'), ('tester', 175, 'Карась')])
        self.assertEqual([r['you'] for r in top], [False, True])
        self.assertEqual(top[0]['weight'], 8.0)
        self.assertTrue(all(r['caught_at'] for r in top))

    def test_equal_records_earlier_catch_first(self):
        self.add_catch('alice', 1, 1.0)
        self.add_catch('bob', 1, 1.0)
        rows = self.fish_board(self.board(), 1)
        self.assertEqual([r['username'] for r in rows], ['alice', 'bob'])

    def test_top_is_limited_to_ten(self):
        with closing(server.conn()) as c:
            for i in range(12):
                uid, err = auth.register(c, f'player{i}', 'secret1')
                self.assertIsNone(err)
                c.execute('INSERT INTO catch(user_id,fish_id,location_id,weight_kg,kept,price) VALUES (?,1,1,?,1,100)',
                          (uid, 0.3 + i * 0.05))
            c.commit()
        rows = self.fish_board(self.board(), 1)
        self.assertEqual(len(rows), 10)
        self.assertEqual(rows[0]['username'], 'player11')
        self.assertEqual([r['weight'] for r in rows], sorted((r['weight'] for r in rows), reverse=True))

    def test_supabase_dispatch_uses_rpc_without_sqlite(self):
        fake = Mock()
        fake.rpc.return_value = {'price': [], 'fish': []}
        with patch.object(server, 'DB_BACKEND', 'supabase'), patch.object(server, 'SUPABASE', fake), \
             patch.object(server.sqlite3, 'connect', side_effect=AssertionError('SQLite used')):
            self.assertEqual(server.get_leaderboard(7), {'price': [], 'fish': []})
            fake.rpc.assert_called_with('leaderboard', {'uid': 7})


if __name__ == '__main__':
    unittest.main()