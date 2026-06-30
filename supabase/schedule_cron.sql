-- Register the every-minute engine tick. Run this MANUALLY in the Supabase
-- SQL editor after deploying functions. Replace <CRON_SECRET> with the same
-- value you set via `supabase secrets set CRON_SECRET=...`, and confirm the
-- project URL matches yours.
--
-- We embed the values as literals because hosted Supabase blocks
-- `ALTER DATABASE ... SET app.settings.*` from the SQL editor.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'field-engine-tick') then
    perform cron.unschedule('field-engine-tick');
  end if;
end $$;

select cron.schedule(
  'field-engine-tick',
  '* * * * *',  -- every minute
  $$
  select net.http_post(
    url     := 'https://tjaurmvytdeumynjteca.supabase.co/functions/v1/engine-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- verify
select jobname, schedule, active from cron.job where jobname = 'field-engine-tick';
