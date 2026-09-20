// Emits an inactive, unreviewed candidate. It never connects to a database.
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
export const artifactPath='docs/implementation/v5-ai-first/PRESELECTION_QA_EXECUTABLE_POLICY.json';
export function renderQaPolicyCandidate(){
 const bytes=readFileSync(artifactPath),a=JSON.parse(bytes),hash=createHash('sha256').update(bytes).digest('hex');
 if(a.policyId!=='PRESELECTION_QA_V1'||a.jurisdiction!=='RS'||a.version!==1||a.activation!=='NOT_ACTIVATED'||a.document.rules.length!==5)throw new Error('POLICY_ARTIFACT_INVALID');
 const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
 return `-- Prepared Q&A policy candidate SHA256 ${hash}.
-- REVIEW REQUIRED: this creates no active or reviewed production authority.
begin;
do $candidate$
declare a jsonb:=${literal(a)};b uuid;item jsonb;doc jsonb;provenance jsonb;
begin
 if exists(select 1 from private.publication_policy_bundles where policy_id='PRESELECTION_QA_V1' and jurisdiction='RS' and version=1) then raise exception 'QA_POLICY_CANDIDATE_EXISTS';end if;
 provenance:=jsonb_build_object('candidateArtifactSha256','${hash}','sourceMapping',a->'sourceMapping','processingAuthority',a->>'processingAuthority','numericAuthority',a->>'numericAuthority','reviewState','PREPARED_AWAITING_REVIEW','evaluatorPolicy',(a->'document')-'rules');
 insert into private.publication_policy_bundles(policy_id,version,jurisdiction,is_reviewed,is_complete,is_active,review_provenance)
 values('PRESELECTION_QA_V1',1,'RS',false,true,false,provenance) returning id into b;
 for item in select value from jsonb_array_elements(a#>'{document,rules}') loop
  insert into private.publication_policy_rule_refs(bundle_id,rule_id,rule_provenance) values(b,item->>'ruleId',jsonb_build_object('evaluation',item-'ruleId','sourceMapping',(select x from jsonb_array_elements(a->'sourceMapping')x where x->>'ruleId'=item->>'ruleId')));
 end loop;
 select ((a->'document')-'rules')||jsonb_build_object('rules',jsonb_agg(value order by value->>'ruleId')) into doc from jsonb_array_elements(a#>'{document,rules}');
 update private.publication_policy_bundles set review_provenance=provenance||jsonb_build_object('evaluatorContentSha256',encode(extensions.digest(convert_to(doc::text,'UTF8'),'sha256'),'hex')) where id=b;
 if private.publication_policy_document(b) is distinct from doc then raise exception 'QA_EXECUTABLE_DOCUMENT_INVALID';end if;
 if private.publication_policy_bundle_ready(b,'RS',statement_timestamp()) then raise exception 'QA_CANDIDATE_MUST_REMAIN_INACTIVE';end if;
end $candidate$;
commit;
`;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.stdout.write(renderQaPolicyCandidate());
