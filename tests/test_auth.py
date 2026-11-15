import http.client
import json
import os
import sys
import tempfile
import threading
import time
import unittest
import unittest.mock
from contextlib import closing
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import server
import auth
import world


class UnitTests(unittest.TestCase):
    """Хеши паролей и валидация — без HTTP."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.original = server.DB
        server.DB = os.path.join(self.tmp.name, 'unit.db')
        server.init_db()

    def tearDown(self):
        server.DB = self.original
        self.tmp.cleanup()

    def register(self, username='u', password='parol123'):
        with closing(server.conn()) as c:
            uid, err = auth.register(c, username, password)
            c.commit()
        return uid, err

    def test_password_hash_and_verify(self):
        stored = auth.hash_password('секрет123')
        self.assertTrue(stored.startswith('pbkdf2_sha256$'))
        self.assertNotIn('секрет123', stored)
        self.assertTrue(auth.verify_password('секрет123', stored))
        self.assertFalse(auth.verify_password('другой', stored))
        # чужая соль и короткий хеш не проходят
        self.assertFalse(auth.verify_password('секрет123', 'pbkdf2_sha256$1$abcd$ff'))
        self.assertFalse(auth.verify_password('секрет123', 'мусор'))

    def test_register_validation(self):
        self.assertIsNotNone(self.register('good_name-1.2', 'parol123')[0])
        for bad in ('ab', 'a' * 21, 'с пробелом!', '', None):
            uid, err = self.register(bad, 'parol123')
            self.assertIsNone(uid, bad)
            self.assertTrue(err, bad)
        for bad in ('12345', '', None):
            uid, err = self.register('validlogin', bad)
            self.assertIsNone(uid, bad)
            self.assertTrue(err, bad)

    def test_duplicate_username_case_insensitive(self):
        uid, err = self.register('Ivanov', 'parol123')
        self.assertIsNone(err)
        _, err = self.register('ivanov', 'parol123')
        self.assertIn('занят', err)

    def test_authenticate(self):
        self.register('Мария', 'пароль6')
        with closing(server.conn()) as c:
            uid, err = auth.authenticate(c, 'Мария', 'пароль6')
            self.assertIsNone(err)
            self.assertIsInstance(uid, int)
            _, err = auth.authenticate(c, 'мария', 'неверный')
            self.assertIn('Неверный', err)
            _, err = auth.authenticate(c, 'неттакого', 'пароль6')
            self.assertIn('Неверный', err)

    def test_session_expiry(self):
        with closing(server.conn()) as c:
            uid, _ = self.register('sid', 'parol123')
            token = auth.create_session(c, uid)
            c.execute('UPDATE session SET expires_at=? WHERE token=?', (time.time() - 1, token))
            c.commit()
            self.assertIsNone(auth.session_user(c, f'{auth.COOKIE}={token}'))
            c.execute('UPDATE session SET expires_at=? WHERE token=?', (time.time() + 999, token))
            c.commit()
            self.assertEqual(auth.session_user(c, f'{auth.COOKIE}={token}')[0], uid)
        with closing(server.conn()) as c:
            self.assertIsNone(auth.session_user(c, 'fishing_session=несуществующий'))
            self.assertIsNone(auth.session_user(c, None))
        self.assertIsNone(auth.cookie_token('кривая строка без =; каша'))
        self.assertEqual(auth.cookie_token(f'other=1; {auth.COOKIE}=abc'), 'abc')


class AuthApiTests(unittest.TestCase):
    """HTTP-уровень: регистрация, вход, выход, изоляция сохранений."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.original = server.DB
        server.DB = os.path.join(self.tmp.name, 'auth.db')
        server.init_db()
        self.httpd = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown(); self.httpd.server_close()
        server.DB = self.original
        self.tmp.cleanup()

    def req(self, method, path, body=None, headers=None):
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        c.request(method, path, body=body, headers=headers or {})
        r = c.getresponse()
        data, cookie = r.read(), r.getheader('Set-Cookie')
        c.close()
        return r.status, data, cookie

    def post(self, path, obj, cookie=None):
        headers = {'Content-Type': 'application/json'}
        if cookie:
            headers['Cookie'] = cookie
        return self.req('POST', path, json.dumps(obj).encode(), headers)

    def cookie_value(self, set_cookie_header):
        return set_cookie_header.split(';', 1)[0]

    def register(self, username, password='parol123'):
        status, data, cookie = self.post('/api/register', {'username': username, 'password': password})
        self.assertEqual(status, 200, data)
        return self.cookie_value(cookie)

    def test_full_cycle_register_state_logout_login(self):
        status, data, cookie = self.post('/api/register', {'username': 'новичок', 'password': 'пароль6'})
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(data)['username'], 'новичок')
        self.assertTrue(cookie.startswith(f'{auth.COOKIE}='))
        self.assertIn('HttpOnly', cookie)
        cookie = self.cookie_value(cookie)

        status, data, _ = self.req('GET', '/api/state', headers={'Cookie': cookie})
        state = json.loads(data)
        self.assertEqual(state['username'], 'новичок')
        self.assertEqual(state['money'], 200)                 # стартовый капитал
        self.assertEqual(state['baits'], {'worm': 10, 'maggot': 5})
        self.assertFalse(state['tutorial_done'])
        self.assertEqual(len(state['quests']), 3)             # задания на первый день

        status, data, cleared = self.post('/api/logout', {}, cookie=cookie)
        self.assertEqual(status, 200)
        self.assertIn('Max-Age=0', cleared)
        self.assertEqual(self.req('GET', '/api/state', headers={'Cookie': cookie})[0], 401)

        status, data, cookie = self.post('/api/login', {'username': 'новичок', 'password': 'пароль6'})
        self.assertEqual(status, 200)
        status, data, _ = self.req('GET', '/api/state', headers={'Cookie': self.cookie_value(cookie)})
        self.assertEqual(json.loads(data)['username'], 'новичок')

    def test_login_wrong_credentials(self):
        self.register('sergey')
        for body in ({'username': 'sergey', 'password': 'неверный'},
                     {'username': 'нетакого', 'password': 'parol123'}):
            status, data, cookie = self.post('/api/login', body)
            self.assertEqual(status, 401, body)
            self.assertIn('Неверный', json.loads(data)['error'])
            self.assertIsNone(cookie)

    def test_register_conflicts_and_validation_via_http(self):
        self.register('dublon')
        for body in ({'username': 'dublon', 'password': 'parol123'},
                     {'username': 'ab', 'password': 'parol123'},
                     {'username': 'ok login?', 'password': 'parol123'},
                     {'username': 'oklogin', 'password': '12345'}):
            status, data, _ = self.post('/api/register', body)
            self.assertEqual(status, 400, body)
            self.assertTrue(json.loads(data)['error'], body)

    def test_isolation_logic(self):
        """У каждого пользователя свои деньги, наживка, улов, задания и активный заброс."""
        with closing(server.conn()) as c:
            uid_a, _ = auth.register(c, 'alice', 'parol123')
            uid_b, _ = auth.register(c, 'bob', 'parol123')
            c.commit()

        with unittest.mock.patch('server.time.time', return_value=1000):
            self.assertEqual(server.post_cast({'location': 'lake', 'bait': 'worm'}, uid_a)[0], 200)
        with unittest.mock.patch('server.time.time', return_value=1012):
            self.assertEqual(server.post_catch({'location': 'lake', 'fish_id': 1, 'weight': 1, 'kept': True}, uid_a)[0], 200)

        st_a, st_b = server.get_state(uid_a), server.get_state(uid_b)
        self.assertEqual(st_a['money'], 353)                  # 200 + карась 1 кг: 100×1.528 ≈ 153
        self.assertEqual(st_b['money'], 200)                  # Боба улов не коснулся
        self.assertEqual(st_a['baits']['worm'], 9)
        self.assertEqual(st_b['baits']['worm'], 10)
        self.assertEqual(len(st_a['last']), 1)
        self.assertEqual(st_b['last'], [])

        # Боб не может забрать чужой активный заброс: у него его нет.
        status, _ = server.post_catch({'location': 'lake', 'fish_id': 1, 'weight': 1, 'kept': True}, uid_b)
        self.assertEqual(status, 400)

        # Задания у каждого свои, прогресс не смешивается.
        c = server.conn()
        try:
            world.ensure_quests(c, uid_a, today='2030-05-05')
            world.ensure_quests(c, uid_b, today='2030-05-05')
            qa = c.execute('SELECT COUNT(*) FROM quest WHERE user_id=?', (uid_a,)).fetchone()[0]
            qb = c.execute('SELECT COUNT(*) FROM quest WHERE user_id=?', (uid_b,)).fetchone()[0]
            self.assertEqual((qa, qb), (3, 3))
            # достижение «Первый улов» — только у Алисы
            ach_a = c.execute('SELECT COUNT(*) FROM achievement WHERE user_id=?', (uid_a,)).fetchone()[0]
            ach_b = c.execute('SELECT COUNT(*) FROM achievement WHERE user_id=?', (uid_b,)).fetchone()[0]
        finally:
            c.close()
        self.assertEqual((ach_a, ach_b), (1, 0))
        self.assertEqual(server.get_state(uid_b)['achievements'][0]['unlocked_at'], None)

    def test_expired_session_rejected_at_http_level(self):
        cookie = self.register('olga')
        with closing(server.conn()) as c:
            token = auth.cookie_token(f'{auth.COOKIE}={cookie.split("=", 1)[1]}')
            c.execute('UPDATE session SET expires_at=? WHERE token=?', (time.time() - 5, token))
            c.commit()
        self.assertEqual(self.req('GET', '/api/state', headers={'Cookie': cookie})[0], 401)

if __name__ == '__main__':
    unittest.main()
