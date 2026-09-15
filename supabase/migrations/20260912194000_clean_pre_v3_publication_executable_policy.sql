-- USKOČI D-0140-C / executable publication policy binding.
-- Forward-only. Converts the already owner-approved 16-rule V1 minimum into
-- the exact bounded evaluator document expected by W05. It does NOT add legal
-- certification and does NOT change any frozen product outcome.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $precondition$
declare
  v_bundle uuid;
  v_refs integer;
begin
  select b.id into v_bundle
  from private.publication_policy_bundles b
  where b.policy_id='RS_PUBLICATION_POLICY_MINIMUM'
    and b.jurisdiction='RS' and b.version=1
  for update;
  if v_bundle is null then raise exception 'D0140C_BUNDLE_MISSING'; end if;
  if not private.publication_policy_bundle_ready(v_bundle,'RS',statement_timestamp()) then
    raise exception 'D0140C_BUNDLE_NOT_OWNER_APPROVED';
  end if;
  if (select b.review_provenance->>'review_state' from private.publication_policy_bundles b where b.id=v_bundle)
       is distinct from 'OWNER_PRODUCT_APPROVED_NOT_LEGAL_CERTIFICATION' then
    raise exception 'D0140C_OWNER_APPROVAL_PROVENANCE_MISSING';
  end if;
  if (select b.review_provenance->>'legal_certification' from private.publication_policy_bundles b where b.id=v_bundle)
       is distinct from 'false' then
    raise exception 'D0140C_MUST_NOT_CLAIM_LEGAL_CERTIFICATION';
  end if;
  select count(*) into v_refs from private.publication_policy_rule_refs r where r.bundle_id=v_bundle;
  if v_refs<>16 then raise exception 'D0140C_RULE_SET_INCOMPLETE'; end if;
end
$precondition$;

update private.publication_policy_bundles b
set review_provenance=b.review_provenance || jsonb_build_object(
  'evaluatorPolicy',jsonb_build_object(
    'schemaVersion','USKOCI_PUBLICATION_POLICY_V1',
    'instructions',
      'Classify only whether the saved USKOCI Zadatak may enter public marketplace inventory in Serbia under this owner-approved minimum product policy. Apply every relevant rule. ALLOW only a clear concrete requested task with no prohibited, ambiguous, high-risk or unresolved regulated signal. BLOCK explicit prohibited or unlawful objectives and non-task listings. CLARIFY correctable public wording/privacy problems or materially unclear requests. REVIEW unresolved regulated/high-risk cases. HITNO never overrides another rule. This product policy is not legal certification and must fail closed when applicability is uncertain.'
  ),
  'evaluator_binding','OWNER_LOCKED_RS_MINIMUM_V1_EXECUTABLE',
  'evaluator_binding_date','2026-09-12'
)
where b.policy_id='RS_PUBLICATION_POLICY_MINIMUM' and b.jurisdiction='RS' and b.version=1;

update private.publication_policy_rule_refs r
set rule_provenance=r.rule_provenance || jsonb_build_object(
  'evaluation',
  case r.rule_id
    when 'RS-MIN-001' then jsonb_build_object('instructions','Clear concrete request for another person to perform a task or service, with no prohibited, ambiguous, unresolved regulated or high-risk signal.','outcomes',jsonb_build_array('ALLOW'),'safeReasonCodes',jsonb_build_array('CLEAR_CONCRETE_TASK'))
    when 'RS-MIN-002' then jsonb_build_object('instructions','The public text is actually a service offer or self-advertisement rather than a request for someone else to perform a Zadatak.','outcomes',jsonb_build_array('BLOCK'),'safeReasonCodes',jsonb_build_array('SERVICE_OFFER_NOT_TASK'))
    when 'RS-MIN-003' then jsonb_build_object('instructions','Sale, rental or classified listing rather than a requested service task.','outcomes',jsonb_build_array('BLOCK'),'safeReasonCodes',jsonb_build_array('CLASSIFIED_LISTING'))
    when 'RS-MIN-004' then jsonb_build_object('instructions','Spam, promotion, referral, affiliate content or unrelated advertising.','outcomes',jsonb_build_array('BLOCK'),'safeReasonCodes',jsonb_build_array('SPAM_OR_ADVERTISING'))
    when 'RS-MIN-005' then jsonb_build_object('instructions','Profanity or vulgar wording in an otherwise potentially acceptable task, without targeted abuse. Require cleaned public wording before publication.','outcomes',jsonb_build_array('CLARIFY'),'safeReasonCodes',jsonb_build_array('CLEAN_PUBLIC_WORDING'))
    when 'RS-MIN-006' then jsonb_build_object('instructions','Targeted insult, harassment, humiliation, hateful abuse or discriminatory abuse toward a person or group.','outcomes',jsonb_build_array('BLOCK'),'safeReasonCodes',jsonb_build_array('TARGETED_ABUSE'))
    when 'RS-MIN-007' then jsonb_build_object('instructions','Threat, intimidation, violence, or a request to harm or frighten someone.','outcomes',jsonb_build_array('BLOCK'),'safeReasonCodes',jsonb_build_array('THREAT_OR_VIOLENCE'))
    when 'RS-MIN-008' then jsonb_build_object('instructions','Theft, fraud, forgery, deceptive impersonation, tax evasion or another explicit request to bypass the law.','outcomes',jsonb_build_array('BLOCK'),'safeReasonCodes',jsonb_build_array('ILLEGAL_CIRCUMVENTION'))
    when 'RS-MIN-009' then jsonb_build_object('instructions','Stalking, covert surveillance abuse, doxxing, or obtaining or exposing another person private data without lawful authority.','outcomes',jsonb_build_array('BLOCK'),'safeReasonCodes',jsonb_build_array('PRIVACY_ABUSE'))
    when 'RS-MIN-010' then jsonb_build_object('instructions','Sexual exploitation, trafficking, paid sexual-service objective, or sexual content involving minors.','outcomes',jsonb_build_array('BLOCK'),'safeReasonCodes',jsonb_build_array('SEXUAL_EXPLOITATION'))
    when 'RS-MIN-011' then jsonb_build_object('instructions','Illegal drugs or controlled-substance bypass, harmful weapons or ammunition procurement or transfer, or pyrotechnics as an ordinary marketplace task.','outcomes',jsonb_build_array('BLOCK'),'safeReasonCodes',jsonb_build_array('CONTROLLED_HARMFUL_GOODS'))
    when 'RS-MIN-012' then jsonb_build_object('instructions','Public text contains phone, email, exact home address, QR, identity document or other private data that should not be public. Require a corrected public revision.','outcomes',jsonb_build_array('CLARIFY'),'safeReasonCodes',jsonb_build_array('REMOVE_PRIVATE_DATA'))
    when 'RS-MIN-013' then jsonb_build_object('instructions','The requested task is materially unclear or an essential fact is missing, so what another person should actually do is not sufficiently understood.','outcomes',jsonb_build_array('CLARIFY'),'safeReasonCodes',jsonb_build_array('TASK_NEEDS_CLARIFICATION'))
    when 'RS-MIN-014' then jsonb_build_object('instructions','Clearly high-risk or regulated category for which this minimum policy contains no reviewed specific rule. Do not publish under the minimum policy.','outcomes',jsonb_build_array('REVIEW'),'safeReasonCodes',jsonb_build_array('REGULATED_OR_HIGH_RISK'))
    when 'RS-MIN-015' then jsonb_build_object('instructions','HITNO or urgency never changes or overrides the outcome selected under another applicable rule. Never select this rule as the sole decision rule.','outcomes','[]'::jsonb,'safeReasonCodes','[]'::jsonb)
    when 'RS-MIN-016' then jsonb_build_object('instructions','Policy state, evaluator result or applicable rule is missing, stale, conflicting or not applicable with confidence. Fail closed for review.','outcomes',jsonb_build_array('REVIEW'),'safeReasonCodes',jsonb_build_array('POLICY_UNCERTAIN'))
    else null
  end
)
where r.bundle_id=(select b.id from private.publication_policy_bundles b where b.policy_id='RS_PUBLICATION_POLICY_MINIMUM' and b.jurisdiction='RS' and b.version=1);

do $bind_digest$
declare
  v_bundle uuid;
  v_head jsonb;
  v_rules jsonb;
  v_doc jsonb;
  v_digest text;
begin
  select b.id,b.review_provenance->'evaluatorPolicy' into v_bundle,v_head
  from private.publication_policy_bundles b
  where b.policy_id='RS_PUBLICATION_POLICY_MINIMUM' and b.jurisdiction='RS' and b.version=1
  for update;
  select jsonb_agg(jsonb_build_object(
    'ruleId',r.rule_id,
    'instructions',r.rule_provenance#>>'{evaluation,instructions}',
    'outcomes',r.rule_provenance#>'{evaluation,outcomes}',
    'safeReasonCodes',r.rule_provenance#>'{evaluation,safeReasonCodes}'
  ) order by r.rule_id)
  into v_rules
  from private.publication_policy_rule_refs r where r.bundle_id=v_bundle;
  v_doc:=v_head||jsonb_build_object('rules',v_rules);
  v_digest:=encode(extensions.digest(convert_to(v_doc::text,'UTF8'),'sha256'),'hex');
  update private.publication_policy_bundles b
  set review_provenance=b.review_provenance||jsonb_build_object('evaluatorContentSha256',v_digest)
  where b.id=v_bundle;
end
$bind_digest$;

do $postcondition$
declare
  v_bundle uuid;
  v_doc jsonb;
  v_refs integer;
begin
  select b.id into v_bundle from private.publication_policy_bundles b
  where b.policy_id='RS_PUBLICATION_POLICY_MINIMUM' and b.jurisdiction='RS' and b.version=1;
  v_doc:=private.publication_policy_document(v_bundle);
  if v_doc is null then raise exception 'D0140C_EXECUTABLE_POLICY_DOCUMENT_INVALID'; end if;
  if v_doc->>'schemaVersion'<>'USKOCI_PUBLICATION_POLICY_V1' then raise exception 'D0140C_SCHEMA_INVALID'; end if;
  if jsonb_array_length(v_doc->'rules')<>16 then raise exception 'D0140C_RULE_COUNT_INVALID'; end if;
  select count(*) into v_refs from jsonb_array_elements(v_doc->'rules') r
  where r->>'ruleId'='RS-MIN-001' and r->'outcomes'=jsonb_build_array('ALLOW');
  if v_refs<>1 then raise exception 'D0140C_ALLOW_RULE_INVALID'; end if;
  if exists(select 1 from jsonb_array_elements(v_doc->'rules') r where r->>'ruleId'='RS-MIN-015' and jsonb_array_length(r->'outcomes')<>0) then
    raise exception 'D0140C_URGENCY_OVERRIDE_REINTRODUCED';
  end if;
  if (select b.review_provenance->>'legal_certification' from private.publication_policy_bundles b where b.id=v_bundle) is distinct from 'false' then
    raise exception 'D0140C_LEGAL_CERTIFICATION_DRIFT';
  end if;
end
$postcondition$;
commit;
