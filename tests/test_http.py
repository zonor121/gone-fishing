import http.client
import json
import os
import sqlite3
import sys
import tempfile
import threading
import unittest
from contextlib import closing
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server
import world
import auth
import legacy


class HttpTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.original = server.DB
        # вложенный несуществующий каталог: init_db должен создать его сам (как /var/data на Render)
        server.DB = os.path.join(self.tmp.name, 'nested', 'dir', 'test.db')
        server.init_db()
        with closing(server.conn()) as c:
            self.uid, _ = auth.register(c, 'tester', 'secret1')
            c.commit()
        self.httpd = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown(); self.httpd.server_close()
        server.DB = self.original
        self.tmp.cleanup()

    def req(self, method, path, body=None, headers=None):
        status, data, _ = self.req_full(method, path, body, headers)
        return status, data

    def req_full(self, method, path, body=None, headers=None):
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        c.request(method, path, body=body, headers=headers or {})
        r = c.getresponse()
        data, cookie = r.read(), r.getheader('Set-Cookie')
        c.close()
        return r.status, data, cookie

    def post(self, path, raw, cookie=None):
        headers = {'Content-Type': 'application/json'}
        if cookie:
            headers['Cookie'] = cookie
        return self.req('POST', path, body=raw, headers=headers)

    def login_cookie(self, username='tester', password='secret1'):
        status, data, cookie = self.req_full('POST', '/api/login',
            json.dumps({'username': username, 'password': password}).encode(),
            {'Content-Type': 'application/json'})
        self.assertEqual(status, 200, data)
        return cookie.split(';', 1)[0]

    def test_health_and_api(self):
        self.assertEqual(self.req('GET', '/healthz')[0], 200)
        self.assertEqual(self.req('GET', '/api/state?x=1')[0], 401)   # без сессии состояния нет
        cookie = self.login_cookie()
        status, data = self.req('GET', '/api/state?x=1', headers={'Cookie': cookie})
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(data)['money'], 200)
        status, data = self.req('GET', '/api/config')
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(data)['fish']), 12)
        self.assertEqual(self.req('GET', '/')[0], 200)

    def test_register_login_logout_cycle(self):
        status, data, cookie = self.req_full('POST', '/api/register',
            json.dumps({'username': 'newcomer', 'password': 'parol123'}).encode(),
            {'Content-Type': 'application/json'})
        self.assertEqual(status, 200, data)
        self.assertEqual(json.loads(data)['username'], 'newcomer')
        self.assertTrue(cookie and cookie.startswith(f'{auth.COOKIE}=') and 'HttpOnly' in cookie)
        cookie = cookie.split(';', 1)[0]
        status, data = self.req('GET', '/api/state', headers={'Cookie': cookie})
        state = json.loads(data)
        self.assertEqual(state['username'], 'newcomer')
        self.assertEqual(state['money'], 200)
        status, data, cleared = self.req_full('POST', '/api/logout', b'{}',
            {'Content-Type': 'application/json', 'Cookie': cookie})
        self.assertEqual(status, 200)
        self.assertIn('Max-Age=0', cleared)
        self.assertEqual(self.req('GET', '/api/state', headers={'Cookie': cookie})[0], 401)

    def test_login_rejects_wrong_password(self):
        self.assertEqual(self.post('/api/login',
            json.dumps({'username': 'tester', 'password': 'wrong'}).encode())[0], 401)
        self.assertEqual(self.post('/api/login',
            json.dumps({'username': 'ghost', 'password': 'wrong'}).encode())[0], 401)

    def test_game_endpoints_require_session(self):
        for path in ('/api/cast', '/api/buy', '/api/catch', '/api/quest/claim', '/api/tutorial'):
            self.assertEqual(self.post(path, b'{}')[0], 401, path)

    def test_tests_pages_not_served_by_default(self):
        self.assertEqual(self.req('GET', '/tests/sea.html')[0], 404)

    def test_malformed_requests_get_400_not_crash(self):
        cookie = self.login_cookie()
        for raw in (b'not json', b'[]', b'"str"', b'{"weight":"abc","fish_id":1,"location":"lake"}',
                    b'{"bait":{"a":1},"location":"lake"}', b'{"qty":"x","bait":"worm"}'):
            for path in ('/api/cast', '/api/buy', '/api/catch', '/api/quest/claim'):
                self.assertIn(self.post(path, raw, cookie=cookie)[0], (400, 403), (path, raw))
        self.assertEqual(self.req('GET', '/healthz')[0], 200)  # сервер жив и БД не заблокирована

    def test_oversized_body_rejected(self):
        self.assertEqual(self.post('/api/buy', b'{"pad":"' + b'a' * 10000 + b'"}')[0], 413)

    def test_unknown_location_is_400_not_boat_message(self):
        cookie = self.login_cookie()
        status, data = self.post('/api/cast', json.dumps({'location': 'moon', 'bait': 'worm'}).encode(), cookie=cookie)
        self.assertEqual(status, 400)
        self.assertNotIn('лодк', json.loads(data)['error'])


class QuestTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.original = server.DB
        server.DB = os.path.join(self.tmp.name, 'q.db')
        server.init_db()
        with closing(server.conn()) as c:
            self.uid, _ = auth.register(c, 'quester', 'secret1')
            c.commit()

    def tearDown(self):
        server.DB = self.original
        self.tmp.cleanup()

    def kinds(self, day):
        c = server.conn()
        try:
            world.ensure_quests(c, self.uid, today=day)
            return [r['kind'] for r in c.execute('SELECT kind FROM quest WHERE day=? AND user_id=?', (day, self.uid))]
        finally:
            c.close()

    def test_sea_quest_never_given_without_boat(self):
        for i in range(60):
            self.assertNotIn('sea', self.kinds(f'2030-01-{i:02d}'))

    def test_sea_quest_possible_with_boat(self):
        c = server.conn()
        c.execute('UPDATE player SET boat_owned=1 WHERE user_id=?', (self.uid,))
        c.commit(); c.close()
        seen = set()
        for i in range(80):
            seen.update(self.kinds(f'2031-01-{i:02d}'))
        self.assertIn('sea', seen)


class LegacySaveTests(unittest.TestCase):
    """Сохранение до появления аккаунтов (общий player.id=1) переезжает в аккаунт fisherman."""
    def test_pre_accounts_save_migrates_and_keeps_progress(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, 'old.db')
            legacy.build(path)
            c = sqlite3.connect(path)
            c.execute('UPDATE player SET money=777')
            c.execute('UPDATE player_bait SET qty=9 WHERE bait_id=1')
            c.execute('INSERT INTO catch(fish_id,location_id,weight_kg,kept,price) VALUES (1,1,0.5,1,100)')
            c.commit(); c.close()
            original, server.DB = server.DB, path
            try:
                server.init_db(); server.init_db()   # дважды: миграция идемпотентна
                with closing(server.conn()) as cc:
                    uid, err = auth.authenticate(cc, 'fisherman', 'fisherman')
                self.assertIsNone(err)
                st = server.get_state(uid)
                self.assertEqual(st['username'], 'fisherman')
                self.assertEqual(st['money'], 777)
                self.assertEqual(st['baits']['worm'], 9)
                self.assertEqual(len(st['inventory']), 1)
                self.assertEqual(len(server.get_config()['fish']), 12)  # 6 прежних + море + налим/форель
            finally:
                server.DB = original


if __name__ == '__main__':
    unittest.main()
