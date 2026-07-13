import type { OddsOffer } from './txline.ts';

export function impliedWinProbability(offers: OddsOffer[], side: 'home' | 'away'): number | null {
  for (const o of offers) {
    const names = (o.PriceNames ?? []).map((n) => n.toLowerCase());
    const pct = o.Pct ?? [];
    if (names.length < 2 || pct.length !== names.length) continue;
    const homeIdx = names.findIndex((n) => n === '1' || n.includes('home'));
    const awayIdx = names.findIndex((n) => n === '2' || n.includes('away'));
    const idx = side === 'home' ? homeIdx : awayIdx;
    if (idx < 0) continue;
    const raw = pct[idx];
    if (!raw || raw === 'NA') continue;
    const p = parseFloat(raw) / 100;
    if (p > 0 && p < 1) return p;
  }
  return null;
}

export function multiplierFromProb(p: number): number {
  const bounded = Math.max(0.18, Math.min(0.85, p));
  return Math.round((1 / bounded) * 10) / 10; // one decimal, ~1.2–5.5
}
