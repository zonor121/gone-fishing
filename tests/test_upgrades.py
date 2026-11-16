import http.client
import json
import os
import sys
import tempfile
import threading
import time
import unittest
from contextlib import closing
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server
import auth


class UpgradesTests(unittest.TestCase):
    """Топ-3: стили вываживания, магазин удочек (rod_level), трофейные рыбы."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.original = server.DB
        server.DB = os.path.join(self.tmp.name, 'up.db')
        server.init_db()
        with closing(server.conn()) as c:
            self.uid, err = auth.register(c, 'tester', 'secret1')
            self.assertIsNone(err)
            c.commit()
        self.httpd = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown(); self.httpd.server_close()
        server.DB = self.original
        self.tmp.cleanup()

    def req(self, method, path, body=None, login=True):
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        cookie = None
        if login:
            c.request('POST', '/api/login', body=json.dumps({'username': 'tester', 'password': 'secret1'}).encode(),
                      headers={'Content-Type': 'application/json'})
            r = c.getresponse()
            self.assertEqual(r.status, 200)
            cookie = r.getheader('Set-Cookie').split(';', 1)[0]
            r.read()
        headers = {'Content-Type': 'application/json'}
        if cookie:
            headers['Cookie'] = cookie
        c.request(method, path, body=json.dumps(body).encode() if body is not None else None, headers=headers)
        r = c.getresponse()
        data = r.read()
        status = r.status
        c.close()
        return status, json.loads(data) if data else None

    def set_money(self, n):
        with closing(server.conn()) as c:
            c.execute('UPDATE player SET money=? WHERE user_id=?', (n, self.uid))
            c.commit()

    def arm_cast(self, fish_id=1, location_id=1, bait_id=1):
        with closing(server.conn()) as c:
            c.execute('INSERT OR REPLACE INTO active_cast(user_id,location_id,bait_id,ready_at) VALUES (?,?,?,?)',
                      (self.uid, location_id, bait_id, time.time() - 1))
            c.commit()

    def catch(self, weight, trophy=False, kept=True):
        self.arm_cast()
        return self.req('POST', '/api/catch',
                        {'fish_id': 1, 'location': 'lake', 'weight': weight, 'kept': kept, 'trophy': trophy})

    # ---- конфиг: стили боя, цены удочек, шанс трофея ----
    def test_config_fish_styles_prices_and_trophy_chance(self):
        status, cfg = self.req('GET', '/api/config', login=False)
        self.assertEqual(status, 200)
        self.assertEqual({r['id']: r['price'] for r in cfg['rods']}, {1: 0, 2: 1200, 3: 4500})
        self.assertEqual(cfg['rod_prices'], {'2': 1200, '3': 4500})
        self.assertEqual(cfg['trophy_chance'], 0.04)
        styles = {f['id']: f['style'] for f in cfg['fish']}
        self.assertTrue(all(s in ('calm', 'dart', 'heavy', 'diver') for s in styles.values()), styles)
        self.assertEqual(styles[1], 'calm')    # карась
        self.assertEqual(styles[2], 'heavy')   # карп
        self.assertEqual(styles[4], 'dart')    # щука
        self.assertEqual(styles[11], 'diver')  # налим
        self.assertEqual(styles[10], 'dart')   # тунец

    # ---- магазин удочек ----
    def test_state_rod_level_starts_at_one(self):
        status, s = self.req('GET', '/api/state')
        self.assertEqual(status, 200)
        self.assertEqual(s['rod_level'], 1)

    def test_buy_rod_upgrades_sequentially_and_charges(self):
        self.set_money(10000)
        status, r = self.req('POST', '/api/buy', {'item': 'rod'})
        self.assertEqual(status, 200, r)
        status, s = self.req('GET', '/api/state')
        self.assertEqual(s['rod_level'], 2)
        self.assertEqual(s['money'], 8800)
        status, r = self.req('POST', '/api/buy', {'item': 'rod'})
        self.assertEqual(status, 200, r)
        status, s = self.req('GET', '/api/state')
        self.assertEqual(s['rod_level'], 3)
        self.assertEqual(s['money'], 4300)
        status, r = self.req('POST', '/api/buy', {'item': 'rod'})
        self.assertEqual(status, 409)
        self.assertFalse(r['ok'])

    def test_buy_rod_without_money_rejected(self):
        status, r = self.req('POST', '/api/buy', {'item': 'rod'})
        self.assertEqual(status, 400)
        status, s = self.req('GET', '/api/state')
        self.assertEqual(s['rod_level'], 1)
        self.assertEqual(s['money'], 200)

    def test_buy_rod_requires_session(self):
        status, r = self.req('POST', '/api/buy', {'item': 'rod'}, login=False)
        self.assertEqual(status, 401)

    # ---- трофеи ----
    def test_trophy_catch_price_doubled_and_flag_saved(self):
        status, r = self.catch(1.5, trophy=True)   # карась max 1.2: трофей 1.25×max
        self.assertEqual(status, 200, r)
        self.assertEqual(r['price'], 350)          # 100 × 1.75 × 2
        self.assertIn('trophy', r['new_achievements'])
        with closing(server.conn()) as c:
            row = c.execute('SELECT trophy, weight_kg, price FROM catch WHERE user_id=?', (self.uid,)).fetchone()
            self.assertEqual(row['trophy'], 1)
            self.assertEqual(row['weight_kg'], 1.5)
            self.assertEqual(row['price'], 350)
            money = c.execute('SELECT money FROM player WHERE user_id=?', (self.uid,)).fetchone()[0]
        self.assertEqual(money, 550)

    def test_trophy_weight_above_one_and_half_max_rejected(self):
        status, r = self.catch(1.9, trophy=True)   # > 1.2 × 1.5 + .01
        self.assertEqual(status, 400)
        self.assertFalse(r['ok'])

    def test_trophy_weight_below_max_rejected(self):
        status, r = self.catch(1.0, trophy=True)
        self.assertEqual(status, 400)

    def test_overweight_without_trophy_flag_rejected(self):
        status, r = self.catch(1.5, trophy=False)
        self.assertEqual(status, 400)

    def test_trophy_released_gives_no_money_but_keeps_flag(self):
        status, r = self.catch(1.5, trophy=True, kept=False)
        self.assertEqual(status, 200, r)
        self.assertEqual(r['price'], 0)
        with closing(server.conn()) as c:
            row = c.execute('SELECT trophy, kept FROM catch WHERE user_id=?', (self.uid,)).fetchone()
        self.assertEqual((row['trophy'], row['kept']), (1, 0))

    def test_state_marks_trophy_in_last_and_diary(self):
        self.catch(1.5, trophy=True)
        status, s = self.req('GET', '/api/state')
        self.assertEqual(status, 200)
        self.assertTrue(s['last'][0]['trophy'])
        self.assertTrue(s['diary']['heaviest']['trophy'])
        codes = {a['code']: a for a in s['achievements']}
        self.assertIn('trophy', codes)
        self.assertEqual(codes['trophy']['name'], 'Трофейщик')
        self.assertTrue(codes['trophy']['unlocked_at'])


if __name__ == '__main__':
    unittest.main()