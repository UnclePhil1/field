import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../app/AppStore';
import { useAuth } from '../../app/AuthStore';
import { supabase } from '../../lib/supabase';
import { fetchMatches } from '../../lib/api';
import { squadsApi } from '../../lib/squadsApi';
import { Sheet } from '../../components/Sheet';
import { ChatIcon } from '../../components/Icons';
import { ChatPanel } from './ChatPanel';

// A chat button pinned bottom-right on every screen. Opens a drawer where the
// user switches between the public match room and their private squad chat.
export function FloatingChat() {
  const { activeMatchId } = useAppStore();
  const { userId } = useAuth();
  const [liveId, setLiveId] = useState<string | null>(null);
  const [squadCode, setSquadCode] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'match' | 'squad'>('match');
  const [unread, setUnread] = useState(0);
  const openRef = useRef(false);
  useEffect(() => { openRef.current = open; if (open) setUnread(0); }, [open]);

  // When not inside a match room, fall back to the current live match.
  useEffect(() => {
    if (activeMatchId) return;
    fetchMatches().then((ms) => setLiveId(ms.find((m) => m.status === 'live')?.id ?? null)).catch(() => {});
  }, [activeMatchId]);

  const matchId = activeMatchId ?? liveId;

  useEffect(() => {
    if (!matchId) { setSquadCode(null); return; }
    squadsApi.mine(matchId).then((r) => setSquadCode(r.squad?.code ?? null)).catch(() => setSquadCode(null));
  }, [matchId]);

  useEffect(() => { if (!squadCode && tab === 'squad') setTab('match'); }, [squadCode, tab]);

  // Count messages from others that land while the drawer is closed.
  useEffect(() => {
    const ids = [matchId, squadCode].filter(Boolean) as string[];
    if (ids.length === 0) return;
    const bump = (row: { user_id?: string }) => {
      if (!openRef.current && row.user_id !== userId) setUnread((n) => Math.min(99, n + 1));
    };
    const channels = ids.map((id) =>
      supabase
        .channel(`chat-unread:${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `scope_id=eq.${id}` },
          (p) => bump(p.new as { user_id?: string }))
        .subscribe(),
    );
    return () => { channels.forEach((c) => supabase.removeChannel(c)); };
  }, [matchId, squadCode, userId]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open chat"
        className="fixed bottom-24 right-4 z-40 grid place-items-center rounded-full bg-grass text-ink shadow-grass transition-transform hover:scale-105 active:scale-95 lg:bottom-6"
        style={{ height: 52, width: 52 }}
      >
        <ChatIcon size={24} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-flare px-1 text-[11px] font-bold text-ink ring-2 ring-pitch">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Chat">
        <div className="p-4">
          {!matchId ? (
            <p className="py-8 text-center text-sm text-muted">Chat opens when a match is live. Check back at kickoff.</p>
          ) : (
            <>
              <div className="mb-3 flex gap-1 rounded-full border border-edge-2 bg-turf-2 p-0.5">
                <Tab active={tab === 'match'} onClick={() => setTab('match')}>Public</Tab>
                <Tab active={tab === 'squad'} onClick={() => setTab('squad')} disabled={!squadCode}>
                  Squad{squadCode ? '' : ' · none'}
                </Tab>
              </div>
              {tab === 'squad' && squadCode ? (
                <ChatPanel scope="squad" scopeId={squadCode} note="Private — only your squad can see this." />
              ) : (
                <ChatPanel scope="match" scopeId={matchId} note="Public room — everyone watching this match. Keep it friendly." />
              )}
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}

function Tab({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
        active ? 'bg-grass/15 text-grass' : 'text-muted hover:text-chalk',
        disabled ? 'cursor-not-allowed opacity-50' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
