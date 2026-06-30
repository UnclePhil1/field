import { useEffect, useRef, useState } from 'react';

/**
 * Counts down to an absolute epoch (ms). Returns seconds remaining and
 * a 0..1 progress value (1 = full window, 0 = locked).
 */
export function useCountdown(locksAt: number, windowSeconds: number) {
  const compute = () => Math.max(0, (locksAt - Date.now()) / 1000);
  const [remaining, setRemaining] = useState(compute);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;
      setRemaining(compute());
      raf.current = window.setTimeout(tick, 250) as unknown as number;
    };
    tick();
    return () => {
      active = false;
      if (raf.current != null) clearTimeout(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locksAt]);

  const progress = windowSeconds > 0 ? Math.min(1, Math.max(0, remaining / windowSeconds)) : 0;
  const locked = remaining <= 0;
  return { remaining, progress, locked };
}
