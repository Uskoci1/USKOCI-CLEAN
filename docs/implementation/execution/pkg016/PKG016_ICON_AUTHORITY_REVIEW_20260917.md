# PKG-016 / GAP-0041 — launcher icon authority review

Owner instruction, 2026-09-17: find every existing USKOČI brand asset, name the most canonical mark,
show two or three real options derived from it, and describe them as an Android adaptive icon and an
iOS app icon. **Do not invent a new brand mark.** Until one option is approved, GAP-0041 stays open.

Nothing in this review was committed as an approved asset. The previews are proposals.

## 1. Every brand asset that exists

`assets/` holds 46 files. These are the USKOČI-owned brand assets; everything else is Expo template
or React template art.

| Asset | What it is |
| --- | --- |
| `assets/entry-splash-mark.svg` and `.png` | **the canonical mark, already prepared for a native icon**, 640×640 |
| `assets/brand/entry-mark-0.svg` … `entry-mark-6.svg` | seven mark fragments, each a different aspect ratio, from 85×25 to 179×205 |
| `assets/brand/entry-word-0.svg` … `entry-word-3.svg` | four wordmark fragments |
| `assets/brand/entry-v49/` | the V4.9 entry composition source: `requester.webp`, `worker.jpg`, two note SVGs, and `provenance.json` binding them to the owner's HTML |
| `assets/generated/uskoci-entry-city.webp`, `uskoci-rounded.ttf` | entry illustration and the brand typeface |
| `assets/entry-splash-empty.xml` | the Android splash drawable |

Template assets currently wired into `app.json`, none of them USKOČI: `assets/images/icon.png`,
`android-icon-foreground.png`, `android-icon-background.png`, `android-icon-monochrome.png`,
`favicon.png`, plus `expo-logo.png`, `react-logo*.png` and `splash-icon.png`.

## 2. The most canonical mark, and why it is not a judgement call

`assets/entry-splash-mark.svg` carries its own provenance in a comment at the top of the file:

> Exact SPOJ V2 BrandMark paths; original `uskoci-lockup.svg` SHA256
> `25162f9bc7e7f822e77bd4ff078b8295a50796e9af49ffbdac98dac04d17ae97`. Only centered padding is added
> for the native splash icon safe area.

So it is the exact brand mark, unmodified, already squared and padded for a native icon, and already
in production as the splash image in `app.json`. The seven `entry-mark-*.svg` fragments are pieces of
the entry composition at varying aspect ratios, not a square mark. Nothing else is a candidate.

**Using it as the launcher icon means the icon and the splash are literally the same artwork**, so
tapping the icon and seeing the app open is one continuous image.

### Measured facts about the mark

| Measure | Value |
| --- | --- |
| canvas | 640 × 640 |
| ink bounding box | 560 × 582, that is 87.5% of the width and 90.9% of the height |
| padding around the ink | 6.2% left and right, 4.5% top and bottom |
| colours | `#FF7908` orange, 73 909 px, and `#2E7A6A` teal, 73 061 px |

The two brand colours are almost exactly balanced, 50.3% against 49.7%. Neither is subordinate.

## 3. The problem that must be solved whichever option wins

**The mark cannot be dropped in as-is.** Android adaptive icons are 108 units wide, of which only 72
are guaranteed visible and 66 are safe, because the launcher masks the icon to its own shape and may
parallax it. The mark fills 87.5% to 90.9% of its canvas, so an adaptive foreground built from it
unchanged would be clipped on every launcher that uses a circular mask.

Its current padding is correct for what the file says it is: the splash safe area. An icon needs
different padding. Every option below therefore re-pads the mark, scaling the ink to sit inside
66/108 for Android and inside 72% for iOS, where the squircle trims the corners.

That is scaling and centring, not redrawing. No path is touched.

## 4. The options

All three use the identical mark. Only the background field differs, and **no path is recoloured in
any of them**, which is what keeps this a derivation rather than a new identity.

| Option | Background | Character |
| --- | --- | --- |
| **A. Mark on white** | `#FFFFFF` | Exactly today's splash, which is white in both light and dark mode. Zero artistic decision. The icon and the launch screen become the same image. |
| **B. Mark on warm tint** | `#FFF4EA`, the lightest tint of the mark's own orange | Separates the icon from the many white icons on a home screen while staying inside the brand. Warm, and leans to the orange half. |
| **C. Mark on cool tint** | `#EAF3F1`, the lightest tint of the mark's own teal | Same separation, leaning to the teal half. Calmer, and reads closer to the app's own surfaces. |

### As an Android adaptive icon

Each option supplies a 432 × 432 foreground with the ink inside the 66/108 safe box, and a flat
background colour rather than a background image, so no seam can appear between layers. The launcher
then masks it: a circle on stock Android, a squircle on Samsung, a rounded square elsewhere. Because
the field is flat and the ink is inside the safe box, every mask shows the whole mark.

The **monochrome** layer for themed icons is a separate, mechanical derivation: the same paths
flattened to a single colour, letting the OS tint it. It is not a design decision and I have not
produced it, because it should be generated from whichever option is approved.

### As an iOS app icon

One opaque 1024 × 1024 image, no transparency and no pre-applied rounding, because iOS masks it
itself. The ink sits inside 72% so the squircle cannot clip the extremities. Option A on white is the
most conventional on iOS; B and C read as a deliberate brand tile.

### What the options do not include

A full-bleed brand colour field, with the whole tile in `#FF7908` or `#2E7A6A`, would be striking and
is the obvious fourth direction. **It is not offered**, because at those backgrounds one half of the
mark disappears into the field, so it would require recolouring the mark's own paths. That is a brand
decision the owner would have to make, not a derivation I can perform.

## 5. What happens after approval

1. Generate the three Android layers and the iOS icon from the approved option at full resolution.
2. Point `app.json` at them, replacing every Expo template reference including the favicon.
3. Retire the unused template art.
4. Rebuild and re-attest, so the artifact that carries the icon is the artifact that is proven.

Until step 1 has an approved input, **GAP-0041 stays open and PKG-016 cannot reach DONE_VERIFIED**,
because shipping the Expo template icon is precisely what this package exists to end.
