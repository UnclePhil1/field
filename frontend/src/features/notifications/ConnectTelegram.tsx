import { useCallback, useEffect, useRef, useState } from 'react';
import { telegramApi, type TelegramLink } from '../../lib/telegramApi';
import { StatLabel } from '../../components/StatLabel';
import { Button } from '../../components/Button';

function TelegramGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.94 4.4l-3.3 15.56c-.24 1.1-.9 1.37-1.83.85l-5.05-3.72-2.44 2.35c-.27.27-.5.5-1.02.5l.36-5.13L18.1 6.4c.4-.36-.09-.56-.63-.2L6.9 13.06l-4.9-1.53c-1.07-.33-1.09-1.07.22-1.58L20.55 2.9c.89-.33 1.67.2 1.39 1.5z" />
    </svg>
  );
}

export function ConnectTelegram() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [tgUsername, setTgUsername] = useState<string | null>(null);
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await telegramApi.status();
      setConnected(s.connected);
      setTgUsername(s.tg_username);
      return s.connected;
    } catch {
      setConnected(false);
      return false;
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [refresh]);

  async function startLink() {
    setBusy(true);
    setError(null);
    try {
      const l = await telegramApi.link();
      setLink(l);
      window.open(l.url, '_blank', 'noopener');
      let ticks = 0;
      pollRef.current = window.setInterval(async () => {
        ticks += 1;
        const done = await refresh();
        if (done || ticks > 40) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          if (done) setLink(null);
        }
      }, 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start linking');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await telegramApi.unlink();
      setConnected(false);
      setTgUsername(null);
      setLink(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-edge bg-turf p-4">
      <div className="flex items-center gap-2">
        <span className="text-[#2AABEE]"><TelegramGlyph /></span>
        <StatLabel>Telegram alerts</StatLabel>
      </div>

      {connected ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-chalk">Connected{tgUsername ? ` as @${tgUsername}` : ''}.</p>
            <p className="mt-0.5 text-xs text-muted">Goals, cards, corners, prediction cards and tournament results land in your chat.</p>
          </div>
          <Button variant="turf" size="sm" disabled={busy} onClick={disconnect}>Disconnect</Button>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-sm text-chalk-dim">
            Get every match moment on Telegram — free, instant, no app permissions needed.
          </p>
          {link ? (
            <div className="mt-3 rounded-card border border-edge-2 bg-turf-2 p-3">
              <p className="text-xs text-muted">
                Telegram should have opened. If not, open{' '}
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-grass hover:underline">
                  @{link.bot}
                </a>{' '}
                and send <span className="tabular font-semibold text-chalk">/start {link.code}</span>.
              </p>
              <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                <span className="h-2 w-2 animate-live-pulse rounded-full bg-grass" />
                Waiting for you to confirm in Telegram…
              </p>
            </div>
          ) : (
            <Button variant="grass" size="md" className="mt-3" leftIcon={<TelegramGlyph size={16} />} disabled={busy} onClick={startLink}>
              {busy ? 'Preparing…' : 'Connect Telegram'}
            </Button>
          )}
          {error && <p className="mt-2 text-xs text-flare-2">{error}</p>}
        </div>
      )}
    </section>
  );
}
