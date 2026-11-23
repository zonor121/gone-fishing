import json
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
HARNESS = r"""
const fs = require('node:fs');
const vm = require('node:vm');

function makeContext() {
  const texts = [], rects = [], gradients = [], scales = [], stack = [];
  const state = {
    globalAlpha: 1, strokeStyle: '', fillStyle: '', lineWidth: 1, font: '', textAlign: 'left',
    texts, rects, gradients, scales,
    save() { stack.push({globalAlpha: this.globalAlpha, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth, font: this.font, textAlign: this.textAlign}); },
    restore() { Object.assign(this, stack.pop()); },
    translate() {},
    scale(sx, sy) { scales.push([sx, sy]); },
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    arc() {},
    ellipse() {},
    clip() {},
    stroke() {},
    fill() {},
    roundRect(x, y, w, h) { rects.push({kind: 'round', x, y, w, h}); },
    fillRect(x, y, w, h) { rects.push({kind: 'fill', x, y, w, h}); },
    fillText(text, x, y) { texts.push({text: String(text), x, y, color: this.fillStyle, align: this.textAlign}); },
    createLinearGradient(...args) {
      const grad = {args, stops: [], addColorStop(o, c) { this.stops.push([o, c]); }};
      gradients.push(grad);
      return grad;
    }
  };
  return state;
}

const context = vm.createContext({makeContext});
vm.runInContext(fs.readFileSync('static/hud.js', 'utf8'), context);
const result = vm.runInContext(fs.readFileSync(0, 'utf8'), context);
process.stdout.write(JSON.stringify(result));
"""


class HudTests(unittest.TestCase):
    def probe(self, script):
        result = subprocess.run(['node', '-e', HARNESS], input=script,
                                encoding='utf-8', capture_output=True,
                                cwd=ROOT, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_idle_wait_fly_render_nothing(self):
        result = self.probe("""(() => {
          const out = {};
          for (const st of ['idle', 'wait', 'fly', 'res', 'out']) {
            const g = makeContext();
            drawHud(g, st, {pw: .5, t: .4, d: .5, time: 1});
            out[st] = g.rects.length + g.texts.length;
          }
          return out;
        })()""")
        for st, count in result.items():
            self.assertEqual(count, 0, st)

    def test_hud_panels_are_centered_and_avoid_chips_and_horizon(self):
        result = self.probe("""(() => {
          const bounds = {};
          const cases = [
            ['charge', {pw: .68, time: 1}],
            ['bite', {tm: 1.4, time: 1, reduce: true}],
            ['reel', {t: .45, breakThreshold: .80, dangerZone: .20, d: .5, bx: 120, sd: 0, time: 1}]
          ];
          for (const [st, info] of cases) {
            const g = makeContext();
            drawHud(g, st, info);
            const rounds = g.rects.filter(r => r.kind === 'round');
            const minX = Math.min(...rounds.map(r => r.x));
            const maxX = Math.max(...rounds.map(r => r.x + r.w));
            const maxY = Math.max(...rounds.map(r => r.y + r.h));
            const panel = rounds[0];
            bounds[st] = {
              minX, maxX, maxY,
              center: panel.x + panel.w / 2,
              texts: g.texts.map(t => t.text)
            };
          }
          return bounds;
        })()""")
        for st, b in result.items():
            self.assertGreaterEqual(b['minX'], 175, st)
            self.assertLessEqual(b['maxX'], 735, st)
            self.assertLessEqual(b['maxY'], 80, st)
            self.assertAlmostEqual(b['center'], 400, places=2)
        self.assertIn('СИЛА ЗАБРОСА', result['charge']['texts'])
        self.assertIn('68%', result['charge']['texts'])
        self.assertIn('ПОДСЕКАЙ!', result['bite']['texts'])
        self.assertIn('НАТЯЖЕНИЕ', result['reel']['texts'])
        self.assertIn('ДО БЕРЕГА', result['reel']['texts'])

    def test_reel_statuses_and_reduced_motion(self):
        result = self.probe("""(() => {
          const gNormal = makeContext();
          drawHud(gNormal, 'reel', {t: .45, breakThreshold: .80, dangerZone: .20, d: .5, bx: 120, sd: 0, time: 1});
          const gSurge = makeContext();
          drawHud(gSurge, 'reel', {t: .45, breakThreshold: .80, dangerZone: .20, d: .5, bx: 120, sd: .5, time: 1});
          const gAlert = makeContext();
          drawHud(gAlert, 'reel', {t: .76, breakThreshold: .80, dangerZone: .20, d: .5, bx: 120, sd: .5, time: 1});
          const gBiteReduced = makeContext();
          drawHud(gBiteReduced, 'bite', {tm: 1.0, time: 1.23, reduce: true});
          return {
            normal: gNormal.texts.map(t => t.text),
            surge: gSurge.texts.map(t => t.text),
            alert: gAlert.texts.map(t => t.text),
            biteScales: gBiteReduced.scales
          };
        })()""")
        self.assertIn('45%', result['normal'])
        self.assertIn('РЫВОК!', result['surge'])
        self.assertIn('ОСЛАБЬТЕ!', result['alert'])
        self.assertEqual(result['biteScales'], [[1, 1]])


if __name__ == '__main__':
    unittest.main()
