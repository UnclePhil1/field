import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet-overlay absolute inset-0 bg-black/55 backdrop-blur-[1px]" onClick={onClose} />
      <div
        className="sheet-panel absolute right-0 top-0 flex h-dvh w-[min(360px,88vw)] flex-col border-l border-edge-2 bg-turf shadow-card"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <span className="eyebrow">{title}</span>
          <button onClick={onClose} aria-label="Close" className="rounded-full px-2 py-1 text-sm text-muted hover:text-chalk">
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
