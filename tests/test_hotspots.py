from contextlib import closing
import json
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import sea
import server


ROOT = Path(__file__).resolve().parents[1]

HARNESS = r"""
const fs = require('node:fs');
const vm = require('node:vm');

function makeContext(locCode = 'lake') {
  const ellipses = [], arcs = [], rects = [], texts = [], gradients = [], stack = [];
  const ctx = {
    locCode,
    ellipses, arcs, rects, texts, gradients,
    globalAlpha: 1, strokeStyle: '', fillStyle: '', lineWidth: 1, font: '', textAlign: 'left',
    save() { stack.push({globalAlpha: this.globalAlpha, strokeStyle: this.strokeStyle, fillStyle: this.fillStyle, lineWidth: this.lineWidth}); },
    restore() { Object.assign(this, stack.pop()); },
    translate() {},
    scale() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    clip() {},
    stroke() {},
    fill() {},
    roundRect(x, y, w, h) { rects.push({kind: 'round', x, y, w, h}); },
    fillRect(x, y, w, h) { rects.push({kind: 'fill', x, y, w, h}); },
    fillText(text, x, y) { texts.push({text: String(text), x, y}); },
    ellipse(x, y, rx, ry) { ellipses.push({x, y, rx, ry}); },
    arc(x, y, r) { arcs.push({x, y, r}); },
    createLinearGradient(...args) {
      const grad = {args, stops: [], addColorStop(o, c) { this.stops.push([o, c]); }};
      gradients.push(grad);
      return grad;
    }
  };
  return ctx;
}

let clock = 1000000;
const storage = new Map();
const localStorage = {
  getItem: k => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: k => storage.delete(k)
};

const context = vm.createContext({
  makeContext,
  Date: {now: () => clock},
  setClock(v) { clock = v; },
  localStorage,
  currentLoc: 'lake',
  waterPoint(distance) {
    const z = Math.max(0, distance), depth = 1 / (1 + z * .006);
    const horizon = context.currentLoc === 'sea' ? 183 : 239;
    const near = context.currentLoc === 'sea' ? 290 : 355;
    return [400 + 16 * (1 - depth), horizon + (near - horizon) * depth, .5 + depth * .7];
  },
  spawnSplash() {}
});
vm.runInContext(fs.readFileSync('static/hotspots.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('static/hud.js', 'utf8'), context);
const result = vm.runInContext(fs.readFileSync(0, 'utf8'), context);
process.stdout.write(JSON.stringify(result));
"""


class HotspotBackendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = str(Path(self.tmp.name) / 'test.db')
        self.patches = [
            patch.object(server, 'DB', self.db_path),
            patch.object(server, 'DB_BACKEND', 'sqlite'),
        ]
        for p in self.patches:
            p.start()
        server.init_db()
        code, body, _ = server.post_register({'username': 'angler1', 'password': 'secret123'})
        self.assertEqual(code, 200)
        self.assertTrue(body['ok'])
        with closing(server.conn()) as c:
            self.uid = c.execute('SELECT id FROM user WHERE username=?', ('angler1',)).fetchone()[0]

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.tmp.cleanup()

    def test_config_and_buy_chum_flow(self):
        cfg = server.get_config()
        self.assertEqual(cfg['groundbait_price'], 120)
        self.assertEqual(cfg['groundbait_duration'], 180)
        self.assertEqual(server.get_state(self.uid)['groundbait_qty'], 0)

        # Стартовые 200 ₽: 5 пачек (600 ₽) или некорректное количество купить нельзя.
        self.assertEqual(server.post_buy({'item': 'groundbait', 'qty': 0}, self.uid)[0], 400)
        self.assertEqual(server.post_buy({'item': 'groundbait', 'qty': 100}, self.uid)[0], 400)
        self.assertEqual(server.post_buy({'item': 'groundbait', 'qty': 5}, self.uid)[0], 400)

        # Покупка 1 пачки за 120 ₽: остаётся 80 ₽ и 1 прикормка.
        code, body = server.post_buy({'item': 'groundbait', 'qty': 1}, self.uid)
        self.assertEqual((code, body), (200, {'ok': True}))
        st = server.get_state(self.uid)
        self.assertEqual(st['money'], 80)
        self.assertEqual(st['groundbait_qty'], 1)

        # На море без лодки прикормить нельзя.
        code, body = server.post_chum({'location': 'sea'}, self.uid)
        self.assertEqual(code, 403)
        self.assertEqual(server.get_state(self.uid)['groundbait_qty'], 1)

        # На неизвестной локации ошибка 400.
        self.assertEqual(server.post_chum({'location': 'mars'}, self.uid)[0], 400)

        # На озере прикормка тратится и возвращает длительность 180 с.
        code, body = server.post_chum({'location': 'lake'}, self.uid)
        self.assertEqual((code, body), (200, {'ok': True, 'groundbait_qty': 0, 'duration': 180}))
        self.assertEqual(server.get_state(self.uid)['groundbait_qty'], 0)

        # Повторная попытка с пустым запасом даёт 400.
        self.assertEqual(server.post_chum({'location': 'lake'}, self.uid)[0], 400)

    def test_sea_migrate_adds_groundbait_column_idempotently(self):
        with closing(sqlite3.connect(':memory:')) as c:
            c.row_factory = sqlite3.Row
            c.executescript('''
                CREATE TABLE location(id INTEGER PRIMARY KEY, code TEXT, name TEXT, sky_top TEXT, sky_bottom TEXT, water_top TEXT, water_bottom TEXT, has_current INTEGER, has_forest INTEGER);
                CREATE TABLE rod(id INTEGER PRIMARY KEY, name TEXT, max_range INTEGER, strength REAL, reel_speed REAL);
                CREATE TABLE bait(id INTEGER PRIMARY KEY, code TEXT, name TEXT, price INTEGER);
                CREATE TABLE fish(id INTEGER PRIMARY KEY, name TEXT, min_kg REAL, max_kg REAL, bite_freq REAL, resistance REAL, color TEXT, price INTEGER, times TEXT, weather TEXT, fight_style TEXT);
                CREATE TABLE fish_location(fish_id INTEGER, location_id INTEGER, PRIMARY KEY(fish_id,location_id));
                CREATE TABLE fish_bait(fish_id INTEGER, bait_id INTEGER, bite_weight REAL, PRIMARY KEY(fish_id,bait_id));
                CREATE TABLE player(id INTEGER PRIMARY KEY, money INTEGER DEFAULT 200);
                INSERT INTO player(id, money) VALUES (1, 500);
            ''')
            sea.migrate(c)
            sea.migrate(c)  # повторный запуск идемпотентен
            cols = {r[1] for r in c.execute('PRAGMA table_info(player)')}
            self.assertIn('groundbait_qty', cols)
            self.assertEqual(c.execute('SELECT money, groundbait_qty FROM player WHERE id=1').fetchone()[:], (500, 0))


class HotspotClientTests(unittest.TestCase):
    def probe(self, script):
        result = subprocess.run(['node', '-e', HARNESS], input=script,
                                encoding='utf-8', capture_output=True,
                                cwd=ROOT, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_hotspot_spawn_priority_and_expiry(self):
        res = self.probe("""(() => {
          resetHotspots('lake');
          const spots = hotspotState.spots.map(s => ({dist: s.dist, ttl: s.ttl}));
          const sep = Math.abs(spots[0].dist - spots[1].dist);
          activateGroundbait('lake', 180, 132);
          const baitedHit = checkHotspotHit(132);
          const farSpot = spots.find(s => Math.abs(s.dist - 132) > 44);
          const naturalHit = farSpot ? checkHotspotHit(farSpot.dist) : {kind: 'skipped'};
          const miss = checkHotspotHit(999);
          for (let i = 0; i < 19; i++) updateHotspots(10, 'lake', i * 10);
          const expired = hotspotState.baited === null;
          return {count: spots.length, spots, sep, baitedHit, naturalHit, miss, expired};
        })()""")
        self.assertEqual(res['count'], 2)
        for s in res['spots']:
            self.assertGreaterEqual(s['dist'], 55)
            self.assertLessEqual(s['dist'], 250)
        self.assertGreaterEqual(res['sep'], 50)
        self.assertEqual(res['baitedHit']['kind'], 'baited')
        self.assertLess(res['baitedHit']['waitMult'], 0.7)
        self.assertGreater(res['baitedHit']['trophyMult'], 2.0)
        if res['naturalHit']['kind'] != 'skipped':
            self.assertEqual(res['naturalHit']['kind'], 'natural')
        self.assertIsNone(res['miss'])
        self.assertTrue(res['expired'])

    def test_draw_hotspots_stays_on_open_water_and_hud_bounds_hold(self):
        res = self.probe("""(() => {
          resetHotspots('lake');
          activateGroundbait('lake', 180, 75);
          hotspotState.spots[0].dist = 60;
          hotspotState.spots[1].dist = 230;
          currentLoc = 'lake';
          const gLake = makeContext('lake');
          drawHotspots(gLake, 3.2, null, {sea: false, activeHit: checkHotspotHit(75)});
          const lakeMaxY = Math.max(...gLake.ellipses.map(e => e.y + e.ry));

          resetHotspots('sea');
          activateGroundbait('sea', 180, 65);
          hotspotState.spots[0].dist = 55;
          hotspotState.spots[1].dist = 240;
          currentLoc = 'sea';
          const gSea = makeContext('sea');
          drawHotspots(gSea, 3.2, null, {sea: true, activeHit: checkHotspotHit(65)});
          const seaMaxY = Math.max(...gSea.ellipses.map(e => e.y + e.ry));

          const targets = getHotspotTargets(300);
          const gHud = makeContext('sea');
          drawHud(gHud, 'charge', {pw: 65 / 300, targets, time: 1});
          const rounds = gHud.rects.filter(r => r.kind === 'round');
          const allX = gHud.rects.flatMap(r => [r.x, r.x + r.w]);
          const allY = gHud.rects.flatMap(r => [r.y, r.y + r.h]);
          return {
            lakeEllipses: gLake.ellipses.length, lakeMaxY,
            seaEllipses: gSea.ellipses.length, seaMaxY,
            targetCount: targets.length,
            hudMinX: Math.min(...allX), hudMaxX: Math.max(...allX), hudMaxY: Math.max(...allY),
            panelCenter: rounds[0].x + rounds[0].w / 2,
            hudTexts: gHud.texts.map(t => t.text)
          };
        })()""")
        self.assertGreaterEqual(res['lakeEllipses'], 6)
        self.assertLess(res['lakeMaxY'], 355)
        self.assertGreaterEqual(res['seaEllipses'], 6)
        self.assertLess(res['seaMaxY'], 290)
        self.assertGreaterEqual(res['targetCount'], 2)
        self.assertGreaterEqual(res['hudMinX'], 175)
        self.assertLessEqual(res['hudMaxX'], 735)
        self.assertLessEqual(res['hudMaxY'], 80)
        self.assertAlmostEqual(res['panelCenter'], 400, places=2)
        self.assertTrue(any('В ПРИКОРМКЕ' in t for t in res['hudTexts']))

    def test_groundbait_and_hotspots_advance_with_wall_clock_and_persist(self):
        res = self.probe("""(() => {
          setClock(1000000);
          resetHotspots('lake');
          const idBefore = hotspotState.spots[0].id;
          const ageBefore = hotspotState.spots[0].age;
          activateGroundbait('lake', 180, 140, 'angler');

          // Уход на 25 с: естественная точка стареет и прикормка тикает без dt.
          setClock(1025000);
          updateHotspots(0, 'lake', 0);
          const age25 = hotspotState.spots[0].age;
          const ttl25 = hotspotState.baited ? hotspotState.baited.ttl : null;

          // Ещё 65 с (итого 90 с): первая точка успевает сменить место, прикормка на половине.
          setClock(1090000);
          updateHotspots(0, 'lake', 0);
          const relocated = hotspotState.spots[0].id !== idBefore;
          const ttlHalf = hotspotState.baited ? hotspotState.baited.ttl : null;

          // Имитируем перезагрузку страницы ещё через 30 с (итого 120 с прошло).
          hotspotState.baited = null;
          setClock(1120000);
          const restored = restoreGroundbait('lake', 'angler');
          const ttlRestored = hotspotState.baited ? hotspotState.baited.ttl : null;

          // После истечения 180 с прикормка пропадает и очищает localStorage.
          setClock(1200000);
          updateHotspots(0, 'lake', 0);
          const expiredAfterWall = hotspotState.baited === null;
          const persistedAfterExpiry = restoreGroundbait('lake', 'angler');

          return {ageBefore, age25, ttl25, relocated, ttlHalf, restored, ttlRestored, expiredAfterWall, persistedAfterExpiry};
        })()""")
        self.assertAlmostEqual(res['age25'] - res['ageBefore'], 25, delta=0.1)
        self.assertAlmostEqual(res['ttl25'], 155, delta=0.1)
        self.assertTrue(res['relocated'])
        self.assertAlmostEqual(res['ttlHalf'], 90, delta=0.1)
        self.assertTrue(res['restored'])
        self.assertAlmostEqual(res['ttlRestored'], 60, delta=0.1)
        self.assertTrue(res['expiredAfterWall'])
        self.assertFalse(res['persistedAfterExpiry'])
