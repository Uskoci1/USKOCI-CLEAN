
  select case
    when p_published_at is null or not isfinite(p_published_at) then null
    when p_kind = 'TODAY_FLEXIBLE'
      then (date_trunc('day', p_published_at at time zone tz) + interval '1 day') at time zone tz
    when p_kind = 'TOMORROW_FLEXIBLE'
      then (date_trunc('day', p_published_at at time zone tz) + interval '2 days') at time zone tz
    when p_kind = 'WEEK_FLEXIBLE'
      then (date_trunc('week', p_published_at at time zone tz) + interval '1 week') at time zone tz
  end
  from (select case when private.availability_timezone_valid(p_timezone)
    then p_timezone else 'Europe/Belgrade' end as tz) resolved
