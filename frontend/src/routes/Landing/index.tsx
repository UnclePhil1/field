import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthStore';
import { Button } from '../../components/Button';
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
  { Icon: FlameIcon, title: 'Call the next 5 minutes', body: 'Fast yes/no cards on goals, cards and corners. Tap before they lock.' },
  { Icon: CoinIcon, title: 'Build a streak', body: 'Win to grow your stack and your multiplier. A long run is worth protecting.' },
  { Icon: ShieldIcon, title: 'Provably fair', body: 'Every result settles against live data anchored on Solana. Check the receipt.' },
  { Icon: BoardIcon, title: 'Climb the board', body: 'Live per-match and tournament-long leaderboards across all 104 games.' },
  { Icon: TrophyIcon, title: 'Prediction battles', body: 'Free-entry tournaments with real USDC prizes paid by the host — verified on-chain.' },
  { Icon: ArrowIcon, title: 'Free to play', body: 'Free coins that refill daily. A game, not a betting site. No signup wall to start.' },
];

export function Landing() {
  const { status } = useAuth();
  // already signed in → straight into the app
  if (status === 'ready') return <Navigate to="/play" replace />;
  const ctaTo = '/connect';
  const ctaLabel = 'Connect wallet to play';

  return (
    <div className="app-backdrop min-h-dvh">
      {/* top bar */}
      <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-5 py-5">
        <span className="inline-flex items-baseline text-2xl font-extrabold tracking-tightest text-chalk">
          Field<span className="text-grass">.</span>
        </span>
        <Link to={ctaTo}>
          <Button variant="grass" size="sm">Connect</Button>
        </Link>
      </header>

      {/* hero */}
      <section className="mx-auto grid w-full max-w-[1100px] items-center gap-8 px-5 py-8 lg:grid-cols-2 lg:py-16">
        <div>
          <p className="eyebrow text-grass">The live second screen for the World Cup</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-display text-chalk sm:text-5xl">
            Don’t just watch the match —{' '}
            <span className="text-grass">call it, live.</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-chalk-dim">
            Open Field during a match and predict the next five minutes. Build a streak, climb the
            leaderboard, and watch every result settle against data you can actually verify on Solana.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to={ctaTo}>
              <Button variant="grass" size="lg" leftIcon={<ArrowIcon size={18} />}>{ctaLabel}</Button>
            </Link>
            {/* <span className="text-xs text-muted">Free to play · provably fair · not a betting site</span> */}
          </div>
        </div>

        {/* hero pitch visual (decorative) */}
        <div className="relative corner-arcs rounded-card-lg border border-edge-2 bg-turf p-3 shadow-card">
          <span className="arc-b" aria-hidden />
          <Pitch events={[]} />
          <div className="mt-3 flex items-center justify-between px-1">
            <span className="eyebrow">England v France</span>
            <span className="tabular text-xs font-bold text-flare-2">LIVE 67'</span>
          </div>
        </div>
      </section>

      {/* what it is */}
      <section className="mx-auto w-full max-w-[1100px] px-5 py-6">
        <div className="rounded-card-lg border border-edge bg-turf p-6 text-center">
          <p className="mx-auto max-w-2xl text-lg font-semibold leading-relaxed text-chalk">
            Field turns the phone already in your hand into a fast, social prediction game. And it proves
            every result is real using match data cryptographically anchored on Solana.
          </p>
        </div>
      </section>

      {/* features */}
      <section className="mx-auto w-full max-w-[1100px] px-5 py-8">
        <p className="eyebrow mb-4">What you get</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-card border border-edge bg-turf p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-grass/10 text-grass">
                <f.Icon size={18} />
              </span>
              <h3 className="mt-3 text-base font-bold text-chalk">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section className="mx-auto w-full max-w-[1100px] px-5 py-8">
        <p className="eyebrow mb-4">How a round works</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['1', 'A card appears', 'A timed yes/no question about the next short stretch of play.'],
            ['2', 'You make the call', 'Tap your side and stake before it locks.'],
            ['3', 'The feed settles it', 'You win or lose points — with a provably-fair receipt.'],
          ].map(([n, t, b]) => (
            <div key={n} className="rounded-card border border-edge bg-turf p-5">
              <span className="tabular text-2xl font-extrabold text-grass">{n}</span>
              <h3 className="mt-1 text-base font-bold text-chalk">{t}</h3>
              <p className="mt-1 text-sm text-muted">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* final CTA */}
      <section className="mx-auto w-full max-w-[1100px] px-5 py-12 text-center">
        <h2 className="text-3xl font-extrabold tracking-display text-chalk">Ready to call it?</h2>
        <p className="mt-2 text-sm text-muted">Connect a Solana wallet and you’re in. No download, no buy-in.</p>
        <Link to={ctaTo} className="mt-5 inline-block">
          <Button variant="grass" size="lg" leftIcon={<ArrowIcon size={18} />}>{ctaLabel}</Button>
        </Link>
      </section>

      <footer className="mx-auto w-full max-w-[1100px] px-5 py-8 text-center text-xs text-muted">
        Field · Built on TxLINE · Anchored on Solana · A free skill game, not a betting product.
      </footer>
    </div>
  );
}
