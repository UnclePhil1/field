import { useEffect, useRef } from 'react';

export function AngelCaption({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text]);

  if (!text) return null;
  const words = text.split(/(\s+)/);

  return (
    <div ref={ref} className={['angel-caption', className].join(' ')} aria-live="polite">
      <p className="text-center font-semibold leading-relaxed text-chalk">
        {words.map((w, i) =>
          w.trim() === '' ? w : <span key={i} className="angel-caption__word">{w}</span>,
        )}
      </p>
    </div>
  );
}
