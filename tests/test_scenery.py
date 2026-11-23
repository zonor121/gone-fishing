import json
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
HARNESS = r"""
const fs = require('node:fs');
const vm = require('node:vm');
let clock = 1000000;
let sequence = 0;

function canvas() {
  const result = {id: ++sequence, width: 1600, height: 840};
  const images = [], fills = [], gradients = [], ellipses = [], stack = [];
  const state = {
    canvas: result, globalAlpha: 1, globalCompositeOperation: 'source-over',
    strokeStyle: '', fillStyle: '', lineWidth: 1, lineCap: 'butt',
    images, fills, gradients, ellipses,
    save() { stack.push({globalAlpha: this.globalAlpha, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth}); },
    restore() { Object.assign(this, stack.pop()); },
    drawImage(source, ...args) { images.push({source: source.id, alpha: this.globalAlpha, args}); },
    ellipse(x, y, rx, ry, rot) { ellipses.push({x, y, rx, ry, rot, fill: this.fillStyle}); },
    fillRect(...args) { fills.push({color: this.fillStyle, args}); },
    createLinearGradient(...args) { return gradient('linear', args); },
    createRadialGradient(...args) { return gradient('radial', args); }
  };
  function gradient(kind, args) {
    const value = {kind, args, stops: [], addColorStop(offset, color) { this.stops.push([offset, color]); }};
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
  document, $: id => document.getElementById(id), Date: {now: () => clock},
  g: main.getContext('2d'), drawing: main.getContext('2d'),
  sl: {value: 'lake'}, sr: {value: '1'}, S: 'idle', dockWet: 0, pw: 0, cast: 0, bx: 100, tt: 0,
  waterPoint: () => [400, 260, 1],
  resetDrawing() {
    const g = main.getContext('2d');
    g.images.length = g.fills.length = g.gradients.length = g.ellipses.length = 0;
  },
  canvasCount: () => sequence,
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
`, context);

const result = vm.runInContext(fs.readFileSync(0, 'utf8'), context);
process.stdout.write(JSON.stringify(result));
"""


class SceneryTests(unittest.TestCase):
    def probe(self, script):
        result = subprocess.run(['node', '-e', HARNESS], input=script,
                                encoding='utf-8', capture_output=True,
                                cwd=ROOT, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_all_locations_phases_and_weathers_render_cleanly(self):
        result = self.probe("""(() => {
          const locs = [
            {code: 'lake', current: false, forest: false},
            {code: 'river', current: true, forest: false},
            {code: 'pond', current: false, forest: true},
            {code: 'sea', current: false, forest: false}
          ];
          let rendered = 0;
          for (const l of locs) {
            sl.value = l.code;
            for (const part of ['morning', 'day', 'evening', 'night']) {
              for (const wx of ['clear', 'rain', 'fog', 'wind']) {
                at(part, 30, wx);
                resetDrawing();
                if (l.code === 'sea') drawSea(1.5);
                else drawEnvironment(l, 1.5);
                rendered++;
              }
            }
          }
          return {rendered};
        })()""")
        self.assertEqual(result['rendered'], 64)

    def test_dynamic_clouds_drift_over_time(self):
        result = self.probe("""(() => {
          at('day', 30, 'clear');
          const P = getPalette();
          resetDrawing();
          drawDynamicSky(0, 190, P, false);
          const xs0 = drawing.ellipses.slice(0, 6).map(e => e.x);
          resetDrawing();
          drawDynamicSky(20, 190, P, false);
          const xs1 = drawing.ellipses.slice(0, 6).map(e => e.x);
          return {xs0, xs1};
        })()""")
        self.assertNotEqual(result['xs0'], result['xs1'])

    def test_night_fireflies_appear_on_freshwater_but_not_sea(self):
        result = self.probe("""(() => {
          at('night', 30, 'clear');
          const P = getPalette();
          resetDrawing();
          drawAtmosphere({code: 'pond'}, 2.0, P);
          const pondRadials = drawing.gradients.filter(gr => gr.kind === 'radial').length;
          resetDrawing();
          drawAtmosphere({code: 'sea'}, 2.0, P);
          const seaRadials = drawing.gradients.filter(gr => gr.kind === 'radial').length;
          return {pondRadials, seaRadials};
        })()""")
        self.assertGreaterEqual(result['pondRadials'], 8)
        self.assertEqual(result['seaRadials'], 0)

    def test_cached_landscape_frames_reused_without_extra_canvases(self):
        result = self.probe("""(() => {
          at('day', 30, 'clear');
          const l = {code: 'lake', current: false, forest: false};
          drawEnvironment(l, 0);
          const afterFirst = canvasCount();
          drawEnvironment(l, 10);
          const afterSecond = canvasCount();
          return {afterFirst, afterSecond};
        })()""")
        self.assertEqual(result['afterFirst'], result['afterSecond'])

    def test_dock_and_boat_render_cleanly_across_phases_and_weather(self):
        result = self.probe("""(() => {
          let rendered = 0;
          for (const part of ['day', 'evening', 'night']) {
            for (const wet of [0, 0.85]) {
              at(part, 30, wet > 0 ? 'rain' : 'clear');
              dockWet = wet;
              resetDrawing();
              drawFirstPersonDock();
              rendered += drawing.images.length > 0 ? 1 : 0;
            }
            for (const wx of ['clear', 'wind', 'rain']) {
              at(part, 30, wx);
              resetDrawing();
              drawBoat(2.5);
              rendered += drawing.gradients.length > 0 ? 1 : 0;
            }
          }
          return {rendered};
        })()""")
        self.assertEqual(result['rendered'], 15)


if __name__ == '__main__':
    unittest.main()
