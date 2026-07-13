import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../app/AuthStore';
import { BellIcon } from './Icons';
import { Sheet } from './Sheet';

interface Notification {
  id: string;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setItems((data as Notification[]) ?? []);
  }, []);

  useEffect(() => {
    if (!userId) return;
    load();
    const channel = supabase
      .channel(`notif:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, load]);

  const unread = items.filter((n) => !n.read).length;

  async function markAllRead() {
    const ids = items.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    setItems((xs) => xs.map((n) => ({ ...n, read: true })));
    await supabase.from('notifications').update({ read: true }).in('id', ids);
  }

  function openItem(n: Notification) {
    setOpen(false);
    if (!n.read) supabase.from('notifications').update({ read: true }).eq('id', n.id);
    if (n.url) navigate(n.url.replace(window.location.origin, ''));
  }

  if (!userId) return null;

  return (
    <>
      <button
        onClick={() => { setOpen(true); markAllRead(); }}
        aria-label="Notifications"
        className="relative grid h-8 w-8 place-items-center rounded-full text-chalk-dim transition-colors hover:bg-turf-2 hover:text-chalk"
      >
        <BellIcon size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-flare px-1 text-[10px] font-bold text-ink">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Notifications">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Nothing yet. Play a card and results land here.</p>
        ) : (
          <ul className="divide-y divide-edge/60">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => openItem(n)}
                  className={['flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-turf-2', n.read ? '' : 'bg-grass/[0.06]'].join(' ')}
                >
                  <span className="text-sm font-semibold text-chalk">{n.title}</span>
                  {n.body && <span className="text-xs text-muted">{n.body}</span>}
                  <span className="tabular mt-0.5 text-[10px] text-muted">{timeAgo(n.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
