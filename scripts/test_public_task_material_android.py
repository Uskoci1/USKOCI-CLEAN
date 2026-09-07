"""Offscreen XML must not certify material as physically displayed."""
import sys
import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).parent))
from public_task_material_android_journey import card_touch_point, normalize_text, visible_text
from public_task_material_validate import validate_original_text


def tree(text='Kutije', rect='[10,30][190,70]', parent='[0,20][200,180]', **attrs):
    root = ET.Element('hierarchy')
    container = ET.SubElement(root, 'node', {'bounds': parent})
    ET.SubElement(container, 'node', {'bounds': rect, 'text': text, **attrs})
    return root


class PhysicalMaterialObservations(unittest.TestCase):
    def test_tall_card_touch_is_clipped_to_actual_exposed_region(self):
        root = tree(rect='[0,40][200,850]', parent='[0,20][200,190]')
        card = root[0][0]
        card.set('content-desc', 'Otvorite priliku Kutije')
        card.set('clickable', 'true')
        self.assertEqual(card_touch_point(root, 'Kutije', 200, 200), (100, 104))

    def test_tiny_hidden_disabled_or_other_card_is_not_a_touch_target(self):
        for patch in ({'bounds': '[0,170][200,900]'}, {'enabled': 'false'},
                      {'visible-to-user': 'false'}, {'content-desc': 'Otvorite priliku Drugo'}):
            root = tree(rect='[0,40][200,850]', parent='[0,20][200,190]')
            card = root[0][0]
            card.attrib.update({'content-desc': 'Otvorite priliku Kutije', 'clickable': 'true', **patch})
            with self.subTest(patch=patch):
                self.assertIsNone(card_touch_point(root, 'Kutije', 200, 200))

    def test_fully_visible_material_is_admitted(self):
        self.assertEqual(visible_text(tree(), 200, 200), {'Kutije'})

    def test_screen_clipped_or_offscreen_text_is_rejected(self):
        for rect in ('[10,-10][190,50]', '[10,150][190,230]', '[10,300][190,330]', '[0,0][0,0]'):
            with self.subTest(rect=rect):
                self.assertEqual(visible_text(tree(rect=rect), 200, 200), set())

    def test_scroll_ancestor_clip_is_enforced_even_within_the_screen(self):
        self.assertEqual(visible_text(tree(rect='[10,170][190,190]'), 200, 200), set())

    def test_hidden_ancestor_and_hidden_text_are_rejected(self):
        root = tree()
        root[0].set('visible-to-user', 'false')
        self.assertEqual(visible_text(root, 200, 200), set())
        self.assertEqual(visible_text(tree(**{'visible-to-user': 'false'}), 200, 200), set())

    def test_normalization_preserves_words_and_numeric_values(self):
        self.assertEqual(normalize_text('•  Kolica\n za kutije'), 'Kolica za kutije')
        self.assertNotEqual(normalize_text('najmanje 2 god.'), normalize_text('najmanje 0 god.'))
        self.assertNotEqual(normalize_text('• Bez lifta'), normalize_text('Lift'))

    def test_original_recomputation_rejects_self_reported_offscreen_fact(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / 'rich_scan_00.xml').write_bytes(ET.tostring(tree(rect='[10,170][190,190]')))
            report = {'viewport': [200, 200], 'scans': {'rich': {'originalPairs': 1, 'observedExpected': ['Kutije']}}}
            with self.assertRaises(AssertionError):
                validate_original_text(path, report)

    def test_original_recomputation_can_accumulate_actual_scrolled_views(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            for index, text in enumerate(('Kutije', 'Bez lifta')):
                (path / f'rich_scan_{index:02d}.xml').write_bytes(ET.tostring(tree(text=text)))
            validate_original_text(path, {'viewport': [200, 200], 'scans': {
                'rich': {'originalPairs': 2, 'observedExpected': ['Kutije', 'Bez lifta']}}})


if __name__ == '__main__':
    unittest.main()
