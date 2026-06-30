// Tournaments ("Prediction Battles") — public, free-entry skill contests tied to
// a single match. NO escrow: the host declares a USDC prize and pays winners
// directly within 48h; Field verifies the payment tx on-chain (read-only) and
// never custodies funds. All money/chain access is behind tournamentApi.

export type TournamentStatus =
  | 'upcoming' // created, match not kicked off — joinable
  | 'live' // match in progress
  | 'settling' // match ended, finalizing standings
  | 'awaiting_payout' // results final; winners submit address; host pays (48h)
  | 'completed' // all winners paid (or window expired)
  | 'voided'; // match abandoned/cancelled — no prize owed

export type Capacity = { type: 'open' } | { type: 'slots'; max: number };

export interface Tournament {
  id: string;
  title: string;
  description: string;
  bannerUrl: string;
  hostUserId: string;
  hostPayoutWallet: string; // Solana address the host will pay FROM (public)
  matchId: string;
  status: TournamentStatus;
  prize: { asset: 'USDC'; total: number }; // declared, NOT locked
  capacity: Capacity;
  winnersCount: number; // 1–5
  split: number[]; // % per rank, sums to 100
  startingPoints: number; // free stack per joiner (default 1000)
  joinCloses: 'kickoff' | 'matchEnd';
  participantCount: number;
  settledAt?: string;
  payoutDeadline?: string; // settledAt + 48h
  createdAt: string;
}

export interface Participant {
  tournamentId: string;
  userId: string;
  joinedAt: string;
  points: number; // current stack (starts at startingPoints)
  rank?: number;
}

export interface Standing {
  rank: number;
  userId: string;
  displayName: string;
  points: number;
  streak: number;
  isMe?: boolean;
  paid?: boolean; // within top-N
}

export type PayoutStatus = 'awaiting_address' | 'awaiting_payment' | 'paid' | 'expired';

export interface Payout {
  tournamentId: string;
  rank: number;
  userId: string;
  amount: number;
  asset: 'USDC';
  winnerWallet?: string; // submitted by the winner after results
  status: PayoutStatus;
  txSig?: string; // host's payment tx, verified on-chain
  verified?: boolean;
  paidAt?: string;
  isMe?: boolean;
}

export interface CreateTournamentInput {
  title: string;
  description: string;
  bannerUrl: string;
  matchId: string;
  hostPayoutWallet: string;
  prize: { asset: 'USDC'; total: number };
  capacity: Capacity;
  winnersCount: number;
  split: number[];
  startingPoints: number;
  joinCloses: 'kickoff' | 'matchEnd';
}
