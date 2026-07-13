interface Window { from: string; to: string; label: string }

const WC_2026: Window[] = [
  { from: '2026-06-11', to: '2026-06-27', label: 'Group Stage' },
  { from: '2026-06-28', to: '2026-07-03', label: 'Round of 32' },
  { from: '2026-07-04', to: '2026-07-07', label: 'Round of 16' },
  { from: '2026-07-09', to: '2026-07-11', label: 'Quarter-Finals' },
  { from: '2026-07-14', to: '2026-07-15', label: 'Semi-Finals' },
  { from: '2026-07-18', to: '2026-07-18', label: 'Third Place' },
  { from: '2026-07-19', to: '2026-07-19', label: 'Final' },
];

export function stageFor(startTimeMs: number, competition: string): string | null {
  if (!/world cup/i.test(competition)) return null;
  const day = new Date(startTimeMs).toISOString().slice(0, 10); // YYYY-MM-DD
  for (const w of WC_2026) {
    if (day >= w.from && day <= w.to) return w.label;
  }
  return null;
}
