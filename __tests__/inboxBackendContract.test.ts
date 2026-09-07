import { readFileSync } from 'node:fs';
const sql=readFileSync('supabase/proofs/notifications/n03_inbox_candidate.sql','utf8');
const proof=readFileSync('supabase/proofs/notifications/n03_inbox_proof.mjs','utf8');
describe('S06 canonical event read owner',()=>{
  it('extends the existing event and does not create another Inbox system',()=>{
    expect(sql).toContain('alter table public.user_activity_events add column read_at timestamptz');
    expect(sql).not.toMatch(/create table|update public\.notification_deliveries/i);
    expect(sql).toContain('set read_at=coalesce(read_at,statement_timestamp())');
    expect(sql).toContain('where id=p_event_id and recipient_user_id=v_uid');
  });
  it('uses bounded keyset pages and one consistent snapshot for read count and items',()=>{
    expect(sql).toContain('language plpgsql stable security definer');
    expect(sql).toContain('(e.created_at,e.id)<(p_before_at,p_before_id)');
    expect(sql).toContain('order by e.created_at desc,e.id desc limit p_limit+1');
    expect(sql).toContain('where read_at is null');
    expect(sql).not.toMatch(/\boffset\b/i);
  });
  it('resolves only fixed target kinds through invoker RLS, ignoring payload routes',()=>{
    const resolver=sql.split('create function public.rpc_resolve_activity_event')[1];
    expect(resolver).toContain('security invoker set search_path=pg_catalog');
    expect(resolver).toContain('recipient_user_id=v_uid');
    expect(resolver).not.toContain('e.payload');
    expect(resolver).toContain("jsonb_build_object('kind','UNAVAILABLE')");
  });
  it('requires real owner/non-owner reads, concurrency, pagination and stale target proof',()=>{
    for(const c of ['KEYSET_PAGINATION_NO_DUPLICATE_OR_SKIP','OWNER_ONLY_IDEMPOTENT_READ_NO_DELIVERY_MUTATION',
      'MARK_ALL_ROLE_AND_CUTOFF_KEEP_NEW_ARRIVALS_UNREAD','TAP_REAUTHORIZES_ENTITY_NO_PAYLOAD_ROUTE_TRUST'])
      expect(proof).toContain(c);
    expect(proof.indexOf('assertLocalDeviceProofTargets(url,dbUrl)')).toBeLessThan(proof.indexOf('createClient(url'));
  });
});
