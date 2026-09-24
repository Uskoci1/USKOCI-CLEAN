---
name: uskoci-ci-and-tooling-caveats
description: "CI and QA traps found 2026-09-23/24 — bracket path filters break a workflow file, tracked outputs/ harness is type-checked, new supabaseClient imports crash screen suites, Bash-tool heredocs fail (use Write), gh wait loops must request conclusion, the owner phone hides ADB when USB debugging is off"
metadata:
  node_type: memory
  type: project
  originSessionId: 76affeda-95a8-4142-8648-3324aae3af63
  modified: 2026-09-23T06:33:59.339Z
---

Four traps that each cost a CI round on 2026-09-23 (PKG-047/048/050 work):

1. **GitHub `paths:` filters refuse bracket patterns.** `'src/app/dogovor/[[]id[]].tsx'` made GitHub reject the
   whole workflow file ("workflow file issue", run fails in seconds with the *file path* as the run name, and the
   paths filter is ignored so it fires on every push). Use a directory pattern: `'src/app/dogovor/**'`.
2. **`outputs/native-product-review-20260922/review.tsx` is TRACKED and inside `tsconfig`**, so `npx tsc --noEmit`
   in every proof workflow (PKG-004/007/045/050 "Bind source, types…") compiles it. Making a projection field
   required (e.g. `DogovorProjekcija.izvor`, 332d285f) broke all four workflows for ~5 hours before anyone
   looked. Locally I had filtered `outputs/` out of tsc output thinking it was untracked — it is not. When a
   contract type changes, grep `outputs/` fixtures too.
3. **A new production-client import in a screen crashes old screen suites.** `prilike/[id].tsx` gained
   `useSafetyEntry → safetyClientService → supabaseClient`; `task-detail-screen.test.tsx` mocks react-native with a
   Proxy whose `mockAppListeners` Set is not yet initialised when `supabaseClient` registers its AppState listener
   at module load → "Cannot read properties of undefined (reading 'add')". Fix: mock the hook absent in that suite
   (`jest.mock('../../ui/safety/useSafetyEntry', () => ({ useSafetyEntry: () => undefined }))`). PKG-007 runs the
   FULL regression, so this is where such a crash shows first. Prefer routing new screen calls through the `Izvor`
   port (as PKG-050 did with `oznaciPorukeProcitanim`) so suites that mock `useIzvor` need only a new mock member.
4. **The Bash tool's quoted heredocs (`<<'EOF'`) fail unpredictably** here with "unexpected EOF while looking for
   matching `''" when the body is long / contains SQL dollar-quotes or JS template literals — the command is run
   through `eval`. Write files with the Write tool, then do md5/sha pinning with `node -e '…'` in single quotes
   (use `\x27` for inner apostrophes). Also: foreground `sleep` is blocked (use Monitor), and `docs/control/out`
   is gitignored (never `git add` it).

5. **A CI wait loop must request every field it reads.** `gh run view N --json status --jq 'select(.status=="completed") | .conclusion'`
   prints nothing forever: `conclusion` was never requested, so it is null and the loop never ends (two waiters hung
   on 2026-09-23 evening). Use `--json status,conclusion --jq '"(.status) (.conclusion)"'` and match `completed*`.
6. **The owner phone (HONOR, serial A8QDVB6522001205) drops its ADB interface** when USB debugging is off: Windows
   then lists only the WPD/MTP and mass-storage interfaces (`Get-PnpDevice ... VID_339B`), and `adb devices` is empty.
   Ask the owner to turn on Otklanjanje grešaka preko USB-a and accept the prompt; never try to work around it.

7. **Workflow scripts refuse CR characters** ("script contains control characters that would be hidden in the
   approval dialog"): a script edited by Python on Windows came out CRLF. Write workflow scripts with LF only, and
   never put backticks inside a template-literal prompt (they end the string). Syntax-check a copy with `node --check`
   after stubbing `agent/parallel/phase/args` and wrapping the top-level awaits.
8. **The QA emulator (AVD USKOCI_V5_TEST) must run in Europe/Belgrade.** It was Europe/Warsaw, so every time carried
   "(po vremenu u Srbiji)", which Serbian phones never show, and critics chased false wraps. The image is a Play Store
   build: no `adb root`, `setprop persist.sys.timezone` fails, `-timezone` is ignored after a snapshot boot. Set it in
   Settings > System > Date & time > Time zone > Region "Serbia" (driven with `scratchpad/ui.py`). Width checks: `adb
   shell wm density 540/480/443/402` gives 320/360/390/430 dp on the 1080 px screen; `settings put system font_scale 1.3`;
   reset with `wm density reset` and font_scale 1.0 afterwards. A density change restarts the app on Početna.
9. **Android reports font scale 1.3 as 1.2999999523.** Any `fontScale >= 1.3` never fires at the Large setting. Read
   it through `src/ui/system/textScale.ts` (`useTextScale()` / `roundTextScale()`), never raw.

**How to apply:** before pushing a package, run the full Jest locally in the background (`npx jest --runInBand`),
expect only the known `scripts/__tests__/firebase-config.test.ts` first-run timeout; check `gh run list` after
every push because `cancel-in-progress` concurrency groups silently cancel dispatched runs when a later commit
lands. Related: [[uskoci-route-test-harness-caveats]], [[uskoci-local-windows-proof-caveats]].
