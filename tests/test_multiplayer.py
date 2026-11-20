import http.client
import json
import os
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import Mock, patch
from contextlib import closing
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server
import auth
import multiplayer


class MultiplayerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.original = server.DB
        server.DB = os.path.join(self.tmp.name, 'mp.db')
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

    def presence(self, user='tester', location='pond', status='idle'):
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        c.request('POST', '/api/login', body=json.dumps({'username': user, 'password': 'secret1'}).encode(),
                  headers={'Content-Type': 'application/json'})
        r = c.getresponse()
        self.assertEqual(r.status, 200)
        cookie = r.getheader('Set-Cookie').split(';', 1)[0]
        r.read()
        c.request('POST', '/api/presence', body=json.dumps({'location': location, 'status': status}).encode(),
                  headers={'Content-Type': 'application/json', 'Cookie': cookie})
        r = c.getresponse()
        data, code = r.read(), r.status
        c.close()
        return code, json.loads(data)

    def add_catch(self, user, fish_id=1, weight=1.0, kept=1, price=150, trophy=0, caught_at=None):
        with closing(server.conn()) as c:
            if caught_at:
                c.execute('''INSERT INTO catch(user_id,fish_id,location_id,weight_kg,kept,price,trophy,caught_at)
                             VALUES (?, ?, 1, ?, ?, ?, ?, ?)''',
                          (self.users[user], fish_id, weight, kept, price, trophy, caught_at))
            else:
                c.execute('''INSERT INTO catch(user_id,fish_id,location_id,weight_kg,kept,price,trophy)
                             VALUES (?, ?, 1, ?, ?, ?, ?)''',
                          (self.users[user], fish_id, weight, kept, price, trophy))
            c.commit()

    def test_requires_session(self):
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        c.request('POST', '/api/presence', body=b'{}', headers={'Content-Type': 'application/json'})
        r = c.getresponse()
        self.assertEqual(r.status, 401)
        c.close()

    def test_neighbors_same_location_with_status(self):
        self.presence('alice', 'pond', 'wait')
        self.presence('bob', 'pond', 'fight')
        code, r = self.presence('tester', 'pond', 'idle')
        self.assertEqual(code, 200)
        self.assertTrue(r['ok'])
        self.assertEqual(r['players'], [{'username': 'alice', 'status': 'wait'},
                                        {'username': 'bob', 'status': 'fight'}])
        self.assertEqual(r['online'], 3)
        self.assertEqual(r['counts'], {'pond': 3})

    def test_other_location_not_a_neighbor(self):
        self.presence('alice', 'lake', 'wait')
        code, r = self.presence('tester', 'pond')
        self.assertEqual(code, 200)
        self.assertEqual(r['players'], [])
        self.assertEqual(r['online'], 2)
        self.assertEqual(r['counts'], {'lake': 1, 'pond': 1})

    def test_stale_presence_excluded(self):
        self.presence('alice', 'pond', 'wait')
        with closing(server.conn()) as c:
            c.execute('UPDATE presence SET seen_at=? WHERE user_id=?',
                      (time.time() - multiplayer.ONLINE_TIMEOUT - 5, self.users['alice']))
            c.commit()
        code, r = self.presence('tester', 'pond')
        self.assertEqual(r['players'], [])
        self.assertEqual(r['online'], 1)

    def test_heartbeat_updates_location_and_status(self):
        self.presence('alice', 'pond', 'wait')
        self.presence('alice', 'lake', 'fight')
        code, r = self.presence('tester', 'lake')
        self.assertEqual(r['players'], [{'username': 'alice', 'status': 'fight'}])
        self.assertEqual(r['counts'], {'lake': 2})

    def test_sea_requires_boat(self):
        code, r = self.presence('tester', 'sea')
        self.assertEqual(code, 403)
        self.assertFalse(r['ok'])
        with closing(server.conn()) as c:
            c.execute('UPDATE player SET boat_owned=1 WHERE user_id=?', (self.users['tester'],))
            c.commit()
        code, r = self.presence('tester', 'sea')
        self.assertEqual(code, 200)

    def test_unknown_location_rejected(self):
        code, r = self.presence('tester', 'ocean')
        self.assertEqual(code, 400)
        self.assertFalse(r['ok'])

    def test_unknown_status_normalized_to_idle(self):
        self.presence('alice', 'pond', 'hacked')
        code, r = self.presence('tester', 'pond')
        self.assertEqual(r['players'], [{'username': 'alice', 'status': 'idle'}])

    def test_feed_shows_others_not_own_catches(self):
        self.add_catch('bob', fish_id=1, weight=1.2, trophy=1)
        self.add_catch('tester', fish_id=2, weight=3.0)
        code, r = self.presence('tester', 'pond')
        self.assertEqual(len(r['feed']), 1)
        row = r['feed'][0]
        self.assertEqual(row['username'], 'bob')
        self.assertEqual(row['fish'], 'Карась')
        self.assertEqual(row['location_code'], 'lake')
        self.assertEqual(row['weight'], 1.2)
        self.assertTrue(row['trophy'])
        self.assertTrue(row['kept'])
        self.assertTrue(row['caught_at'])

    def test_feed_newest_first_and_limited(self):
        for i in range(multiplayer.FEED_LIMIT + 3):
            self.add_catch('bob', weight=0.2 + i * 0.05)
        code, r = self.presence('tester', 'pond')
        self.assertEqual(len(r['feed']), multiplayer.FEED_LIMIT)
        weights = [row['weight'] for row in r['feed']]
        self.assertEqual(weights, sorted(weights, reverse=True))

    def test_feed_ignores_old_catches(self):
        self.add_catch('bob', caught_at='2000-01-01 00:00:00')
        code, r = self.presence('tester', 'pond')
        self.assertEqual(r['feed'], [])

    def test_supabase_dispatch_uses_rpc_without_sqlite(self):
        fake = Mock()
        fake.rpc.return_value = {'status': 200, 'body': {'ok': True}}
        data = {'location': 'pond', 'status': 'idle'}
        with patch.object(server, 'DB_BACKEND', 'supabase'), patch.object(server, 'SUPABASE', fake), \
             patch.object(server.sqlite3, 'connect', side_effect=AssertionError('SQLite used')):
            self.assertEqual(server.post_presence(data, 7), (200, {'ok': True}))
            fake.rpc.assert_called_with('presence', {'uid': 7, 'data': data})


if __name__ == '__main__':
    unittest.main()