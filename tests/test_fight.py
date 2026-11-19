import json
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
HARNESS = r"""
const fs = require('node:fs');
const vm = require('node:vm');
const elements = new Map();
const document = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '0', hidden: id === 'auth', style: {}, textContent: '',
      getContext: () => ({}), addEventListener() {}, setAttribute() {}
    });
    return elements.get(id);
  },
  querySelector: () => null, querySelectorAll: () => [], addEventListener() {}
};
const context = vm.createContext({document, addEventListener() {}, muted: false,
  currentWeather: () => 'clear'});
vm.runInContext(fs.readFileSync('static/fish-art.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('static/game.js', 'utf8'), context);
vm.runInContext(`
  function setup({weight = 1, max = 8, resistance = .75, style = 'heavy',
                  tired = 0, pulling = 1, surge = 0} = {}) {
    R = [{str: 1, spd: 1}]; sr.value = '0';
    fish = {id: 2, name: 'Карп', min: .1, max, res: resistance, style};
    w = weight; fatigue = tired; S = 'reel'; t = .3; d = .5;
    hold = pulling; sd = surge; sg = 999; tut = -1;
    tackleLevel = 1; reelLevel = 1;
  }
  function sample() { return {t, d, fatigue, state: S}; }
`, context);
const result = vm.runInContext(fs.readFileSync(0, 'utf8'), context);
process.stdout.write(JSON.stringify(result));
"""


class FightTests(unittest.TestCase):
    def probe(self, script):
        result = subprocess.run(['node', '-e', HARNESS], input=script, text=True,
                                encoding='utf-8', capture_output=True, cwd=ROOT, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_rod_shop_compares_best_owned_rod_to_next_upgrade(self):
        result = self.probe("""(() => {
          R = [
            {id: 1, name: 'Бамбуковая', rng: 300, str: 1, spd: 1},
            {id: 2, name: 'Стеклопластик', rng: 350, str: 1.15, spd: 1.1},
            {id: 3, name: 'Спиннинг', rng: 400, str: 1.3, spd: 1.2}
          ];
          rodLevel = 2; sr.value = '0'; M = 1500; rodPrices = {3: 1200};
          return rodShopSection();
        })()""")
        for comparison in ('Стеклопластик → Спиннинг', '350 → 400',
                           '×1.15 → ×1.3', '×1.1 → ×1.2'):
            self.assertIn(comparison, result)
        self.assertIn('data-rod', result)
        self.assertIn('1 200', result.replace('\xa0', ' '))

    def test_sea_retrieval_stays_in_water_with_room_for_ripples_and_boat_bobbing(self):
        points = self.probe("""(() => {
          sl.value = 'sea';
          return [0, 1, 24, 30, 100, 300, 550, 605].map(waterPoint);
        })()""")
        for x, y, scale in points:
            self.assertGreater(y, 183)
            self.assertLess(y + 5 + 30 * scale * .22 + .5, 307)
        for near, far in zip(points, points[1:]):
            self.assertGreater(near[1], far[1])
        self.assertLess(points[0][1] - points[1][1], 1)

    def test_shore_projection_is_unchanged_after_switching_from_sea(self):
        result = self.probe("""(() => {
          sl.value = 'sea'; waterPoint(0);
          return ['lake', 'river', 'pond'].map(location => {
            sl.value = location;
            return [-10, 0, 100, 500].map(waterPoint);
          });
        })()""")
        for points in result:
            self.assertEqual(points, [[400, 355, 1.2], [400, 355, 1.2],
                                      [406, 311.5, .9375], [412, 268, .675]])

    def test_sea_release_starts_at_retrieval_point_and_splashes_outside_boat(self):
        result = self.probe("""(() => {
          sl.value = 'sea'; L = {sea: {code: 'sea'}}; S = 'out'; outKeep = false;
          matchMedia = () => ({matches: true});
          drawSea = drawBoat = drawFog = drawFirstPersonRod = dayTint = drawWeatherEffects = () => {};
          const positions = [], splashes = [];
          Object.assign(g, {
            setTransform() {}, save() {}, restore() {}, scale() {}, beginPath() {}, stroke() {},
            translate(x, y) { positions.push([x, y]); },
            ellipse(x, y) { splashes.push([x, y]); }
          });
          drawFish = () => {};
          outT = 0; draw();
          outT = .9; draw();
          return {positions, splashes, landing: waterPoint(0).slice(0, 2)};
        })()""")
        self.assertEqual(result['positions'][0], result['landing'])
        self.assertEqual(result['splashes'], [result['landing']])
        self.assertLess(result['positions'][0][1], 300)
        self.assertLess(result['splashes'][0][1], 300)

    def fish_sizes(self, species, weights, minimum=1, maximum=9, card=False):
        data = json.dumps({'id': species, 'min': minimum, 'max': maximum})
        return self.probe(f"""(() => {{
          fish = {data};
          const sizes = [], stack = []; let x = 1, y = 1;
          const gc = {{
            save() {{ stack.push([x, y]); }}, restore() {{ [x, y] = stack.pop(); }},
            translate() {{}}, clearRect() {{}},
            setTransform(a, b, c, d) {{ x = a; y = d; }},
            scale(a, b) {{ x *= a; y *= b; }}
          }};
          paintFishArtwork = () => sizes.push([x, y]);
          $('cfish').getContext = () => gc;
          for (w of {json.dumps(weights)}) {{ {'cardFish()' if card else 'drawFish(0, 0, gc)'}; }}
          return sizes;
        }})()""")

    def test_pike_grows_mainly_in_length_not_depth(self):
        small, large = self.fish_sizes(4, [1, 9])
        length_gain = large[0] / small[0] - 1
        depth_gain = large[1] / small[1] - 1
        self.assertGreater(length_gain, .25)
        self.assertGreater(length_gain, depth_gain * 2)
        self.assertLess(depth_gain, .25)

    def test_slender_species_gain_more_length_than_depth(self):
        for species in (4, 7, 11, 12):
            with self.subTest(species=species):
                small, large = self.fish_sizes(species, [1, 13.5])
                self.assertGreater(large[0] / small[0] - 1,
                                   (large[1] / small[1] - 1) * 1.5)

    def test_deep_bodied_species_gain_more_depth_than_pike(self):
        small, large = self.fish_sizes(4, [1, 9])
        pike_gain = large[1] / small[1] - 1
        for species in (1, 2, 6, 9):
            with self.subTest(species=species):
                small, large = self.fish_sizes(species, [1, 9])
                self.assertGreater(large[1] / small[1] - 1, pike_gain * 2)

    def test_growth_uses_species_minimum_not_only_maximum(self):
        ordinary = self.fish_sizes(4, [3], minimum=1)[0]
        smallest = self.fish_sizes(4, [3], minimum=3)[0]
        self.assertLess(smallest[0], ordinary[0])

    def test_all_species_keep_growing_through_trophy_weights(self):
        for species in range(1, 13):
            with self.subTest(species=species):
                sizes = self.fish_sizes(species, [1, 3, 6, 9, 11, 13.5])
                for smaller, larger in zip(sizes, sizes[1:]):
                    self.assertGreater(larger[0], smaller[0])
                    self.assertGreater(larger[1], smaller[1])
                self.assertGreater(sizes[-1][0], sizes[-3][0] * 1.05)

    def test_growth_is_smooth_at_ordinary_maximum_weight(self):
        before, normal, after = self.fish_sizes(4, [8.999, 9, 9.001])
        for axis in (0, 1):
            self.assertGreater(normal[axis], before[axis])
            self.assertGreater(after[axis], normal[axis])
            self.assertAlmostEqual(normal[axis] - before[axis],
                                   after[axis] - normal[axis], delta=.000001)

    def test_largest_fish_fit_catch_card_without_separate_squashing(self):
        for species in range(1, 13):
            with self.subTest(species=species):
                x, y = self.fish_sizes(species, [13.5], card=True)[0]
                self.assertLess(160 * x, 300)
                self.assertLess(88 * y, 160)

    def test_card_preserves_same_weight_growth_as_scene(self):
        for species in range(1, 13):
            with self.subTest(species=species):
                scene = self.fish_sizes(species, [1, 9, 13.5])
                cards = self.fish_sizes(species, [1, 9, 13.5], card=True)
                for scene_size, card_size in zip(scene, cards):
                    for a, b in zip(scene_size, card_size):
                        self.assertAlmostEqual(b, a * 3.8)

    def test_strength_uses_kilograms_not_species_maximum(self):
        result = self.probe("""(() => {
          setup({weight: 1, max: 8}); update(1/60); const a = sample();
          setup({weight: 1, max: 15}); update(1/60); return [a, sample()];
        })()""")
        self.assertAlmostEqual(result[0]['t'], result[1]['t'])
        self.assertAlmostEqual(result[0]['d'], result[1]['d'])

    def test_heavy_fish_pulls_noticeably_harder_and_reels_slower(self):
        light, heavy = self.probe("""(() => {
          setup({weight: .5}); update(1/60); const a = sample();
          setup({weight: 8}); update(1/60); return [a, sample()];
        })()""")
        self.assertGreater(heavy['t'] - .3, (light['t'] - .3) * 1.3)
        self.assertGreater(heavy['d'], light['d'])

    def test_pulling_accumulates_fatigue(self):
        result = self.probe('setup(); update(1/60); sample()')
        self.assertGreater(result['fatigue'], 0)

    def test_surge_accumulates_fatigue_without_pulling(self):
        result = self.probe('setup({pulling: 0, surge: .5}); update(1/60); sample()')
        self.assertGreater(result['fatigue'], 0)

    def test_rest_without_surge_does_not_tire_or_restore_fish(self):
        result = self.probe('setup({pulling: 0, tired: .4}); update(.5); sample()')
        self.assertEqual(result['fatigue'], .4)

    def test_light_fish_tires_faster_during_pulling(self):
        light, heavy = self.probe("""(() => {
          setup({weight: .5}); update(1/60); const a = sample();
          setup({weight: 8}); update(1/60); return [a, sample()];
        })()""")
        self.assertGreater(light['fatigue'], heavy['fatigue'] * 2)

    def test_light_fish_tires_faster_during_surges(self):
        light, heavy = self.probe("""(() => {
          setup({weight: .5, pulling: 0, surge: .5}); update(1/60); const a = sample();
          setup({weight: 8, pulling: 0, surge: .5}); update(1/60); return [a, sample()];
        })()""")
        self.assertGreater(light['fatigue'], heavy['fatigue'] * 2)

    def test_tired_fish_creates_less_tension_and_reels_faster(self):
        fresh, tired = self.probe("""(() => {
          setup({weight: 8}); update(1/60); const a = sample();
          setup({weight: 8, tired: .8}); update(1/60); return [a, sample()];
        })()""")
        self.assertLess(tired['t'] - .3, (fresh['t'] - .3) * .6)
        self.assertLess(tired['d'], fresh['d'])

    def test_tired_fish_has_weaker_surges(self):
        fresh, tired = self.probe("""(() => {
          setup({weight: 8, style: 'dart', pulling: 0, surge: .5});
          update(1/60); const a = sample();
          setup({weight: 8, style: 'dart', pulling: 0, surge: .5, tired: .8});
          update(1/60); return [a, sample()];
        })()""")
        self.assertLess(tired['t'], fresh['t'])
        self.assertLess(tired['d'] - .5, (fresh['d'] - .5) * .6)

    def test_fatigue_stops_at_full_exhaustion(self):
        result = self.probe('setup({tired: .9999}); update(.1); sample()')
        self.assertEqual(result['fatigue'], 1)

    def test_new_hookup_resets_fatigue(self):
        result = self.probe("setup({tired: .9}); S = 'bite'; down(); sample()")
        self.assertEqual(result['fatigue'], 0)
        self.assertEqual(result['state'], 'reel')

    def test_exhausted_fish_still_resists(self):
        result = self.probe('setup({tired: 1, pulling: 0, surge: .5}); update(1/60); sample()')
        self.assertGreater(result['d'], .5)

    def test_species_fight_styles_remain_distinct(self):
        calm, dart = self.probe("""(() => {
          setup({style: 'calm', pulling: 0, surge: .5}); update(1/60); const a = sample();
          setup({style: 'dart', pulling: 0, surge: .5}); update(1/60); return [a, sample()];
        })()""")
        self.assertGreater(dart['d'], calm['d'])
        self.assertGreater(dart['t'], calm['t'])

    def test_largest_trophy_can_still_be_reeled_toward_player(self):
        result = self.probe('setup({weight: 22.5, max: 15, resistance: .95}); update(1/60); sample()')
        self.assertLess(result['d'], .5)
        self.assertEqual(result['state'], 'reel')

    def test_maximum_weight_tuna_can_be_landed_with_best_equipment(self):
        for weight in (15, 22.5):
            for random in (0, .5, .99):
                with self.subTest(weight=weight, random=random):
                    result = self.probe(f"""(() => {{
                      setup({{weight: {weight}, max: 15, resistance: .95, style: 'dart'}});
                      R = [{{str: 1.75, spd: 1.5}}]; tackleLevel = 6; reelLevel = 6;
                      cardFish = () => {{}}; Math.random = () => {random};
                      S = 'bite'; down(); w = {weight}; trophy = w > fish.max;
                      let ticks = 0;
                      while (S === 'reel' && ticks < 7200) {{
                        hold = t < .65 ? 1 : 0;
                        update(1/60); ticks++;
                      }}
                      return {{...sample(), seconds: ticks/60, message: $('msg').textContent}};
                    }})()""")
                    self.assertEqual(result['state'], 'res', result)
                    self.assertLess(result['seconds'], 120)

    def test_heavier_fish_has_stronger_surges(self):
        light, heavy = self.probe("""(() => {
          setup({weight: .5, pulling: 0, surge: .5}); update(1/60); const a = sample();
          setup({weight: 8, pulling: 0, surge: .5}); update(1/60); return [a, sample()];
        })()""")
        self.assertGreater(heavy['t'], light['t'])
        self.assertGreater(heavy['d'], light['d'])

    def test_no_fatigue_accumulates_outside_fight(self):
        result = self.probe("setup({tired: .4}); S = 'idle'; update(1); sample()")
        self.assertEqual(result['fatigue'], .4)


if __name__ == '__main__':
    unittest.main()
