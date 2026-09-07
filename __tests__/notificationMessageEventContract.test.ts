import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');
const candidate = read('supabase/proofs/notifications/n01_message_event_candidate.sql');
const predecessor = read('supabase/migrations/20260901101056_client_agreement_workspace_closure.sql');
const runtime = read('supabase/proofs/notifications/n01_message_event_proof.mjs');
const workflow = read('.github/workflows/notifications-n01-message-event-proof.yml');
function body(source: string): string {
  const start = source.indexOf('create or replace function public.rpc_send_agreement_message(');
  const match = source.slice(start).match(/as \$function\$([\s\S]*?)\$function\$;/);
  if (start < 0 || !match) throw new Error('Expected message writer source missing');
  return match[1];
}

describe('N01 proof candidate preserves current message authority', () => {
  it('keeps exact existing function body except the durable event call', () => {
    const stripped = body(candidate).replace(/  -- Durable domain event only;[\s\S]*?(?=  return v_id;)/, '');
    expect(stripped).toBe(body(predecessor));
    expect(createHash('md5').update(body(predecessor)).digest('hex')).toBe('705f19630e27792639d737bfa41d77c6');
  });
  it('rejects unknown predecessors and does not change an applied migration', () => {
    expect(candidate).toContain('N01_MESSAGE_WRITER_PREDECESSOR_MISMATCH');
    expect(candidate).toContain('705f19630e27792639d737bfa41d77c6');
    expect(candidate).toContain('PROOF-ONLY CANDIDATE');
    expect(candidate).not.toMatch(/(?:insert into|update|delete from)\s+supabase_migrations/i);
  });
  it('binds counterpart and role on the server and keeps a minimal privacy-safe event', () => {
    const emit = body(candidate).split('perform private.emit_event(')[1].split('  );')[0];
    expect(emit).toContain('then v_agreement.worker_account_id else v_agreement.requester_account_id end');
    expect(emit).toContain("then 'WORKER' else 'REQUESTER' end");
    expect(emit).toContain("'MESSAGE_RECEIVED', 'AGREEMENT', p_agreement_id, v_agreement.current_version");
    expect(emit).toContain("'agreement_message:' || v_id::text");
    expect(emit).toContain("'NORMAL', jsonb_build_object('message_id', v_id)");
    expect(emit).not.toMatch(/p_body|contact|location|v_agreement\.title/);
    expect(candidate.match(/perform private\.emit_event\(/g)).toHaveLength(1);
  });
  it('retains private security-definer boundary and propagates event errors atomically', () => {
    expect(candidate).toContain('security definer\nset search_path = pg_catalog');
    expect(candidate).toContain('from public, anon;');
    expect(candidate).toContain('grant execute on function public.rpc_send_agreement_message(uuid,text) to authenticated;');
    expect(body(candidate)).not.toMatch(/exception\s+when|dblink|http_/i);
    expect(body(candidate).indexOf('perform private.emit_event')).toBeGreaterThan(body(candidate).indexOf('returning id into v_id'));
    expect(body(candidate).indexOf('perform private.emit_event')).toBeLessThan(body(candidate).indexOf('return v_id;'));
  });
  it('guards all runtime mutations before creating clients and never promotes live', () => {
    expect(runtime.indexOf('assertLocalDeviceProofTargets(url, dbUrl)')).toBeLessThan(runtime.indexOf('const requester = createClient'));
    expect(runtime).toContain('candidate_sha256:');
    expect(runtime).toContain('EMITTER_FAILURE_ROLLS_BACK_MESSAGE');
    expect(runtime).toContain('CATEGORY_OFF_DURABLE_EVENT_RETAINED');
    expect(runtime).toContain('NORMAL_MESSAGE_RESPECTS_QUIET_HOURS');
    expect(runtime).toContain('NON_PARTY_REJECTED');
    expect(runtime).toContain('TERMINAL_CHAT_REJECTED');
    expect(runtime).not.toContain('leqcwgzvjsxugfgzdmth.supabase.co');
    expect(runtime).not.toContain('exp.host');
    expect(workflow).not.toContain('secrets.');
    expect(workflow).not.toMatch(/supabase (?:link|db push|functions deploy)/);
  });
  it('does not rewrite the emitter, add notification tables or activate gated features', () => {
    expect(candidate).not.toMatch(/create or replace function private\.emit_event|create table|alter table/i);
    expect(candidate).not.toMatch(/insert into (?:private|public)\.(?:publication_policy_bundles|preselection_qa|connection_policy_versions)/i);
    expect(workflow).toContain('supabase/proofs/ru5_device_ui_live79_env.sh');
    expect(workflow).toContain('supabase/proofs/notifications/n01_message_event_proof.mjs');
    expect(workflow).toContain('supabase/setup-cli@ab058987d8d6c725971f6cf9d0b5c98467e30bd1');
  });
});
