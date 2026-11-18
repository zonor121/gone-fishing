import http.client
import json
import os
import sys
import tempfile
import threading
import unittest
from contextlib import closing
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server
import auth


class TackleReelsTests(unittest.TestCase):
    """Магазин снастей (красная зона) и катушек (спад натяжения): по 5 апгрейдов."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.original = server.DB
        server.DB = os.path.join(self.tmp.name, 'tr.db')
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

    def test_state_levels_start_at_one(self):
        status, s = self.req('GET', '/api/state')
        self.assertEqual(status, 200)
        self.assertEqual(s['tackle_level'], 1)
        self.assertEqual(s['reel_level'], 1)

    def test_config_prices_and_effects(self):
        status, cfg = self.req('GET', '/api/config', login=False)
        self.assertEqual(status, 200)
        self.assertEqual(cfg['tackle_prices'], {'2': 600, '3': 1500, '4': 3000, '5': 5500, '6': 9000})
        self.assertEqual(cfg['reel_prices'], {'2': 500, '3': 1300, '4': 2800, '5': 5000, '6': 8000})
        self.assertEqual(cfg['tackle_zones'], [0.30, 0.26, 0.22, 0.18, 0.14, 0.10])
        self.assertEqual(cfg['reel_recovery'], [0.5, 0.6, 0.7, 0.8, 0.9, 1.0])

    def test_buy_tackle_upgrades_sequentially_and_charges(self):
        self.set_money(100000)
        for level, spent in ((2, 600), (3, 2100), (4, 5100), (5, 10600), (6, 19600)):
            status, r = self.req('POST', '/api/buy', {'item': 'tackle'})
            self.assertEqual(status, 200, r)
            status, s = self.req('GET', '/api/state')
            self.assertEqual(s['tackle_level'], level)
            self.assertEqual(s['money'], 100000 - spent)
        status, r = self.req('POST', '/api/buy', {'item': 'tackle'})
        self.assertEqual(status, 409)
        self.assertFalse(r['ok'])

    def test_buy_reel_upgrades_sequentially_and_charges(self):
        self.set_money(100000)
        for level, spent in ((2, 500), (3, 1800), (4, 4600), (5, 9600), (6, 17600)):
            status, r = self.req('POST', '/api/buy', {'item': 'reel'})
            self.assertEqual(status, 200, r)
            status, s = self.req('GET', '/api/state')
            self.assertEqual(s['reel_level'], level)
            self.assertEqual(s['money'], 100000 - spent)
        status, r = self.req('POST', '/api/buy', {'item': 'reel'})
        self.assertEqual(status, 409)
        self.assertFalse(r['ok'])

    def test_buy_tackle_without_money_rejected(self):
        status, r = self.req('POST', '/api/buy', {'item': 'tackle'})   # стартовые 200 < 600
        self.assertEqual(status, 400)
        status, s = self.req('GET', '/api/state')
        self.assertEqual(s['tackle_level'], 1)
        self.assertEqual(s['money'], 200)

    def test_buy_reel_without_money_rejected(self):
        status, r = self.req('POST', '/api/buy', {'item': 'reel'})     # стартовые 200 < 500
        self.assertEqual(status, 400)
        status, s = self.req('GET', '/api/state')
        self.assertEqual(s['reel_level'], 1)
        self.assertEqual(s['money'], 200)

    def test_buy_requires_session(self):
        for item in ('tackle', 'reel'):
            status, r = self.req('POST', '/api/buy', {'item': item}, login=False)
            self.assertEqual(status, 401)

    def test_upgrades_are_independent(self):
        self.set_money(1100)
        status, r = self.req('POST', '/api/buy', {'item': 'tackle'})
        self.assertEqual(status, 200, r)
        status, r = self.req('POST', '/api/buy', {'item': 'reel'})
        self.assertEqual(status, 200, r)
        status, s = self.req('GET', '/api/state')
        self.assertEqual((s['tackle_level'], s['reel_level'], s['money']), (2, 2, 0))


if __name__ == '__main__':
    unittest.main()