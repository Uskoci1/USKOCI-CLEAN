# Public task column privacy — continuation of deep-read 7.17

Status: **investigated; no fix implemented or applied**.

Canonical DEV was read after PKG-033 (ledger 189). The catalog currently contains **41** live, non-dropped
columns on public.needs; authenticated has SELECT on all of them through its table grant. The earlier
ledger's “42 columns” is not the current measured count. The substantive exposure remains.

## Measured boundary

- needs_public_discovery permits same-world authenticated accounts to read PUBLISHED/SELECTION rows.
- Owner and participant SELECT policies add their own visibility. The closed-account policy is restrictive.
- The table grant exposes requester_account_id, remaining_search_closed_by_account_id and free-text
  remaining_search_close_reason, irrespective of which fields the app chooses to display.
- There are 7 PUBLISHED/SELECTION rows at this measurement, 0 with a nonempty close reason and 0 with
  remaining_search_closed_at. These are global aggregate counts, not a stranger impersonation test.
- No account was impersonated and no user row was changed.

## Read complete bodies before selecting an approach

- public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid) is SECURITY INVOKER. Both bounded list
  branches SELECT m.* and call public.covered_slots(m). Its JSON projection is narrow, but SQL privileges
  are checked before projecting that JSON.
- public.covered_slots(public.needs) is a SECURITY DEFINER computed field; it only uses n.id to sum
  SELECTED selections. Its composite argument matters to PostgREST's generated query.
- public.fn_need_covered_slots(uuid) computes the same sum from the UUID.
- private.viewer_same_world(uuid) checks the caller with auth.uid() through accounts_same_world.
- The closure source digest includes its schema digest and certified functions. It does not explicitly
  list these two readers; any proposed grant/policy/function change still needs a full disposable digest test.

## Existing client dependencies

- needClientService.mojePotrebe filters needs.requester_account_id and orders created_at. Removing SELECT
  on either breaks this read even when the column is absent from its output projection.
- needClientService.potreba and supabaseIzvor.prilika request the covered_slots computed field and embed
  geography/requirements. Revoking whole-row access must be tested through the actual REST query,
  not only a direct SQL projection.
- myApplicationsClientService reads revision-bound pricing through needs!inner. This protects the new
  PKG-033 edit composer and must keep its current revision guard.
- ru4Production.remainingSearchState reads remaining_search_closed_at directly.
- The public detail's legitimate contract includes description, revision and lifecycle capabilities in
  addition to list-card fields. The fix must define an explicit public DETAIL allowlist as well.

## Required implementation proof

Prefer explicit public/owner readers with a narrow authority contract over a blind table REVOKE.
Whichever approach is selected, prove on the disposable API:

1. Same-world stranger: safe detail/list remain readable; excluded columns and SELECT * do not disclose data.
2. Other world and restricted account: remain denied.
3. Owner: own list, draft/detail/edit context and filters work.
4. Participant: previously permitted historical task detail still works.
5. Computed coverage, geography embeds and PKG-033 version-bound pricing still work via actual REST queries.
6. New and old-client compatibility is stated; schema cache refreshed; closure digest and authority surface verified.

Do not mark 7.17 closed based on this investigation or on an allowlisted UI SELECT alone.

## Follow-up after PKG-035 (ledger 191)

Read the actual `supabaseIzvor.prilika`, owner query, revision-bound application join and
`ru4Production.remainingSearchState` again. Public detail still reads `needs` directly; merely making
the list RPC a definer and removing public discovery would break detail on installed clients.
The four current SELECT policies are owner, participant, same-world PUBLISHED/SELECTION discovery
(permissive), plus `rpc_storage_account_open()` (restrictive). No policy was changed.

PKG-035 adds another existing-query dependency: `selectable_application_count(needs)`. It returns a count
only for the stored owner (foreign null), and its actual PostgREST query was proved in run35658331088.
Any privacy change must retain that computed field for owners as well as the original coverage field.
This new field does not fix the broader table grant. Do not conflate per-field owner checks with a
safe table boundary or silently break older owner/public-detail clients during the rollout.
