# USKOČI — UI unification audit (2026-09-23)

Branch: `work/ui-unification-20260923`  
Base: `clean-alpha-backend`

## Authority read before changes

- `AGENTS.md`
- `docs/authority/AUTHORITY_INDEX.md`
- `docs/implementation/execution/CURRENT_ENTRY_MAP_20260916.md`
- `docs/implementation/NEXT_AI_HANDOFF_20260919_2100.md`
- `docs/implementation/v5-ai-first/pkg023/OWNER_DECISIONS_V3_20260919.md`
- `docs/implementation/v5-ai-first/DESIGN_PACK_EXECUTION_20260920.md`
- `docs/implementation/v5-ai-first/HTML_DIRECTION_HOME_20260920.md`
- PKG-011B premium design docs
- current package manifest and current native UI files

`USKOCI_MASTER_PLAN_DIZAJNA.md` is not present on the repository default branch, so it is not treated as repository authority. The owner's current chat direction is still used for visual refinement where it does not contradict repository authority.

## What is already good and must stay

1. Native Expo/React Native implementation; no WebView/prototype runtime.
2. One account, no global role switch; current canonical shell remains **Početna | Mapa | Dogovori**.
3. Existing Supabase/RPC/RLS/revision/idempotency boundaries remain untouched.
4. White ground, deep green hierarchy, controlled orange action signal, original brand/entry assets.
5. Existing system tokens, Phosphor icon family, Reanimated/Gesture Handler and current Press component are reusable.
6. Current Home and AI surfaces already preserve truth: partial reads do not become empty states, sends are explicit, dictation produces editable text, and UI does not invent server success.

## Main visual conflicts found

### C01 — top chrome is not one component
`HomePresentation` owns a custom header while list surfaces use `ScreenHeader`. They disagree on composition and account control placement. The user experiences the same global controls as different products.

**Action:** one shared root-chrome geometry. Avatar/profile on the left, content/brand/title in the middle according to surface, inbox on the right. Same touch target and optical icon size.

### C02 — shared header comments and semantics still describe an obsolete global intent
`ScreenHeader` still documents the old intent-shaped shell even though the current authority removed global mode.

**Action:** remove obsolete semantics from the primitive; screen copy describes the object/surface, not a global role.

### C03 — navigation is structurally correct but visually underpowered
The current three-tab shell is correct, but its icon and label geometry are smaller than the current owner direction and the floating rounded container competes visually with content on small phones.

**Action:** keep the same routes and back behavior; increase optical icon size/touch confidence and refine the container without changing navigation semantics.

### C04 — AI composer is functionally correct but compositionally split
`AiConversationShell` presents typing and voice as separate layouts. `VoiceComposer` is centered inside another bar, so the bottom area reads as controls assembled around a feature rather than one premium composer.

**Action:** preserve hold-to-talk, permission, transcript, explicit Send and recovery contracts while presenting them inside one floating composer family with clear text / voice / listening / review states.

### C05 — token system exists, but not every surface uses it as the sole owner
The system is already close to the requested palette and scale. New work should not add a second theme.

**Action:** evolve `src/ui/system/tokens.ts` and migrate touched components to it. Do not introduce a new UI dependency or parallel token file.

### C06 — visual completion cannot be proven by route smoke alone
The design docs already say the supplied HTML is direction, not pixel lock. A green unit suite does not prove hierarchy, keyboard composition or device ergonomics.

**Action:** each slice needs code checks plus screenshots/phone review for 320/360/390/430 widths, enlarged text, loading/error/missing states and keyboard where relevant.

## Implementation order

1. Shared system tokens + global header/footer chrome.
2. Home/root tab geometry.
3. AI task intake: conversation shell, floating composer, voice/listening/review states.
4. Map controls/pin/list/create-task affordance.
5. Task and application list/card hierarchy.
6. Agreement list/detail/messages.
7. Profile/worker/resources.
8. Calendar/availability.
9. Notifications/settings/privacy/support.
10. Full regression and visual/device polish.

## Hard boundaries for this branch

- No migration, Edge deployment, RPC signature or policy change.
- No new dependency.
- No fabricated data, location, reputation, delivery state or saved result.
- No direct push to `clean-alpha-backend`; changes stay on this branch and are reviewed through a PR.
- No broad `!important`-style patching pattern; touched components must have one native owner.
