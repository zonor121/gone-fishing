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
  function rod(level, state = 'idle') {
    sr.value = String(level); S = state;
    pw = state === 'charge' ? .5 : 0; cast = state === 'fly' ? .3 : 0;
    t = state === 'reel' ? .5 : 0; sd = 0; hold = state === 'reel' ? 1 : 0;
    resetDrawing(); drawFirstPersonRod(400, 200, 0);
  }
  function midStop(gradient) {
    return gradient.stops.reduce((a, b) => Math.abs(b[0] - .5) < Math.abs(a[0] - .5) ? b : a)[1];
  }
  function blankGradient(lift = 0) {
    return drawing.gradients.find(gr => gr.args[0] === 563 && gr.args[1] === 333 - lift);
  }
  function gripGradient() { return drawing.gradients.find(gr => gr.args[0] === 622); }
  function endpoints(path) {
    return path.points.filter(p => p[0] === 'M' || p[0] === 'L' || p[0] === 'Q')
      .map(p => [p[p.length - 2], p[p.length - 1]]);
  }
  function linePath(lift = 0) {
    return drawing.strokes.find(s => {
      const pts = endpoints(s);
      if (pts.length < 6) return false;
      const [fx, fy] = pts[0], [lx, ly] = pts[pts.length - 1];
      return Math.hypot(fx - 575, fy - (378 - lift)) < 18 && Math.hypot(lx - 400, ly - 200) < .01;
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
        for state, lift in (('idle', 0), ('wait', 0), ('reel', 0), ('charge', 15), ('fly', 14.5623)):
            with self.subTest(state=state):
                result = self.probe(f"""(() => {{
                  at('day', 30); rod(1, '{state}');
                  const line = linePath({lift});
                  if (!line) return {{found: false}};
                  const pts = endpoints(line);
                  const centers = new Set();
                  for (const e of drawing.ellipses) {{
                    if (Math.hypot(e.x - 575, e.y - (378 - {lift})) < 18) continue;
                    if (pts.some(p => Math.hypot(p[0] - e.x, p[1] - e.y) < 2.5))
                      centers.add(e.x.toFixed(1) + ',' + e.y.toFixed(1));
                  }}
                  return {{found: true, guides: centers.size}};
                }})()""")
                self.assertTrue(result['found'], f'нет лески от шпули к вершинке в состоянии {state}')
                self.assertEqual(result['guides'], 5)

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
            return pts.some(p => Math.hypot(p[1] - 563, p[2] - 333) < 3)
              && pts.some(p => Math.hypot(p[1] - 400, p[2] - 200) < 1);
          });
        })()""")
        self.assertTrue(result)


if __name__ == '__main__':
    unittest.main()