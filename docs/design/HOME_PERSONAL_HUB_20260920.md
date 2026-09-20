# Home: personal account hub — owner clarification, 20 September 2026

## Binding clarification

The owner explicitly confirmed that Home remains the combined place for posted tasks and their incoming applications, the account's outgoing applications, agreements and required reactions. "Tako je" confirms that functional purpose. It does not approve the appearance of D/E/F, the new prototype, a public-discovery Home feed or a native implementation.

The Home restart over-emphasized task creation and public discovery. The current personal-hub prototype supersedes that composition hypothesis. Keep D/E/F as unapproved studies; public discovery remains reached through Mapa / USKOČI I ZARADI.

## One revised composition

The owner-facing artifact is outputs/uskoci-home-exploration-20260920/TVOJA_POCETNA.html, with home-hub.css, home-hub.js, home-hub-data.js and home-hub-provenance.json. It is an interactive local design workbench, not a shipped app or a backend client. No new Figma frame is claimed for this iteration.

Home presents attention first, then a compact interleaved preview of owned tasks and outgoing applications, then upcoming/active agreements. The two entry actions remain fixed above the unchanged Početna / Mapa / Dogovori navigation. Interactions explain the destination outside the phone preview; they do not perform commands, open native routes or simulate a successful transaction.

The compact activity preview displays the first two of the source's at-most-five rows. Its all-activities link counts both locally omitted rows and source `more`: `more + max(0, rows.length - 2)`. This is an explicit proposed presentation change, not a change to fetch limits, pending reconciliation or the source engine. The same account's two relationships remain interleaved when both have rows.

## Functional evidence

A local Node helper uses the installed TypeScript transpiler and imports the existing `src/data/homeSnapshot.ts` composeHome() unchanged. Four synthetic read specimens produce active, busy, empty and partially unavailable HomeSnapshots. No real identity, account data, private location, database request or provider call is used. Initial loading and total failure are additional presentation states, not fabricated successful snapshots.

Attention eligibility and order come from the existing composer. A partially unavailable snapshot hides the attention total, and missing applications are described as unavailable, not empty. The attention remainder remains explanatory text referring to activities and agreements; no new universal attention route is invented. Row targets retain subject kind and id, including CANDIDATES versus NEED for the same task and APPLICATION versus AGREEMENT.

## Verification run

- JavaScript syntax checked with node --check.
- Browser reviewed the active composition; both owned and applied rows and both agreement relations appear.
- At width 360 and text multiplier 1.35, appScroll width equals client width (360); no phone buttons were below 44 x 44 in that check. This is web-preview evidence, not native accessibility certification.
- Busy specimen renders confirmation, open problem and changed application first, then a +2 remainder and total 5.
- Partial specimen suppresses the attention total and names missing applications while retaining available tasks.
- Empty specimen contains zero activity/attention rows and retains both entry actions.
- Loading and total-error views were opened and inspected; neither reports an empty account.
- Browser interaction testing caught and corrected a prototype-only row/target mapping mistake. After the fix, CANDIDATES, NEED, APPLICATION and AGREEMENT ids are populated. Clicking the confirmation row explains opening the agreement and explicitly does not confirm completion.

No native tests, device test, Figma parity check, full 200% text test, production proof or visual approval is claimed. The native client, dependencies, database and migrations are unchanged.

