# TxLINE setup scripts

## txline-subscribe.mjs — get your `TXLINE_API_TOKEN` (mainnet free tier)

Runs the one-time on-chain subscription to the **free World Cup tier** and
activates an API token. Free tier costs **no subscription fee** — you only need a
tiny amount of real SOL (≈ $0.02) in the wallet for transaction gas.

### Steps
1. Install deps:
   ```bash
   cd backend/scripts
   npm install
   ```
2. Get a funded Solana wallet keypair file. No Solana CLI needed — generate one:
   ```bash
   node gen-wallet.mjs        # writes ./my-wallet.json, prints its public address
   ```
   Then send that address a little SOL (≈0.01, for gas) from Phantom or an exchange.
   (If you already have a CLI wallet — a JSON array of 64 numbers — you can use that instead.)
3. Run it:
   ```bash
   node txline-subscribe.mjs ./my-wallet.json
   ```
4. It prints the exact `supabase secrets set TXLINE_API_TOKEN=...` line. Run that,
   plus the two base-URL lines it prints, then redeploy isn't needed — the engine
   picks up the new secret on its next minute tick.

### Options (env vars)
- `TXLINE_SERVICE_LEVEL` — `12` (real-time, default) or `1` (60s delay).
- `TXLINE_DURATION_WEEKS` — default `4`. Re-run before it lapses to renew.
- `SOLANA_RPC` — override the RPC (default mainnet-beta public RPC).

### Notes
- The token is **time-limited**; re-run to refresh when it expires.
- Keep `my-wallet.json` private — it controls the wallet. Never commit it.
- If `subscribe(...)` errors on argument types, tell me — a couple of IDL fields
  may want `BN` instead of plain numbers and I'll adjust.
