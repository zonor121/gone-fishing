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
                                capture_output=True, cwd=ROOT, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

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
                      R = [{{str: 1.7, spd: 1.5}}]; tackleLevel = 6; reelLevel = 6;
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
