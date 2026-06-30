// Server-authoritative scoring — ported verbatim from the frontend's original
// AppStore.settleCard math so behaviour is identical, just trustworthy now.

export const STREAK_STEP = 0.1; // +10% payout per streak rung

export interface ScoreResult {
  won: boolean;
  payout: number; // coins gained on a win (0 on loss)
  points: number; // leaderboard points (+ on win, −stake on loss)
  newStreak: number;
  newCoins: number;
}

export function score(params: {
  pick: 'yes' | 'no';
  outcome: 'yes' | 'no';
  stake: number;
  cardMultiplier: number;
  streak: number;
  coins: number;
}): ScoreResult {
  const { pick, outcome, stake, cardMultiplier, streak, coins } = params;
  const won = pick === outcome;
  const streakMult = 1 + streak * STREAK_STEP;
  const payout = won ? Math.round(stake * cardMultiplier * streakMult) : 0;
  const points = won ? Math.round(stake * cardMultiplier) : -stake;
  const newStreak = won ? streak + 1 : 0;
  const newCoins = won ? coins + payout : Math.max(0, coins - stake);
  return { won, payout, points, newStreak, newCoins };
}
