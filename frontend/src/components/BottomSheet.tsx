import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
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
        className="sheet-panel-bottom absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-[560px] flex-col rounded-t-card-lg border-t border-edge-2 bg-turf shadow-card"
        style={{ height: '75vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="eyebrow">{title}</span>
          <button onClick={onClose} aria-label="Close" className="rounded-full px-2 py-1 text-sm text-muted hover:text-chalk">Close</button>
        </div>
        <div className="mx-auto mb-1 mt-1 h-1 w-10 rounded-full bg-edge-2" aria-hidden />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
