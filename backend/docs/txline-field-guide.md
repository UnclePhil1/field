# TxLINE / TxODDS → Field integration guide

> **Source of truth.** This file is a curated distillation of the full TxODDS / TxLINE
> documentation for building **Field**. The complete raw export lives in
> [`txodds-txline-reference.md`](./txodds-txline-reference.md) (~23k lines — IDLs, T&Cs,
> full schedule, per-endpoint OpenAPI). Read from THIS file first; drop into the raw
> reference for IDL types, Merkle-proof shapes, or exact request/response schemas.
>
> Field is a **free play-along football prediction game**. Its "provably fair" promise
> is backed by TxLINE: scores come from the TxODDS off-chain feed and every settled
> stat can be validated against a **Solana on-chain Merkle root**. The `Receipt` /
> `anchoredOn: "Solana"` types already in the codebase map directly onto this.

---

## 1. The big picture

TxLINE = **hybrid system**: TxODDS serves data off-chain (HTTP + SSE streams);
Solana stores cryptographic commitments (daily Merkle roots) so any score/stat can be
independently verified. Access is gated by **time-limited API tokens** secured by an
**on-chain subscription** tied to a Solana wallet.

Data domains:
- **Fixtures** — matches (teams, start time, competition).
- **Odds** — market odds per fixture (not core to Field's MVP).
- **Scores** — live stats (goals, cards, corners…) — **this is what Field predicts and settles on.**

Two networks:
| | Base URL |
| --- | --- |
| **Mainnet** | `https://txline.txodds.com/api/` |
| **Devnet** | `https://txline-dev.txodds.com/api/` |

(Auth host variant for some flows: `https://oracle.txodds.com` / `oracle-dev`.)

---

## 2. Auth & access flow (do this first)

Wallet-based, three steps. **Field already starts the wallet-connect flow** (see
`src/lib/wallet.ts`, `src/app/AuthStore.tsx`) — the same Solana wallet should drive the
TxLINE subscription + token.

1. **Get a guest JWT**
   `POST https://txline.txodds.com/auth/guest/start` → returns a short-lived `jwt`.
2. **Subscribe on-chain** (or use a **free tier** — see §6; World Cup / Int'l Friendlies
   need no payment). Premium tiers: optionally buy **TxL** tokens (USDT on Solana, via
   a quote → `POST /api/guest/purchase/quote` → sign locally), then subscribe on-chain.
3. **Activate your API token**
   `POST https://txline.txodds.com/api/token/activate` → returns the `apiToken` used on
   every data call.

### Request headers for ALL data endpoints
```ts
const httpClient = axios.create({
  baseURL: "https://txline.txodds.com",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${jwt}`,   // guest/session JWT
    "X-Api-Token": apiToken,             // from /api/token/activate
  },
});
```

> **Field architecture rule:** keep JWT + apiToken acquisition and all TxLINE calls
> **server-side** (a backend the frontend talks to via `src/lib/api.ts`). The browser
> should never hold the API token. The existing `api.ts` boundary comment ("never hit
> TxLINE directly… swap is contained to this file") already anticipates this.

---

## 3. Endpoint reference (the ones Field needs)

All paths are relative to the base URL. Auth headers required unless noted.

### Fixtures
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/fixtures/snapshot` | All fixtures, or `?competitionId=<id>` for one competition. |
| GET | `/api/fixtures/updates/{epochDay}/{hourOfDay}` | Fixture changes in a time bucket. |
| GET | `/api/fixtures/validation` | On-chain validation data for a fixture. |
| GET | `/api/fixtures/batch-validation` | Validate many fixtures at once. |

Fixture fields (snapshot): `FixtureId`, `Participant1`, `Participant2`, `StartTime`
(epoch ms), plus competition info. → maps to Field's `Match` (`home`, `away`,
`kickoff`, `competition`, `id`).

### Odds (lower priority for Field MVP)
| Method | Path |
| --- | --- |
| GET | `/api/odds/snapshot/{fixtureId}` |
| GET | `/api/odds/updates/{fixtureId}` |
| GET | `/api/odds/updates/{epochDay}/{hourOfDay}/{interval}` |
| GET | `/api/odds/stream` (SSE) |
| GET | `/api/odds/validation` |

### Scores — **the core of Field**
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/scores/snapshot/{fixtureId}` | Current stat snapshot; `?asOf=<ms>` for point-in-time. |
| GET | `/api/scores/updates/{fixtureId}` | Live updates for a fixture. |
| GET | `/api/scores/updates/{epochDay}/{hourOfDay}/{interval}` | Updates in a 5-min bucket. |
| GET | `/api/scores/historical/{fixtureId}` | Full update sequence; only for fixtures that started **2 weeks → 6 hours** ago. |
| GET | `/api/scores/stream` (SSE) | **Real-time** scores stream. |
| GET | `/api/scores/stat-validation` | Merkle-proof data for one/two stats (see §5). |

Score update fields include `seq` (sequence no.), `ts` (timestamp), `gameState`
(phase) — used for ordering, replay, and validation.

### Time-bucket math (for the `updates` endpoints)
```ts
const epochDay  = Math.floor(targetTime.getTime() / 86400000);
const hourOfDay = targetTime.getUTCHours();
const interval  = Math.floor(targetTime.getUTCMinutes() / 5); // 0..11, a 5-min slot
```

---

## 4. Streaming (live play)

Scores/odds stream over **Server-Sent Events** (`Accept: text/event-stream`), not
WebSockets. Field's live match room should consume `/api/scores/stream` server-side and
relay to the browser (the existing `useLiveMatch` / `subscribeMatch` hook is the seam).

```ts
const res = await fetch("https://txline.txodds.com/api/scores/stream", {
  headers: {
    Authorization: `Bearer ${jwt}`,
    "X-Api-Token": apiToken,
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
  },
});
const reader = res.body!.getReader();
const decoder = new TextDecoder();
// loop: reader.read() → decoder.decode(value) → split("\n") → parse each non-empty line
```

> **Bandwidth:** add `"Accept-Encoding": "gzip"` to cut 70–80%; decompress chunks with
> `gunzipSync()` (Node `zlib`) before decoding.

---

## 5. On-chain validation (Field's "provably fair" receipt)

This is what makes Field's `Receipt` real. After a stat settles, fetch proof data and
verify it against the daily Solana Merkle root.

- Endpoint: `GET /api/scores/stat-validation?fixtureId=&seq=&statKey=[&statKey2=]`
- Returns: `summary` (fixtureId, updateStats {updateCount, min/maxTimestamp},
  eventStatsSubTreeRoot), `subTreeProof`, `mainTreeProof`, `statToProve`,
  `eventStatRoot`, `statProof` (and `…2` variants for two-stat comparisons).
- Verify with the Anchor program `Txoracle` (`@coral-xyz/anchor`, `@solana/web3.js`),
  calling `validateStat(...)` as a read-only `.view()` against the `daily_scores_roots`
  PDA. Single-stat uses a predicate (`threshold` + `comparison`); two-stat adds an
  operator (e.g. `subtract`) for things like goal difference.
- **PDA:** `["daily_scores_roots", epochDay as le u16]` under the program id.
  `epochDay = floor(minTimestamp / 86_400_000)`.

Program addresses, full IDL, and types are in the raw reference under
**Program Addresses**, **IDL & Types (Mainnet/Devnet)**.

Field's `Receipt` mapping: `source` = TxLINE feed, `statVerified` = resolved stat
label, `merkleRoot` = on-chain `daily_scores_roots` root, `anchoredOn` = `"Solana"`,
`txRef` = validation/anchor reference.

---

## 6. Free tier (use this to build NOW — no payment)

**World Cup Free Tier**: instant access to **EPL + World Cup** (and Int'l Friendlies)
with no payment. Flow: set up Solana wallet → subscribe to free tier → activate API
access → first call. Perfect for Field's MVP and the hackathon. See raw reference:
**World Cup Free Tier** and **Subscription Tiers**.

---

## 7. Stat & phase encoding (drives prediction cards + settlement)

Field's prediction cards (`StatKind = 'goal' | 'corner' | 'card'`, `Side`) must map to
TxODDS **stat keys**. Encoding formula (soccer): **`(period * 1000) + base_key`**.

**Soccer full-game base keys:**
| Key | Stat | Key | Stat |
| --- | --- | --- | --- |
| 1 | P1 Total Goals | 2 | P2 Total Goals |
| 3 | P1 Yellow Cards | 4 | P2 Yellow Cards |
| 5 | P1 Red Cards | 6 | P2 Red Cards |
| 7 | P1 Corners | 8 | P2 Corners |

**Period multipliers:** H1 `+1000`, H2 `+2000`, ET1 `+3000`, ET2 `+4000`, PE `+5000`.
e.g. `1007` = Participant 1 First-Half Corners; `2002` = P2 Second-Half Goals.

**Soccer game phases:** NS=1, H1=2, HT=3, H2=4, F=5, WET=6, ET1=7, HTET=8, ET2=9,
FET=10, WPE=11, PE=12, FPE=13, I=14, A=15, C=16, TXCC=17, TXCS=18, P=19.
→ Map to Field's `MatchPhase` (`PRE|1H|HT|2H|FT`) and `MatchStatus`.

(American Football feed also covered — keys 1–16, formula
`(half*1000 OR quarter*10000)+base_key` — see raw reference if Field expands to NFL/NCAAF.)

---

## 8. How this maps onto the current Field codebase

| Field code | TxLINE source |
| --- | --- |
| `src/lib/api.ts` (`fetchMatches`) | `GET /api/fixtures/snapshot` |
| `useLiveMatch` / `subscribeMatch` | `GET /api/scores/stream` (SSE), `/api/scores/updates/{fixtureId}` |
| `Match` type | fixtures snapshot fields + phase encoding |
| `MatchEvent` (`goal`/`corner`/`card`) | scores updates + stat keys (§7) |
| `PredictionCard.stat` + `subjectTeam` | stat key = `(period*1000)+base` for P1/P2 |
| `Receipt` (`merkleRoot`, `anchoredOn:"Solana"`, `txRef`) | `/api/scores/stat-validation` + `validateStat` on `daily_scores_roots` PDA |
| Wallet connect (`AuthStore`, `wallet.ts`) | guest JWT → on-chain subscription → `apiToken` |

**Next backend steps (not yet built):** a Field backend service that (1) holds JWT +
apiToken, (2) proxies fixtures/scores + the SSE stream to the frontend, (3) runs
`stat-validation` to mint `Receipt`s on settle. Keep all of that behind `src/lib/api.ts`.

---

## 9. Where to look in the raw reference

`txodds-txline-reference.md` top-level sections: Quickstart · Subscription Tiers ·
World Cup Free Tier · Overview (Feature Matrix) · StablePrice Feed · Schedule ·
Soccer Feed · American Football Feed · Program Addresses · IDL & Types (Mainnet/Devnet) ·
Fetching Snapshots · Streaming Data · On-Chain Validation · Hackathon T&Cs · T&Cs.

Live docs index: <https://txline-docs.txodds.com/llms.txt>
