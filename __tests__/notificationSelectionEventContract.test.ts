import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const read = (file: string) => readFileSync(file, 'utf8');
const candidate = read('supabase/proofs/notifications/n02_selection_event_candidate.sql');
const predecessor = read('supabase/migrations/20260906100000_clean_p0d03_requester_connection_activation_v1.sql');
const runtime = read('supabase/proofs/notifications/n02_selection_event_proof.mjs');
const workflow = read('.github/workflows/notifications-n02-selection-event-proof.yml');
const body = predecessor.split('create or replace function public.rpc_select_response(')[1]
  .split('as $function$')[1].split('$function$;')[0];
const event = candidate.split('$n02_event$')[1];

describe('N02 successful selection durable event contract', () => {
  it('guards the exact current predecessor and modifies only the final return boundary', () => {
    expect(createHash('md5').update(body).digest('hex')).toBe('867b280d4131188db3906c1ced7f4c11');
    expect(candidate).toContain('N02_SELECTION_PREDECESSOR_MISMATCH');
    expect(candidate).toContain('N02_SELECTION_ANCHOR_MISMATCH');
    expect(candidate).toContain('N02_SELECTION_POSTCONDITION_MISMATCH');
    const anchor = '\n  return v_agreement_id;\nend;\n';
    expect(body.split(anchor)).toHaveLength(2);
    const changed = body.replace(anchor, event + anchor);
    expect(changed.replace(event, '')).toBe(body);
    expect(changed.indexOf(event)).toBeGreaterThan(changed.indexOf('insert into private.selection_commands('));
    expect(changed.indexOf(event)).toBeGreaterThan(changed.indexOf('return v_command.agreement_id;'));
    expect(changed.indexOf(event)).toBeGreaterThan(changed.indexOf('return v_legacy_agreement_id;'));
  });
  it('uses the existing event family with server-bound recipient/version/targets and no private values', () => {
    expect(event).toContain("v_resp.worker_account_id, 'WORKER', 'RESPONSE_SELECTED'");
    expect(event).toContain("'RESPONSE', v_resp.id, v_ver.version");
    expect(event).toContain("'response_selected:' || v_selection_id::text");
    expect(event).toContain("'NORMAL', jsonb_build_object('agreement_id', v_agreement_id, 'need_id', v_need.id)");
    expect(event).not.toMatch(/p_content_hash|p_client_request_id|scope_note|price_rsd|address|contact|v_need\.title/);
    expect(event.match(/perform private\.emit_event\(/g)).toHaveLength(1);
  });
  it('preserves transaction atomicity, existing authority and zero forbidden activation', () => {
    expect(candidate).toContain('begin;');
    expect(candidate).toContain('commit;');
    expect(candidate).not.toMatch(/exception\s+when|create table|alter table|grant execute|revoke|create or replace function private\.emit_event/i);
    expect(candidate).not.toMatch(/(?:insert into|update|delete from)\s+supabase_migrations/i);
    expect(candidate).toContain('PROOF-ONLY CANDIDATE');
  });
  it('requires real authenticated disposable proof, guarded before any clients or SQL', () => {
    expect(runtime.indexOf('assertLocalDeviceProofTargets(url, dbUrl)')).toBeLessThan(runtime.indexOf('createClient(url'));
    for (const label of ['EMITTER_FAILURE_ATOMIC_ROLLBACK', 'CONCURRENT_SAME_COMMAND_ONE_EVENT',
      'WRONG_ACTOR_AND_STALE_NO_EFFECT', 'CATEGORY_OFF_EVENT_RETAINED',
      'QUIET_HOURS_RESPECTED', 'RECIPIENT_RLS_AND_DIRECT_WRITE_DENIED', 'FINAL_INVARIANTS']) {
      expect(runtime).toContain(label);
    }
    expect(workflow).toContain('ru5_device_ui_live79_env.sh');
    expect(workflow).toContain('n02_selection_event_proof.mjs');
    expect(workflow).not.toContain('secrets.');
    expect(workflow).not.toMatch(/supabase (link|db push|functions deploy)/);
  });
});
