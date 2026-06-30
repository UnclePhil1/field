# Field — Frontend

A live, play-along football prediction web app. Open it during a match → a
timed yes/no card appears (“Corner for England in the next 5:00?”) → lock your
call before the ring runs out → the feed settles it → win free **coins**, build
a **streak**, climb the **leaderboard**, and every result carries a
**provably-fair receipt**. Cards only ever use **goals, cards, and corners** —
the stats Field can verify. It’s a free game, **not a betting site**.

## Run it

```bash
cd field/frontend
npm install
npm run dev      # http://localhost:5173
```

The app runs **standalone on mock data** — no backend, no TxLINE, no wallet.

```bash
npm run build      # typecheck + production build
npm run preview    # serve the build
npm run typecheck  # tsc only
```

## Stack
React 18 · Vite · TypeScript (strict) · React Router v6 · Tailwind CSS +
CSS-variable tokens · one `AppStore` context · self-hosted Inter + JetBrains
Mono. No Redux, no UI kit, no second icon library.

## How it’s wired

```
src/
├── app/        router, AppStore context, AppShell (responsive layout)
├── routes/     Lobby/  MatchRoom/  Leaderboard/  You/
├── components/ AppBar, SideNav, BottomNav, Button, Chip, CountdownRing,
│               Pitch, Modal, StatLabel, Icons
├── features/   match/  prediction/  streak/  receipt/  board/
├── lib/        mockFeed.ts, api.ts, useLiveMatch.ts, useCountdown.ts, format.ts
├── types/      index.ts  (Match, MatchEvent, PredictionCard, Settlement, …)
└── styles/     theme.css (tokens), globals.css, pitch.css
```

### Design system is a contract
All colour and shape live as CSS variables in `styles/theme.css` and are mirrored
onto Tailwind utilities in `tailwind.config.js`. **No hex in components, no
off-palette accents.** `grass` = primary/positive, `flare` = live/urgent only,
losses use `muted` (never red).

### One swappable data source
Components only ever read `useLiveMatch(matchId) → { match, events, card }`.
Today it subscribes to the mock emitter in `lib/mockFeed.ts` (via the
`lib/api.ts` boundary). Later, `lib/api.subscribeMatch` opens a WebSocket to the
Field backend emitting the **same event shape** — components don’t change. The
swap is contained to one file.

### Honest visuals
The pitch view is an **interpretation of verifiable events**, never a claim of
player tracking. Copy never implies data Field doesn’t have.

## Responsive
Mobile-first. Verified at **360 / 768 / 1280**. Mobile is a single column with a
fixed bottom nav; desktop adds a slim side nav and, in the Match Room, a
contextual rail. No horizontal scroll, touch targets ≥ 44px, visible focus
rings, `prefers-reduced-motion` respected.
