import {readFileSync} from 'fs';
import {join} from 'path';
const sql=readFileSync(join(__dirname,'../supabase/proofs/notifications/n06_push_registry_candidate.sql'),'utf8');
const proof=readFileSync(join(__dirname,'../supabase/proofs/notifications/n06_push_registry_proof.mjs'),'utf8');
describe('N06 device registry authority',()=>{
  it('keeps the existing owner behind narrow authenticated CAS commands',()=>{
    expect(sql).not.toMatch(/create table/i);expect(sql).toContain('auth.uid()');
    expect(sql.match(/security definer set search_path=pg_catalog/g)).toHaveLength(2);
    expect(sql).toContain('PUSH_REVISION_CONFLICT');expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('create unique index push_device_active_token_owner_idx');
    expect(sql).toContain('revoke all on public.notification_push_devices from public,anon,authenticated');
  });
  it('does not enable preferences, emit events or enqueue delivery',()=>{
    expect(sql).not.toMatch(/(?:insert into|update)\s+public\.(?:notification_preferences|notification_deliveries|user_activity_events|notification_push_attempts)/i);
    expect(sql).not.toContain('private.emit_event');
  });
  it('proves tombstones, revocation replay, cross-account races and direct mutation denial',()=>{
    expect(proof.indexOf('assertLocalDeviceProofTargets(url,db)')).toBeLessThan(proof.indexOf('createClient(url,'));
    for(const check of ['REVOKE_REPLAY_AND_LATE_ENABLE_CANNOT_RESURRECT','UNSEEN_REVOKE_TOMBSTONE_REJECTS_IN_FLIGHT_INITIAL_ENABLE',
      'CONCURRENT_DIFFERENT_OWNER_CLAIMS_NEVER_DUPLICATE_ACTIVE_TOKEN','OWNER_READ_NO_DIRECT_MUTATIONS_OR_FOREIGN_REVOCATION']) expect(proof).toContain(check);
  });
});
