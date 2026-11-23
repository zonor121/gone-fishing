import json
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
HARNESS = r"""
const fs = require('node:fs'), vm = require('node:vm');
let clock = 1000000;
function canvas() {
  const result = {width: 1600, height: 840};
  const strokes = [], pathFills = [], fills = [], gradients = [], ellipses = [], stack = [];
  const state = {
    canvas: result, globalAlpha: 1, strokeStyle: '', fillStyle: '', lineWidth: 1,
    path: [], strokes, pathFills, fills, gradients, ellipses,
    save() { stack.push({globalAlpha: this.globalAlpha, strokeStyle: this.strokeStyle,
      fillStyle: this.fillStyle, lineWidth: this.lineWidth}); },
    restore() { Object.assign(this, stack.pop()); },
    beginPath() { this.path = []; },
    moveTo(x, y) { this.path.push(['M', x, y]); },
    lineTo(x, y) { this.path.push(['L', x, y]); },
    quadraticCurveTo(cx, cy, x, y) { this.path.push(['Q', cx, cy, x, y]); },
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) { this.path.push(['C', c1x, c1y, c2x, c2y, x, y]); },
    closePath() { this.path.push(['Z']); },
    ellipse(x, y, rx, ry, rot) { this.path.push(['E', x, y]);
      ellipses.push({x, y, rx, ry, rot, style: this.strokeStyle, width: this.lineWidth}); },
    arc(x, y, r) { this.path.push(['A', x, y]); },
    roundRect(x, y, w, h) { this.path.push(['R', x, y, w, h]); },
    stroke() { strokes.push({style: this.strokeStyle, width: this.lineWidth, points: this.path.slice()}); },
    fill() { pathFills.push({style: this.fillStyle, points: this.path.slice()}); },
    fillRect(...args) { fills.push({color: this.fillStyle, args}); },
    createLinearGradient(...args) { return gradient(args); },
    createRadialGradient(...args) { return gradient(args); }
  };
  function gradient(args) {
    const value = {args, stops: [], addColorStop(offset, color) { this.stops.push([offset, color]); }};
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
  document, $: id => document.getElementById(id), Date: {now: () => clock}, g: main.getContext('2d'),
  sl: {value: 'lake'}, sr: {value: '1'}, S: 'idle', dockWet: 0, pw: 0, cast: 0, bx: 100, tt: 0,
  t: 0, sd: 0, hold: 0,
  waterPoint: () => [400, 260, 1],
  drawing: main.getContext('2d'),
  resetDrawing() {
    const g = main.getContext('2d');
    g.strokes.length = g.pathFills.length = g.fills.length = g.gradients.length = g.ellipses.length = 0;
  },
  setClock(value) { clock = value; }
});
for (const file of ['world', 'scenery']) {
  vm.runInContext(fs.readFileSync('static/' + file + '.js', 'utf8'), context);
}
vm.runInContext(`
  function at(part, seconds, wx = 'clear') {
    WORLD = {day_part: part, day_part_left: 180 - seconds, weather: wx, weather_left: 120};
    worldSyncAt = 1000000; setClock(1000000);
  }
  function rod(level, state = 'idle', time = 0) {
    sr.value = String(level); S = state;
    pw = state === 'charge' ? .5 : 0; cast = state === 'fly' ? .3 : 0;
    t = state === 'reel' ? .5 : 0; sd = 0; hold = state === 'reel' ? 1 : 0;
    resetDrawing(); drawFirstPersonRod(400, 200, time);
  }
  function midStop(gradient) {
    return gradient.stops.reduce((a, b) => Math.abs(b[0] - .5) < Math.abs(a[0] - .5) ? b : a)[1];
  }
  function blankGradient() {
    return drawing.gradients.find(gr =>
      Math.abs(gr.args[0] - ROD_RIG.blankBase[0]) < .01 &&
      Math.abs(gr.args[1] - ROD_RIG.blankBase[1]) < .01 &&
      Math.abs(gr.args[2] - ROD_RIG.tip[0]) < .01 &&
      Math.abs(gr.args[3] - ROD_RIG.tip[1]) < .01);
  }
  function gripGradient() {
    return drawing.gradients.find(gr =>
      Math.abs(gr.args[0] - ROD_RIG.gripStart[0]) < .01 &&
      Math.abs(gr.args[1] - ROD_RIG.gripStart[1]) < .01);
  }
  function endpoints(path) {
    return path.points.filter(p => p[0] === 'M' || p[0] === 'L' || p[0] === 'Q')
      .map(p => [p[p.length - 2], p[p.length - 1]]);
  }
  function linePath() {
    return drawing.strokes.find(s => {
      const pts = endpoints(s);
      if (pts.length < 6) return false;
      const [fx, fy] = pts[0], [lx, ly] = pts[pts.length - 1];
      return Math.hypot(fx - ROD_RIG.spool[0], fy - ROD_RIG.spool[1]) < 3 &&
        Math.hypot(lx - ROD_RIG.tip[0], ly - ROD_RIG.tip[1]) < 3;
    });
  }
`, context);
const result = vm.runInContext(fs.readFileSync(0, 'utf8'), context);
process.stdout.write(JSON.stringify(result));
"""


class RodTests(unittest.TestCase):
    def probe(self, script):
        result = subprocess.run(['node', '-e', HARNESS], input=script,
                                encoding='utf-8', capture_output=True,
                                cwd=ROOT, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_each_of_six_rods_has_its_own_blank_color(self):
        result = self.probe("""(() => {
          at('day', 30);
          return [1, 2, 3, 4, 5, 6].map(level => { rod(level); return midStop(blankGradient()); });
        })()""")
        self.assertEqual(len(set(result)), 6, result)

    def test_line_runs_from_spool_through_guides_to_tip_in_every_state(self):
        for state in ('idle', 'wait', 'reel', 'charge', 'fly'):
            with self.subTest(state=state):
                result = self.probe(f"""(() => {{
                  at('day', 30); rod(1, '{state}');
                  const line = linePath();
                  if (!line) return {{found: false}};
                  const pts = endpoints(line);
                  const matched = ROD_RIG.guides.filter(([gx, gy]) =>
                    pts.some(p => Math.hypot(p[0] - gx, p[1] - gy) <= 2.5) &&
                    drawing.ellipses.some(e => Math.hypot(e.x - gx, e.y - gy) <= 2.5)
                  );
                  return {{found: true, totalGuides: ROD_RIG.guides.length, matched: matched.length}};
                }})()""")
                self.assertTrue(result['found'], f'нет лески от шпули к вершинке в состоянии {state}')
                self.assertEqual(result['totalGuides'], 5)
                self.assertEqual(result['matched'], 5)

    def test_night_dims_blank_exactly_by_foreground_dim(self):
        result = self.probe("""(() => {
          const mids = [];
          for (const level of [1, 3, 6]) {
            at('day', 30); rod(level); const day = midStop(blankGradient());
            at('night', 30); rod(level); const night = midStop(blankGradient());
            mids.push(night === mix(day, '#141c26', .45));
          }
          return mids;
        })()""")
        self.assertEqual(result, [True, True, True])

    def test_top_rod_grip_material_differs_from_bamboo(self):
        result = self.probe("""(() => {
          at('day', 30);
          rod(1); const cork = midStop(gripGradient());
          rod(6); const eva = midStop(gripGradient());
          return {cork, eva};
        })()""")
        self.assertNotEqual(result['cork'], result['eva'])

    def test_blank_still_spans_grip_anchor_to_given_tip(self):
        result = self.probe("""(() => {
          at('day', 30); rod(1);
          return drawing.pathFills.some(f => {
            const pts = f.points.filter(p => p[0] === 'M' || p[0] === 'L');
            return pts.some(p => Math.hypot(p[1] - ROD_RIG.blankBase[0], p[2] - ROD_RIG.blankBase[1]) < 3)
              && pts.some(p => Math.hypot(p[1] - 400, p[2] - 200) < 1);
          });
        })()""")
        self.assertTrue(result)

    def test_rod_is_large_and_tapered(self):
        result = self.probe("""(() => {
          at('day', 30); rod(1);
          const length = Math.hypot(ROD_RIG.blankBase[0] - 400, ROD_RIG.blankBase[1] - 200);
          return {length, baseY: ROD_RIG.blankBase[1], widths: ROD_RIG.widths};
        })()""")
        self.assertGreaterEqual(result['length'], 230)
        self.assertGreater(result['baseY'], 300)
        self.assertGreaterEqual(result['widths'][0], 8)
        self.assertLessEqual(result['widths'][1], 2)

    def test_blank_bends_with_state(self):
        result = self.probe("""(() => {
          at('day', 30);
          rod(1, 'idle'); const idleBow = ROD_RIG.bow;
          sr.value = '1'; S = 'reel'; t = .8; sd = 0; hold = 1; resetDrawing(); drawFirstPersonRod(400, 200, 0);
          const reelBow = ROD_RIG.bow;
          rod(1, 'charge'); const chargeBow = ROD_RIG.bow;
          S = 'fly'; cast = .3; resetDrawing(); drawFirstPersonRod(400, 200, 0); const flyA = ROD_RIG.bow;
          cast = .6; resetDrawing(); drawFirstPersonRod(400, 200, 0); const flyB = ROD_RIG.bow;
          return {idleBow, reelBow, chargeBow, flyA, flyB};
        })()""")
        self.assertGreater(result['idleBow'], 0)
        self.assertGreater(result['reelBow'], result['idleBow'])
        self.assertLess(result['chargeBow'], 0)
        self.assertNotAlmostEqual(result['flyA'], result['flyB'])

    def test_bite_makes_tip_tremble(self):
        result = self.probe("""(() => {
          at('day', 30);
          rod(1, 'bite', 0.01); const bowA = ROD_RIG.bow;
          rod(1, 'bite', 0.05); const bowB = ROD_RIG.bow;
          return {bowA, bowB};
        })()""")
        self.assertNotAlmostEqual(result['bowA'], result['bowB'])

    def test_breathing_moves_rig_but_not_tip(self):
        result = self.probe("""(() => {
          at('day', 30);
          rod(1, 'idle', 0);
          const base0 = ROD_RIG.blankBase.slice();
          const tip0 = endpoints(linePath()).at(-1);
          rod(1, 'idle', 2.5);
          const base1 = ROD_RIG.blankBase.slice();
          const tip1 = endpoints(linePath()).at(-1);
          return {base0, base1, tip0, tip1};
        })()""")
        self.assertNotEqual(result['base0'], result['base1'])
        self.assertEqual(result['tip0'], [400, 200])
        self.assertEqual(result['tip1'], [400, 200])

    def test_left_hand_only_while_fishing(self):
        result = self.probe("""(() => {
          at('day', 30);
          const states = {};
          for (const st of ['idle', 'charge', 'fly', 'wait', 'bite', 'reel']) {
            rod(1, st, 0);
            states[st] = ROD_RIG.leftHand;
          }
          rod(1, 'reel', 0); const crank0 = ROD_RIG.crank.slice();
          rod(1, 'reel', 0.1); const crank1 = ROD_RIG.crank.slice();
          return {states, crank0, crank1};
        })()""")
        for st in ('wait', 'bite', 'reel'):
            self.assertTrue(result['states'][st], st)
        for st in ('idle', 'charge', 'fly'):
            self.assertFalse(result['states'][st], st)
        self.assertNotEqual(result['crank0'], result['crank1'])


if __name__ == '__main__':
    unittest.main()