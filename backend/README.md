# Field — Backend

The backend is **Supabase** (Postgres + Auth + Realtime + Edge Functions), not a
self-hosted Node service. It lives in [`../supabase`](../supabase). This decision
replaced the earlier Express/`ws` stub: the user doesn't run servers, so the
"thin Field backend" from the product doc is implemented as Supabase Edge
Functions plus a `pg_cron`-scheduled engine, with **Supabase Realtime** pushing
live state to clients (no always-on WebSocket server to operate).

See [`../supabase/README.md`](../supabase/README.md) for setup, secrets, and deploy.

## Responsibilities (mapped from the product doc's "Field backend")
- **SSE consumer / match-state engine** → `engine-tick` Edge Function, scheduled
  every minute, polls TxLINE devnet REST and writes match state to Postgres.
- **Card & rules engine** → `engine-tick` spawns/resolves cards and runs scoring
  (`_shared/scoring.ts`, ported 1:1 from the original client logic).
- **Proof service** → `txline-proof` Edge Function (read-only Merkle proof).
- **Auth** → `wallet-auth` Edge Function (verify Solana signature → session).
- **DB** → Postgres tables: profiles, matches, match_events, prediction_cards,
  predictions, settlements (+ leaderboard views).

This `backend/` folder is now just a pointer; there is no separate service to run.
