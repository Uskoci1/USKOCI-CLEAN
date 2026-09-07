"""Source geometry regressions; only a new emulator run proves actual visibility."""
import unittest
from scripts.d03_chat_keyboard_bounds import observe_ime_frame, assert_composer_above_ime

IME = 'InsetsSource id=3 type=ime frame=[0,1500][1080,2400] visible=true flags= sideHint=BOTTOM'


class ActualImeBoundary(unittest.TestCase):
    def test_reads_android_15_dump_and_to_string_formats(self):
        formats = (IME, 'InsetsSource: {3 mType=ime mFrame=[0,1500][1080,2400] mVisible=true mFlags=}')
        for text in formats:
            with self.subTest(text=text):
                self.assertEqual(observe_ime_frame(text, 1080, 2400), {
                    'imeTop': 1500, 'imeFrame': [0, 1500, 1080, 2400],
                    'imeGeometrySource': 'WINDOW_MANAGER_INSETS_SOURCE'})

    def test_same_frame_repeated_for_multiple_windows_is_one_observation(self):
        self.assertEqual(observe_ime_frame(IME+'\n'+IME, 1080, 2400)['imeTop'], 1500)

    def test_does_not_use_status_navigation_or_hidden_ime_frames(self):
        text = IME.replace('type=ime', 'type=navigationBars').replace('1500', '2300')+'\n'+IME
        self.assertEqual(observe_ime_frame(text, 1080, 2400)['imeTop'], 1500)
        for text in ('', 'mInputShown=true', IME.replace('visible=true', 'visible=false'),
                     IME.replace('type=ime', 'type=imeCaptionBar'), IME.replace('type=ime', 'type=statusBars')):
            with self.subTest(text=text), self.assertRaises(AssertionError):
                observe_ime_frame(text, 1080, 2400)

    def test_conflicting_malformed_floating_and_out_of_screen_geometry_fail_closed(self):
        for text in (IME+'\n'+IME.replace('1500', '1400'), IME.replace('[0,1500]', '[x,1500]'),
                     IME.replace('[0,1500]', '[50,1500]'), IME.replace('2400', '2401'),
                     IME.replace('1500', '-1'), IME.replace('1500', '2400')):
            with self.subTest(text=text), self.assertRaises(AssertionError):
                observe_ime_frame(text, 1080, 2400)

    def test_controls_above_or_touching_known_ime_top_are_visible(self):
        assert_composer_above_ime({'screen': [1080, 2400], 'input': [65, 1360, 878, 1499],
                                  'send': [899, 1361, 1014, 1500], 'imeShown': True, 'imeTop': 1500})

    def test_predecessor_controls_inside_screen_but_below_ime_are_rejected(self):
        # Actual e068 control bounds; the1500 IME boundary here is a synthetic parser fixture.
        observation = {'screen': [1080, 2400], 'input': [65, 1584, 878, 1700],
                       'send': [899, 1585, 1014, 1701], 'imeShown': True, 'imeTop': 1500}
        with self.assertRaisesRegex(AssertionError, 'occluded'):
            assert_composer_above_ime(observation)

    def test_unknown_boundary_or_hidden_keyboard_cannot_pass_even_with_visible_screen_bounds(self):
        observation = {'screen': [1080, 2400], 'input': [65, 1200, 878, 1400],
                       'send': [899, 1200, 1014, 1401], 'imeShown': True, 'imeTop': 1500}
        for change in ({'imeTop': None}, {'imeTop': 0}, {'imeTop': 2400}, {'imeTop': True}, {'imeShown': False}):
            with self.subTest(change=change), self.assertRaises(AssertionError):
                assert_composer_above_ime({**observation, **change})

    def test_either_control_overlap_or_offscreen_rect_is_rejected(self):
        observation = {'screen': [1080, 2400], 'input': [65, 1200, 878, 1400],
                       'send': [899, 1200, 1014, 1401], 'imeShown': True, 'imeTop': 1500}
        for change in ({'input': [65, 1200, 878, 1501]}, {'send': [899, 1200, 1014, 1501]},
                       {'input': [-1, 1200, 878, 1400]}, {'send': [899, 1200, 1081, 1401]}):
            with self.subTest(change=change), self.assertRaises(AssertionError):
                assert_composer_above_ime({**observation, **change})


if __name__ == '__main__':
    unittest.main()
