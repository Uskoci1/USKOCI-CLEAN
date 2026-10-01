# Voice messages — B1 server package applied to canonical DEV (receipt, 2026-10-01)

**Status: APPLIED TO CANONICAL DEV `leqcwgzvjsxugfgzdmth` ON THE OWNER'S `PRIMENI`; BOTH EDGE FUNCTIONS DEPLOYED AND BYTE-VERIFIED BEFORE IT; POSTFLIGHT EMPTY; CLOSURE/PRIVACY CERTIFICATE RE-BOUND IN ALL THREE PLACES. THE CLIENT VOICE FLAG IS STILL OFF, NO DEVICE WAS USED, NO VOICE MESSAGE WAS SENT, NOTHING WAS DONE ON PRODUCTION.**

Machine-readable twin: `supabase/operations/dev-alpha/ledger/20261001_chat_voice_b1_application.receipt.json`. The proofs, exact bytes and the rollback design are in [VOICE_B1_B2A_CHECKPOINT_RECEIPT_20261001.md](VOICE_B1_B2A_CHECKPOINT_RECEIPT_20261001.md); the plan is [VOICE_B1_B2_PLAN_20260930.md](VOICE_B1_B2_PLAN_20260930.md).

## 1. The owner's word and its limits

On 2026-10-01 the owner wrote, in chat: "PRIMENI — ODOBRAVAM CEO DOKAZANI VOICE B1 SERVER PAKET NA DEV." in this exact order: (1) deploy `uskoci-account-closure-worker`; (2) read it back and compare byte for byte with git; (3) deploy `uskoci-media`; (4) read back and compare; (5) a fresh read-only DEV preflight; (6) only if all green, apply `supabase/candidates/chat_voice_b1_dev_application.sql` as ONE atomic migration, ledger 214 → 215; (7) full postflight/readback; (8) confirm the new closure/privacy digest in all three places; (9) the final receipt; (10) `redovi.json` and the LIVE plan, `--check`. His approval explicitly includes the certificate re-bind that is part of the application.

It excluded everything else: no extra change; the client Voice flag stays off; no existing message, task, agreement, profile or account is touched and no destructive account-deletion test runs over shared DEV data; the revert is not applied unless a real need arises and then only on a separate `PRIMENI`; nothing on PROD; no secret, provider or paid service; UI, B2-b, B2-c, the HONOR, legal wording and the iOS microphone text stay out. Any mismatch of a byte readback, pin, digest, preflight or postflight meant stop at once.

**One interruption.** After step 5 and before step 6 the owner wrote "PAUZIRAJ RAD GDE SI STIGAO". Work stopped with nothing applied (read-only recheck at 04:17:09Z: ledger 214, digest `707af7fc…`, no voice table, column or bucket). He then wrote "nastavi" and step 6 ran. **On the earlier attempt** the auto-mode classifier had denied the connector Edge deploy on a bare "Primeni"; nothing was circumvented, and after the explicit package approval above the connector deploys were allowed.

## 2. Timeline (UTC, 2026-10-01)

| Time | Step |
| --- | --- |
| 04:07:10 | `uskoci-account-closure-worker` v3 → **v4** deployed (3 files, `verify_jwt` false) |
| 04:11:51 | `uskoci-media` v13 → **v14** deployed (3 files, `verify_jwt` true) |
| 04:13:11 | fresh read-only DEV preflight: `problems []`, 25 metadata + 26 body pins, ledger 214, certified = live = `707af7fc…`, ready, binding matches, 0 closures executing |
| 04:17:09 | read-only recheck as the owner's pause arrived (ledger 214, no voice object) |
| 06:58:00 | **`apply_migration` `dev_alpha_chat_voice_b1_dev_application`, version `20261001065800`, ledger 215** |
| 06:59:09 | read-only postflight: `problems []` |
| 07:00:10 | digest in all places and data state read; 07:00:25 security advisors; 07:03:07 DEV snapshot regenerated |

## 3. Edge functions (steps 1–4)

Both were deployed through the Supabase connector and read back with `get_edge_function`; every file was compared with `git show HEAD:supabase/<path>` and is **byte-equal, CRLF included**: worker `index.ts` (2,206 B, `0f87d3ab…`), `closure.ts` (9,979 B, `3bed4aac…`), `_shared/data-export.ts` (11,262 B, `44a09fb2…`); media `index.ts` (38,389 B, `2fb26252…`), `_shared/mediaImageSanitizer.mjs` (3,222 B, `9db536a2…`), `_shared/voiceM4a.mjs` (12,324 B, `f3b07384…`). Platform bundle hashes: worker `9f7373f9…ae11`, media `34e4a231…d1ac`. None of the six files contains a backslash-u sequence, so the known connector behaviour of resolving literal escapes could not have changed any of them. **Evidence limit:** the media readback was saved to a file by the harness; the worker readback was compared from a file into which I copied the tool output (JSON escapes kept), then compared with git. `list_edge_functions` afterwards: 11 ACTIVE functions, the same slugs, only these two changed version.

## 4. The application (steps 5–6)

The text sent was an integrity guard (605 characters, a DO block that hashes `substr(current_query(), marker, 97325)` and refuses unless it equals the candidate's sha256) followed by the candidate. **The guard passed on the first attempt and the whole statement committed.** The stored ledger row: 1 statement of 97,931 characters; the candidate span starts at character 606; the database-computed sha256 of that span is `e0221f33b1fc5310b863a5fd5d7845b10d10db69e3a6a7d8627cd9c2e938aabe`, equal to the trimmed candidate (blob `416ba145…898e`, 97,331 bytes): stored byte for byte; the connector appended nothing. The statement's own in-transaction work (25 metadata pins, 26 body pins, the proved B1-a and B1-b fragments, the three-place re-bind, delta accounting 1/4 to 4/4 and the post-state pins) all passed, otherwise nothing would have committed.

No separate preflight was repeated between "nastavi" and the apply (about 2 h 45 min after the fresh one); the statement re-pinned the same predecessor inside its own transaction under share locks, which is why a drift could only have raised and applied nothing.

## 5. Postflight and the certificate (steps 7–8)

`voice_b1_dev_postflight.readonly.sql` (sha256 `3472171c…5b22`, run unchanged from git): **`problems: []`**, 13 applied-body pins, 15 voice-function pins, 4 trigger pins, 52 export datasets, ledger 215, Postgres 17.6.

**New certified digest: `58447d7730e909a0c0e60dd92ef77416af927471bd6f645988448e32c6e3cb46`** (old: `707af7fc…33e1`, bound nowhere now). It is equal in all three places and in the two live checks, read directly:

| Place | Value |
| --- | --- |
| `private.closure_source_v5.sha256` | `58447d77…cb46` |
| `private.closure_erasure_source_v5.sha256` | `58447d77…cb46` |
| the single 64-hex literal in `private.retention_ai_source_ready()` | `58447d77…cb46` |
| `private.closure_source_digest_v5()` (live) | `58447d77…cb46` |
| `private.closure_erasure_binding_v5()->>'sourceSha256'` | `58447d77…cb46`, readiness `true` |

The digest hashes database-local type and role oids, so it differs from every disposable chain; what the proofs established was the catalog result, and the transaction computed the digest.

## 6. State and existing data

Unchanged: 8 agreements and 10 messages as before (none with a voice asset), no account, task, profile or session row touched. New and empty: `private.agreement_voice_uploads_v1` 0 rows, 0 voice messages, 0 objects in `agreement-voice`; 3 buckets, all private; 0 closure executions; the 4 voice triggers present; 0 functions mention `40001` (the B24 rule holds in the new bodies). The only data writes are the ones the package declares: the new bucket row, one retention-catalog row (`MEDIA_OBJECTS` relations) and the two certificate rows.

Security advisors after the change: the same five lint names as before (`anon_` and `authenticated_security_definer_function_executable`, `auth_leaked_password_protection`, `extension_in_public`, `rls_enabled_no_policy`); the new objects appear only inside them, by design: the upload table under `rls_enabled_no_policy` (deny-all), and the three authenticated voice/history RPCs under `authenticated_security_definer_function_executable`. No new lint name.

## 7. What this does not prove, and what stays closed

- No voice message was sent, no upload was made, and no HTTP/JWT-level call of the new RPCs or of the Edge voice operations was made. Hosted-runtime behaviour is proved only by the disposable chain and by the in-transaction accounting.
- No real account closure was run after the re-bind (shared DEV: it needs his word); the in-transaction checks stand in for it.
- The client Voice flag `EXPO_PUBLIC_VOICE_MESSAGES` is off in every build. B2-b (native recording and playback), B2-c (UI), the HONOR run, the legal wording LEG-09..12 and the iOS microphone text are untouched. A build that knows only V1 would show a voice row as TEXT with "Glasovna poruka. Ažuriraj aplikaciju da je poslušaš." (none exists). Support never hears voice.
- Production: nothing. The same package (with B24 part 1 and 2) must be applied to any future production project, after its own proof, before its first real user.
- Dependencies, providers, payments and secrets: unchanged; `expo-audio` remains conditionally approved only. The two privacy branches deferred to the final whole-app privacy pass are unaffected.

## 8. Rollback

`supabase/candidates/chat_voice_b1_revert.sql` (sha256 `ab22e08f…d1173`) is proven (run 36789867392) and **not applied**; it needs its own `PRIMENI`, refuses while any voice data exists, restores the 14 pre-image definitions, the 2 CHECKs and the catalog row, and re-binds the certificate. It is valid only while no later package changes the closure surface or the 13 rewritten functions. Redeploying worker v3 and media v13 is a separate owner decision.

## 9. Registry

`docs/control/redovi.json` (chat row and the `voice_b1_b2` block), `docs/control/master-plan-live-state.json` and the LIVE plan are updated and checked in the same commit; `docs/control/dev_snapshot.json` is regenerated at ledger 215. Next in the owner's order: EX-04 Posao / personal lists (source, client, tests and disposable proof first; a DEV apply needs a new explicit `PRIMENI`).
