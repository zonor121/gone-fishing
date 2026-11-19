import json
from pathlib import Path
import re
import subprocess
import unittest
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SVG = '{http://www.w3.org/2000/svg}'
HARNESS = r"""
const fs = require('node:fs'), vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('static/fish-art.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('static/locations.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('static/guide.js', 'utf8'), context);
const result = vm.runInContext(fs.readFileSync(0, 'utf8'), context);
Promise.resolve(result).then(value => process.stdout.write(JSON.stringify(value)));
"""
NAMES = ['Карась', 'Карп', 'Окунь', 'Щука', 'Плотва', 'Лещ', 'Скумбрия',
         'Треска', 'Морской окунь', 'Тунец', 'Налим', 'Форель']


class FishArtTests(unittest.TestCase):
    def probe(self, script):
        result = subprocess.run(['node', '-e', HARNESS], input=script,
                                encoding='utf-8', capture_output=True, cwd=ROOT, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def illustrations(self):
        return self.probe('(' + json.dumps(NAMES) + ').map((name, i) => '
                          'fishIllustration({id: i+1, name, color: "#8c9b82"}))')

    def visible_geometry(self, markup):
        root = ET.fromstring(markup)
        attrs = ('d', 'cx', 'cy', 'rx', 'ry', 'r', 'points', 'transform')
        return tuple((node.tag.split('}')[-1],
                      tuple((key, node.attrib[key]) for key in attrs if key in node.attrib))
                     for node in root.iter()
                     if node.tag.split('}')[-1] in ('path', 'ellipse', 'circle', 'g'))

    def test_all_twelve_species_have_distinct_geometry_even_with_same_color(self):
        geometry = [self.visible_geometry(svg) for svg in self.illustrations()]
        self.assertEqual(len(set(geometry)), 12)

    def test_species_geometry_does_not_change_when_name_is_translated(self):
        drawings = self.probe('['
            'fishIllustration({id: 4, name: "Щука", color: "#8c9b82"}),'
            'fishIllustration({id: 4, name: "Northern pike", color: "#8c9b82"})]')
        self.assertEqual(self.visible_geometry(drawings[0]), self.visible_geometry(drawings[1]))

    def test_markings_are_clipped_to_the_species_body(self):
        for name, markup in zip(NAMES, self.illustrations()):
            with self.subTest(species=name):
                root = ET.fromstring(markup)
                clips = {clip.attrib['id'] for clip in root.iter(SVG+'clipPath')}
                marked = [node for node in root.iter() if 'clip-path' in node.attrib]
                self.assertTrue(marked, 'Body texture must be clipped, not drawn across fins')
                for node in marked:
                    self.assertIn(node.attrib['clip-path'][5:-1], clips)

    def test_fin_rays_are_clipped_to_their_fin_not_the_body(self):
        for name, markup in zip(NAMES, self.illustrations()):
            with self.subTest(species=name):
                root = ET.fromstring(markup)
                clips = {clip.attrib['id']: clip.find(SVG+'path').attrib['d']
                         for clip in root.iter(SVG+'clipPath')}
                paths = root.find(SVG+'g').findall(SVG+'path')
                rays = [path for path in paths if path.attrib['fill'] == 'none'
                        and path.attrib['stroke-opacity'] in ('.38', '0.38', '.45', '0.45')]
                self.assertTrue(rays)
                for ray in rays:
                    self.assertIn('clip-path', ray.attrib)
                    outline = clips[ray.attrib['clip-path'][5:-1]]
                    self.assertTrue(any(path.attrib['d'] == outline
                                        and path.attrib['fill'] != 'none' for path in paths))

    def test_fill_and_stroke_use_matching_opacity_without_group_compositing(self):
        for markup in self.illustrations():
            root = ET.fromstring(markup)
            for path in root.find(SVG+'g').findall(SVG+'path'):
                if path.attrib['fill'] != 'none' and path.attrib['stroke'] != 'none':
                    self.assertNotIn('opacity', path.attrib)
                    self.assertEqual(path.attrib['fill-opacity'], path.attrib['stroke-opacity'])

    def test_trout_has_spots_inside_its_tail_outline(self):
        root = ET.fromstring(self.probe('fishIllustration({id: 12})'))
        paths = root.find(SVG+'g').findall(SVG+'path')
        tail = paths[0].attrib['d']
        clips = {clip.attrib['id'] for clip in root.iter(SVG+'clipPath')
                 if clip.find(SVG+'path').attrib['d'] == tail}
        spots = [path for path in paths if path.attrib['fill'].startswith('#')
                 and path.attrib.get('clip-path', '')[5:-1] in clips]
        self.assertTrue(spots, 'Trout tail must have clipped dark spots')

    def test_repeated_cards_use_self_contained_unique_svg_resources(self):
        drawings = self.probe('Array.from({length: 4}, () => '
                              'fishIllustration({id: 2, name: "Карп", color: "#8c9b82"}))')
        used_ids = set()
        for markup in drawings:
            root = ET.fromstring(markup)
            ids = {node.attrib['id'] for node in root.iter() if 'id' in node.attrib}
            self.assertTrue(ids)
            self.assertFalse(ids & used_ids)
            used_ids.update(ids)
            for ref in re.findall(r'url\(#([^)]+)\)', markup):
                self.assertIn(ref, ids)

    def test_illustrations_do_not_insert_names_or_server_colors_as_markup(self):
        data = {'id': 4, 'name': '<script>alert(1)</script>',
                'color': '\"/><script>alert(2)</script>'}
        markup = self.probe('fishIllustration(' + json.dumps(data) + ')')
        root = ET.fromstring(markup)
        self.assertFalse(list(root.iter(SVG+'script')))
        self.assertNotIn('onerror', markup)

    def test_body_cross_sections_follow_straight_and_curved_silhouettes(self):
        sections = self.probe('['
            '"M10 10L30 10L30 30L10 30Z",'
            '"M10 20L30 10L40 20L30 30Z",'
            '"M10 20Q20 0 30 20L30 30L10 30Z",'
            '"M10 20C10 0 30 0 30 20L30 30L10 30Z"'
            '].map(path => fishBodySections(path)[20])')
        self.assertEqual(sections, [[10, 30], [15, 25], [10, 30], [5, 30]])

    def test_illustrations_render_without_network_or_image_assets(self):
        drawings = self.illustrations()
        for markup in drawings:
            root = ET.fromstring(markup)
            self.assertTrue(root.find(SVG+'g').findall(SVG+'path'))
            self.assertFalse(list(root.iter(SVG+'image')))
            self.assertNotIn('href=', markup)

    def test_guide_yields_between_species_when_animation_frames_are_paused(self):
        result = self.probe(r'''(async () => {
            const F = Array.from({length: 12}, (_, i) => ({
                id: i+1, name: String(i+1), min: 1, max: 2, price: 100,
                baits: {}, locs: []
            }));
            const BL = [], L = {}, nodes = {}, tasks = [];
            globalThis.F = F; globalThis.BL = BL; globalThis.L = L;
            globalThis.$ = id => nodes[id] ||= {
                innerHTML: '', textContent: '',
                querySelector() { return this; }
            };
            globalThis.activityLabel = () => 'Активна';
            globalThis.requestAnimationFrame = () => {};
            globalThis.setTimeout = callback => tasks.push(callback);
            const rendering = renderGuide();
            const counts = [fishArtCache.size];
            const cards = (nodes['guide-fish'].innerHTML.match(/<article /g) || []).length;
            for (let i=0; i<12 && tasks.length; i++) {
                tasks.shift()();
                await Promise.resolve();
                counts.push(fishArtCache.size);
            }
            if (counts.length !== 13) return {counts, cards, drawings: []};
            await rendering;
            return {counts, cards, drawings: F.map(f => nodes[`guide-fish-${f.id}`]?.innerHTML)};
        })()''')
        self.assertEqual(result['cards'], 12)
        self.assertEqual(result['counts'], list(range(13)))
        for markup in result['drawings']:
            self.assertTrue(ET.fromstring(markup).find(SVG+'g').findall(SVG+'path'))

    def test_artwork_is_stable_between_renders(self):
        drawings = self.probe('Array.from({length: 3}, () => '
                              'fishIllustration({id: 12, name: "Форель", color: "#8c9b82"}))')
        self.assertEqual(len({self.visible_geometry(svg) for svg in drawings}), 1)


if __name__ == '__main__':
    unittest.main()
