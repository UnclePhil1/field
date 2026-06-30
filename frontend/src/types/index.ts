// Shared domain types. Mock feed and the future WebSocket feed MUST emit
// these exact shapes so swapping the source is a one-file change.

export type TeamCode = string; // e.g. "ENG", "FRA"

export interface Team {
  code: TeamCode;
  name: string;
  /** ISO 3166-1 alpha-2 (or gb-eng/gb-sct/gb-wls) for flag rendering */
  country?: string;
}

export type MatchPhase = 'PRE' | '1H' | 'HT' | '2H' | 'ET' | 'FT';
export type MatchStatus = 'upcoming' | 'live' | 'finished';

export interface Match {
  id: string;
  competition: string; // "World Cup", "Premier League"
  home: Team;
  away: Team;
  status: MatchStatus;
  phase: MatchPhase;
  /** match clock in minutes, e.g. 68 */
  minute: number;
  homeScore: number;
  awayScore: number;
  /** booking tallies per team (verifiable counts, not per-player) */
  homeYellow?: number;
  homeRed?: number;
  awayYellow?: number;
  awayRed?: number;
  /** ISO kickoff time, used for upcoming countdowns */
  kickoff: string;
}

// Only the stats Field can cryptographically verify drive everything.
export type StatKind = 'goal' | 'corner' | 'card';
export type Side = 'home' | 'away';

export interface MatchEvent {
  id: string;
  matchId: string;
  kind: StatKind;
  side: Side;
  /** match minute */
  minute: number;
  /** short human label, e.g. "Corner · ENG" */
  label: string;
  /** position on pitch 0..1 (x = length, y = width) — interpretation only */
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
  /** which verifiable stat this card is about */
  stat: StatKind;
  side: Side;
  /** full question, team name highlighted by the UI */
  question: string;
  /** the team the question is about, for grass highlight */
  subjectTeam: TeamCode;
  /** payout multiplier, e.g. 2.4 -> "×2.4" */
  multiplier: number;
  /** epoch ms when the card locks */
  locksAt: number;
  /** seconds in the prediction window (for the ring) */
  windowSeconds: number;
  /** crowd split 0..100 = % who picked yes */
  crowdYes: number;
  /** short flare sync line, optional */
  syncLine?: string;

  // ---- present only once status === 'settled' ----
  /** objective truth from the feed: did the stat happen? */
  outcome?: PredictionPick;
  /** what the feed verified, e.g. "Corner awarded to ENG at 70'" */
  resolvedStatLabel?: string;
  /** provably-fair receipt for the settled card */
  receipt?: Receipt;
}

export interface Receipt {
  source: string; // "TxLINE live feed"
  statVerified: string; // "Corner awarded to ENG at 70'"
  merkleRoot: string; // "a91f…7c2e"
  anchoredOn: string; // "Solana"
  txRef: string; // short ref hash
  /** card this receipt belongs to — lets the proof modal fetch full proof data */
  cardId?: string;
  /** Solana explorer URL for the on-chain account that anchors this data */
  explorerUrl?: string;
}

export interface Settlement {
  cardId: string;
  result: SettlementResult;
  pick: PredictionPick;
  stake: number;
  /** coins won (positive) or lost (0 shown as −stake in UI) */
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
  /** explicit board rank; when omitted the table falls back to list index */
  rank?: number;
}
