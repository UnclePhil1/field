# FanField

Play the match while it happens. FanField is a live, play-along football game: you
predict the next goal, card, or corner over a short window, build a streak, and
climb the leaderboard. It is free to play. You play with points and coins, not real-money stakes.

Every result is settled from a verifiable live data feed, so outcomes are decided
by what actually happened on the pitch, not by a house. Sponsor-funded tournaments
add real USDC prizes that hosts pay to winners directly, with each payment checked
on-chain. FanField never holds anyone's money.

Live at **fanfield.xyz**

Demo video (walkthrough): **https://youtu.be/O44zeDOH-YM**

---

## Contents

- [Demo video](#demo-video)
- [Brief technical documentation](#brief-technical-documentation)
- [How the main parts work](#how-the-main-parts-work)
- [What you can do](#what-you-can-do)
- [How a prediction works](#how-a-prediction-works)
- [Tournaments (Prediction Battles)](#tournaments-prediction-battles)
- [Notifications](#notifications)
- [What we use from TxODDS](#what-we-use-from-txodds)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Running it locally](#running-it-locally)
- [Environment and secrets](#environment-and-secrets)
- [Security](#security)
- [Screenshots](#screenshots)
- [Project layout](#project-layout)

---

## Demo video

A full product walkthrough, including the problem it solves, a live app tour, and
how the TxLINE feed powers the backend:

**https://youtu.be/O44zeDOH-YM**

## Brief technical documentation

### Core idea

Football is most fun when you have something riding on the next moment. FanField
turns any live match into a fast, social game: players make short yes/no calls on
the next goal, card, or corner, and every call is settled from a verifiable live
data feed rather than by a house. Because the same feed decides every outcome, the
result is identical for everyone and can be checked. On top of that sits a light
social and rewards layer — streaks, squads, chat, and sponsor-funded tournaments —
that keeps players coming back before, during, and after the whistle.

### Business highlights

- Free to play: players use points and coins, which
  lowers the legal and trust barrier and widens the audience.
- Built for one of the largest live audiences on earth (the World Cup), where the
  gap between goals is exactly the attention FanField captures.
- Tournaments create real stakes without FanField ever touching money: hosts fund
  USDC prizes and pay winners directly, and each payment is verified on-chain. This
  keeps the platform out of custody and compliance-heavy money flows.
- Growth is built in: squad invites, shareable "brag" cards, and Telegram alerts
  each turn one player into several.

### Revenue

FanField earns money in two clear ways.

The first way is coin top-ups. The game is free, and every player/user gets a coin on signup. When a player runs low on coins, they
can buy more. The starter pack is 1,000 coins for 3 dollars, paid in USDC or SOL,
and it opens up automatically once a balance drops below 100. Coins are only used
to play inside the app and can never be cashed out, so buying them is the same as
buying credits in any game, not placing a wager. This is the main income line
because it grows with how much people play.

The second way is a claim fee on real-stake wins. Score Link has a real-stake mode
where a player can back an exact scoreline with real funds instead of coins. Those
funds lock in a vault for the match. At full time, the players who called the exact
score split the funds that were staked on the wrong scorelines. FanField takes no
cut when a player enters. Instead, when a winner comes to claim their winnings, a
small fee is taken from the amount they withdraw. So the platform only earns after
a player has already won and is cashing out, which keeps entry free of any house
edge. This mode is opt-in and marked as coming soon in the app while the vault and
payout flow are finished.

Both models keep FanField out of heavy money handling. Coins are just game credits,
and for real-stake play the funds sit in a vault and are only touched to pay
winners, with the small fee taken on the claim.

### Technical highlights

- Real-data only, no mocks. All game state resolves from Supabase (Postgres,
  Auth, Realtime, Edge Functions) and the TxLINE feed.
- A single scheduled Edge Function (the "engine") runs every minute and is the
  authority for the whole game: it syncs fixtures, advances live matches from the
  feed clock and status, opens and settles prediction cards, updates coins and
  streaks, finalizes tournament standings, and fans out notifications.
- Verifiable settlement: cards resolve against the feed's stat values, and each
  settled call keeps a receipt referencing the TxODDS oracle anchored on Solana.
- Odds-aware pricing: when market odds are available, a card's payout multiplier is
  derived from the implied win probability, so harder calls pay more.
- The browser never holds a secret or talks to the feed. Row Level Security scopes
  user data; all privileged writes run server-side with the service role.
- Notifications fan out to three channels from one call. In-app inbox (Realtime),
  browser push (FCM), and Telegram, each gated by user preference.

### TxLINE endpoints used

Access uses a short-lived guest JWT plus an API token, sent on every data request
as a bearer token and an `X-Api-Token` header. All feed calls are server-side only.

| Purpose | Method + endpoint |
|---|---|
| Start a guest session (JWT) | `POST /auth/guest/start` |
| Activate the API token | `POST /api/token/activate` |
| World Cup fixtures | `GET /api/fixtures/snapshot` |
| Current score/state for a fixture | `GET /api/scores/snapshot/{fixtureId}` |
| Live score/stat updates | `GET /api/scores/updates/{fixtureId}` |
| Historical scores (replays, backfill) | `GET /api/scores/historical/{fixtureId}` |
| Market odds for a fixture | `GET /api/odds/snapshot/{fixtureId}` |
| Stat validation / proof for a receipt | `GET /api/scores/stat-validation?fixtureId={id}&seq={seq}&statKey={key}` |

Fixtures give us the match list. Scores snapshots and updates drive the live clock,
phase (from the status id), score, cards, and corners, and settle prediction cards.
Odds set the payout multiplier. Stat validation backs the provably-fair receipt.

### Proof of on-chain verification

Provably fair is not just a claim here. When a prediction card settles, FanField
fetches the Merkle proof for that exact stat from TxLINE and submits a
validate_stat transaction to the TxODDS oracle program on Solana mainnet. The
program checks the proof against the root anchored on-chain and confirms the stat.

Here is a real one you can open right now. It validates the corner stat that
settled the card "Corner for ENG in the next 5:00?" (fixture 18241006):

https://explorer.solana.com/tx/4gD2p84DqP9uSJ5PXt1UoKsEVo8YpPg9H6GZLY4PTYWDJcyXkoLQpMKrysxCCwcA6gLjRvxv3MkxRukJbjxQ42h9

The transaction logs show the oracle program running the full check: fixture-level
validation passes, the stat proof resolves against the on-chain root, and the
predicate evaluates to true. Each settled call's receipt in the app links to its
own transaction like this one, so any player can verify their result end to end.

## How the main parts work

This part walks through the five biggest pieces of FanField. For each piece you get
a plain description of what it does, the files behind it, and what each file does.
Read this and you will understand how the app is built and how the parts fit
together.

### 1. Merkle proof and the on-chain check

What it does: when a prediction settles, FanField does more than say you won or lost.
It proves the stat really happened. It gets a Merkle proof from the data feed, then
sends a small transaction to the TxODDS program on Solana. The program checks the
proof against the record already saved on the chain. If it matches, the result is
real. Anyone can open the transaction and watch the check pass.

A Merkle proof is a short set of hashes that shows one small fact (like "home team
corners went up by one") belongs to a big batch of match data, without needing the
whole batch. The batch has one short fingerprint called the root, and that root is
saved on the chain.

Files:

- `supabase/functions/_shared/txline.ts`: talks to the TxLINE feed. The function
  `fetchStatValidation` asks the feed for the proof of one stat. The same file also
  fetches fixtures, live scores, and odds.
- `supabase/functions/_shared/proof.ts`: the function `merkleRootFrom` reads the
  proof and pulls out the root hash, the short fingerprint of the whole batch.
- `supabase/functions/_shared/anchor.ts`: builds and sends the `validate_stat`
  transaction to Solana. It packs the proof into the exact byte layout the program
  expects, adds a short note (a memo), signs it with the app wallet, and sends it.
  This file turns "we have a proof" into "the chain checked it".
- `supabase/functions/engine-tick/index.ts`: at settle time it calls the three files
  above. The feed publishes the root about once an hour, so if the proof is not ready
  yet, the engine saves the result and tries again on a later run until the
  transaction goes through.
- `supabase/functions/txline-proof/index.ts`: a small endpoint the app calls when a
  player taps "how was this proven". It fetches the proof again and returns it with
  the saved receipt.
- `frontend/src/features/receipt/ProofModal.tsx` and `Receipt.tsx`: the pop-up and
  the small receipt line a player sees. They show the question, the result, the root,
  and a link to the real transaction.

### 2. Players: lineups, who did what, and momentum

What it does: FanField shows the starting eleven and the bench for both teams, puts
the player name on every goal, card, and corner, and reads how dangerous the play is
right now. All of this comes from the live feed.

One thing to know: the live feed does not match the written docs. The real feed uses
capital field names and sends each event as a small message. Also, an event names the
player by one id (the normativeId) while the team list uses a different id (the
fixturePlayerId). The code handles both ids, so names line up with the right player.

Files:

- `supabase/functions/_shared/players.ts`: this is the brain for player data.
  - `parseLineups` reads the two team lists and splits them into home and away, each
    with shirt number, name, and starter or bench.
  - `buildPlayerIndex` maps every player id (both id types) to a short name like
    "J. Bellingham".
  - `sideMap` says which side each player id belongs to.
  - `attributeEvents` finds the latest scorer or booked player for each side.
  - `eventPlayerQueue` does the same in time order, used to rebuild replays.
  - `possessionFrom` reads how the play looks right now (Safe, Attack, Danger, or
    High Danger) and whether a goal or corner seems close.
  - `formatPlayerName` turns "Bellingham, Jude" into "J. Bellingham".
- `supabase/migrations/0019_lineups_players.sql`: adds the new database columns:
  `lineups` and `possession_type` on matches, `player` on match_events, and
  `resolved_player` on prediction_cards.
- `supabase/functions/engine-tick/index.ts`: every minute it parses the lineups and
  saves them, tags new goals and cards with the player, counts each player's goals
  and cards from the saved events, and also fills in lineups for matches that already
  finished.
- `frontend/src/features/match/LineupsPanel.tsx`: shows both teams, the starting
  eleven, a bench you can open, and small marks for goals and cards next to a name.
- `frontend/src/features/match/MomentumMeter.tsx`: shows a bar and a word like
  "danger" when the feed says a chance is building.
- `frontend/src/features/match/EventTicker.tsx`: the strip of recent events, now with
  the player name in each label.

### 3. Prediction cards (Flash Pools)

What it does: during a match, the app opens a short yes or no question, like "Corner
for England in the next 5 minutes". You pick yes or no and stake coins. When the
window ends, the engine reads the feed and settles it. The result is the same for
everyone because it comes from the feed, not from a person.

Files:

- `supabase/functions/_shared/cards.ts`: the function `generateCard` makes a new
  card. It picks the stat and the team, sets the payout, and uses momentum, so when
  the play is dangerous it leans toward goal or corner cards. `statKey` maps a stat
  and match phase to the exact number used to read that stat from the feed.
- `supabase/functions/place-call/index.ts`: runs when a player locks a call. It
  checks the card is still open, checks the player has enough coins, and saves the
  pick. It runs on the server, so a player cannot fake a balance or a stake.
- `supabase/functions/_shared/scoring.ts`: the function `score` works out the coins
  won or lost, the leaderboard points, and the new streak once a card settles.
- `supabase/functions/engine-tick/index.ts`: opens a new card when none is open, and
  settles the due card by comparing the feed stat now to the value when the card
  opened. It writes the receipt and updates coins and streaks.
- `frontend/src/features/prediction/PredictionCard.tsx`: the card a player sees. Yes
  and no buttons, the stake stepper, the countdown ring, and the result view after
  it settles.
- `frontend/src/lib/useLiveMatch.ts` and `frontend/src/lib/api.ts`: keep the match,
  the events, and the current card fresh in the browser using Supabase Realtime.

### 4. Telegram bot

What it does: a player can link their FanField account to Telegram and get the same
alerts there. Goals, kick-off, full-time, new cards, and tournament results.

Files:

- `supabase/functions/telegram/index.ts`: the link flow. It makes a short code, and
  when the player starts the bot with that code, it ties one Telegram chat to one
  account. It can also unlink.
- `supabase/functions/telegram-webhook/index.ts`: the endpoint Telegram calls when
  someone messages the bot. It checks a secret so only real Telegram requests get in,
  reads the code, and sends the welcome message.
- `supabase/functions/_shared/telegram.ts`: the send helpers. `sendToChat` sends to
  one chat, and `broadcastTelegram` sends to many at once.
- `supabase/functions/_shared/notify.ts`: the function `notifyAll` sends one event to
  all three places at once, the in-app inbox, browser push, and Telegram, and each
  one respects the player's own settings.

### 5. Voice agent (Angel)

What it does: Angel is a voice buddy. A player can ask out loud for the score,
corners, cards, or their own streak, and she answers from the live feed. The first
five sessions are free, then there is a small monthly plan paid in USDC.

Files:

- `supabase/functions/voice-session/index.ts`: the server side. It checks how many
  free trials the player has left, checks if their paid plan is active, and when a
  player pays, it verifies the USDC payment on Solana before giving access. It holds
  the voice key, so the key never reaches the browser.
- `supabase/functions/_shared/solana.ts`: the function `verifyUsdcPayment` reads the
  chain to confirm the player really sent the USDC to the app wallet.
- `frontend/src/features/voice/useAngel.ts`: runs the live voice chat in the browser
  and handles the back and forth talking.
- `frontend/src/features/voice/angelTools.ts`: the list of things Angel can look up,
  like score and streak, wired to real data.
- `frontend/src/features/voice/AngelButton.tsx`, `AngelCaption.tsx`, and
  `AngelPaywall.tsx`: the button to start her, the live captions, and the pay screen
  once the free trials run out.
- `frontend/src/lib/voiceApi.ts`: the browser side that calls `voice-session` to
  start a session and to check access.

## What you can do

- Play along with live matches and call the next goal, card, or corner.
- Build a streak. A longer streak raises your score multiplier.
- Earn coins and climb a global leaderboard.
- Join tournaments with a free points stack and compete for host-funded USDC prizes.
- Rewatch any finished match in Replay mode, with an animated timeline of events.
- Talk to Angel, the voice agent. Ask for the score, corners, cards, or your own
  streak out loud and she answers from the live TxLINE data (five free sessions,
  then a small monthly subscription). Also at agent.fanfield.xyz.
- Get alerts in the app, as browser push, and on Telegram.
- Sign in with a username and password or with a Solana wallet, and link the other later.

## How a prediction works

During a live match, FanField opens a prediction card with a simple yes or no
question and a short window, for example "Corner for England in the next 5 minutes".
You place a call and stake some coins. When the window closes, the engine reads the
live feed and settles the card:

- If the feed confirms the event, "yes" wins and "no" loses.
- If the feed cannot confirm the event in time, the card is voided, your stake is
  returned, and your streak is kept.

Because settlement uses a verifiable feed and not a person, the result is the same
for everyone and can be checked. Winning odds are weighted using the live match odds
when they are available, so harder calls pay more.

## Tournaments (Prediction Battles)

A tournament is a contest built on a single match.

- Entry is free. Every player starts with the same points stack (1,000 points).
- The host funds a USDC prize pool and sets how it splits across the top finishers.
- Players earn and lose points on the tournament's own prediction cards during the match.
- When the match ends, final standings are locked from the live feed.
- The host pays winners directly from their own wallet. FanField verifies each payment
  on-chain and marks the payout as paid once the transaction checks out.

FanField never takes custody of prize money. It only records standings and confirms
that the on-chain payment matches the amount owed.

## Notifications

FanField sends the same events across three channels, and each is optional:

- In-app inbox, updated live.
- Browser push notifications.
- Telegram, through the FanField bot.

Events include pre-match reminders, kick-off and full-time, goals, cards, corners,
new prediction cards to play, and tournament results. Match-event alerts go only to
people who are playing or following that match, and every alert respects the user's
notification settings. To turn on Telegram, a user opens You, taps Connect Telegram,
and starts the bot with a one-time code.

## What we use from TxODDS

Live match data comes from the TxODDS TxLINE feed. FanField uses it as the single
source of truth for both the live experience and settlement:

- Fixtures. The World Cup schedule is synced into the app's match list.
- Live scores and match state. The feed's status id sets the match phase (pre-match,
  first half, half-time, second half, full-time), and the feed clock gives the real
  match minute. Placeholder entries without a status id are ignored so a finished
  match is never shown as live.
- Live statistics. Goals, cards, and corners are read from the feed's per-period stat
  values and turned into pitch events and prediction settlement.
- Odds. When market odds are available, the implied win probability is used to price
  a prediction card's multiplier, so calls are weighted by how likely they are.
- Verifiable settlement(https://explorer.solana.com/tx/4gD2p84DqP9uSJ5PXt1UoKsEVo8YpPg9H6GZLY4PTYWDJcyXkoLQpMKrysxCCwcA6gLjRvxv3MkxRukJbjxQ42h9). Prediction cards are resolved against the feed, and each
  settled call keeps a receipt that references the TxODDS oracle anchored on Solana.

Access uses a guest token plus an API token, handled entirely on the server. No feed
credentials are ever exposed to the browser.

## Tech stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS.
- Backend: Supabase, Postgres, Auth, Realtime, and Edge Functions (Deno).
- Data: TxODDS TxLINE feed.
- Chain: Solana, read through an RPC endpoint for payout verification and receipts.
- Wallet sign-in: Reown AppKit (WalletConnect and injected wallets).
- Notifications: Supabase Realtime (inbox), Firebase Cloud Messaging (push), Telegram Bot API.

## Architecture

The browser app never talks to the database or the data feed directly. All game
logic and every secret live on the server.

```
                        +---------------------------+
                        |  Browser app (React/Vite) |
                        |  play, chat, tournaments  |
                        +---------------------------+
                          |  reads (Realtime, RLS)  ^  writes (session)
                          v                         |
       +--------------------------------------------------------------+
       |                    Supabase                                  |
       |   Postgres + RLS      Realtime        Auth                   |
       |                                                              |
       |   Edge Functions (Deno, service role)                       |
       |   engine-tick (every minute) . tournaments . squads .       |
       |   match-predict . chat . telegram(+webhook) . auth          |
       +--------------------------------------------------------------+
             |                      |                       |
             v                      v                       v
     +----------------+   +------------------+   +----------------------+
     | TxLINE / TxODDS|   |  Solana RPC      |   |  FCM + Telegram      |
     | fixtures,      |   |  verify USDC     |   |  push + bot alerts   |
     | scores, odds,  |   |  payouts, oracle |   |                      |
     | stat proofs    |   |  receipts        |   |                      |
     +----------------+   +------------------+   +----------------------+
```


- A scheduled Edge Function (the engine) runs every minute. It syncs fixtures,
  advances live matches from the feed, opens and settles prediction cards, updates
  coins and streaks, finalizes tournament standings, and sends notifications.
- Edge Functions handle sign-in, tournaments, payouts, and the Telegram link and
  webhook. They authenticate the caller from their session and use the service role
  only on the server.
- Row Level Security is on for user data, so people can read and change only their
  own rows. Public tables such as matches and tournaments are read-only to everyone.
- Shared work lives in `supabase/functions/_shared` (feed client, scoring, odds,
  notifications, and so on).

Shared link previews are rendered on the host as serverless functions, so a shared
match, tournament, or replay link unfurls as a branded card on social apps.

## Running it locally

You need Node 18 or newer and a Supabase project.

```bash
cd frontend
cp .env.example .env    # fill in the values below
npm install
npm run dev
```

The app runs on http://localhost:5173.

Backend migrations and Edge Functions are deployed with the Supabase CLI:

```bash
cd supabase
supabase db push
supabase functions deploy
```

See `supabase/README.md` for the full backend setup, including the scheduled engine
and the Telegram webhook.

## Environment and secrets

The frontend reads a small set of public values from `.env`:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SOLANA_CLUSTER`
- Reown and Firebase public keys used by the browser SDKs

All private values are Supabase Edge Function secrets and never appear in the repo or
in the browser. These include the service role key, the TxODDS feed tokens, the cron
secret, the Firebase service account, and the Telegram bot token and webhook secret.
Secret files and `.env` files are git-ignored.

## Security

- No private keys in the client. The browser only ever holds public keys. The service
  role key, feed tokens, and bot token are server-only secrets.
- Row Level Security on all user tables. Users can read and write only their own data.
  Writes that affect balances or standings run on the server with the service role.
- Protected server actions. The engine and tournament settlement require a shared cron
  secret. Marking a payout as paid is limited to the tournament host and is verified
  on-chain before it is accepted.
- Verified Telegram webhook. The webhook only accepts requests that carry the correct
  secret token, and one Telegram chat maps to exactly one account.
- No fund custody. Hosts pay winners directly. FanField only reads the chain to confirm
  a payment happened.
- Safe link previews. Shared-link cards are built from a fixed canonical origin, so a
  spoofed request header cannot poison a cached preview.

## Screenshots

Add captures from fanfield.xyz to `docs/screenshots/` and they will show here.

![Lobby — live and upcoming matches](docs/screenshots/lobby.png)

![Match room — live prediction card](docs/screenshots/match-room.png)

![Tournament — standings and prize](docs/screenshots/tournament.png)

![Replay — animated match timeline](docs/screenshots/replay.png)

## Project layout

```
field/
  frontend/    React app (UI, routing, client data access)
  supabase/    Postgres migrations and Edge Functions (the backend)
  backend/     One-off chain and feed scripts, plus reference docs
  docs/        Feed and API reference, screenshots
```

---

Built for the World Cup. Come play at **fanfield.xyz**.
