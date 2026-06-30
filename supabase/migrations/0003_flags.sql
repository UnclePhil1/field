-- Country codes for flag rendering. ISO 3166-1 alpha-2 (or gb-eng/gb-sct/gb-wls
-- for the home nations). Nullable — unknown names fall back to the team code.
alter table public.matches add column if not exists home_country text;
alter table public.matches add column if not exists away_country text;
