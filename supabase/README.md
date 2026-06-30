# Field — Supabase backend

Postgres + Auth + Realtime + Edge Functions. This is the "thin Field backend"
from the product doc: it holds the TxLINE secret, runs the card/rules engine on a
schedule, and pushes live state to clients via Realtime. **No always-on server.**

## Layout
```
supabase/
├── config.toml
├── migrations/
│   ├── 0001_init.sql      # tables, views, RLS, realtime publication
│   └── 0002_engine.sql    # txline_session table + pg_cron schedule for engine-tick
└── functions/
    ├── _shared/           # txline.ts, supabase.ts, scoring.ts, cards.ts, cors.ts
    ├── wallet-auth/       # verify wallet signature → Supabase session
    ├── place-call/        # record a wager (server-authoritative)
    ├── engine-tick/       # CRON: poll TxLINE devnet, spawn/resolve cards, settle
    └── txline-proof/      # expand a receipt's Merkle proof on demand
```

## One-time setup
1. Install the CLI and link the project:
   ```bash
   supabase link --project-ref tjaurmvytdeumynjteca
   ```
2. Apply migrations:
   ```bash
   supabase db push
   ```
3. Set Edge Function secrets (Dashboard → Project Settings → Edge Functions, or CLI):
   ```bash
   supabase secrets set \
     TXLINE_BASE=https://txline.txodds.com \
     TXLINE_AUTH_BASE=https://txline.txodds.com \
     TXLINE_API_TOKEN=<token from backend/scripts/txline-subscribe.mjs> \
     TXLINE_COMPETITION_ID=<World Cup competition id> # optional filter \
     WALLET_AUTH_SECRET=<long random string> \
     CRON_SECRET=<long random string>
   ```
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected
   automatically into functions — do not set them by hand.
4. Deploy functions:
   ```bash
   supabase functions deploy wallet-auth place-call engine-tick txline-proof
   ```
5. Wire the cron scheduler — run once in the SQL editor (values for THIS project):
   ```sql
   alter database postgres set app.settings.functions_url =
     'https://tjaurmvytdeumynjteca.supabase.co/functions/v1';
   alter database postgres set app.settings.cron_secret = '<same CRON_SECRET as above>';
   ```

## TxLINE token
Real data needs a one-time **mainnet free World Cup tier** on-chain subscription,
which returns an activated `apiToken`. Use `backend/scripts/txline-subscribe.mjs`
to do the subscribe + activate and print the token, then drop it in as
`TXLINE_API_TOKEN`. Until then the engine runs but returns no fixtures (boards stay
empty); nothing crashes.

## Notes
- All gameplay writes go through functions with the service role (RLS-bypassing).
  Clients only read public game state + their own rows, and call `place-call`.
- Scoring lives in `_shared/scoring.ts`, ported 1:1 from the original frontend
  `AppStore.settleCard` so behaviour is unchanged — just trustworthy.
- Cron granularity is 1 minute (pg_cron). Fine for a devnet demo.
