import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, Mock
from urllib.error import HTTPError, URLError
import supabase_db
import server


class SupabaseTests(unittest.TestCase):
    def client(self, key='sb_secret_test'):
        with patch.dict(os.environ, {'SUPABASE_URL': 'https://example.supabase.co', 'SUPABASE_SECRET_KEY': key}, clear=True), patch('supabase_db.build_opener'):
            return supabase_db.Supabase()

    def test_env_priority_quotes_and_comments(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {'PORT': '9000'}, clear=True):
            path = Path(tmp) / '.env'
            path.write_text('# comment\nPORT=8000\nSUPABASE_SECRET_KEY="fake#key"\nNAME=value # comment\n', encoding='utf-8')
            supabase_db.load_env(path)
            self.assertEqual(os.environ['PORT'], '9000')
            self.assertEqual(os.environ['SUPABASE_SECRET_KEY'], 'fake#key')
            self.assertEqual(os.environ['NAME'], 'value')

    def test_missing_or_public_key_rejected(self):
        for key in ('', 'sb_publishable_test'):
            with self.assertRaises(supabase_db.DatabaseError):
                self.client(key)

    def test_headers_payload_and_result(self):
        for key in ('sb_secret_test', 'legacy-jwt'):
            client = self.client(key)
            response = io.BytesIO(b'{"ok":true}')
            client.opener.open = Mock(return_value=response)
            self.assertEqual(client.rpc('health'), {'ok': True})
            request = client.opener.open.call_args.args[0]
            self.assertEqual(request.get_header('Apikey'), key)
            self.assertEqual(request.get_header('Authorization'), None if key.startswith('sb_secret_') else 'Bearer ' + key)
            self.assertEqual(json.loads(request.data), {'action': 'health', 'payload': {}})

    def test_failures_do_not_leak_secret(self):
        for error in (HTTPError('https://example', 401, 'secret', {}, None), URLError('secret'), ValueError('secret')):
            client = self.client()
            client.opener.open = Mock(side_effect=error)
            with self.assertRaises(supabase_db.DatabaseError) as caught:
                client.rpc('health')
            self.assertNotIn('secret', str(caught.exception))

    def test_supabase_dispatch_has_no_sqlite_access(self):
        fake = Mock()
        fake.rpc.return_value = {'status': 200, 'body': {'ok': True}}
        with patch.object(server, 'DB_BACKEND', 'supabase'), patch.object(server, 'SUPABASE', fake), patch.object(server.sqlite3, 'connect', side_effect=AssertionError('SQLite used')):
            for path, action in (('/api/cast','cast'),('/api/buy','buy'),('/api/catch','catch'),('/api/quest/claim','quest_claim'),('/api/tutorial','tutorial')):
                self.assertEqual(server.POST[path]({'x': 1}, 7), (200, {'ok': True}))
                fake.rpc.assert_called_with(action, {'uid': 7, 'data': {'x': 1}})
            fake.rpc.return_value = {'ok': True}
            self.assertEqual(server.health(), {'ok': True})

    def test_register_hashes_password_and_uses_atomic_rpc(self):
        client = Mock()
        client.rpc.return_value = {'uid': 1, 'username': 'tester'}
        status, body, cookie = supabase_db.register(client, {'username': 'tester', 'password': 'test-pass'})
        self.assertEqual(status, 200)
        action, payload = client.rpc.call_args.args
        self.assertEqual(action, 'register')
        self.assertNotIn('password', payload)
        self.assertTrue(payload['password_hash'].startswith('pbkdf2_sha256$'))
        self.assertIn('HttpOnly', cookie)
        self.assertEqual(client.rpc.call_count, 1)

    def test_anonymous_session_does_not_call_remote(self):
        client = Mock()
        self.assertIsNone(supabase_db.current_user(client, {}))
        client.rpc.assert_not_called()

    def test_migrations_match_api(self):
        """Последняя миграция == текущая fishing_api из supabase_api.sql; предыдущие — её история."""
        root = Path(__file__).resolve().parents[1]
        api = (root / 'db/supabase_api.sql').read_text(encoding='utf-8')
        api = api.replace('"user"', 'fishing_user').replace('BEGIN;\n', '', 1).replace('\nCOMMIT;', '')
        api_fn = api[api.index('CREATE OR REPLACE FUNCTION'):].strip()
        migs = sorted((root / 'db/migrations').glob('[0-9][0-9][0-9]_*.sql'))
        self.assertEqual([m.name for m in migs],
                         ['001_weighted_catch_price.sql', '002_boat_price_10000_and_spin_bait.sql'])
        last = migs[-1].read_text(encoding='utf-8')
        # заголовок-комментарий допускается; тело функции должно совпадать с api посимвольно
        self.assertIn(api_fn, last, 'последняя миграция устарела относительно db/supabase_api.sql')
        prev = migs[0].read_text(encoding='utf-8')
        self.assertIn('least(greatest(w,f.min_kg)', prev)          # весовая цена уже в 001
        self.assertIn('6 000', prev)
        self.assertNotIn("b.code='spin' AND random()", prev)       # блесна появилась только в 002
        self.assertIn('10 000', last)
        self.assertIn("b.code='spin' AND random()>=.25", last)
