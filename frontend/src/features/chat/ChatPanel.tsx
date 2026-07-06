import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { chatApi, type ChatMessage, type ChatScope } from '../../lib/chatApi';
import { useAuth } from '../../app/AuthStore';

const EMOJIS = ['⚽', '🔥', '😂', '😍', '😮', '😱', '😭', '👏', '👍', '👎', '🙌', '💪', '🎉', '🏆', '🥅', '🟨', '🟥', '🚩', '⏱️', '💔', '😤', '🤯', '🫡', '🇵🇹', '🇪🇸', '🇦🇷', '🇧🇷', '🇫🇷', '🇬🇧', '🇺🇸', '🥳', '💚'];

// A live chat feed for one room (a match or a squad). History + live updates come
// straight from the table; sends are guarded by the chat function.
export function ChatPanel({ scope, scopeId, note }: { scope: ChatScope; scopeId: string; note: string }) {
  const { userId } = useAuth();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const bottom = useRef<HTMLDivElement>(null);

  const add = useCallback((m: ChatMessage) => {
    if (seen.current.has(m.id)) return;
    seen.current.add(m.id);
    setMsgs((xs) => [...xs, m]);
  }, []);

  useEffect(() => {
    seen.current = new Set();
    setMsgs([]);
    chatApi.history(scopeId).then((rows) => rows.forEach(add)).catch(() => {});
    const channel = supabase
      .channel(`chat:${scopeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `scope_id=eq.${scopeId}` },
        (p) => add(p.new as ChatMessage))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [scopeId, add]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setErr(null);
    try {
      await chatApi.send(scope, scopeId, body);
      setText('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send');
    } finally { setBusy(false); }
  }

  async function report(id: string) {
    try { await chatApi.report(id); setErr('Reported. Thanks for keeping it clean.'); } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col">
      <p className="mb-2 text-xs text-muted">{note}</p>
      <div className="flex h-64 flex-col gap-2 overflow-y-auto rounded-card border border-edge bg-turf-2 p-3 [scrollbar-width:thin]">
        {msgs.length === 0 ? (
          <p className="m-auto text-xs text-muted">No messages yet — say something.</p>
        ) : (
          msgs.map((m) => {
            const mine = m.user_id === userId;
            return (
              <div key={m.id} className={['group flex flex-col', mine ? 'items-end' : 'items-start'].join(' ')}>
                <div className={['max-w-[85%] rounded-[12px] px-3 py-1.5', mine ? 'bg-grass/15 text-chalk' : 'bg-turf text-chalk'].join(' ')}>
                  {!mine && <span className="mb-0.5 block text-[11px] font-bold text-grass">{m.name}</span>}
                  <span className="whitespace-pre-wrap break-words text-sm">{m.body}</span>
                </div>
                {!mine && (
                  <button onClick={() => report(m.id)} className="mt-0.5 text-[10px] text-muted opacity-0 transition-opacity hover:text-flare-2 group-hover:opacity-100">
                    Report
                  </button>
                )}
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>

      {err && <p className="mt-1 text-[11px] text-flare-2">{err}</p>}

      {userId ? (
        <div className="relative mt-2 flex gap-2">
          {showEmoji && (
            <div className="absolute bottom-12 left-0 z-10 grid w-64 grid-cols-8 gap-1 rounded-card border border-edge-2 bg-turf p-2 shadow-card">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => { setText((t) => (t + e).slice(0, 240)); setShowEmoji(false); }} className="rounded-md p-1 text-lg hover:bg-turf-2">
                  {e}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowEmoji((s) => !s)}
            aria-label="Emoji"
            className="grid w-9 shrink-0 place-items-center rounded-[12px] border border-edge-2 bg-turf-2 text-lg hover:border-grass/60"
          >
            🙂
          </button>
          <input
            value={text}
            maxLength={240}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Say something…"
            className="min-w-0 flex-1 rounded-[12px] border border-edge-2 bg-turf-2 px-3 py-2 text-sm text-chalk outline-none focus:border-grass/60"
          />
          <button
            onClick={send}
            disabled={busy || !text.trim()}
            className="rounded-[12px] bg-grass px-4 text-sm font-bold text-ink disabled:opacity-45"
          >
            Send
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">Sign in to join the chat.</p>
      )}
    </div>
  );
}
