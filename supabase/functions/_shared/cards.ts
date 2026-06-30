// Card generation + TxLINE stat encoding. Field only ever asks about the three
// verifiable stats: goals, cards, corners (per txline-field-guide.md §7).

export type StatKind = 'goal' | 'card' | 'corner';
export type Side = 'home' | 'away';
export type MatchPhase = 'PRE' | '1H' | 'HT' | '2H' | 'ET' | 'FT';

// Soccer full-game base keys (Participant 1 vs 2).
const BASE: Record<StatKind, { home: number; away: number }> = {
  goal: { home: 1, away: 2 },
  // "card" cards ask about yellow cards (the common bookings market).
  card: { home: 3, away: 4 },
  corner: { home: 7, away: 8 },
};

// Period multiplier added to the base key. Full-game = 0.
const PERIOD_MULT: Record<MatchPhase, number> = {
  PRE: 0, '1H': 1000, HT: 1000, '2H': 2000, ET: 3000, FT: 0,
};

/** Encode a (stat, side, phase) into a TxLINE stat key: (period*1000)+base. */
export function statKey(stat: StatKind, side: Side, phase: MatchPhase): number {
  return PERIOD_MULT[phase] + BASE[stat][side];
}

/** Map a TxLINE soccer game-phase id → our compact phase enum. */
export function phaseFromTxline(id: number): MatchPhase {
  switch (id) {
    case 1: return 'PRE';      // NS
    case 2: return '1H';       // H1
    case 3: return 'HT';       // HT
    case 4: return '2H';       // H2
    case 5: case 10: case 13: return 'FT';
    case 7: case 9: return 'ET';
    default: return '1H';
  }
}

export function isLivePhase(p: MatchPhase): boolean {
  return p === '1H' || p === 'HT' || p === '2H' || p === 'ET';
}

const TEMPLATES: { stat: StatKind; q: (team: string) => string }[] = [
  { stat: 'corner', q: (t) => `Corner for ${t} in the next 5:00?` },
  { stat: 'goal', q: (t) => `${t} to score in the next 5:00?` },
  { stat: 'card', q: () => `A booking in the next 5:00?` },
];

const SYNC_LINES = [
  'reading the pressure — momentum building',
  'tempo rising into the final third',
  'numbers pushing forward',
  'end-to-end right now',
];

export interface GeneratedCard {
  stat: StatKind;
  side: Side;
  question: string;
  subject_team: string;
  multiplier: number;
  window_seconds: number;
  crowd_yes: number;
  sync_line: string;
  txline_stat_key: number;
}

/** Build the next card for a live match. */
export function generateCard(input: {
  phase: MatchPhase;
  homeCode: string;
  awayCode: string;
  windowSeconds?: number;
}): GeneratedCard {
  const tpl = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  const side: Side = Math.random() > 0.5 ? 'home' : 'away';
  const subject = side === 'home' ? input.homeCode : input.awayCode;
  const windowSeconds = input.windowSeconds ?? 300;
  return {
    stat: tpl.stat,
    side,
    question: tpl.q(tpl.stat === 'card' ? 'either side' : subject),
    subject_team: subject,
    multiplier: +(1.6 + Math.random() * 1.6).toFixed(1),
    window_seconds: windowSeconds,
    crowd_yes: Math.round(35 + Math.random() * 40),
    sync_line: SYNC_LINES[Math.floor(Math.random() * SYNC_LINES.length)],
    txline_stat_key: statKey(tpl.stat, side, input.phase),
  };
}
