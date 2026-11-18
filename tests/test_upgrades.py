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
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ['DB_BACKEND'] = 'sqlite'
import supabase_db
# server loads .env at import time; these tests must never read it.
with patch.object(supabase_db, 'load_env', return_value=None):
    import server
import auth


EXPECTED_ROD_CATALOG = (
    (1, 'Бамбуковая', 300, 1.0, 1.0, 0),
    (2, 'Стеклопластик', 350, 1.15, 1.1, 600),
    (3, 'Спиннинг', 400, 1.30, 1.2, 1200),
    (4, 'Композит', 450, 1.45, 1.3, 1800),
    (5, 'Графит', 500, 1.60, 1.4, 2400),
    (6, 'Карбон', 550, 1.75, 1.5, 3000),
)
LEGACY_RODS = (
    (1, 'Бамбуковая', 300, 1.0, 1.0),
    (2, 'Спиннинг', 400, 1.3, 1.2),
    (3, 'Карбон', 500, 1.7, 1.5),
)
LEGACY_SAVES = (
    ('legacy_1', 1, 137),
    ('legacy_2', 2, 2468),
    ('legacy_3', 3, 9753),
)
MIGRATED_LEGACY_SAVES = (
    ('legacy_1', 1, 137),
    ('legacy_2', 3, 2468),
    ('legacy_3', 6, 9753),
)


class UpgradesTests(unittest.TestCase):
    """Топ-3: стили вываживания, магазин удочек (rod_level), трофейные рыбы."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        for attribute, value in (('DB', os.path.join(self.tmp.name, 'up.db')),
                                 ('DB_BACKEND', 'sqlite')):
            override = patch.object(server, attribute, value)
            override.start()
            self.addCleanup(override.stop)
        server.init_db()
        with closing(server.conn()) as c:
            self.uid, err = auth.register(c, 'tester', 'secret1')
            self.assertIsNone(err)
            c.commit()
        self.httpd = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        self.addCleanup(self.httpd.server_close)
        self.addCleanup(self.httpd.shutdown)
        self.port = self.httpd.server_address[1]
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

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
        self.assertEqual({r['id']: r['price'] for r in cfg['rods']},
                         {1: 0, 2: 600, 3: 1200, 4: 1800, 5: 2400, 6: 3000})
        self.assertEqual(cfg['rod_prices'],
                         {'2': 600, '3': 1200, '4': 1800, '5': 2400, '6': 3000})
        self.assertEqual(cfg['trophy_chance'], 0.04)
        styles = {f['id']: f['style'] for f in cfg['fish']}
        self.assertTrue(all(s in ('calm', 'dart', 'heavy', 'diver') for s in styles.values()), styles)
        self.assertEqual(styles[1], 'calm')    # карась
        self.assertEqual(styles[2], 'heavy')   # карп
        self.assertEqual(styles[4], 'dart')    # щука
        self.assertEqual(styles[11], 'diver')  # налим
        self.assertEqual(styles[10], 'dart')   # тунец

    def test_config_rod_catalog_has_exact_six_level_values(self):
        status, cfg = self.req('GET', '/api/config', login=False)
        self.assertEqual(status, 200)
        rows = tuple((r['id'], r['name'], r['rng'], r['str'], r['spd'], r['price'])
                     for r in cfg['rods'])
        self.assertEqual(rows, EXPECTED_ROD_CATALOG)

    def test_config_rod_upgrades_have_uniform_increments(self):
        status, cfg = self.req('GET', '/api/config', login=False)
        self.assertEqual(status, 200)
        rods = cfg['rods']
        self.assertEqual(len(rods), 6)
        for previous, current in zip(rods, rods[1:]):
            with self.subTest(level=current['id']):
                self.assertEqual(current['id'] - previous['id'], 1)
                self.assertEqual(current['rng'] - previous['rng'], 50)
                self.assertAlmostEqual(current['str'] - previous['str'], 0.15)
                self.assertAlmostEqual(current['spd'] - previous['spd'], 0.1)
                self.assertEqual(current['price'] - previous['price'], 600)

    # ---- магазин удочек ----
    def test_state_rod_level_starts_at_one(self):
        status, s = self.req('GET', '/api/state')
        self.assertEqual(status, 200)
        self.assertEqual(s['rod_level'], 1)

    def test_buy_rod_upgrades_sequentially_and_charges(self):
        self.set_money(9000)
        for level, money_left in ((2, 8400), (3, 7200), (4, 5400), (5, 3000), (6, 0)):
            status, r = self.req('POST', '/api/buy', {'item': 'rod'})
            self.assertEqual(status, 200, r)
            self.assertTrue(r['ok'])
            status, s = self.req('GET', '/api/state')
            self.assertEqual(status, 200, s)
            self.assertEqual(s['rod_level'], level)
            self.assertEqual(s['money'], money_left)
        status, r = self.req('POST', '/api/buy', {'item': 'rod'})
        self.assertEqual(status, 409, r)
        self.assertFalse(r['ok'])
        status, s = self.req('GET', '/api/state')
        self.assertEqual(status, 200, s)
        self.assertEqual((s['rod_level'], s['money']), (6, 0))

    def test_buy_rod_at_level_six_rejected_without_charging(self):
        with closing(server.conn()) as c:
            c.execute('UPDATE player SET rod_level=6,money=10000 WHERE user_id=?', (self.uid,))
            c.commit()
        status, r = self.req('POST', '/api/buy', {'item': 'rod'})
        self.assertEqual(status, 409, r)
        self.assertFalse(r['ok'])
        status, s = self.req('GET', '/api/state')
        self.assertEqual(status, 200, s)
        self.assertEqual((s['rod_level'], s['money']), (6, 10000))

    def test_buy_rod_without_money_rejected(self):
        status, r = self.req('POST', '/api/buy', {'item': 'rod'})
        self.assertEqual(status, 400, r)
        self.assertFalse(r['ok'])
        status, s = self.req('GET', '/api/state')
        self.assertEqual(status, 200, s)
        self.assertEqual(s['rod_level'], 1)
        self.assertEqual(s['money'], 200)

    def test_buy_rod_requires_session(self):
        status, r = self.req('POST', '/api/buy', {'item': 'rod'}, login=False)
        self.assertEqual(status, 401, r)
        self.assertFalse(r['ok'])
        status, s = self.req('GET', '/api/state')
        self.assertEqual(status, 200, s)
        self.assertEqual((s['rod_level'], s['money']), (1, 200))

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


class RodCatalogMigrationTests(unittest.TestCase):
    """Real init_db migrations against local legacy and new-format saves."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        for attribute, value in (('DB', os.path.join(self.tmp.name, 'migration.db')),
                                 ('DB_BACKEND', 'sqlite')):
            override = patch.object(server, attribute, value)
            override.start()
            self.addCleanup(override.stop)
        # Build the surrounding schema without running any catalog migration first.
        with closing(server.conn()) as c:
            for name in ('schema.sql', 'seed.sql'):
                with open(os.path.join(server.BASE, 'db', name), encoding='utf-8') as f:
                    c.executescript(f.read())

    def seed_saves(self, rods, players):
        with closing(server.conn()) as c:
            c.execute('DELETE FROM rod')
            c.executemany('INSERT INTO rod(id,name,max_range,strength,reel_speed) VALUES (?,?,?,?,?)',
                          rods)
            for username, level, money in players:
                uid, err = auth.register(c, username, 'secret1')
                self.assertIsNone(err)
                c.execute('UPDATE player SET rod_level=?,money=? WHERE user_id=?', (level, money, uid))
            c.commit()

    def saved_players(self):
        with closing(server.conn()) as c:
            return tuple(tuple(r) for r in c.execute('''
                SELECT u.username,p.rod_level,p.money
                FROM player p JOIN user u ON u.id=p.user_id ORDER BY u.username'''))

    def catalog_rows(self):
        with closing(server.conn()) as c:
            return tuple(tuple(r) for r in c.execute(
                'SELECT id,name,max_range,strength,reel_speed FROM rod ORDER BY id'))

    def test_fresh_schema_registers_equipment_at_level_one(self):
        with closing(server.conn()) as c:
            uid, err = auth.register(c, 'fresh_equipment', 'secret1')
            self.assertIsNone(err)
            profile = dict(c.execute('SELECT * FROM player WHERE user_id=?', (uid,)).fetchone())
            self.assertEqual((profile.get('rod_level'), profile.get('tackle_level'),
                              profile.get('reel_level')), (1, 1, 1))

    def test_init_db_remaps_legacy_levels_without_changing_money(self):
        self.seed_saves(LEGACY_RODS, LEGACY_SAVES)
        server.init_db()
        self.assertEqual(self.saved_players(), MIGRATED_LEGACY_SAVES)
        self.assertEqual(self.catalog_rows(), tuple(r[:5] for r in EXPECTED_ROD_CATALOG))

    def test_init_db_legacy_catalog_migration_is_idempotent(self):
        self.seed_saves(LEGACY_RODS, LEGACY_SAVES)
        server.init_db()
        first_players = self.saved_players()
        first_rods = self.catalog_rows()
        server.init_db()
        self.assertEqual(self.saved_players(), first_players)
        self.assertEqual(self.catalog_rows(), first_rods)
        self.assertEqual(self.saved_players(), MIGRATED_LEGACY_SAVES)
        self.assertEqual(self.catalog_rows(), tuple(r[:5] for r in EXPECTED_ROD_CATALOG))

    def test_init_db_preserves_new_catalog_level_two_and_three_saves(self):
        new_saves = (('new_2', 2, 2468), ('new_3', 3, 9753))
        self.seed_saves(tuple(r[:5] for r in EXPECTED_ROD_CATALOG), new_saves)
        for initialization in (1, 2):
            with self.subTest(initialization=initialization):
                server.init_db()
                self.assertEqual(self.saved_players(), new_saves)
                self.assertEqual(self.catalog_rows(), tuple(r[:5] for r in EXPECTED_ROD_CATALOG))


if __name__ == '__main__':
    unittest.main()
