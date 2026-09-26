# R19 — deep virtualized return and Android chat Back

2026-09-26. Corrections follow the installed, attested `03cc3e48` native failures in `NATIVE_REVIEW.explicit-viewport.md`. No backend, Edge, dependency, payment, provider, microphone or business-record changes.

## Discovery

The measured full-sheet viewport already restores the actual ten-row list on both devices. The local 1,000-row gallery still returned from rows 41–43 to 10–12. Installed RN's `VirtualizedList` limits the tail spacer to the highest measured cell when `getItemLayout` is absent. Its early content height is therefore the currently measured window, not proof of the final list extent. Permanently accepting that smaller scroll target loses the original position.

The correction retains the logical target across provisional native scroll acknowledgements. New content measurements advance the request until that target is reached. Genuine shrink is accepted only after the actual final cell and optional footer are measured. The custom cell forwards RN layout/focus/style/children; measured content coordinates include preceding cells and the header. Footer measurements are renewed with their dataset extent. Loading/error do not masquerade as known empty data. Account, focus, coverage, deliberate filter resets and user drag still retire or cancel restoration.

Regression coverage includes partial measurement growth, a fitting partial first window, both final-layout/scroll callback orders, real shrink, empty/error, optional footer refresh, stale owners and deliberate drag. The old source loses a saved 8,000 offset after its first provisional 1,800 acknowledgement. Corrected behavior preserves 8,000 through 1,800 and 6,000 until reaching it. These tests do not substitute for the native deep-return replay.

`dizajn-mapa?count=1000&discoveryTrace=1` explicitly enables a DEV-package-only numeric trace. It caps events/values, rejects text/identifiers/objects and non-finite numbers, and retires retained callbacks when disabled. The gallery has no backend fixtures, provider calls or commands. It proves local rendering/continuity only, not server filtering, query cost or concurrent-user load.

## Agreement chat

Chat is a local view inside the Agreement route. The header Back already selects its overview; Android hardware Back previously popped the whole route. A focus-scoped Android handler now dismisses a visible keyboard first, then selects overview. The next Back from overview remains normal navigation. Account/incarnation, focus and foreground ownership guard the handler; listeners retire on blur/unmount. Existing command journals and unknown outcomes survive the view change.

Four added regressions fail on the old route. Unknown completion coverage also verifies that switching back does not trigger a reread or clear the retained uncertain receipt. The exact later APK must still prove Android navigation on-device; IME behavior requires an active/inert composer scenario, not a completed read-only Agreement.

## Evidence

`CHECKS.deep-return-chat.json` records the integrated types/full Jest run and exact runtime file hashes. The preceding APK/capture/trace manifests remain separate. Record the later APK source/tree/hash and actual replay results before closing either native failure. Existing broader R19 NEXT/release gates remain open. Remote dashboard import is not confirmed by local generation.
