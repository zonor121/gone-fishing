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
  const strokes = [], pathFills = [], fills = [], gradients = [], ellipses = [], arcs = [], stack = [];
  const state = {
    canvas: result, globalAlpha: 1, strokeStyle: '', fillStyle: '', lineWidth: 1, lineCap: 'butt',
    path: [], strokes, pathFills, fills, gradients, ellipses, arcs,
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
      ellipses.push({x, y, rx, ry, rot});
    },
    arc(x, y, r, sa, ea) {
      this.path.push(['A', x, y, r]);
      arcs.push({x, y, r, sa, ea});
    },
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
    g.strokes.length = g.pathFills.length = g.fills.length = g.gradients.length = g.ellipses.length = g.arcs.length = 0;
  },
  setReducedMotion(v) { reducedMotion = v; },
  setClock(value) { clock = value; }
});

for (const file of ['world', 'scenery', 'water-fx', 'tackle-fx']) {
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


class TackleFxTests(unittest.TestCase):
    def probe(self, script):
        result = subprocess.run(['node', '-e', HARNESS], input=script,
                                encoding='utf-8', capture_output=True,
                                cwd=ROOT, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_bell_mount_is_exposed_near_rod_tip(self):
        res = self.probe("""(() => {
          at('day', 30);
          drawFirstPersonRod(470, 118, 0);
          const m = ROD_RIG.bellMount;
          const distToTip = Math.hypot(m.pos[0] - ROD_RIG.tip[0], m.pos[1] - ROD_RIG.tip[1]);
          return {hasMount: Boolean(m), distToTip, width: m.width};
        })()""")
        self.assertTrue(res['hasMount'])
        self.assertGreater(res['distToTip'], 10)
        self.assertLess(res['distToTip'], 45)
        self.assertGreater(res['width'], 1.2)

    def test_rod_bells_clip_ringing_reduced_motion_and_night_dimming(self):
        res = self.probe("""(() => {
          at('day', 30);
          drawFirstPersonRod(470, 118, 0);
          const Pday = getPalette();

          resetDrawing();
          drawRodBells(drawing, ROD_RIG, 'idle', 0.5, Pday);
          const idleRadials = drawing.gradients.filter(gr => gr.kind === 'radial').length;
          const idleArcs = drawing.arcs.length;
          const dayStop = drawing.gradients.find(gr => gr.kind === 'radial').stops[0][1];

          resetDrawing();
          drawRodBells(drawing, ROD_RIG, 'bite', 0.02, Pday);
          const biteArcs = drawing.arcs.length;
          const bellA = drawing.arcs.filter(a => Math.abs(a.r - 3.05) < 0.05).map(a => [a.x, a.y]);

          resetDrawing();
          drawRodBells(drawing, ROD_RIG, 'bite', 0.08, Pday);
          const bellB = drawing.arcs.filter(a => Math.abs(a.r - 3.05) < 0.05).map(a => [a.x, a.y]);

          setReducedMotion(true);
          resetDrawing();
          drawRodBells(drawing, ROD_RIG, 'bite', 0.02, Pday);
          const redArcs = drawing.arcs.length;
          const redA = drawing.arcs.filter(a => Math.abs(a.r - 3.05) < 0.05).map(a => [a.x, a.y]);
          resetDrawing();
          drawRodBells(drawing, ROD_RIG, 'bite', 0.08, Pday);
          const redB = drawing.arcs.filter(a => Math.abs(a.r - 3.05) < 0.05).map(a => [a.x, a.y]);
          setReducedMotion(false);

          at('night', 30);
          const Pnight = getPalette();
          resetDrawing();
          drawRodBells(drawing, ROD_RIG, 'idle', 0.5, Pnight);
          const nightStop = drawing.gradients.find(gr => gr.kind === 'radial').stops[0][1];

          return {
            idleRadials, idleArcs, biteArcs, redArcs,
            movedOnBite: JSON.stringify(bellA) !== JSON.stringify(bellB),
            staticWhenReduced: JSON.stringify(redA) === JSON.stringify(redB),
            nightDimmed: nightStop === mix(dayStop, '#141c26', .45)
          };
        })()""")
        self.assertGreaterEqual(res['idleRadials'], 2)
        self.assertEqual(res['biteArcs'], res['idleArcs'] + 4)
        self.assertEqual(res['redArcs'], res['idleArcs'])
        self.assertTrue(res['movedOnBite'])
        self.assertTrue(res['staticWhenReduced'])
        self.assertTrue(res['nightDimmed'])

    def test_hanging_rig_baits_and_charge_pendulum(self):
        res = self.probe("""(() => {
          at('day', 30);
          const P = getPalette();
          const summary = {};
          for (const bait of ['worm', 'maggot', 'corn', 'shrimp', 'spin']) {
            resetDrawing();
            drawHangingRig(drawing, 470, 118, 'idle', bait, 0, 1.0, P);
            summary[bait] = {
              strokes: drawing.strokes.length,
              fills: drawing.pathFills.length,
              ellipses: drawing.ellipses.length,
              radials: drawing.gradients.filter(gr => gr.kind === 'radial').length,
              hasFloatCollar: drawing.fills.length > 0
            };
          }
          resetDrawing();
          drawHangingRig(drawing, 470, 118, 'charge', 'worm', 0.85, 0, P);
          const allRigX = drawing.strokes.flatMap(s =>
            s.points.filter(p => p[0] === 'M' || p[0] === 'L').map(p => p[1])
          );
          return {summary, minChargeX: Math.min(...allRigX)};
        })()""")
        self.assertTrue(res['summary']['worm']['hasFloatCollar'])
        self.assertFalse(res['summary']['spin']['hasFloatCollar'])
        self.assertGreaterEqual(res['summary']['maggot']['ellipses'], 3)
        self.assertGreaterEqual(res['summary']['corn']['radials'], 2)
        self.assertGreater(res['summary']['shrimp']['fills'], res['summary']['worm']['fills'])
        self.assertLess(res['minChargeX'], 465)

    def test_spin_lure_states_and_sea_boat_clearance(self):
        res = self.probe("""(() => {
          at('day', 30);
          const P = getPalette();

          resetDrawing();
          drawSpinLure(drawing, 405, 210, 0.85, 'fly', 1.0, P, {waterY: 260, castProgress: 0.4});
          const flyShadow = drawing.ellipses.some(e => Math.abs(e.y - 262) < 1);
          const flyGrads = drawing.gradients.length;

          resetDrawing();
          drawSpinLure(drawing, 405, 290, 1.15, 'wait', 0.0, P, {sea: true});
          const seaMaxYWait = Math.max(...drawing.ellipses.map(e => e.y + e.ry));

          resetDrawing();
          drawSpinLure(drawing, 405, 290, 1.15, 'bite', 0.2, P, {sea: true});
          const seaMaxYBite = Math.max(...drawing.ellipses.map(e => e.y + e.ry));

          return {flyShadow, flyGrads, seaMaxYWait, seaMaxYBite};
        })()""")
        self.assertTrue(res['flyShadow'])
        self.assertGreaterEqual(res['flyGrads'], 1)
        self.assertLess(res['seaMaxYWait'], 307)
        self.assertLess(res['seaMaxYBite'], 307)


if __name__ == '__main__':
    unittest.main()
