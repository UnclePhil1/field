# Field

Live, play-along football prediction web app for the World Cup — predict the next
five minutes, build a streak, climb the board, and verify every result against
data anchored on Solana. Free to play; not a betting site.

Powered by the **TxLINE** (TxODDS) verifiable data feed, with sponsor-funded
**Tournaments ("Prediction Battles")** where hosts pay USDC prizes directly and
each payment is verified on-chain (Field never custodies funds).

## Stack
- **Frontend** — React 18 + Vite + TypeScript + Tailwind (`frontend/`)
- **Backend** — Supabase (Postgres + Auth + Realtime + Edge Functions) (`supabase/`)
- **Data** — TxLINE mainnet feed; on-chain reads via Solana RPC
- **Chain helpers** — `backend/scripts/` (one-shot TxLINE subscribe, e2e test)

## Run locally
```bash
cd frontend
cp .env.example .env   # fill in your Supabase keys + VITE_SOLANA_CLUSTER
npm install
npm run dev
```

## Backend
See [`supabase/README.md`](supabase/README.md) for migrations, Edge Function
secrets, and deploy. All secrets live in Supabase / your host's env — never in
the repo (see `.gitignore`).

## Structure
```
field/
├── frontend/   # React app
├── supabase/   # migrations + Edge Functions (the real backend)
├── backend/    # chain scripts + docs (no standalone server)
└── docs/       # TxLINE + API-Football reference
```
