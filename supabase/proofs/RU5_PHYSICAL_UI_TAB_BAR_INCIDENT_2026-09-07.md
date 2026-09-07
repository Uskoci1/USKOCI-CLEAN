# RU-5 physical Android proof: tab-bar geometry and route inventory

## Fresh re-admission

Canonical: `46ddea1a2688a3026c269c1235026142f0f3921c`.
Active proof branch: `proof/ru5-physical-device-ui-journey-20260906` at `804dd47ac3bd3e0cf1d84c5431197566f57f151b`.
The older prepared `a95d25a...` is already an ancestor; do not reset the branch to it.
No PR exists for this proof branch at re-admission.
Frozen master SHA-256 was rechecked: `e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`.
The pinned source export at `251d72e9...` was compared to current proof HEAD: only eight harness/fixture/incident files changed; product and continuity files remained unchanged. The layout base blob was checked independently: `e25ba91ba49748b0cd37d34e99849925a2513e68`.
A fresh live Supabase read-only call was blocked by the tool safety layer. No live SQL was executed in this continuation and no new live-state confirmation is claimed. The prior recorded live-79 state is historical until a fresh read succeeds. No live promotion is allowed from this report.

## Physical evidence

Run `34062847661`, job `101566364076`, failed after real Worker authentication. APK build, TypeScript, regression/input/local-target guards and disposable reconstruction passed; UI/business validation steps were skipped after the journey failure.
Artifact `9998290752` was downloaded and its ZIP SHA-256 verified: `75079adf14c9a38cd4ff760cd1056cb8c975045fc58e704ed3dda6e91394417e`.
`proof-build.txt` binds APK SHA-256 `8f60d81b7740f56c6b05808224d98baa51e73e6c746559b065e1407fec506e6e` to the exact run/source.
The log confirms the auth sheet on attempt 1, complete 68-character email and masked 44-character password readback, followed by `AUTH_worker_authenticated` PNG/XML. Authentication is no longer the current failure.

The real authenticated screenshot and hierarchy show ten bottom tabs, not the five canonical Requester destinations. Five internal routes were auto-added: `profil/radnik`, `potrebe/[id]/kandidati`, `potrebe/[id]/pregled`, `prilike/[id]`, `prilike/[id]/prijava`.
The real Profil target bounds are `[432,2220][540,2338]`; the driver's center is `(486,2279)`. Android navigation background begins at y=2274 on a 1080x2400 display. Thus the selected touch point overlaps the system-navigation region. The failure PNG/XML show the launcher, and the driver times out waiting for `Pređi u prostor Uskočera`. This is consistent with system touch interception; no app-crash diagnosis is claimed without crash evidence.

## Minimal product correction

Only `src/app/(app)/_layout.tsx` changes at runtime. Keep all existing routes, role rules, tab order, callbacks, icons and no-slide navigation. Explicitly hide the five internal route buttons with the existing `href: null` mechanism; this is visibility, not an authorization boundary.
Use existing `useSafeAreaInsets()` and `bottomPadding = Math.max(18, insets.bottom)`. Preserve the original 66-point control area with `height = 66 + bottomPadding`; zero-inset geometry remains 84/18. No coordinate shortcut or direct Auth/RPC fallback is introduced. The existing physical driver is unchanged.
Official API references checked: Expo SDK 57 safe-area-context (`https://docs.expo.dev/versions/v57.0.0/sdk/safe-area-context/`) and Expo Router JavaScript tabs (`https://docs.expo.dev/router/advanced/tabs/`). No dependency changes.

## Validation and remaining gate

Local isolated execution of the transpiled component configuration passed both role inventories, all 13 explicit route registrations, and bottom-inset geometry at 0/18/24/34/48/64. This uses mock module boundaries and is NOT React Native rendering or full TypeScript type checking.
Twelve Jest component-configuration cases were added for the same contract and workspace stability; full TypeScript/Jest execution is pending the proof workflow. Both edited TS sources pass local transpilation syntax diagnostics.
Required next evidence remains the full 13-state real Android journey, PNG/XML inspection, disposable business effects and P0D03 zero-RSD binding. No PR/merge/closure is authorized by configuration tests alone.
Physical UI unit: NOT PROVEN. Aggregate RU-5: NOT CLOSED / bounded-note DECISION-REQUIRED. No backend, migrations, policy, monetization, HITNO, D0140, RU-4B, Application AI, FASTEST or AUTO_FILL changes.
