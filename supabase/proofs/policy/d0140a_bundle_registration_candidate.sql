-- D-0140-A: register the owner-locked RS publication policy minimum (V1) as
-- an UNREVIEWED, INCOMPLETE, INACTIVE bundle with its sixteen stable rule ids.
-- Rule ids and outcomes are copied verbatim from
-- docs/implementation/ru3/RS_PUBLICATION_POLICY_MINIMUM_OWNER_LOCK_V1.md
-- (status OWNER_LOCKED_MINIMUM / NOT_PRODUCTION_ACTIVATED, blob sha256
-- 792597eb4b5b940238f784587c9431613d3a71bdd7f662e9439fdbed134bd2aa).
-- No rule text, no review stamp, no activation: the RU-3 resolver keeps
-- returning NULL, need publication and RU-4B Q&A stay fail-closed. Review,
-- completeness and activation are authorized-operations acts on this row,
-- and ALLOW decisions stay refused by rpc_record_need_publication_decision_service
-- (RU3_ALLOW_NOT_ENABLED) until that separate gate is lifted.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $precondition$
begin
  if to_regclass('private.publication_policy_bundles') is null
     or to_regclass('private.publication_policy_rule_refs') is null then
    raise exception 'D0140A_PREDECESSOR_TABLES_MISSING';
  end if;
  if to_regprocedure('private.current_publication_policy_bundle(text,text,timestamptz)') is null
     or to_regprocedure('private.publication_policy_bundle_ready(uuid,text,timestamptz)') is null then
    raise exception 'D0140A_PREDECESSOR_RESOLVER_MISSING';
  end if;
  if exists (select 1 from private.publication_policy_bundles b
             where b.policy_id='RS_PUBLICATION_POLICY_MINIMUM' and b.jurisdiction='RS' and b.version=1) then
    raise exception 'D0140A_BUNDLE_ALREADY_REGISTERED';
  end if;
end
$precondition$;

insert into private.publication_policy_bundles(policy_id,version,jurisdiction,is_reviewed,is_complete,is_active,review_provenance)
values(
  'RS_PUBLICATION_POLICY_MINIMUM',1,'RS',false,false,false,
  jsonb_build_object(
    'source','docs/implementation/ru3/RS_PUBLICATION_POLICY_MINIMUM_OWNER_LOCK_V1.md',
    'source_sha256','792597eb4b5b940238f784587c9431613d3a71bdd7f662e9439fdbed134bd2aa',
    'source_status','OWNER_LOCKED_MINIMUM / NOT_PRODUCTION_ACTIVATED',
    'registered_by','20260908170000_clean_d0140a_policy_bundle_registration',
    'review_state','PENDING_LEGAL_REVIEW',
    'activation_rule','is_reviewed, is_complete and is_active are set only by authorized operations after review; ALLOW additionally requires the RU-3 service gate to be lifted'
  )
);

insert into private.publication_policy_rule_refs(bundle_id,rule_id,rule_provenance)
select b.id, r.rule_id,
       jsonb_build_object(
         'outcome',r.outcome,
         'source','docs/implementation/ru3/RS_PUBLICATION_POLICY_MINIMUM_OWNER_LOCK_V1.md',
         'source_sha256','792597eb4b5b940238f784587c9431613d3a71bdd7f662e9439fdbed134bd2aa',
         'content','NOT_SEEDED: rule text lives in the owner-locked source document only'
       )
from private.publication_policy_bundles b
cross join (values
  ('RS-MIN-001','ALLOW'),
  ('RS-MIN-002','BLOCK'),
  ('RS-MIN-003','BLOCK'),
  ('RS-MIN-004','BLOCK'),
  ('RS-MIN-005','CLARIFY'),
  ('RS-MIN-006','BLOCK'),
  ('RS-MIN-007','BLOCK'),
  ('RS-MIN-008','BLOCK'),
  ('RS-MIN-009','BLOCK'),
  ('RS-MIN-010','BLOCK'),
  ('RS-MIN-011','BLOCK'),
  ('RS-MIN-012','CLARIFY'),
  ('RS-MIN-013','CLARIFY'),
  ('RS-MIN-014','REVIEW'),
  ('RS-MIN-015','NO_OVERRIDE'),
  ('RS-MIN-016','REVIEW')
) as r(rule_id,outcome)
where b.policy_id='RS_PUBLICATION_POLICY_MINIMUM' and b.jurisdiction='RS' and b.version=1;

do $postcondition$
declare
  v_bundle uuid;
  v_refs integer;
begin
  select b.id into v_bundle from private.publication_policy_bundles b
  where b.policy_id='RS_PUBLICATION_POLICY_MINIMUM' and b.jurisdiction='RS' and b.version=1;
  select count(*) into v_refs from private.publication_policy_rule_refs r where r.bundle_id=v_bundle;
  if v_refs<>16 then
    raise exception 'D0140A_POSTCONDITION_FAILED: expected 16 rule refs, found %', v_refs;
  end if;
  if private.current_publication_policy_bundle('RS_PUBLICATION_POLICY_MINIMUM','RS',statement_timestamp()) is not null then
    raise exception 'D0140A_POSTCONDITION_FAILED: unreviewed bundle must not resolve as current';
  end if;
  if private.publication_policy_bundle_ready(v_bundle,'RS',statement_timestamp()) then
    raise exception 'D0140A_POSTCONDITION_FAILED: unreviewed bundle must not be ready';
  end if;
end
$postcondition$;

commit;
