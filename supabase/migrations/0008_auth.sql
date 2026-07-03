-- Dual auth: username+password OR wallet. A profile may start with just one and
-- link the other later, so wallet is now optional. Uniqueness is still enforced
-- (unique allows multiple NULLs in Postgres, so many username-only accounts are fine).
alter table public.profiles alter column wallet drop not null;
