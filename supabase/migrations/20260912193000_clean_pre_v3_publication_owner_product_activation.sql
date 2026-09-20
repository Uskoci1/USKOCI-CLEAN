-- USKOČI D-0140-B / owner product-policy activation.
-- Forward-only authorized operation. This is NOT a legal opinion/certification.
-- It activates the already owner-locked 16-rule minimum exactly as registered:
-- ordinary low-risk may ALLOW; illegal/dangerous BLOCK; ambiguity CLARIFY;
-- regulated/unresolved cases REVIEW. No rule outcome is weakened or invented.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $precondition$
declare
  v_id uuid;
  v_refs integer;
  v_source text;
begin
  select b.id,b.review_provenance->>'source_sha256'
    into v_id,v_source
  from private.publication_policy_bundles b
  where b.policy_id='RS_PUBLICATION_POLICY_MINIMUM'
    and b.jurisdiction='RS'
    and b.version=1
  for update;
  if v_id is null then raise exception 'D0140B_BUNDLE_MISSING'; end if;
  if v_source is distinct from '792597eb4b5b940238f784587c9431613d3a71bdd7f662e9439fdbed134bd2aa' then
    raise exception 'D0140B_SOURCE_DIGEST_MISMATCH';
  end if;
  select count(*) into v_refs from private.publication_policy_rule_refs r where r.bundle_id=v_id;
  if v_refs<>16 then raise exception 'D0140B_RULE_SET_INCOMPLETE'; end if;
  if exists (
    select 1 from private.publication_policy_rule_refs r
    where r.bundle_id=v_id
      and (r.rule_provenance->>'outcome') not in ('ALLOW','BLOCK','CLARIFY','REVIEW','NO_OVERRIDE')
  ) then raise exception 'D0140B_RULE_OUTCOME_INVALID'; end if;
  if exists (
    select 1 from private.publication_policy_rule_refs r
    where r.bundle_id=v_id and r.rule_id='RS-MIN-001'
      and r.rule_provenance->>'outcome'<>'ALLOW'
  ) or exists (
    select 1 from private.publication_policy_rule_refs r
    where r.bundle_id=v_id and r.rule_id in ('RS-MIN-002','RS-MIN-003','RS-MIN-004','RS-MIN-006','RS-MIN-007','RS-MIN-008','RS-MIN-009','RS-MIN-010','RS-MIN-011')
      and r.rule_provenance->>'outcome'<>'BLOCK'
  ) or exists (
    select 1 from private.publication_policy_rule_refs r
    where r.bundle_id=v_id and r.rule_id in ('RS-MIN-005','RS-MIN-012','RS-MIN-013')
      and r.rule_provenance->>'outcome'<>'CLARIFY'
  ) or exists (
    select 1 from private.publication_policy_rule_refs r
    where r.bundle_id=v_id and r.rule_id in ('RS-MIN-014','RS-MIN-016')
      and r.rule_provenance->>'outcome'<>'REVIEW'
  ) or exists (
    select 1 from private.publication_policy_rule_refs r
    where r.bundle_id=v_id and r.rule_id='RS-MIN-015'
      and r.rule_provenance->>'outcome'<>'NO_OVERRIDE'
  ) then raise exception 'D0140B_FROZEN_RULE_OUTCOMES_CHANGED'; end if;
end
$precondition$;

update private.publication_policy_bundles b
set is_reviewed=true,
    is_complete=true,
    is_active=true,
    reviewed_at=statement_timestamp(),
    effective_from=statement_timestamp(),
    activated_at=statement_timestamp(),
    review_provenance=b.review_provenance || jsonb_build_object(
      'review_state','OWNER_PRODUCT_APPROVED_NOT_LEGAL_CERTIFICATION',
      'approved_by','USKOCI_PRODUCT_OWNER',
      'approval_date','2026-09-12',
      'approval_scope','PRODUCT_PUBLICATION_MINIMUM_RS_V1',
      'legal_certification',false,
      'activation_authority','Owner explicitly requested publication rules be approved and technical publication blocking removed; regulated/high-risk cases remain REVIEW/BLOCK.',
      'activated_by','20260912193000_clean_pre_v3_publication_owner_product_activation'
    )
where b.policy_id='RS_PUBLICATION_POLICY_MINIMUM'
  and b.jurisdiction='RS'
  and b.version=1;

do $postcondition$
declare
  v_id uuid;
  v_current uuid;
begin
  select b.id into v_id from private.publication_policy_bundles b
  where b.policy_id='RS_PUBLICATION_POLICY_MINIMUM' and b.jurisdiction='RS' and b.version=1;
  if not private.publication_policy_bundle_ready(v_id,'RS',statement_timestamp()) then
    raise exception 'D0140B_READY_FALSE';
  end if;
  v_current:=private.current_publication_policy_bundle('RS_PUBLICATION_POLICY_MINIMUM','RS',statement_timestamp());
  if v_current is distinct from v_id then raise exception 'D0140B_CURRENT_BUNDLE_MISMATCH'; end if;
  if (select b.review_provenance->>'legal_certification' from private.publication_policy_bundles b where b.id=v_id) is distinct from 'false' then
    raise exception 'D0140B_PROVENANCE_MUST_NOT_CLAIM_LEGAL_CERTIFICATION';
  end if;
  if has_table_privilege('anon','private.publication_policy_bundles','SELECT')
     or has_table_privilege('authenticated','private.publication_policy_bundles','SELECT')
     or has_table_privilege('service_role','private.publication_policy_bundles','SELECT') then
    raise exception 'D0140B_PRIVATE_POLICY_TABLE_EXPOSED';
  end if;
end
$postcondition$;
commit;
