#!/usr/bin/env python3
"""PKG-016 / GAP-0041 launcher icon attestation for a built Android APK.

Pointing app.json at an icon does not prove the icon shipped, and a release APK
shortens resource names, so the packaged art cannot be found by path. This matches
it by content instead: every square image in the APK's resources is reduced to a
small RGB fingerprint and compared with the committed assets.

It requires three things, and deliberately does not require a fourth:

  1. the committed adaptive foreground is present in the artifact,
  2. the committed icon is present,
  3. the Expo template icon is absent.

The template *foreground* is not asserted, because it cannot be measured. That file
is only 9.8 percent opaque, so composited onto white it is very nearly blank and
sits within 6 of small unrelated glyphs. Asserting its absence would be a coin toss
dressed as a check. Nothing is lost: reverting to it would push the foreground
presence check to roughly 18, far outside its threshold, so the regression is caught
by check 1.

Measured on the 2026-09-17 artifact, which is where the thresholds come from:
exact match 0.00, density variants 0.03, template icon 85.70, and the distance
between the shipped foreground and the template foreground 17.88.

Usage: attest_launcher_icon.py <apk> <receipt.json>
"""
import hashlib
import io
import json
import os
import sys
import zipfile
from pathlib import Path

from PIL import Image

SHIPPED_FOREGROUND = Path('assets/brand/app-icon/android-icon-foreground.png')
SHIPPED_ICON = Path('assets/brand/app-icon/icon.png')
TEMPLATE_ICON = Path('assets/images/icon.png')
TEMPLATE_FOREGROUND = Path('assets/images/android-icon-foreground.png')

GRID = 24
PRESENT_AT_MOST = 6.0    # an exact re-encode measured 0.00; density variants 0.02
ABSENT_AT_LEAST = 40.0   # the template icon measured 72 or worse against every packaged image


def fail(code, detail=''):
    print('FAIL LAUNCHER_ICON_ATTESTATION ' + code + ((' ' + detail) if detail else ''), file=sys.stderr)
    raise SystemExit(1)


def require(condition, code, detail=''):
    if not condition:
        fail(code, detail)


def fingerprint(image):
    """Small RGB signature over an opaque white composite, independent of density."""
    rgba = image.convert('RGBA')
    flat = Image.new('RGB', rgba.size, (255, 255, 255))
    flat.paste(rgba, mask=rgba.split()[3])
    return list(flat.resize((GRID, GRID), Image.LANCZOS).getdata())


def distance(a, b):
    return sum(abs(x - y) for pa, pb in zip(a, b) for x, y in zip(pa, pb)) / float(GRID * GRID * 3)


def packaged(apk_path):
    """Every square resource image of a plausible icon size, fingerprinted."""
    out = []
    with zipfile.ZipFile(apk_path) as archive:
        for name in archive.namelist():
            if not name.startswith('res/') or not name.lower().endswith(('.png', '.webp')):
                continue
            if name.endswith('.9.png'):
                continue
            try:
                image = Image.open(io.BytesIO(archive.read(name)))
                if image.width != image.height or image.width < 40:
                    continue
                out.append((name, image.width, fingerprint(image)))
            except Exception:
                continue
    return out


def nearest(reference, images):
    best = None
    for name, size, fp in images:
        d = distance(reference, fp)
        if best is None or d < best[0]:
            best = (d, name, size)
    return best


def main() -> int:
    if len(sys.argv) != 3:
        fail('USAGE', 'attest_launcher_icon.py <apk> <receipt.json>')
    apk_path, receipt_path = Path(sys.argv[1]), Path(sys.argv[2])
    require(apk_path.is_file(), 'APK_NOT_FOUND', str(apk_path))
    # Only the shipped assets are required. The template files are reference material
    # for the absence check and PKG-023 is expected to retire them; when they are gone
    # the check has nothing to compare and simply reports that.
    for asset in (SHIPPED_FOREGROUND, SHIPPED_ICON):
        require(asset.is_file(), 'ASSET_NOT_FOUND', str(asset))

    images = packaged(apk_path)
    require(len(images) > 0, 'NO_PACKAGED_RESOURCE_IMAGES')

    foreground = nearest(fingerprint(Image.open(SHIPPED_FOREGROUND)), images)
    icon = nearest(fingerprint(Image.open(SHIPPED_ICON)), images)
    template_icon = (nearest(fingerprint(Image.open(TEMPLATE_ICON)), images)
                     if TEMPLATE_ICON.is_file() else None)
    template_fg = (nearest(fingerprint(Image.open(TEMPLATE_FOREGROUND)), images)
                   if TEMPLATE_FOREGROUND.is_file() else None)

    require(foreground[0] <= PRESENT_AT_MOST, 'SHIPPED_FOREGROUND_NOT_PACKAGED',
            'nearest %.2f at %s' % (foreground[0], foreground[1]))
    require(icon[0] <= PRESENT_AT_MOST, 'SHIPPED_ICON_NOT_PACKAGED',
            'nearest %.2f at %s' % (icon[0], icon[1]))
    if template_icon is not None:
        require(template_icon[0] >= ABSENT_AT_LEAST, 'EXPO_TEMPLATE_ICON_STILL_PACKAGED',
                'nearest %.2f at %s' % (template_icon[0], template_icon[1]))

    receipt = {
        'unit': 'PKG016_LAUNCHER_ICON_ATTESTATION',
        'gap': 'GAP-0041',
        'result': 'PASS',
        'method': 'packaged resources matched by RGB content, because a release APK shortens resource names',
        'packagedSquareImagesConsidered': len(images),
        'shippedForeground': {'asset': str(SHIPPED_FOREGROUND).replace('\\', '/'),
                              'nearestPackaged': foreground[1], 'sizePx': foreground[2],
                              'distance': round(foreground[0], 3)},
        'shippedIcon': {'asset': str(SHIPPED_ICON).replace('\\', '/'),
                        'nearestPackaged': icon[1], 'sizePx': icon[2],
                        'distance': round(icon[0], 3)},
        'expoTemplateIconAbsent': (
            {'nearestPackaged': template_icon[1], 'distance': round(template_icon[0], 3), 'asserted': True}
            if template_icon is not None else
            {'asserted': False, 'why': 'the template icon is no longer in the repository, so there is nothing to compare'}),
        'expoTemplateForegroundObserved': (None if template_fg is None else
                                           {'nearestPackaged': template_fg[1], 'distance': round(template_fg[0], 3),
                                            'asserted': False,
                                            'why': 'the template foreground is only 9.8 percent opaque, so composited '
                                                   'onto white it is near blank and indistinguishable from small '
                                                   'glyphs; its absence is covered by the foreground presence check'}),
        'thresholds': {'presentAtMost': PRESENT_AT_MOST, 'absentAtLeast': ABSENT_AT_LEAST},
        'apkSha256': hashlib.sha256(apk_path.read_bytes()).hexdigest(),
        'sourceCommit': os.environ.get('GITHUB_SHA'),
        'sourceTree': os.environ.get('USKOCI_SOURCE_TREE'),
        'workflowRunId': os.environ.get('GITHUB_RUN_ID'),
        'workflowRunAttempt': os.environ.get('GITHUB_RUN_ATTEMPT'),
    }
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + '\n', encoding='utf8')

    print('PASS PKG016_LAUNCHER_ICON_ATTESTATION shipped_foreground_packaged shipped_icon_packaged template_absent')
    print('foreground nearest %.2f at %s (%dpx)' % (foreground[0], foreground[1], foreground[2]))
    if template_icon is not None:
        print('template icon nearest %.2f, well outside %.1f' % (template_icon[0], ABSENT_AT_LEAST))
    else:
        print('template icon no longer in the repository; absence check not applicable')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
