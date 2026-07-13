import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAngel } from './useAngel';
import { AngelPaywall } from './AngelPaywall';
import { AngelCaption } from './AngelCaption';
import { Logo } from '../../components/Logo';

const STATUS_LABEL: Record<string, string> = {
  idle: 'Tap start and ask me anything',
  connecting: 'Connecting…',
  listening: 'Listening…',
  speaking: 'Angel is speaking',
  locked: 'Free sessions used',
  error: 'Something went wrong',
};

export function AngelButton() {
  const [open, setOpen] = useState(false);
  const { status, transcript, error, access, refreshAccess, start, stop } = useAngel();
  const live = status === 'listening' || status === 'speaking' || status === 'connecting';

  function toggleOpen() {
    if (open) { stop(); setOpen(false); }
    else { setOpen(true); refreshAccess(); }
  }

  return (
    <>
      <button
        onClick={toggleOpen}
        aria-label="Talk to Angel"
        className="fixed bottom-40 right-4 z-40 grid place-items-center rounded-full border border-grass/50 bg-pitch-deep text-grass shadow-grass transition-transform hover:scale-105 active:scale-95 lg:bottom-[5.5rem]"
        style={{ height: 52, width: 52 }}
      >
        <MicIcon size={22} />
        {live && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-live-pulse rounded-full bg-grass ring-2 ring-pitch" />}
      </button>

      {open && (
        <div className="fixed bottom-56 right-4 z-40 w-[min(330px,90vw)] overflow-hidden rounded-card-lg border border-grass/25 bg-pitch-deep/90 shadow-card backdrop-blur-md lg:bottom-36">
          <div className="dot-grid p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={['angel-orb', status === 'speaking' ? 'angel-orb--speaking' : ''].join(' ')}
                  style={{ width: 52, height: 52 }}
                >
                  <Logo size={26} />
                </div>
                <div>
                  <p className="text-sm font-extrabold tracking-display text-chalk">Angel</p>
                  <p className="text-[11px] text-grass">{STATUS_LABEL[status]}</p>
                </div>
              </div>
              <button onClick={toggleOpen} className="rounded-full px-2 py-1 text-xs text-muted hover:text-chalk">✕</button>
            </div>

            <AngelCaption text={transcript} className="mt-3 max-h-24 text-sm" />
            {error && <p className="mt-2 text-xs text-flare-2">{error}</p>}

            {status === 'locked' ? (
              <div className="mt-3"><AngelPaywall access={access} onSubscribed={refreshAccess} /></div>
            ) : (
              <button
                onClick={() => (live ? stop() : start())}
                className={[
                  'mt-3 w-full rounded-[13px] py-2.5 text-sm font-bold transition-colors',
                  live ? 'border border-flare/40 bg-flare/10 text-flare-2' : 'bg-grass text-ink shadow-grass hover:bg-grass-deep',
                ].join(' ')}
              >
                {live ? 'Stop' : 'Start talking'}
              </button>
            )}

            <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
              {access && !access.subActive
                ? <span className="tabular">{access.trialsLeft} free session{access.trialsLeft === 1 ? '' : 's'} left</span>
                : access?.subActive ? <span className="font-bold text-grass">Pro active</span> : <span />}
              <Link to="/angel" onClick={() => { stop(); setOpen(false); }} className="font-semibold text-grass hover:underline">
                Full experience →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
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
