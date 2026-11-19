import json
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
HARNESS = r"""
const fs = require('node:fs'), vm = require('node:vm');
let clock = 1000000, sequence = 0;
const canvases = new Map();
function canvas() {
  const result = {id: ++sequence, width: 1600, height: 840};
  const images = [], fills = [], gradients = [], stack = [];
  const state = {
    canvas: result, globalAlpha: 1, globalCompositeOperation: 'source-over',
    images, fills, gradients,
    save() { stack.push({globalAlpha: this.globalAlpha, fillStyle: this.fillStyle}); },
    restore() { Object.assign(this, stack.pop()); },
    drawImage(source, ...args) { images.push({source: source.id, alpha: this.globalAlpha,
      operation: this.globalCompositeOperation, args}); },
    fillRect(...args) { fills.push({color: this.fillStyle, alpha: this.globalAlpha, args}); },
    createLinearGradient() { return gradient(); },
    createRadialGradient() { return gradient(); }
  };
  function gradient() {
    const value = {stops: [], addColorStop(offset, color) { this.stops.push([offset, color]); }};
    gradients.push(value);
    return value;
  }
  const context = new Proxy(state, {
    get(target, key) {
      if (!(key in target)) target[key] = () => {};
      return target[key];
    }
  });
  result.getContext = () => context;
  canvases.set(result.id, result);
  return result;
}
const main = canvas(), elements = new Map();
const document = {
  createElement: tag => { if (tag !== 'canvas') throw Error('Unexpected element: ' + tag); return canvas(); },
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, {hidden: false, textContent: '', style: {},
      setAttribute() {}, addEventListener() {}});
    return elements.get(id);
  }
};
const context = vm.createContext({
  document, $: id => document.getElementById(id), Date: {now: () => clock}, g: main.getContext('2d'),
  sl: {value: 'lake'}, sr: {value: '0'}, S: 'idle', dockWet: 0, pw: 0, cast: 0, bx: 100, tt: 0,
  waterPoint: () => [400, 260, 1],
  resetDrawing() {
    const g = main.getContext('2d'); g.images.length = g.fills.length = g.gradients.length = 0;
  },
  drawing: main.getContext('2d'), canvasCount: () => sequence,
  imageLayers: image => canvases.get(image.source).getContext('2d').images,
  setClock(value) { clock = value; }
});
for (const file of ['world', 'scenery', 'marine']) {
  vm.runInContext(fs.readFileSync('static/' + file + '.js', 'utf8'), context);
}
vm.runInContext(`
  function at(part, seconds, wx = 'clear') {
    WORLD = {day_part: part, day_part_left: 180 - seconds, weather: wx, weather_left: 120};
    worldSyncAt = 1000000; setClock(1000000);
  }
  function sky() { return getPalette().sky.map(rgbOf); }
`, context);
const result = vm.runInContext(fs.readFileSync(0, 'utf8'), context);
process.stdout.write(JSON.stringify(result));
"""


class DaylightTests(unittest.TestCase):
    def probe(self, script):
        result = subprocess.run(['node', '-e', HARNESS], input=script,
                                encoding='utf-8', capture_output=True,
                                cwd=ROOT, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_first_half_of_each_phase_keeps_its_lighting(self):
        expected = {'morning': [127, 151, 176], 'day': [113, 150, 173],
                    'evening': [86, 90, 128], 'night': [13, 22, 38]}
        for part, color in expected.items():
            with self.subTest(part=part):
                self.assertEqual(self.probe(f"at('{part}', 89); sky()[0]"), color)

    def test_last_ninety_seconds_blend_sunset_into_night(self):
        result = self.probe("at('evening', 135); sky()[0]")
        self.assertEqual(result, [50, 56, 83])

    def test_transition_eases_in_and_out(self):
        result = self.probe("""[90, 112.5, 135, 157.5, 179.999].map(seconds => {
          at('evening', seconds); return sky()[0];
        })""")
        self.assertEqual(result, [[86, 90, 128], [75, 79, 114], [50, 56, 83],
                                  [24, 33, 52], [13, 22, 38]])

    def test_all_phase_boundaries_are_visually_continuous(self):
        for part in ('morning', 'day', 'evening', 'night'):
            with self.subTest(part=part):
                result = self.probe(f"""(() => {{
                  at('{part}', 179.999); const before = sky();
                  setClock(1000002); return {{before, after: sky()}};
                }})()""")
                self.assertEqual(result['before'], result['after'])

    def test_foreground_lighting_reaches_exact_endpoint_at_phase_boundary(self):
        for part in ('morning', 'day', 'evening', 'night'):
            with self.subTest(part=part):
                result = self.probe(f"""(() => {{
                  const lighting = () => {{ const p = getPalette();
                    return [p.environmentDim, p.foregroundDim, p.night]; }};
                  at('{part}', 179.999); const before = lighting();
                  setClock(1000002); return {{before, after: lighting()}};
                }})()""")
                self.assertEqual(result['before'], result['after'])

    def test_clock_advances_through_multiple_cycles_without_polling(self):
        result = self.probe("""(() => {
          at('evening', 135); setClock(1000000 + 720000 * 3 + 180000);
          return sky()[0];
        })()""")
        self.assertEqual(result, [70, 87, 107])

    def test_resynchronizing_world_does_not_restart_a_transition(self):
        result = self.probe("""(() => {
          at('evening', 120); setClock(1015000); const before = sky();
          setWorldState({world: {day_part: 'evening', day_part_left: 45,
            weather: 'clear', weather_left: 120}});
          return {before, after: sky()};
        })()""")
        self.assertEqual(result, {'before': [[50, 56, 83], [109, 81, 78], [143, 118, 91]],
                                  'after': [[50, 56, 83], [109, 81, 78], [143, 118, 91]]})

    def test_visual_transition_does_not_change_fish_activity(self):
        result = self.probe("""(() => {
          at('evening', 135); const f = {times: ['night'], weather: null};
          const before = fishActive(f); setClock(1046000);
          return {before, after: fishActive(f)};
        })()""")
        self.assertEqual(result, {'before': False, 'after': True})

    def test_unsynchronized_scene_defaults_to_day(self):
        self.assertEqual(self.probe('sky()[0]'), [113, 150, 173])

    def test_explicit_palette_keeps_cached_night_frame_unblended(self):
        result = self.probe("at('evening', 135); getPalette('night').sky.map(rgbOf)[0]")
        self.assertEqual(result, [13, 22, 38])

    def test_every_location_crossfades_two_cached_backgrounds(self):
        for code in ('lake', 'river', 'pond', 'sea'):
            with self.subTest(code=code):
                result = self.probe(f"""(() => {{
                  at('evening', 135); sl.value = '{code}';
                  if (sl.value === 'sea') drawSea(0);
                  else drawEnvironment({{code: sl.value, current: sl.value === 'river'}}, 0);
                  return drawing.images.map(image => image.alpha);
                }})()""")
                self.assertEqual(result, [1, .5])

    def test_background_frames_are_reused_until_location_or_weather_changes(self):
        result = self.probe("""(() => {
          at('evening', 135); const l = {code: 'lake'}; drawEnvironment(l, 0);
          const original = drawing.images.map(image => image.source);
          resetDrawing(); setClock(1015000); drawEnvironment(l, 0);
          const later = drawing.images.map(image => image.source);
          resetDrawing(); WORLD.weather = 'rain'; drawEnvironment(l, 0);
          return {original, later, rainy: drawing.images.map(image => image.source)};
        })()""")
        self.assertEqual(len(result['original']), 2)
        self.assertEqual(result['original'], result['later'])
        self.assertTrue(set(result['original']).isdisjoint(result['rainy']))

    def test_finishing_transition_reuses_the_destination_background(self):
        result = self.probe("""(() => {
          at('evening', 135); const l = {code: 'lake'}; drawEnvironment(l, 0);
          const destination = drawing.images.at(-1).source;
          resetDrawing(); setClock(1046000); drawEnvironment(l, 0);
          return {destination, sources: drawing.images.map(image => image.source)};
        })()""")
        self.assertEqual(result['sources'], [result['destination']])

    def test_dock_crossfade_preserves_transparent_edges_and_cached_frames(self):
        result = self.probe("""(() => {
          at('evening', 135); drawFirstPersonDock();
          const layers = imageLayers(drawing.images[0]);
          const original = layers.map(image => image.source);
          const alphas = layers.map(image => image.alpha);
          const operations = layers.map(image => image.operation);
          layers.length = 0; resetDrawing(); setClock(1015000); drawFirstPersonDock();
          return {original, alphas, operations, later: imageLayers(drawing.images[0]).map(image => image.source)};
        })()""")
        self.assertEqual(result['alphas'], [.5, .5])
        self.assertEqual(result['operations'], ['copy', 'lighter'])
        self.assertEqual(result['original'], result['later'])

    def test_hands_and_boat_dim_gradually(self):
        for renderer, expected in (('drawFirstPersonRod(400, 200, 0)', [86, 100, 82]),
                                   ('drawBoat(0)', [159, 163, 155])):
            with self.subTest(renderer=renderer):
                result = self.probe(f"at('evening', 135); {renderer}; rgbOf(drawing.gradients[0].stops[0][1])")
                self.assertEqual(result, expected)

    def test_foreground_tint_interpolates_color_and_opacity(self):
        result = self.probe("at('evening', 135); dayTint(g); drawing.fills[0].color")
        self.assertEqual(result, 'rgba(75,51,48,0.15)')

    def test_night_float_glow_fades_in_and_out(self):
        for part in ('evening', 'night'):
            with self.subTest(part=part):
                result = self.probe(f"""at('{part}', 135); S = 'wait'; drawWeatherEffects(g, 0);
                  drawing.gradients.flatMap(gradient => gradient.stops).filter(stop =>
                    stop[1] === 'rgba(255,214,120,0.25)').length""")
                self.assertEqual(result, 1)

    def test_rain_and_fog_colors_are_continuous_at_dawn_and_nightfall(self):
        for wx, getter in (('fog', 'fogColor'), ('rain', 'rainColor')):
            for part in ('evening', 'night'):
                with self.subTest(wx=wx, part=part):
                    result = self.probe(f"""(() => {{
                      at('{part}', 179.999, '{wx}'); const before = rgbOf({getter}());
                      setClock(1000002); return {{before, after: rgbOf({getter}())}};
                    }})()""")
                    self.assertEqual(result['before'], result['after'])

    def test_weather_textures_do_not_rebuild_geometry_during_lighting_changes(self):
        for wx, renderer in (('fog', 'drawFog'), ('rain', 'drawRain')):
            with self.subTest(wx=wx):
                result = self.probe(f"""(() => {{
                  at('evening', 120, '{wx}'); {renderer}(g, 0); const first = canvasCount();
                  setClock(1015000); {renderer}(g, 1); const second = canvasCount();
                  return {{first, second}};
                }})()""")
                self.assertEqual(result['first'], result['second'])


if __name__ == '__main__':
    unittest.main()
