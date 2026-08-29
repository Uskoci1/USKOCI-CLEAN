-- 18b: raspored. Odvojen od 18 da neuspeh planera ne odnese i motor.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'uskoci_marketplace_tick') then
    perform cron.unschedule('uskoci_marketplace_tick');
  end if;
  perform cron.schedule(
    'uskoci_marketplace_tick',
    '* * * * *',
    $cmd$select private.marketplace_tick(25);$cmd$
  );
end;
$$;
