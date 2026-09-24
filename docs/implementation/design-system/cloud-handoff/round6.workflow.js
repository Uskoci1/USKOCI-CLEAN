export const meta = {
  name: 'uskoci-round6',
  description: 'Remaining screens (application composer and rating; publish review, place and photos; Q&A and Dogovor sub-screens) as audit -> build -> three-lens review, plus a whole-app consistency sweep with adversarially verified findings',
  phases: [
    { title: 'Plan', detail: 'one read-only auditor per remaining area' },
    { title: 'Izrada', detail: 'one implementer per area in an isolated worktree' },
    { title: 'Pregled', detail: 'flow, visual and guard reviewers per area' },
    { title: 'Pretraga', detail: 'five whole-app finders, each from a different angle' },
    { title: 'Potvrda', detail: 'one skeptic per deduplicated finding' },
  ],
}

// Cloud-ready copy (2026-09-24). Pass args: { repo: '<absolute path of the main checkout>', base: '<full sha to build on>' }.
const WT = (args && args.repo) || '.'
const MEM = WT + '/docs/implementation/design-system/cloud-handoff/rules'
const BASE = (args && args.base) || 'HEAD'

const RULES = `Owner rules (binding): old HTML/V28/V41/V46 are sources of function and content only — recompose as a premium USKOČI built from zero would; WHITE app, dark green for the primary action, titles and selection, orange only as a controlled accent (one orange fill per screen plus dots and badges); one primary action per screen; no eyebrows, no copy that explains where you are, no "server" wording; Serbian Latin with "ti", no gendered forms; text at least 12 px; touch at least 48 for commands; clear disabled-with-reason / loading / error / success states; motion only on a real state change, none under reduced motion, no fact animated; a missing price never looks like an amount and an amount never loses its currency; no category or skill shown as a label to other people; never invent data; no card inside a card; no dead buttons; read the text scale through useTextScale()/roundTextScale(). Legal, privacy and consent TEXT keeps its words and meaning. Owner decisions of 2026-09-24: the rewritten voice notice is approved; a task may show street names (no house number) before a Dogovor. Never weaken a guard, a server call, recovery, revision, idempotency, consent, read or viewed marking, or a test's intent. No new dependency (expo-speech is not approved). Payments, prices, providers, store release and data deletion rules are owner decisions. The locked entry and sign-in composition (src/app/auth.tsx, src/app/oporavak.tsx, src/ui/auth/*, src/ui/entry/*, src/ui/referenceEntry/*) keeps its own dark theme and is OUT of scope.`

const SYSTEM = `Reuse the shared system (read it before writing anything similar): sys tokens (src/ui/system/tokens.ts), ScreenChrome (ROOT / DETAIL with a scroll title and a right slot / FLOW), the sheet family (ProductSheet, ConfirmSheet + useConfirmSheet, ActionSheet with subtitles, PeekSheet), StateView, Disclosure (with TurningCaret), V2Action (loading / confirmed / error / reason), Avatar + inicijali(), FactArt, Pictogram + PickerTile, TaskFace / ApplicationFace / CandidateFace, SettingsPresentation, the reduced-motion store (src/ui/system/motion.ts), useTextScale(), vreme() for times. Memory: ${MEM}/uskoci-autonomous-perfection-directive.md, ${MEM}/uskoci-design-lead-directive.md, ${MEM}/uskoci-design-pass-2026-09-23.md, ${MEM}/uskoci-owner-decisions-2026-09-24.md, ${MEM}/uskoci-route-test-harness-caveats.md, ${MEM}/uskoci-ci-and-tooling-caveats.md. Master plan: ${WT}/USKOCI_MASTER_PLAN_DIZAJNA.md. Emulator critique: ${WT}/docs/implementation/design-system/r1-emulator-d7152e9f/R1_CRITIQUE.md.`

const AREAS = [
  { key: 'prijava', title: 'Sastavljanje prijave i ocena saradnje', branch: 'g-round6-prijava', gallery: 'dizajn-prijava',
    files: 'src/app/(app)/prilike/[id]/prijava.tsx, the application COMPOSER part of src/ui/v2/ApplicationSelectionPresentation.tsx (the ApplicationSelectionPresentation function and its helpers; move it into a NEW src/ui/v2/ApplicationComposerPresentation.tsx and keep a re-export from the old module so imports keep working; do not change CandidateListPresentation or CandidateSelectionPresentation), src/app/(app)/oceni-dogovor.tsx, src/ui/reviews/AgreementReviewScreen.tsx, their tests',
    brief: 'The worker composes ONE application: what they offer (price for the offered scope with its basis, or the offer word when the task asks for offers), how many people come, an optional exact time inside the task window, a short note, one green send, then the existing explicit review before sending with every guard, revision, idempotency and recovery exactly as today. It should feel like a premium checkout step, not a form: the task summarised at the top as the task face (bare, no card in a card), clear field states, the reason beside a disabled send. The rating screen: one calm screen, the person first (Avatar, name, role), five large stars with labels for screen readers, an optional short comment, one green send, an honest success state and the Back label that matches where the person came from (Početna, Dogovori, the Dogovor).' },
  { key: 'objava', title: 'Pregled pre objave, mesto zadatka i fotografije', branch: 'g-round6-objava', gallery: 'dizajn-objava',
    files: 'src/app/(app)/pregled-zadatka.tsx, src/app/(app)/pregled-nacrta.tsx, src/app/(app)/mesto-zadatka.tsx, src/ui/location/NeedLocationForm.tsx, src/ui/location/LocationPointEditor.tsx, src/ui/location/LocationControls.tsx, src/ui/location/CountryField.tsx, src/app/(app)/fotografije-zadatka.tsx, src/ui/media/AuthorizedPhoto.tsx (visual only), their tests',
    brief: 'The publish review is the moment of truth: the task as others will see it (the public task face and detail facts, bare), then what still needs an answer, then one green "Objavi zadatak" whose spinner shows only while publishing (already fixed) and the existing guards, editor locks, stale-review and recovery exactly as today; edits as quiet rows. The place screen: the map with the approximate public area and the private exact point clearly separated (what others see vs what only a Dogovor reveals), honest permission states, one primary action. Task photos: a clean grid with add, remove (ConfirmSheet) and upload states (uploading, failed with retry, cancel of an unconfirmed upload exactly as today), no dead buttons.' },
  { key: 'dogovor-dodaci', title: 'Pitanja i odgovori, izmene Dogovora, deljenje lokacije i grupni Dogovor', branch: 'g-round6-dodaci', gallery: 'dizajn-dodaci',
    files: 'src/ui/qa/TaskQaScreen.tsx, src/app/(app)/pitanja-zadatka.tsx, src/ui/agreements/AgreementActionsScreen.tsx, src/ui/agreements/AgreementLocationScreen.tsx, src/ui/AgreementPrivateLocation.tsx, src/ui/groups/GroupConversationScreen.tsx, src/ui/media/AgreementPhotoComposer.tsx, src/app/dogovor/[id]/izmene.tsx, src/app/dogovor/[id]/lokacija.tsx, src/app/dogovor/[id]/grupa.tsx, their tests',
    brief: 'Q&A as a calm public thread: the question, the owner\'s answer, statuses honest, the ask composer as the same floating pill used in Poruke and the AI chat, the existing guards. Agreement changes and cancellation as a serious FLOW (ScreenChrome FLOW, one decision per step, ConfirmSheet for destructive steps, every reason field and guard kept, exact wording kept where it is binding). Location sharing: what is shared, with whom, for how long, the start/stop controls with their states, never implying a live position that is not live. The group Dogovor conversation consistent with Poruke. No dead buttons.' },
]

const AUDIT = (a) => `You are a senior product designer and engineer auditing one area of the USKOČI app (Expo 57 / React Native 0.86, expo-router, Supabase) BEFORE it is rebuilt. READ-ONLY: do not edit, commit or run builds. Work from ${WT} at its current HEAD (${BASE}).
AREA: ${a.title}. Files in scope: ${a.files}.
${SYSTEM}
${RULES}
Brief from the lead: ${a.brief}
Read every file in scope, the routes that open these screens and the tests that pin them. Then write the redesign spec the implementer will follow: for each screen, what it is for, what is wrong today (concrete, with file:line), the new composition top to bottom (shared components, exact Serbian copy where copy changes, states: empty / loading / error / offline / disabled-with-reason / success, large text and 320 dp behaviour), which guards and tests must stay untouched, and which test assertions will need updating because they pin the old look. List owner decisions separately. Be specific enough that a different engineer can build it without guessing.`

const AUDIT_SCHEMA = { type: 'object', properties: {
  screens: { type: 'array', items: { type: 'object', properties: {
    route: { type: 'string' }, purpose: { type: 'string' }, problems: { type: 'array', items: { type: 'string' } },
    composition: { type: 'array', items: { type: 'string' } }, states: { type: 'array', items: { type: 'string' } },
    keepUntouched: { type: 'array', items: { type: 'string' } }, testsToUpdate: { type: 'array', items: { type: 'string' } } },
    required: ['route', 'purpose', 'problems', 'composition', 'states', 'keepUntouched'] } },
  sharedChanges: { type: 'array', items: { type: 'string' } },
  ownerDecisions: { type: 'array', items: { type: 'string' } },
  risks: { type: 'array', items: { type: 'string' } } },
  required: ['screens', 'ownerDecisions', 'risks'] }

const IMPL = (a, spec) => `You implement one bounded unit of the USKOČI app (Expo 57 / React Native 0.86, expo-router, Supabase) in an ISOLATED git worktree.
Setup: confirm you are NOT in ${WT} (never edit it). Run git checkout --detach ${BASE}, then git switch -c ${a.branch}; git log -1 --oneline must show ${BASE}. Link the main checkout's dependencies instead of installing: ln -s "${WT}/node_modules" node_modules (if that fails, run npm ci). Copy the gitignored src/ui/referenceEntry/entryReferenceData.ts from ${WT} if tests need it (never commit it).
UNIT: ${a.title}. Files you own: ${a.files}. Do not edit files outside this list except new files for this unit; if a fix needs another file, say so instead.
${SYSTEM}
${RULES}
Build it from this audited spec (JSON, written by a read-only auditor; follow it, and where you find it wrong, do the right thing and say why):
${JSON.stringify(spec)}
Device check aid: ADD a read-only internal gallery route NEW file src/app/${a.gallery}.tsx, guarded exactly like src/app/dizajn-tabla.tsx (internal build only, no data read or written, every command a no-op), rendering your real presentation components with fixture props in their main states, with a scene list of visible labels and an in-screen "Nazad" back to the list. Do not edit dizajn-tabla.tsx.
Keep line endings (check with file); write scripts with the Write tool; prefer the Write tool for new files.
Verify: npx tsc --noEmit -p tsconfig.json clean; changed suites pass; FULL npx jest passes (report the Suites/Tests line; 5 s first-run timeouts under load may be re-run alone and reported). Commit on your branch (English message ending "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"). Do not push. Return: branch, commit sha(s), worktree path, files changed, results, the gallery route and its scene labels, deviations from the spec with reasons, owner decisions left open, anything not done and why.`

const LENSES = [
  { key: 'tok', what: 'FLOW and UX: one clear job per screen, reachable without gestures only, Back and navigation land where expected, honest and complete empty/loading/error/offline/disabled-with-reason/success states, Serbian copy right (gender-free, plural, no orientation or "server" copy), nothing invented or promised that the app does not do.' },
  { key: 'izgled', what: 'VISUAL and accessibility: tokens only, spacing on the scale, text at least 12 px, one primary action, orange budget, no card inside a card, touch at least 48, screen-reader labels/roles/states/hints, large text via useTextScale at 320-430 dp, reduced motion honoured and no fact animated; the gallery route reads and writes nothing.' },
  { key: 'zastite', what: 'CORRECTNESS: guards, revisions, idempotency, consent, recovery, read and viewed marking unchanged; binding and legal words unchanged; no new dependency; tests updated not weakened (run the changed suites and every suite importing a changed module); missing tests for new behaviour; line-ending churn; files outside the unit; the route test harness.' },
]

const REVIEW = (a, lens, report) => `You are an adversarial senior reviewer (${lens.key}) for one USKOČI change: ${a.title}. Implementer report:
${report}
READ-ONLY: inspect with git (git log, git show <sha>, git diff ${BASE}..<sha>) from ${WT} or the implementer's worktree; do not edit or commit. You may run tests in the implementer's worktree.
${RULES}
Your lens: ${lens.what}
Verify at least four claims by reading code. Return a verdict (ship / fix first) and concrete issues with file:line and the exact fix, ordered by severity.`

const FINDERS = [
  { key: 'tokeni', angle: 'TOKENS and LAYOUT: raw hex colours, raw font sizes, raw spacing and radii outside src/ui/system/tokens.ts and the out-of-scope entry/auth files; text under 12 px; touch targets under 48 for commands; cards inside cards; more than one filled primary per screen; orange fills beyond the budget; raw fontScale comparisons instead of useTextScale.' },
  { key: 'tekst', angle: 'COPY: gendered forms (-o/-la verbs about the reader, "koju si otvorio"), formal "Vi" forms, "server" wording, eyebrows and orientation copy that explains where you are, English words in the UI, wrong plurals, inconsistent command vocabulary for the same action across screens, times not formatted through vreme(), amounts without currency, a category or skill shown as a label to other people.' },
  { key: 'pristupacnost', angle: 'ACCESSIBILITY: presses without accessibilityRole or accessibilityLabel, icon-only buttons without labels, missing accessibilityState (selected, disabled, busy, expanded), live regions for errors that appear, headers without the header role, images without labels or not hidden when decorative, focus lost when a view rebuilds, hints that are in English (library defaults).' },
  { key: 'stanja', angle: 'STATES and NAVIGATION: screens without an honest loading, empty, error or offline state; dead buttons (a press that does nothing or navigates nowhere); routes with no entry left; Back that lands somewhere unexpected; hand-made Modal or Alert.alert left instead of the sheet family; confirmations that bypass ConfirmSheet; disabled buttons without a reason.' },
  { key: 'pokret', angle: 'MOTION and PERFORMANCE: animations that ignore the one reduced-motion store (src/ui/system/motion.ts) or read Reanimated useReducedMotion directly; facts that animate; springs on every render; inline style objects and closures re-created in long lists (FlatList renderItem without memo); heavy work in render; list rows without keys; timers or listeners without cleanup.' },
]

const FINDING_SCHEMA = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: {
  file: { type: 'string' }, line: { type: 'number' }, rule: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' },
  severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'polish'] } }, required: ['file', 'line', 'rule', 'problem', 'fix', 'severity'] } } }, required: ['findings'] }

const FIND = (f) => `You sweep the WHOLE USKOČI app for one class of defects. READ-ONLY from ${WT} at ${BASE}: do not edit, commit or build. Scope: src/app/** and src/ui/** and src/lib/** (skip __tests__, the internal dizajn-* gallery routes, and the locked entry/auth files: src/app/auth.tsx, src/app/oporavak.tsx, src/ui/auth/*, src/ui/entry/*, src/ui/referenceEntry/*). NOTE: three areas are being rebuilt right now and their current code will be replaced — src/app/(app)/prilike/[id]/prijava.tsx and the composer in src/ui/v2/ApplicationSelectionPresentation.tsx, src/app/(app)/oceni-dogovor.tsx and src/ui/reviews/AgreementReviewScreen.tsx, src/app/(app)/pregled-zadatka.tsx, src/app/(app)/pregled-nacrta.tsx, src/app/(app)/mesto-zadatka.tsx, src/ui/location/NeedLocationForm.tsx, LocationPointEditor.tsx, LocationControls.tsx, CountryField.tsx, src/app/(app)/fotografije-zadatka.tsx, src/ui/qa/TaskQaScreen.tsx, src/ui/agreements/AgreementActionsScreen.tsx, AgreementLocationScreen.tsx, src/ui/AgreementPrivateLocation.tsx, src/ui/groups/GroupConversationScreen.tsx, src/ui/media/AgreementPhotoComposer.tsx — skip those files.
${RULES}
Your angle: ${f.angle}
Search systematically (grep and read), not by sampling. Report only real, verifiable defects with the exact file and line, the rule it breaks, the problem and the exact fix. No duplicates, no style opinions without a rule behind them. At most 60 findings, most severe first.`

const SKEPTIC = (x) => `You are a skeptic checking ONE reported defect in the USKOCI app. READ-ONLY from ${WT} at ${BASE}. Default to refuted=true if you cannot confirm it from the code.
Reported: ${JSON.stringify(x)}
${RULES}
Read the file around the line (and whatever it depends on). Is it real, in scope (not a locked entry/auth file, not a test, not an internal gallery), and does the proposed fix respect the owner rules without breaking a guard or a test's intent? Return refuted (true/false), the corrected fix if the proposed one is wrong, and one sentence of evidence with file:line.`

const VERDICT_SCHEMA = { type: 'object', properties: { refuted: { type: 'boolean' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['refuted', 'evidence'] }

const [areas, sweep] = await parallel([
  () => pipeline(AREAS,
    (a) => agent(AUDIT(a), { label: 'plan:' + a.key, phase: 'Plan', schema: AUDIT_SCHEMA }),
    (spec, a) => spec ? agent(IMPL(a, spec), { label: 'izrada:' + a.key, phase: 'Izrada', isolation: 'worktree' }).then(report => ({ spec, report })) : null,
    (built, a) => built && built.report ? parallel(LENSES.map(lens => () => agent(REVIEW(a, lens, built.report), { label: 'pregled:' + a.key + ':' + lens.key, phase: 'Pregled' })))
      .then(reviews => ({ area: a.key, spec: built.spec, report: built.report, reviews: LENSES.map((lens, i) => ({ lens: lens.key, text: reviews[i] })) })) : null,
  ),
  async () => {
    const found = (await parallel(FINDERS.map(f => () => agent(FIND(f), { label: 'pretraga:' + f.key, phase: 'Pretraga', schema: FINDING_SCHEMA }).then(r => (r && r.findings || []).map(x => ({ ...x, finder: f.key }))))))
      .filter(Boolean).flat()
    const seen = new Set(), unique = []
    for (const x of found) { const k = x.file + ':' + x.line + ':' + x.rule; if (!seen.has(k)) { seen.add(k); unique.push(x) } }
    log(`sweep: ${found.length} findings, ${unique.length} after dedupe`)
    const judged = await parallel(unique.map((x, i) => () => agent(SKEPTIC(x), { label: 'potvrda:' + x.finder + ':' + i, phase: 'Potvrda', schema: VERDICT_SCHEMA }).then(v => ({ ...x, verdict: v }))))
    const confirmed = judged.filter(Boolean).filter(x => x.verdict && x.verdict.refuted === false)
    log(`sweep: ${confirmed.length} confirmed of ${unique.length}`)
    return { total: found.length, unique: unique.length, confirmed }
  },
])
return { areas, sweep }
