# PKG-030: the Edge workers take the secret key

**Owner decision, 2026-09-21.** The owner answered "kreni" to option A of a written report. Option A:
- the workers take the server key on the `apikey` header;
- the tick sends the key there;
- JWT verification is switched off in front of the three workers, and each worker checks the key itself;
- the owner then stores the project's secret key in Vault, in place of the legacy key.

No key is created, rotated or changed. The value in Vault becomes another key the project already has.

## What was measured on canonical DEV

The owner stored the legacy `service_role` key in Vault, as PKG-028 asked. It was read inside SQL and never printed:
- it is a JWT with role `service_role` and ref `leqcwgzvjsxugfgzdmth`;
- its issue time is the same as the project's legacy `anon` key;
- the legacy keys are not disabled.

One direct call to each worker still failed:

| worker | answer |
| --- | --- |
| `uskoci-push-transport` | 403 `FORBIDDEN` |
| `uskoci-data-export-worker` | 401 `AUTH_REQUIRED`; Auth then refused the service JWT ("missing sub claim") |
| `uskoci-account-closure-worker` | 403 `SERVICE_ROLE_REQUIRED` |

The cause: on this project the Edge runtime's `SUPABASE_SERVICE_ROLE_KEY` is the new secret key, not the legacy JWT.
- `uskoci-ai-interview` sends `SUPABASE_SERVICE_ROLE_KEY` as its `apikey`.
- The gateway logs (`edge_logs`, `request.sb.apikey.apikey.prefix`) record those calls with the prefix `sb_secret_` and no
  JWT.
- All three workers compare the caller's key with that value, so the legacy key can never match.

The secret key cannot simply be stored instead. With `verify_jwt` on, the gateway parses `Authorization: Bearer
sb_secret_…` as a JWT and refuses it before any worker runs. Supabase documents this, and says what to do instead:
- a `pg_net` caller sends the secret key on the `apikey` header;
- the function runs with `verify_jwt = false` and checks the key itself.

The legacy keys are retired at the end of 2026.

## What changes

| where | before | after |
| --- | --- | --- |
| `_shared/data-export.ts` (export and closure workers) | internal only with `Authorization: Bearer <server key>` | also with `apikey: <server key>`. Both headers are compared in constant time. A person's Bearer is handled exactly as before. |
| `uskoci-push-transport` | the same, as a plain string comparison | the same two headers, compared in constant time |
| `private.edge_worker_tick_v5` (`pkg030a`) | sends `Authorization: Bearer <key>` | sends `apikey: <key>`. Nothing else in the function changed. |
| gateway, three workers | `verify_jwt = true` | `verify_jwt = false`. Each worker refuses a call without the key by itself. |
| gateway, `uskoci-data-export-download` | `verify_jwt = true` | unchanged. Redeployed only so that its copy of the shared file equals the repository. |

**Why switching the gateway check off does not open anything:**
- The push and closure workers never had a path for anyone but the server.
- The export worker's path for a person already asks Auth who the person is (`/auth/v1/user`) before anything else.
  The gateway check was a second copy of that question.

The e2e proof shows each case against the real served workers:
- a call without a key is refused;
- a forged token is refused;
- a signed-in person reaches only their own export path;
- a person is never taken for the service.

## Proof

- Workflow: `.github/workflows/pkg030-workers-secret-key-proof.yml`.
- Script: `supabase/proofs/pkg030/pkg030_proof.mjs`.
- Disposable stack only.

**`gate`** (no database, no network)
- **Environment:** the three workers are compiled from their exact source in an environment shaped like canonical
  DEV's: the server key is `sb_secret_…` and the anon key is `sb_publishable_…`.
- **Cases:** each worker is asked in ten ways:
  - the secret key on `apikey`;
  - the secret key as a Bearer;
  - the legacy JWT as a Bearer, and on `apikey`;
  - no key;
  - the key with one character added, or one removed;
  - the key in another header;
  - a signed-in person;
  - the publishable key alone.
- **Before:** on the source canonical DEV runs (`2a22deb3`), the answers reproduce DEV exactly:
  - the legacy key gets 403 / 401 / 403;
  - the secret key on `apikey` is refused by all three;
  - only the secret key as a Bearer is accepted, and the gateway refuses that form.
- **After:** exactly three rows differ from before: the secret key on `apikey`, now accepted by each worker. Every
  other answer, and every request a worker makes, is identical.

**Database**
- **replay:** source 147 plus every dev_alpha row up to PKG-029, from the exact texts canonical DEV recorded. The tick
  and the 18 bodies around it equal canonical DEV's.
- **apply:**
  - a tampered pin is refused and leaves nothing behind;
  - the candidate applies, and a second application is refused;
  - the surface changes by the tick only;
  - privileges, security and schedule are unchanged;
  - the certified closure digest does not move.

**e2e** (the workers served with `--no-verify-jwt`)
- the refusals and the person's paths above;
- a wrong key sent by the tick is refused, and nothing moves;
- with the right key on `apikey`:
  - the cron-fired tick reaches the closure worker;
  - a confirmed deletion runs to `CLOSED` on the tick alone;
  - the push worker answers for its own switch;
  - the export worker accepts the request the database sends.

## Status on canonical DEV (2026-09-21, stopped part-way)

- **Proof:** passed, run https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35636346590 (source `a28aa71b`).
- **Step 1, done.** `pkg030a` applied as `20260921181654_dev_alpha_pkg030a_edge_workers_apikey`.
  - Its ledger text has sha256 `04daaad8…`, the committed file without its final newline.
  - Ledger **184 = 147 + 37**.
  - The tick body md5 is `f9485392…`, and it sends the key only on `apikey`. Its privileges and schedule are unchanged.
  - The certified digest `67730f62` is live, equals the certified value, and is ready.
- **Step 2, partial.**
  - `uskoci-push-transport` was deployed as v14 with `verify_jwt = false`, from the committed bytes.
  - The byte readback of v14 was **not** done: the session's automatic permission check refused `get_edge_function`
    as weakening authentication.
  - The export, closure and download functions were **not** deployed. They still run the previous code with
    `verify_jwt = true`.
  - Work stopped there to ask the owner.
- **Effect meanwhile:** none on people. The tick sends the stored legacy key on `apikey`, and every worker still refuses
  it, as before. Nothing is claimed or deleted. A caller without the server key is refused by the push worker itself
  (the gate and e2e proofs).

## Order on canonical DEV

1. Apply `pkg030a`. The tick then sends the key on `apikey`. The stored legacy key is still refused, as today.
2. Deploy the three workers with `verify_jwt = false`, and the download function with `verify_jwt = true`. Read each
   file back and byte-compare it with the committed tree.
3. Check on DEV without any key: each worker must answer with its own refusal. A gateway 401 would mean the check is
   still on.
4. **Owner:** in the Supabase SQL editor, replace the stored value with the project's secret key (Project Settings →
   API Keys → secret keys). Paste it yourself; nobody else sees it:
   `select vault.update_secret((select id from vault.secrets where name = 'uskoci_edge_worker_key'), '<secret key>');`
5. Final check: one direct call to each worker, composed inside the database so that the key is never printed.
   - push: `DISABLED` (its switch is off by the owner's decision);
   - export: `TICK_COMPLETED`;
   - closure: `MAINTENANCE_CHECKED` if `USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED=true`, otherwise `DISABLED`.
