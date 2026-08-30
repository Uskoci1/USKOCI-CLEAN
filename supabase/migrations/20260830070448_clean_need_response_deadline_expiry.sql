-- G9: needs.response_deadline je postojao kao kolona ali ga NIKO nije sprovodio.
-- Potreba sa isteklim rokom je ostajala PUBLISHED zauvek i nastavljala da trosi talase.
--
-- Donorova finalna semantika (r24_marketplace_tick) doslovno:
--   gase se samo PUBLISHED/SELECTION Potrebe kojima je rok prosao
--   I ZA KOJE NIKO NIJE IZABRAN. Ako je iko izabran, rok ne gasi Potrebu —
--   posao je vec dodeljen i zavrsava se kroz Dogovor.

create or replace function private.expire_lifecycle(p_at timestamptz default statement_timestamp())
returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $$
declare d integer; rr integer; av integer; ur integer; ne integer;
begin
  -- 1) Potrebe kojima je istekao rok za prijave.
  with istekle as (
    update public.needs x set status = 'EXPIRED'
     where x.status in ('PUBLISHED','SELECTION')
       and x.response_deadline is not null
       and x.response_deadline <= p_at
       and not exists (select 1 from public.need_selections s
                        where s.need_id = x.id and s.status = 'SELECTED')
    returning x.id, x.revision
  ), zatvorene_runde as (
    update public.dispatch_rounds r set status = 'STOPPED', stop_reason = 'NEED_EXPIRED'
      from istekle i
     where r.need_id = i.id and r.status in ('PLANNED','SENT')
    returning r.need_id
  ), ugasene_prilike as (
    update public.opportunity_deliveries o set status = 'EXPIRED'
      from istekle i
     where o.need_id = i.id and o.status in ('READY','SEEN')
    returning o.need_id
  ), iz_reda as (
    delete from private.dispatch_schedule s using istekle i where s.need_id = i.id
    returning s.need_id
  )
  select count(*) into ne from istekle;

  -- 2) Isteklе pojedinacne isporuke (rok talasa, ne rok Potrebe).
  update public.opportunity_deliveries
     set status = 'EXPIRED'
   where status in ('READY','SEEN') and expires_at is not null and expires_at <= p_at;
  get diagnostics d = row_count;

  update public.dispatch_rounds
     set status = 'EXPIRED'
   where status = 'SENT' and deadline_at is not null and deadline_at <= p_at;
  get diagnostics rr = row_count;

  update public.app_profiles
     set available_now = false
   where available_now = true
     and available_now_expires_at is not null and available_now_expires_at <= p_at;
  get diagnostics av = row_count;

  ur := private.expire_urgent(p_at);

  return jsonb_build_object('needsExpired',ne,'deliveriesExpired',d,'roundsExpired',rr,
                            'availabilityExpired',av,'urgencyExpired',ur);
end;
$$;

revoke all on function private.expire_lifecycle(timestamptz) from public, anon, authenticated;

-- Indeks da provera roka ne skenira tabelu.
create index if not exists needs_response_deadline_open_idx
  on public.needs (response_deadline)
  where status in ('PUBLISHED','SELECTION') and response_deadline is not null;

comment on column public.needs.response_deadline is
  'G9: rok za prijave. expire_lifecycle gasi Potrebu u EXPIRED SAMO ako niko nije izabran.';
