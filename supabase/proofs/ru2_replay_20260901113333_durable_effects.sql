-- RU-2 disposable replay substitute for historical AI authenticated runtime proof.
-- Fresh inspection of 20260901113333 shows that all test writes rollback;
-- only these comments survive on production. This proof-only file preserves
-- those durable effects without requiring production conversation fixtures.

comment on table public.ai_messages is
  'AUTHENTICATED_RUNTIME_PROVEN: own-read only; direct authenticated INSERT denied. SERVICE_RUNTIME_PROVEN: atomic USER+ASSISTANT turn persisted inside rollback-only proof with zero residue.';

comment on function public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb) is
  'SERVICE_RUNTIME_PROVEN: authenticated EXECUTE denied; service_role atomically persisted two messages plus one AI_INFERENCE NEEDS_CONFIRMATION fact, then proof subtransaction rolled back with zero retained rows.';
