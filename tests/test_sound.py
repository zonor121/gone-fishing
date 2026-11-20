import json
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
HARNESS = r"""
const fs = require('node:fs'), vm = require('node:vm');
const settings = JSON.parse(process.argv[1]), storage = new Map(Object.entries(settings));
const elements = new Map(), listeners = new Map();
const document = {
  hidden: false,
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '0', hidden: id === 'auth', textContent: '', attrs: {}, events: {},
      style: {setProperty(key, value) { this[key] = value; }},
      getContext: () => ({}),
      addEventListener(type, callback) { this.events[type] = callback; },
      setAttribute(key, value) { this.attrs[key] = value; },
      closest: () => null
    });
    return elements.get(id);
  },
  querySelector: () => null, querySelectorAll: () => [], addEventListener() {}
};
const nodes = [];
function parameter(value = 0) {
  return {
    value, events: [],
    cancelScheduledValues(time) { this.events.push(['cancel', time]); },
    cancelAndHoldAtTime(time) { this.events.push(['hold', time]); },
    setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); },
    linearRampToValueAtTime(value, time) { this.value = value; this.events.push(['ramp', value, time]); },
    exponentialRampToValueAtTime(value, time) { this.value = value; this.events.push(['exponential', value, time]); }
  };
}
function node(kind) {
  const result = {
    kind, outputs: [], gain: parameter(1), frequency: parameter(), Q: parameter(),
    connect(destination) { this.outputs.push(destination); return destination; },
    start() {}, stop() {}
  };
  nodes.push(result);
  return result;
}
const audio = {
  state: 'running', currentTime: 12, sampleRate: 48000,
  destination: node('destination'), createGain: () => node('gain'),
  createBufferSource: () => node('source'), createOscillator: () => node('oscillator'),
  createBiquadFilter: () => node('filter'),
  createBuffer: (channels, length) => ({getChannelData: () => new Float32Array(length)})
};
const context = vm.createContext({
  document, window: {},
  localStorage: {getItem: key => storage.get(key) ?? null,
                setItem: (key, value) => storage.set(key, String(value))},
  addEventListener(type, callback) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(callback);
  },
  currentWeather: () => 'wind', currentDayPart: () => 'day',
  audio, nodes, elements, storage,
  key(overrides = {}) {
    const event = {code: 'KeyM', target: {closest: () => null}, preventDefault() {}, ...overrides};
    for (const callback of listeners.get('keydown') || []) callback(event);
  },
  input(value) {
    const slider = document.getElementById('bvolume');
    slider.value = String(value);
    slider.events.input?.({target: slider});
  }
});
vm.runInContext(fs.readFileSync('static/sound.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('static/multiplayer.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('static/game.js', 'utf8'), context);
const result = vm.runInContext(fs.readFileSync(0, 'utf8'), context);
process.stdout.write(JSON.stringify(result));
"""


class Controls(HTMLParser):
    def __init__(self):
        super().__init__()
        self.elements = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.elements[attrs['id']] = (tag, attrs)


class SoundTests(unittest.TestCase):
    def probe(self, script, settings=None):
        result = subprocess.run(['node', '-e', HARNESS, json.dumps(settings or {})],
                                input=script, encoding='utf-8', capture_output=True,
                                cwd=ROOT, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_header_exposes_a_labelled_volume_range_instead_of_a_mute_button(self):
        controls = Controls()
        controls.feed((ROOT / 'static/index.html').read_text(encoding='utf-8'))
        self.assertIn('bvolume', controls.elements)
        tag, attrs = controls.elements['bvolume']
        self.assertEqual(tag, 'input')
        self.assertEqual(attrs['type'], 'range')
        self.assertEqual((attrs['min'], attrs['max'], attrs['step']), ('0', '100', '1'))
        self.assertTrue(attrs.get('aria-label') or attrs.get('aria-labelledby'))
        self.assertNotIn('bmute', controls.elements)

    def test_default_volume_matches_the_existing_full_level(self):
        result = self.probe('({value: document.getElementById("bvolume").value, '
                            'label: document.getElementById("volume-value").textContent})')
        self.assertEqual(result, {'value': '100', 'label': '100%'})

    def test_saved_volume_is_applied_when_audio_is_first_created(self):
        result = self.probe('audioCtx = audio; ({gain: master().gain.value, '
                            'value: document.getElementById("bvolume").value})', {'sb-volume': '.37'})
        self.assertEqual(result, {'gain': .37, 'value': '37'})

    def test_saved_zero_does_not_restore_full_volume(self):
        result = self.probe('audioCtx = audio; ({gain: master().gain.value, '
                            'value: document.getElementById("bvolume").value})', {'sb-volume': '0'})
        self.assertEqual(result, {'gain': 0, 'value': '0'})

    def test_invalid_saved_volume_is_normalized_before_audio_creation(self):
        for saved, expected in [('-1', 0), ('2', 1), ('bad', 1), ('Infinity', 1)]:
            with self.subTest(saved=saved):
                result = self.probe('audioCtx = audio; master().gain.value', {'sb-volume': saved})
                self.assertEqual(result, expected)

    def test_dragging_updates_percentage_preference_and_live_master_gain(self):
        result = self.probe('''(() => {
          audioCtx = audio; master();
          return [1, 37, 0, 100].map(level => {
            input(level);
            return {label: document.getElementById('volume-value').textContent,
                    spoken: document.getElementById('bvolume').attrs['aria-valuetext'],
                    saved: storage.get('sb-volume'), gain: masterGain.gain.value};
          });
        })()''')
        self.assertEqual(result, [
            {'label': '1%', 'spoken': '1%', 'saved': '0.01', 'gain': .01},
            {'label': '37%', 'spoken': '37%', 'saved': '0.37', 'gain': .37},
            {'label': '0%', 'spoken': 'Звук выключен', 'saved': '0', 'gain': 0},
            {'label': '100%', 'spoken': '100%', 'saved': '1', 'gain': 1}
        ])

    def test_volume_can_be_changed_before_audio_is_unlocked(self):
        result = self.probe('''(() => {
          input(23);
          const locked = audioCtx === null;
          audioCtx = audio;
          return {locked, gain: master().gain.value, saved: storage.get('sb-volume')};
        })()''')
        self.assertEqual(result, {'locked': True, 'gain': .23, 'saved': '0.23'})

    def test_m_key_restores_last_nonzero_slider_level(self):
        result = self.probe('''(() => {
          input(37); key();
          const muted = document.getElementById('bvolume').value;
          key();
          const restored = document.getElementById('bvolume').value;
          input(0); key();
          return {muted, restored, fromZero: document.getElementById('bvolume').value};
        })()''')
        self.assertEqual(result, {'muted': '0', 'restored': '37', 'fromZero': '37'})

    def test_m_shortcut_ignores_editable_controls_modifiers_and_repeats(self):
        result = self.probe('''(() => {
          input(37);
          key({repeat: true}); key({ctrlKey: true}); key({metaKey: true}); key({altKey: true});
          key({target: {closest: () => document.getElementById('bvolume')}});
          document.querySelector = () => ({}); key();
          return document.getElementById('bvolume').value;
        })()''')
        self.assertEqual(result, '37')

    def test_rapid_adjustments_hold_the_current_gain_before_a_new_ramp(self):
        result = self.probe('''(() => {
          audioCtx = audio; master(); input(20); input(80);
          return masterGain.gain.events;
        })()''')
        self.assertEqual(result, [['hold', 12], ['ramp', .2, 12.05],
                                  ['hold', 12], ['ramp', .8, 12.05]])

    def test_every_recorded_and_synthesized_sound_uses_the_volume_output(self):
        for recorded, sources in [(False, 15), (True, 6)]:
            with self.subTest(recorded=recorded):
                result = self.probe('''(() => {
                  audioCtx = audio; input(25);
                  const recorded = RECORDED;
                  if (recorded) {
                    bellBuf = {};
                    for (const key of ['cast', 'dip', 'reel']) sfxBufs[key] = {};
                  }
                  ambBufs.day = {}; ambBufs.wind = {};
                  castWhoosh(); floatDip(); reelSound(true); updateAmbience(true); bellChime();
                  const reachesMaster = node => node === masterGain || node.outputs.some(reachesMaster);
                  const sources = nodes.filter(node => ['source', 'oscillator'].includes(node.kind));
                  return {sources: sources.length, routed: sources.every(reachesMaster),
                          directOutputs: nodes.filter(node => node.outputs.includes(audio.destination)).length,
                          gain: masterGain.gain.value};
                })()'''.replace('RECORDED', json.dumps(recorded)))
                self.assertEqual(result, {'sources': sources, 'routed': True,
                                          'directOutputs': 1, 'gain': .25})


if __name__ == '__main__':
    unittest.main()
