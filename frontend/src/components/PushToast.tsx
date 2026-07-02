import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from './Logo';

interface Toast {
  id: number;
  title: string;
  body?: string;
  url?: string;
}

/** Field-themed in-app toast for FOREGROUND push messages (not OS notifications). */
export function PushToast() {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function onPush(e: Event) {
      const d = (e as CustomEvent).detail as { title: string; body?: string; url?: string };
      const id = Date.now();
      setToasts((t) => [...t, { id, ...d }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
    }
    window.addEventListener('field:push', onPush);
    return () => window.removeEventListener('field:push', onPush);
  }, []);

  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-3">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => {
            if (t.url) navigate(t.url.replace(window.location.origin, ''));
            setToasts((x) => x.filter((y) => y.id !== t.id));
          }}
          className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border border-edge-2 bg-turf px-4 py-3 text-left shadow-card animate-win-reveal"
        >
          <Logo size={20} className="mt-0.5 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-chalk">{t.title}</span>
            {t.body && <span className="mt-0.5 block text-xs text-muted">{t.body}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
