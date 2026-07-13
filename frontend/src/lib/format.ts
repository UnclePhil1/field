export function formatCoins(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatMultiplier(m: number): string {
  return `×${m.toFixed(1)}`;
}

export function formatClock(minute: number): string {
  return `${minute}'`;
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function formatPoints(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('en-US')}`;
}

export function shortHash(hash: string): string {
  if (hash.length <= 9) return hash;
  return `${hash.slice(0, 4)}…${hash.slice(-4)}`;
}

export function phaseLabel(phase: string): string {
  switch (phase) {
    case '1H': return '1st half';
    case 'HT': return 'half time';
    case '2H': return '2nd half';
    case 'ET': return 'extra time';
    case 'FT': return 'full time';
    case 'PRE': return 'pre-match';
    default: return phase;
  }
}

export function untilKickoff(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return 'kicking off';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}
