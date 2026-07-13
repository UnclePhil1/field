// deno-lint-ignore-file no-explicit-any

function toHex(v: any): string | null {
  if (v == null) return null;
  if (typeof v === 'string') {
    if (/^(0x)?[0-9a-fA-F]{16,}$/.test(v)) return v.replace(/^0x/, '').toLowerCase();
    try {
      const bytes = Uint8Array.from(atob(v), (c) => c.charCodeAt(0));
      if (bytes.length >= 8) return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch { /* not base64 */ }
    return v.toLowerCase();
  }
  if (Array.isArray(v)) return v.map((b) => Number(b).toString(16).padStart(2, '0')).join('');
  if (typeof v === 'object' && Array.isArray(v.data)) return toHex(v.data);
  return null;
}

export function merkleRootFrom(validation: any): { full: string | null; short: string } {
  if (!validation) return { full: null, short: '—' };
  const s = validation.summary ?? validation.Summary ?? {};
  const raw =
    validation.eventStatRoot ?? validation.EventStatRoot ??
    s.eventStatsSubTreeRoot ?? s.EventStatsSubTreeRoot ??
    validation.mainTreeRoot ?? validation.MainTreeRoot ??
    validation.root ?? validation.Root ?? null;
  const hex = toHex(raw);
  if (!hex) return { full: null, short: '—' };
  const short = hex.length > 12 ? `${hex.slice(0, 6)}…${hex.slice(-4)}` : hex;
  return { full: hex, short };
}
