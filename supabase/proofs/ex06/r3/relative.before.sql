
  select case
    when p_published_at is null then null
    when p_kind = 'TODAY_FLEXIBLE'
      then (date_trunc('day', p_published_at at time zone coalesce(p_timezone, 'Europe/Belgrade')) + interval '1 day')
           at time zone coalesce(p_timezone, 'Europe/Belgrade')
    when p_kind = 'TOMORROW_FLEXIBLE'
      then (date_trunc('day', p_published_at at time zone coalesce(p_timezone, 'Europe/Belgrade')) + interval '2 days')
           at time zone coalesce(p_timezone, 'Europe/Belgrade')
    when p_kind = 'WEEK_FLEXIBLE' then p_published_at + interval '7 days'
  end
