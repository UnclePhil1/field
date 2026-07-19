export type TeamCode = string; // e.g. "ENG", "FRA"

export interface Team {
  code: TeamCode;
  name: string;
  country?: string;
}

export type MatchPhase = 'PRE' | '1H' | 'HT' | '2H' | 'ET' | 'FT';
export type MatchStatus = 'upcoming' | 'live' | 'finished';

export interface LineupPlayer {
  id: number;
  normativeId?: number;
  name: string;
  number: string;
  starter: boolean;
  position: number;
  goals: number;
  yellow: number;
  red: number;
}
export interface TeamLineup {
  team: string;
  players: LineupPlayer[];
}
export interface FixtureLineups {
  home: TeamLineup;
  away: TeamLineup;
  publishedAt: string;
}

export type PossessionType = 'Safe' | 'Attack' | 'Danger' | 'HighDanger';

export interface Match {
  id: string;
  competition: string; // "World Cup", "Premier League"
  home: Team;
  away: Team;
  status: MatchStatus;
  phase: MatchPhase;
  stage?: string;
  minute: number;
  homeScore: number;
  awayScore: number;
  homeYellow?: number;
  homeRed?: number;
  awayYellow?: number;
  awayRed?: number;
  possession?: number | null;         // home possession %
  possessionType?: PossessionType | string | null;
  lineups?: FixtureLineups | null;
  kickoff: string;
}

export type StatKind = 'goal' | 'corner' | 'card';
export type Side = 'home' | 'away';

export interface MatchEvent {
  id: string;
  matchId: string;
  kind: StatKind;
  side: Side;
  minute: number;
  label: string;
  player?: string | null;
  x: number;
  y: number;
}

export type PredictionStatus = 'live' | 'locked' | 'settled';
export type PredictionPick = 'yes' | 'no';
export type SettlementResult = 'win' | 'loss' | 'void';

export interface PredictionCard {
  id: string;
  matchId: string;
  status: PredictionStatus;
  stat: StatKind;
  side: Side;
  question: string;
  subjectTeam: TeamCode;
  multiplier: number;
  locksAt: number;
  windowSeconds: number;
  crowdYes: number;
  syncLine?: string;

  outcome?: PredictionPick;
  resolvedStatLabel?: string;
  receipt?: Receipt;
}

export interface Receipt {
  source: string; // "TxLINE live feed"
  question?: string; // the flash-pool question, e.g. "A booking in the next 5:00?"
  outcome?: string; // resolved outcome: "yes" | "no" | "void"
  resolvedPlayer?: string | null; // player the feed attributed the resolving stat to
  statVerified: string; // "Corner awarded to ENG at 70'"
  merkleRoot: string; // "a91f…7c2e"
  merkleRootFull?: string | null;
  anchoredOn: string; // "Solana"
  txRef: string; // short ref hash
  anchorTx?: string | null; // full signature of our validate_stat transaction
  cardId?: string;
  explorerUrl?: string;
}

export interface Settlement {
  cardId: string;
  result: SettlementResult;
  pick: PredictionPick;
  stake: number;
  payout: number;
  points: number;
  receipt: Receipt;
}

export interface SettledCall {
  id: string;
  question: string;
  result: SettlementResult;
  points: number;
  minute: number;
  receipt: Receipt;
}

export interface Player {
  id: string;
  name: string;
  handle: string;
  streak: number;
  points: number;
  isMe?: boolean;
  rank?: number;
}
