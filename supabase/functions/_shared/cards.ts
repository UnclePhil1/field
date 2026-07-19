export type StatKind = 'goal' | 'card' | 'corner';
export type Side = 'home' | 'away';
export type MatchPhase = 'PRE' | '1H' | 'HT' | '2H' | 'ET' | 'FT';

const BASE: Record<StatKind, { home: number; away: number }> = {
  goal: { home: 1, away: 2 },
  card: { home: 3, away: 4 },
  corner: { home: 7, away: 8 },
};

const PERIOD_MULT: Record<MatchPhase, number> = {
  PRE: 0, '1H': 1000, HT: 1000, '2H': 2000, ET: 3000, FT: 0,
};

export function statKey(stat: StatKind, side: Side, phase: MatchPhase): number {
  return PERIOD_MULT[phase] + BASE[stat][side];
}

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

// Live momentum from the TxLINE feed, used to time and phrase the card.
// Possession direction isn't exposed by the feed, so this is match-level intensity
// plus the kind of event the feed flags as imminent.
export interface Momentum {
  type: string | null;                     // Safe | Attack | Danger | HighDanger
  possibleKind: 'goal' | 'corner' | null;  // imminent-event kind
}

function syncLineFor(type: string | null): string {
  switch (type) {
    case 'HighDanger': return 'high danger — a big chance is building';
    case 'Danger': return 'danger rising in the final third';
    case 'Attack': return 'on the front foot, pushing forward';
    case 'Safe': return 'knocking it around, tempo settling';
    default: return SYNC_LINES[Math.floor(Math.random() * SYNC_LINES.length)];
  }
}

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

export function generateCard(input: {
  phase: MatchPhase;
  homeCode: string;
  awayCode: string;
  windowSeconds?: number;
  momentum?: Momentum;
}): GeneratedCard {
  const mo = input.momentum;
  const windowSeconds = input.windowSeconds ?? 300;
  const danger = mo?.type === 'Danger' || mo?.type === 'HighDanger';

  // Prefer the stat the feed flags as imminent; otherwise weight toward attacking
  // markets when play is dangerous; otherwise fully random.
  let tpl: { stat: StatKind; q: (team: string) => string };
  if (mo?.possibleKind) {
    tpl = TEMPLATES.find((t) => t.stat === mo.possibleKind) ?? TEMPLATES[1];
  } else if (danger) {
    tpl = Math.random() > 0.5 ? TEMPLATES[1] /* goal */ : TEMPLATES[0] /* corner */;
  } else {
    tpl = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  }

  const side: Side = Math.random() > 0.5 ? 'home' : 'away';
  const subject = side === 'home' ? input.homeCode : input.awayCode;

  // Livelier crowd + shorter multiplier when the feed says a chance is brewing.
  let crowdYes = Math.round(35 + Math.random() * 40);
  if (danger && tpl.stat !== 'card') crowdYes = Math.min(80, crowdYes + 12);

  return {
    stat: tpl.stat,
    side,
    question: tpl.q(tpl.stat === 'card' ? 'either side' : subject),
    subject_team: subject,
    multiplier: +(1.6 + Math.random() * 1.6).toFixed(1),
    window_seconds: windowSeconds,
    crowd_yes: crowdYes,
    sync_line: syncLineFor(mo?.type ?? null),
    txline_stat_key: statKey(tpl.stat, side, input.phase),
  };
}
