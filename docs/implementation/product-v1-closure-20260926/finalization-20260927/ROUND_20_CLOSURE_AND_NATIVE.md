# Round 20 — retire closed dialogs and verify the installed settings

## Problem and decision

The closure dialog previously asked its parent to dismiss without immediately retiring its own confirmation and visit. Four added tests failed: an old confirmation still dispatched start after Close; delayed durable-intent persistence could dispatch start after Close; export navigation could happen twice; and an old export callback could navigate a later visit. These were mocked reproductions, not real closure attempts.

Closing now retires the confirmation and visit synchronously. Buttons belong to the rendered visit; Android Modal Back uses the same guarded close. Support/export/blocker exits are one-shot. A saved intent remains in its journal for recovery; dismissal never erases it, cancels a submitted server command or claims closure succeeded. Existing policy, revision, authority and read-before-retry checks remain.

## Implementation and checks

- `src/ui/closure/ClosureDialog.tsx` and its existing suite: 4 new failing regressions plus 22 existing passes before the fix; final 30/30 PASS including foreground and Android Back checks.
- Integrated `npx tsc --noEmit -p tsconfig.json`: PASS, exit 0. Diff check PASS. No full Jest rerun.
- `src/app/dizajn-objava.tsx`: two internal-only scenes use the production map preview with three public-area fixture points, as an ordered route and as independent places. No fake DEV records, grant bypass, geocoding or GPS. Public map tiles load; external links require an explicit tap. The scenes are prepared for the next APK, not yet natively accepted.
- TaskCard, DiscoveryPeek, dependencies, payments, DEV, Edge and certificates are unchanged.

## Device evidence

`ROUND_20_NATIVE_RECEIPT.json` binds exact artifacts and screenshot/XML hashes. Images stay in the task workspace, outside Git.

Round19 run36335552115 at f04e6b11023ed5d35a0d0a62b11fabd250ad94db was downloaded, attested and installed with `adb install -r` on emulator5556. The installed base.apk matches SHA256 93f9a4d3ebd566a0462264bb8ee1500fae6edf1262dc0b9299c507e796d8ece1. Session/data were preserved. Settled Profile XML now exposes name/photo/actions without stale `Učitavamo profil` or busy semantics. Notification settings were opened, returned to Profile and reopened without saving anything. Legal documents truthfully show unpublished status; this cannot prove external-document timeout behavior. No real account closure or consent was performed.

On the previous Round18 APK, the inert Agreement gallery showed the source-task link, accepted price/time, contact and access sections. Its real chat presentation retained the typed local draft while Android Back dismissed the keyboard; composer and return-to-terms remained visible. This does not prove message delivery, durable recovery or real read acknowledgement. At font1.3, the expanded public map loaded in bounds y310–1726, with wrapped attribution and navigation below it. An earlier Discovery map load failed while the list stayed available; its provider cause was not diagnosed. Font was restored to1.0.

## Realtime diagnosis and separate server gates

Run36335592934 at1108c490 confirmed the first canonical RPC returned200, the message persisted and invalidation revision advanced, but no subscribed client received it. Certificate/schema/program/function digests were unchanged; only publication snapshots differed. This remains a failed wire proof.

Pinned Realtime2.129.3 source shows that channel join precedes asynchronous PostgreSQL registration and that the service lazily initializes its own publication. Harness601d78f6 now waits for actual system-OK, four exact session registrations and prepared replication slots. Only the exact internal Realtime publication initialization is admitted before the baseline; all preexisting publication rows and final certificate/source equality remain strict. Candidate SQL is unchanged. Run36336794390 subsequently passed actual Realtime delivery/denial:12 known-message watermarks,7 heartbeat barriers and21 body-free events. See ROUND_20_B3C_WIRE_RECEIPT.json. This is disposable-only proof, not deployment or certified-erasure acceptance. No live application/client subscription is authorized by this work.

## Status and next step

Closure source and focused checks pass; corrected Profile semantics and ordinary settings return are observed on the exact older APK. The next consolidated emulator build must accept the closure dismissal and multi-point map scenes. Whole-product, physical-phone, live private-route, voice, same-message push, load and store acceptance remain open. P0 application still requires the pending explicit `primeni`. The control table is generated locally; the hosted file-chooser failure still prevents confirmed publication.
