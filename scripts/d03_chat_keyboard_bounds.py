"""Strict physical IME geometry; screen bounds alone cannot prove visibility.

Android 15 InsetsSource.dump/toString report screen-coordinate frames:
https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/android15-release/core/java/android/view/InsetsSource.java
Only geometry is returned; unrelated WindowManager text is never recorded.
"""
import re


def observe_ime_frame(window_dump, width, height):
    frames = set()
    sources = re.findall(r'InsetsSource:\s*\{[^{}\r\n]*\}|InsetsSource\s+id=[^\r\n]*', window_dump)
    for source in sources:
        if not re.search(r'\s(?:mType|type)=ime(?:\s|\})', source):
            continue
        if not re.search(r'\s(?:mVisible|visible)=true(?:\s|\})', source):
            continue
        match = re.search(r'\s(?:mFrame|frame)=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\](?:\s|\})', source)
        if not match:
            raise AssertionError('Visible IME frame is malformed')
        frame = tuple(map(int, match.groups()))
        left, top, right, bottom = frame
        if not (left == 0 and right == width and 0 < top < bottom <= height):
            raise AssertionError('IME frame is not a valid docked keyboard on this proof screen')
        frames.add(frame)
    if len(frames) != 1:
        raise AssertionError('Actual visible IME frame is unknown or conflicting')
    frame = next(iter(frames))
    return {'imeTop': frame[1], 'imeFrame': list(frame), 'imeGeometrySource': 'WINDOW_MANAGER_INSETS_SOURCE'}


def assert_composer_above_ime(observation):
    width, height = observation['screen']
    top = observation.get('imeTop')
    if observation.get('imeShown') is not True or type(top) is not int or not 0 < top < height:
        raise AssertionError('Keyboard visibility requires a known actual IME upper boundary')
    for name in ('input', 'send'):
        left, y, right, bottom = observation[name]
        if not (0 <= left < right <= width and 0 <= y < bottom <= top):
            raise AssertionError('Chat composer or send control is occluded by the physical keyboard')
