import { Link, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../app/AuthStore';
import { Pitch } from '../../components/Pitch';
import {
  ArrowIcon,
  BoardIcon,
  CoinIcon,
  FlameIcon,
  ShieldIcon,
  TrophyIcon,
} from '../../components/Icons';

const FEATURES = [
  { Icon: FlameIcon, title: 'Call the next 5 minutes', body: 'Fast yes/no Flash Pools on goals, cards and corners. Tap before they lock.' },
  { Icon: CoinIcon, title: 'Build a streak', body: 'Win to grow your stack and your multiplier. A long run is worth protecting.' },
  { Icon: ShieldIcon, title: 'Provably fair', body: 'Every result settles against live data anchored on Solana. Check the receipt.' },
  { Icon: BoardIcon, title: 'Climb the board', body: 'Live per-match and tournament-long leaderboards across all 104 games.' },
  { Icon: TrophyIcon, title: 'Flash Pool battles', body: 'Free-entry tournaments with real USDC prizes paid by the host, verified on-chain.' },
  { Icon: ArrowIcon, title: 'Free to play', body: 'Free coins that refill daily. Jump straight in, no signup wall to start.' },
];

export function Landing() {
  const { status } = useAuth();
  if (status === 'ready') return <Navigate to="/play" replace />;
  const cta = '/connect';

  return (
    <div className="dot-grid min-h-dvh bg-pitch text-chalk">
      {/* top bar */}
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-5 sm:px-8">
        <span className="inline-flex items-center gap-1 text-2xl font-extrabold tracking-tightest">
          FanField<span className="text-grass">.</span>
        </span>
        <Link to={cta}>
          <PillButton solid>Connect</PillButton>
        </Link>
      </header>

      {/* hero */}
      <section className="mx-auto grid w-full max-w-[1180px] items-center gap-10 px-5 py-6 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-14">
        <div>
          <span className="chip-label">Live · World Cup</span>
          <h1 className="display mt-5 text-[15vw] leading-[0.86] sm:text-6xl lg:text-[76px]">
            <span className="text-chalk-gradient">Don’t just watch.</span>
            <br />
            <span className="text-grass-gradient">Play it live.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-chalk-dim">
            Predict the next five minutes of a live match. Build a streak, climb the board, and check
            every result yourself. Free to play, provably fair on Solana.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to={cta}><PillButton solid icon>Start playing</PillButton></Link>
            <a href="#how"><PillButton icon>How it works</PillButton></a>
          </div>
          <div className="mt-9 grid max-w-md grid-cols-3 gap-3">
            <StatBox k="Entry" v="Free" />
            <StatBox k="Results" v="Fair" />
            <StatBox k="Games" v="104" />
          </div>
        </div>

        {/* hero visual: the pitch, framed, with floating stat boxes (Xora style) */}
        <div className="relative">
          <div className="overflow-hidden rounded-card-lg border border-edge-2 bg-turf p-3">
            <Pitch events={[]} />
          </div>
          <div className="absolute left-5 top-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-grass/40 bg-pitch-deep/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-grass backdrop-blur">
              <span className="h-2 w-2 animate-live-pulse rounded-full bg-grass" /> Live 67'
            </span>
          </div>
          <div className="absolute -right-2 top-16 hidden sm:block"><StatBox k="Streak" v="×3" /></div>
          <div className="absolute -left-3 bottom-20 hidden sm:block"><StatBox k="Match" v="POR–SPA" /></div>
          <div className="absolute bottom-6 right-6"><StatBox k="Coins" v="+120" accent /></div>
        </div>
      </section>

      {/* what you get */}
      <section className="mx-auto w-full max-w-[1180px] px-5 py-16 sm:px-8">
        <div className="text-center">
          <span className="chip-label">The game</span>
          <h2 className="display mx-auto mt-5 text-4xl sm:text-6xl">
            <span className="text-chalk-gradient">Play. Streak.</span>{' '}
            <span className="text-grass-gradient">Win.</span>
          </h2>
          <p className="mt-4 text-base text-chalk-dim">Everything you need to play along the match, and nothing you don’t.</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-card-lg border border-edge bg-edge sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-pitch px-6 py-8 sm:px-8">
              <span className="grid h-10 w-10 place-items-center rounded-ctrl border border-edge-2 bg-turf text-grass">
                <f.Icon size={18} />
              </span>
              <h3 className="mt-4 text-lg font-bold text-chalk">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how a round works */}
      <section id="how" className="mx-auto w-full max-w-[1180px] px-5 py-16 sm:px-8">
        <span className="chip-label">How a round works</span>
        <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-card-lg border border-edge bg-edge sm:grid-cols-3">
          {[
            ['01', 'A Flash Pool opens', 'A timed yes/no call on the next short stretch of play.'],
            ['02', 'You make the call', 'Tap your side and stake before it locks.'],
            ['03', 'The feed settles it', 'You win or lose points, with a provably-fair receipt.'],
          ].map(([n, t, b]) => (
            <div key={n} className="bg-pitch px-7 py-9">
              <span className="tabular text-4xl font-extrabold text-grass">{n}</span>
              <h3 className="mt-3 text-lg font-bold text-chalk">{t}</h3>
              <p className="mt-1.5 text-sm text-muted">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* final CTA */}
      <section className="mx-auto w-full max-w-[1180px] px-5 py-20 text-center sm:px-8">
        <h2 className="display text-5xl sm:text-7xl">
          <span className="text-chalk-gradient">Ready to</span> <span className="text-grass-gradient">call it?</span>
        </h2>
        <p className="mt-4 text-base text-chalk-dim">Connect a Solana wallet and you’re in. No download, no buy-in.</p>
        <div className="mt-8 flex justify-center">
          <Link to={cta}><PillButton solid icon large>Start playing</PillButton></Link>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-[1180px] border-t border-edge px-5 py-8 text-center text-xs text-muted sm:px-8">
        FanField · Built on TxLINE · Anchored on Solana
      </footer>
    </div>
  );
}

/* ---------- local Xora-style pieces ---------- */

function PillButton({ children, solid, icon, large }: { children: ReactNode; solid?: boolean; icon?: boolean; large?: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-2 rounded-full font-bold transition-colors',
        large ? 'px-7 py-4 text-base' : 'px-5 py-2.5 text-sm',
        solid
          ? 'bg-grass text-ink shadow-grass hover:bg-grass-deep'
          : 'border border-edge-2 bg-turf text-chalk-dim hover:border-grass/60 hover:text-chalk',
      ].join(' ')}
    >
      {children}
      {icon && (
        <span className={['grid place-items-center rounded-full', solid ? 'bg-ink/15' : 'bg-turf-2', large ? 'h-6 w-6' : 'h-5 w-5'].join(' ')}>
          <ArrowIcon size={large ? 15 : 13} />
        </span>
      )}
    </span>
  );
}

function StatBox({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="stat-box">
      <div className="stat-box__k">{k}</div>
      <div className="stat-box__v" style={accent ? { color: 'rgb(var(--grass-rgb))' } : undefined}>{v}</div>
    </div>
  );
}
