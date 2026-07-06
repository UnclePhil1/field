// Derive an odds-weighted multiplier from StablePrice odds. Defensive: returns
// null whenever a usable market isn't present, so the engine falls back to its
// heuristic. Activates automatically once real odds flow for a fixture.
import type { OddsOffer } from './txline.ts';

/** Implied probability (0..1) that `side` wins, from a match-result market. */
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

/** Fair-ish payout multiplier from a probability, bounded to a sane game range. */
export function multiplierFromProb(p: number): number {
  const bounded = Math.max(0.18, Math.min(0.85, p));
  return Math.round((1 / bounded) * 10) / 10; // one decimal, ~1.2–5.5
}
