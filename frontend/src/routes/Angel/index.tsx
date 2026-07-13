import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAngel } from '../../features/voice/useAngel';
import { AngelPaywall } from '../../features/voice/AngelPaywall';
import { AngelCaption } from '../../features/voice/AngelCaption';
import { Logo } from '../../components/Logo';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Tap the mic and ask about any match',
  connecting: 'Connecting…',
  listening: 'Listening…',
  speaking: 'Angel is speaking',
  locked: 'Free sessions used',
  error: 'Something went wrong',
};

export function AngelPage() {
  const { status, transcript, error, access, refreshAccess, start, stop } = useAngel();
  const live = status === 'listening' || status === 'speaking' || status === 'connecting';

  useEffect(() => { refreshAccess(); }, [refreshAccess]);
  useEffect(() => stop, [stop]);

  return (
    <div className="dot-grid relative flex min-h-full flex-col items-center justify-between bg-pitch px-5 py-6">
      <header className="flex w-full max-w-[560px] items-center justify-between">
        <Link to="/play" className="text-xs font-semibold text-muted hover:text-chalk">← Back</Link>
        <span className="chip-label">Angel · Voice</span>
        {access && !access.subActive ? (
          <span className="tabular text-[11px] font-bold text-chalk-dim">{access.trialsLeft} free left</span>
        ) : access?.subActive ? (
          <span className="text-[11px] font-bold text-grass">Pro</span>
        ) : <span />}
      </header>

      <main className="flex flex-col items-center">
        <div
          className={['angel-orb', status === 'speaking' ? 'angel-orb--speaking' : ''].join(' ')}
          style={{ width: 'min(40vw, 200px)', height: 'min(40vw, 200px)' }}
        >
          <Logo size={110} className={status === 'speaking' ? 'drop-shadow-[0_0_24px_rgba(43,212,107,0.8)]' : 'drop-shadow-[0_0_10px_rgba(43,212,107,0.35)]'} />
        </div>

        <h1 className="mt-8 text-xl font-extrabold tracking-display text-chalk">Angel</h1>
        <p className="mt-1 text-sm text-chalk-dim">{STATUS_LABEL[status]}</p>
        {error && <p className="mt-2 text-xs text-flare-2">{error}</p>}

        <AngelCaption text={transcript} className="mt-5 max-h-32 w-full max-w-[480px] px-4 text-base" />

        {status === 'locked' && (
          <div className="mt-6 w-full max-w-[420px]">
            <AngelPaywall access={access} onSubscribed={() => { refreshAccess(); }} />
          </div>
        )}
      </main>

      <footer className="flex flex-col items-center gap-3 pb-4">
        {status !== 'locked' && (
          <button
            onClick={() => (live ? stop() : start())}
            aria-label={live ? 'Stop' : 'Start talking'}
            className={[
              'grid h-16 w-16 place-items-center rounded-full transition-transform active:scale-95',
              live ? 'border border-flare/50 bg-flare/15 text-flare-2' : 'bg-grass text-ink shadow-grass hover:scale-105',
            ].join(' ')}
          >
            {live ? <StopIcon /> : <MicIcon size={26} />}
          </button>
        )}
        <p className="text-[11px] text-muted">“How many corners does Belgium have?” · “Who leads the board?”</p>
      </footer>
    </div>
  );
}

function MicIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
    </svg>
  );
}
