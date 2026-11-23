import json
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
HARNESS = r"""
const fs = require('node:fs');
const vm = require('node:vm');
let clock = 1000000;
let reducedMotion = false;

function canvas() {
  const result = {width: 1600, height: 840};
  const strokes = [], pathFills = [], fills = [], gradients = [], ellipses = [], stack = [];
  const state = {
    canvas: result, globalAlpha: 1, strokeStyle: '', fillStyle: '', lineWidth: 1, lineCap: 'butt',
    path: [], strokes, pathFills, fills, gradients, ellipses,
    save() {
      stack.push({globalAlpha: this.globalAlpha, strokeStyle: this.strokeStyle,
        fillStyle: this.fillStyle, lineWidth: this.lineWidth, lineCap: this.lineCap});
    },
    restore() { Object.assign(this, stack.pop()); },
    beginPath() { this.path = []; },
    moveTo(x, y) { this.path.push(['M', x, y]); },
    lineTo(x, y) { this.path.push(['L', x, y]); },
    quadraticCurveTo(cx, cy, x, y) { this.path.push(['Q', cx, cy, x, y]); },
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) { this.path.push(['C', c1x, c1y, c2x, c2y, x, y]); },
    closePath() { this.path.push(['Z']); },
    ellipse(x, y, rx, ry, rot) {
      this.path.push(['E', x, y, rx, ry]);
      ellipses.push({x, y, rx, ry, rot, fill: this.fillStyle, stroke: this.strokeStyle, width: this.lineWidth});
    },
    arc(x, y, r) { this.path.push(['A', x, y, r]); },
    roundRect(x, y, w, h) { this.path.push(['R', x, y, w, h]); },
    stroke() { strokes.push({style: this.strokeStyle, width: this.lineWidth, alpha: this.globalAlpha, points: this.path.slice()}); },
    fill() { pathFills.push({style: this.fillStyle, alpha: this.globalAlpha, points: this.path.slice()}); },
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
  matchMedia: () => ({matches: reducedMotion}),
  g: main.getContext('2d'),
  sl: {value: 'lake'}, sr: {value: '1'}, S: 'idle', dockWet: 0, pw: 0, cast: 0, bx: 100, tt: 0,
  t: 0, sd: 0, hold: 0,
  waterPoint: () => [400, 260, 1],
  drawing: main.getContext('2d'),
  resetDrawing() {
    const g = main.getContext('2d');
    g.strokes.length = g.pathFills.length = g.fills.length = g.gradients.length = g.ellipses.length = 0;
  },
  setReducedMotion(v) { reducedMotion = v; },
  setClock(value) { clock = value; }
});

for (const file of ['world', 'scenery', 'water-fx']) {
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


class WaterFxTests(unittest.TestCase):
    def probe(self, script):
        result = subprocess.run(['node', '-e', HARNESS], input=script,
                                encoding='utf-8', capture_output=True,
                                cwd=ROOT, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_splash_and_particle_physics(self):
        result = self.probe("""(() => {
          at('day', 30, 'wind');
          resetWaterFX();
          spawnSplash(400, 300, 1.0, 1.2);
          const initial = {
            ripples: waterFX.ripples.length,
            droplets: waterFX.droplets.length,
            foam: waterFX.foam.length,
            r0: waterFX.ripples[0].r,
            vy0: waterFX.droplets[0].vy
          };
          updateWaterFX(0.05, 'idle', {weather: 'wind'});
          const afterStep = {
            r1: waterFX.ripples[0].r,
            vy1: waterFX.droplets[0].vy
          };
          for (let i = 0; i < 40; i++) updateWaterFX(0.1, 'idle', {weather: 'wind'});
          const faded = {
            ripples: waterFX.ripples.length,
            droplets: waterFX.droplets.length,
            foam: waterFX.foam.length
          };
          return {initial, afterStep, faded};
        })()""")
        self.assertGreater(result['initial']['ripples'], 0)
        self.assertGreater(result['initial']['droplets'], 0)
        self.assertGreater(result['initial']['foam'], 0)
        self.assertGreater(result['afterStep']['r1'], result['initial']['r0'])
        self.assertGreater(result['afterStep']['vy1'], result['initial']['vy0'])
        self.assertEqual(result['faded'], {'ripples': 0, 'droplets': 0, 'foam': 0})

    def test_particle_arrays_stay_bounded(self):
        result = self.probe("""(() => {
          at('day', 30);
          resetWaterFX();
          for (let i = 0; i < 100; i++) spawnSplash(400, 300, 1.0, 1.5);
          return {
            ripples: waterFX.ripples.length,
            droplets: waterFX.droplets.length,
            foam: waterFX.foam.length,
            limits: WATER_FX_LIMITS
          };
        })()""")
        self.assertLessEqual(result['ripples'], result['limits']['ripples'])
        self.assertLessEqual(result['droplets'], result['limits']['droplets'])
        self.assertLessEqual(result['foam'], result['limits']['foam'])

    def test_float_has_reflection_body_gradient_and_night_glow(self):
        result = self.probe("""(() => {
          at('day', 30);
          resetDrawing();
          drawRealisticFloat(drawing, 400, 260, 1.0, 'wait', 0, getPalette(), {});
          const dayWait = {
            gradients: drawing.gradients.length,
            belowPy: drawing.ellipses.filter(e => e.y > 261.5).length,
            meniscus: drawing.ellipses.some(e => Math.abs(e.y - 261.5) < 0.1)
          };
          resetDrawing();
          drawRealisticFloat(drawing, 400, 220, 0.85, 'fly', 0, getPalette(), {waterY: 260, castProgress: 0.4});
          const flyShadow = drawing.ellipses.some(e => Math.abs(e.y - 262) < 1);
          at('night', 30);
          resetDrawing();
          drawRealisticFloat(drawing, 400, 260, 1.0, 'wait', 0, getPalette(), {});
          const nightRadials = drawing.gradients.filter(gr => gr.kind === 'radial').length;
          return {dayWait, flyShadow, nightRadials};
        })()""")
        self.assertGreaterEqual(result['dayWait']['gradients'], 2)
        self.assertGreaterEqual(result['dayWait']['belowPy'], 4)
        self.assertTrue(result['dayWait']['meniscus'])
        self.assertTrue(result['flyShadow'])
        self.assertGreaterEqual(result['nightRadials'], 2)

    def test_fight_water_fx_has_no_underwater_fish_and_keeps_surge_styles(self):
        result = self.probe("""(() => {
          at('day', 30);
          const P = getPalette();
          resetDrawing();
          drawFightWaterFX(drawing, 400, 270, 1.0, {id: 4, color: '#4f7d4a', style: 'dart'}, 5, 0.3, 0, 0.2, 1.0, P);
          const nearFills = drawing.pathFills.length;
          resetDrawing();
          drawFightWaterFX(drawing, 400, 270, 1.0, {id: 4, color: '#4f7d4a', style: 'dart'}, 5, 0.9, 0, 0.2, 1.0, P);
          const farFills = drawing.pathFills.length;
          const styleCounts = {};
          for (const st of ['calm', 'dart', 'heavy', 'diver']) {
            resetDrawing();
            drawFightWaterFX(drawing, 400, 270, 1.0, {id: 1, color: '#d8a23a', style: st}, 3, 0.4, 0.6, 0.2, 1.0, P);
            styleCounts[st] = drawing.strokes.length + drawing.pathFills.length;
          }
          return {nearFills, farFills, styleCounts};
        })()""")
        self.assertEqual(result['nearFills'], 0)
        self.assertEqual(result['farFills'], 0)
        for st, cnt in result['styleCounts'].items():
            self.assertGreater(cnt, 0, st)

    def test_sea_float_and_ripples_stay_above_boat(self):
        result = self.probe("""(() => {
          at('day', 30);
          resetWaterFX();
          spawnSplash(400, 290, 1.2, 2.0);
          const maxRippleBottom = Math.max(...waterFX.ripples.map(r => r.y + r.maxR * r.squash));
          resetDrawing();
          drawRealisticFloat(drawing, 400, 290, 1.2, 'wait', 0.5, getPalette(), {sea: true});
          const maxEllY = Math.max(...drawing.ellipses.map(e => e.y + e.ry));
          return {maxRippleBottom, maxEllY};
        })()""")
        self.assertLess(result['maxRippleBottom'], 307)
        self.assertLess(result['maxEllY'], 307)

    def test_reduced_motion_prevents_ambient_particle_spawn(self):
        result = self.probe("""(() => {
          at('day', 30, 'rain');
          resetWaterFX();
          setReducedMotion(true);
          updateWaterFX(1.0, 'wait', {weather: 'rain', px: 400, py: 300, scale: 1});
          return {
            ripples: waterFX.ripples.length,
            droplets: waterFX.droplets.length,
            foam: waterFX.foam.length
          };
        })()""")
        self.assertEqual(result, {'ripples': 0, 'droplets': 0, 'foam': 0})

    def test_fishing_line_highlights_near_break_threshold(self):
        result = self.probe("""(() => {
          at('day', 30);
          resetDrawing();
          drawFishingLine(drawing, 450, 150, 400, 260, 'reel', 0.78, 0.80, 0.5, 1.0, getPalette());
          return {
            strokes: drawing.strokes.length,
            hasGlow: drawing.strokes.some(s => s.width >= 2.5)
          };
        })()""")
        self.assertGreaterEqual(result['strokes'], 2)
        self.assertTrue(result['hasGlow'])


if __name__ == '__main__':
    unittest.main()
