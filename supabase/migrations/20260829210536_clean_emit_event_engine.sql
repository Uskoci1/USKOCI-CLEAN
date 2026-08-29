-- Jedina ulazna tacka za notifikacije. Dispatch zove OVO i nista drugo.
--
-- Redosled je obavezan: durable event -> preference -> delivery -> (push queue).
-- Ako preference ne dozvoljava, delivery se pravi kao SUPPRESSED sa razlogom —
-- ne izostaje. Tako se moze dokazati zasto neko nesto nije dobio.

create or replace function private.category_of_event(p_event_type text)
returns text language sql immutable
as $fn$
  select case
    when p_event_type = 'OPPORTUNITY_AVAILABLE' then 'opportunities'
    when p_event_type like 'RESPONSE\_%' then 'responses'
    when p_event_type like 'AGREEMENT\_%' or p_event_type in ('MESSAGE_RECEIVED','PRIVATE_ACCESS_GRANTED','REVIEW_RECEIVED') then 'dogovor'
    when p_event_type in ('EXECUTION_STATE_CHANGED','COMPLETION_REQUIRED') then 'execution'
    when p_event_type = 'RECOVERY_OPENED' then 'recovery'
    else 'account'
  end;
$fn$;

create or replace function private.in_quiet_hours(p_prefs public.notification_preferences)
returns boolean language sql stable
as $fn$
  select case
    when not p_prefs.quiet_hours_enabled then false
    when p_prefs.quiet_start is null or p_prefs.quiet_end is null then false
    when p_prefs.quiet_start < p_prefs.quiet_end
      then (statement_timestamp() at time zone p_prefs.quiet_timezone)::time
             between p_prefs.quiet_start and p_prefs.quiet_end
    -- prelazak preko ponoci
    else (statement_timestamp() at time zone p_prefs.quiet_timezone)::time >= p_prefs.quiet_start
      or (statement_timestamp() at time zone p_prefs.quiet_timezone)::time <= p_prefs.quiet_end
  end;
$fn$;

create or replace function private.emit_event(
  p_recipient uuid, p_role text, p_event_type text,
  p_entity_type text, p_entity_id uuid, p_entity_version integer,
  p_title text, p_body text, p_dedupe_key text,
  p_urgency text default 'NORMAL',
  p_payload jsonb default '{}',
  p_expires_at timestamptz default null
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare
  v_event_id uuid;
  v_prefs public.notification_preferences%rowtype;
  v_cat text := private.category_of_event(p_event_type);
  v_cat_on boolean;
  v_quiet boolean;
  v_prio text := case when p_urgency = 'HITNO' then 'HIGH' else 'NORMAL' end;
  v_suppress text;
begin
  -- 1) durable event, idempotentno
  insert into public.user_activity_events
    (recipient_user_id, recipient_role, event_type, entity_type, entity_id,
     entity_version, urgency, payload, dedupe_key)
  values (p_recipient, p_role, p_event_type, p_entity_type, p_entity_id,
     p_entity_version, p_urgency, p_payload, p_dedupe_key)
  on conflict (dedupe_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return null;  -- vec emitovano; nista se ne duplira
  end if;

  -- 2) preference; ako red ne postoji, vaze podrazumevane vrednosti
  select * into v_prefs from public.notification_preferences
   where user_id = p_recipient and role_context = p_role;
  if not found then
    v_prefs.in_app_enabled := true;
    v_prefs.push_enabled := false;
    v_prefs.quiet_hours_enabled := false;
    v_prefs.urgent_overrides_quiet_hours := false;
    v_prefs.opportunities_enabled := true; v_prefs.responses_enabled := true;
    v_prefs.dogovor_enabled := true; v_prefs.execution_enabled := true;
    v_prefs.recovery_enabled := true; v_prefs.account_enabled := true;
  end if;

  v_cat_on := case v_cat
    when 'opportunities' then v_prefs.opportunities_enabled
    when 'responses'     then v_prefs.responses_enabled
    when 'dogovor'       then v_prefs.dogovor_enabled
    when 'execution'     then v_prefs.execution_enabled
    when 'recovery'      then v_prefs.recovery_enabled
    else v_prefs.account_enabled end;

  -- 3) IN_APP
  insert into public.notification_deliveries
    (event_id, recipient_user_id, recipient_role, channel, priority, state,
     suppression_reason, title, body, dedupe_key, expires_at)
  values (v_event_id, p_recipient, p_role, 'IN_APP', v_prio,
     case when v_prefs.in_app_enabled and v_cat_on then 'CREATED' else 'SUPPRESSED' end,
     case when v_prefs.in_app_enabled and v_cat_on then null
          when not v_cat_on then 'CATEGORY_OFF' else 'IN_APP_OFF' end,
     p_title, p_body, p_dedupe_key || ':in_app', p_expires_at)
  on conflict (dedupe_key) do nothing;

  -- 4) PUSH — tihi sati se postuju osim uz izricit opt-in za HITNO
  v_quiet := private.in_quiet_hours(v_prefs);
  v_suppress := case
    when not v_prefs.push_enabled then 'PUSH_OFF'
    when not v_cat_on then 'CATEGORY_OFF'
    when v_quiet and not (p_urgency = 'HITNO' and v_prefs.urgent_overrides_quiet_hours)
      then 'QUIET_HOURS'
    else null end;

  insert into public.notification_deliveries
    (event_id, recipient_user_id, recipient_role, channel, priority, state,
     suppression_reason, title, body, dedupe_key, expires_at)
  values (v_event_id, p_recipient, p_role, 'PUSH', v_prio,
     case when v_suppress is null then 'CREATED' else 'SUPPRESSED' end,
     v_suppress, p_title, p_body, p_dedupe_key || ':push', p_expires_at)
  on conflict (dedupe_key) do nothing;

  return v_event_id;
end;
$fn$;

revoke all on function private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)
  from public, anon, authenticated;
revoke all on function private.category_of_event(text) from public, anon, authenticated;
revoke all on function private.in_quiet_hours(public.notification_preferences) from public, anon, authenticated;

comment on function private.emit_event is
  'Jedina ulazna tacka za notifikacije. Potisnuta dostava se BELEZI sa razlogom, ne izostaje — da se moze dokazati zasto neko nesto nije dobio.';
