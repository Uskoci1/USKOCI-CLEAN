# USKOČI Control v0

Read-only Development Monitor for the canonical USKOČI project.

## Safety boundary

- separate branch: `control/uskoci-control-v0-20261004`
- no writes to canonical DEV or the canonical app branch
- no Supabase secret/service-role key in the browser
- runtime reads only public GitHub control artifacts
- `dev_snapshot.json` is shown as a dated snapshot, never as a direct live DEV read
- HEAD/snapshot mismatch is surfaced explicitly as stale

## Current sources

- `work/uskoci-ui-unification-20260924` branch HEAD
- `docs/control/stanje.json`
- `docs/control/dev_snapshot.json`
- `docs/control/master-plan-live-state.json`

## Next stage

Private Users / Tasks / Applications / Agreements / Matching / Push / AI data will require a server-side authenticated read-model. Do not expose privileged Supabase keys to the browser.
