# R20 exact APK: repeated-return defect — 2026-09-26

Source `a5ef12bb011012534c17287ce03218bb3c81adbe`, tree
`9710b804b08637a75e286f35f84add36fc30f287`, emulator build run `36265297705`.
APK SHA256 `adb123cc42d61fe68d64d98eb62613d25fc10af29b27ca6ae37e91edb8dd40df`,
72,546,960 bytes. Both build attestations and the installed `/base.apk` hash agree.
Installation used `adb install -r`; no app data was cleared.

## Device and procedure

`emulator-5556`, x86_64, 1080×2424, density420, font scale1.0. First emulator5554
had no active session and correctly displayed login; no credentials were handled.
The second emulator retained its existing session. The gallery is inert and uses no
server task writes: `uskociapp://dizajn-mapa?count=1000&discoveryTrace=1`.

Expanded the actual sheet, scrolled20 times until rows0040–0042 were visible,
opened the actual row0042, confirmed `LOKALNI PROBNI DETALJ · 42/1000`, then used
Android Back. Opened the same row again with no intervening list scroll and returned.

## Measured result: NOT ACCEPTED

- First return preserves exactly the same visible row bounds and saved9851dp.
  `deep.xml` and `return.xml` are byte-identical, SHA256
  `af0270bc05f283ead57cc702b9a64cd1478257ad746ca71bb747b4f8b69e2c97`.
- Native trace39 reports fresh ready with retained content12282.7dp; trace40
  requests9851 directly. There is no new `onScroll` acknowledgement because the
  offset already matches. This is visual preservation, not a completed restore fence.
- Second no-scroll return seeds9851 but remounts into the half sheet/top rows0001–0002.
  Trace44 is ready=false, native state0, pending9851, content1562.3dp. A later settled
  hierarchy still shows the wrong top rows. The saved requested index was1 although
  the prior native sheet was fully extended (state2).
- Therefore retained-return performance and repeated-return correctness are **open**
  on this APK despite passing unit/CI checks. The follow-up must confirm a same-offset
  return from fresh native evidence and preserve the actual settled detent.
- Manually expanding the wrong half sheet later resumes restoration and reaches
  trace57 ACK9851/9851/9851. The logical offset was not erased; automatic readiness
  was blocked by the wrong restored detent. This manual recovery is not acceptance.

## Evidence

Original PNG/XML/numeric logs are in the outer workspace
`outputs/audit-20260926/r20-native/`.
The decisive captures and trace are also preserved in the repository under
[`r20-native-a5ef12bb/`](r20-native-a5ef12bb/MANIFEST.json), with their hashes,
so another reviewer does not need this computer to inspect the failure.

- `detail-settled.xml` and `repeat-detail-settled.xml` prove the actual opened row.
- `deep.png`, `return.png`, `repeat-settled.png` show the before/first/repeated states.
- `repeat-settled.xml` SHA256:
  `ee0551bcf164525433e8084432c1f63fe8f2e14782d7b652810599c0d93a925c`.
- `trace.log` SHA256:
  `675c4ad8fb489b0a001b226eae635738629e3cb39d008b35e10ce73a3bee3dd7`.

The first hierarchy attempt after install failed with a null root and pulled an old
remote XML; `installed-start.xml` is invalid evidence. Later captures use fresh filenames.
`detail.xml` / `detail-repeat.xml` caught transitions; the settled captures determine
the verdict. No account, message, task, provider, microphone or server change occurred.
