// Parses lineups, goal/card attribution, and possession from the live TxLINE feed.
// The feed is a stream of action messages ("snapshot per action" for the snapshot
// endpoint). Shapes verified against real World Cup fixtures:
//   entry: { Seq, Action, Type:'Soccer', StatusId, Clock, Data, Stats, Score, Lineups? }
//   Lineups[]: { preferredName (team), lineups:[{ fixturePlayerId, rosterNumber,
//                starter, positionId, player:{ preferredName } }] }
//   goal action:  Data = { GoalType, PlayerId }
//   booking action: Data = { PlayerId, ... }         (probed defensively)
//   possession:   Action ∈ {safe|attack|danger|high_danger}_possession (no Data)
//   possible:     Data = { Goal, Corner, Penalty } (imminent-event flags, no side)
// Every accessor probes casing variants and degrades to null if a field is absent.
// deno-lint-ignore-file no-explicit-any

type Entry = Record<string, any>;
export type Side = 'home' | 'away';
export type EventKind = 'goal' | 'card' | 'corner';

function pick(obj: any, ...keys: string[]): any {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) if (obj[k] != null) return obj[k];
  return undefined;
}

/** "Messi, Lionel" → "L. Messi"; "Ronaldo" → "Ronaldo"; "Lionel Messi" → "L. Messi". */
export function formatPlayerName(preferred: string | undefined | null): string {
  const raw = String(preferred ?? '').trim();
  if (!raw) return '';
  if (raw.includes(',')) {
    const [last, first] = raw.split(',').map((s) => s.trim());
    if (first && last) return `${first[0]}. ${last}`;
    return last || first || raw;
  }
  const parts = raw.split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
  return raw;
}

/** "Messi, Lionel" → "Lionel Messi" (full, natural order). */
export function fullPlayerName(preferred: string | undefined | null): string {
  const raw = String(preferred ?? '').trim();
  if (!raw) return '';
  if (raw.includes(',')) {
    const [last, first] = raw.split(',').map((s) => s.trim());
    return [first, last].filter(Boolean).join(' ');
  }
  return raw;
}

function playerIdOf(pl: any): number | null {
  const v = pick(pl, 'fixturePlayerId', 'FixturePlayerId', 'PlayerId', 'playerId', 'id', 'Id');
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function lineupsOf(entry: Entry): any[] | null {
  const l = pick(entry, 'Lineups', 'lineups', 'LineUps', 'lineUps');
  return Array.isArray(l) && l.length ? l : null;
}

/**
 * Map of player id → short display name across both teams. Keyed by BOTH
 * fixturePlayerId (roster) and normativeId, because live events reference the
 * player by normativeId while the roster lists fixturePlayerId. Empty until kickoff.
 */
export function buildPlayerIndex(scores: unknown[]): Map<number, string> {
  const idx = new Map<number, string>();
  for (const entry of scores as Entry[]) {
    const teams = lineupsOf(entry);
    if (!teams) continue;
    for (const team of teams) {
      const roster = pick(team, 'lineups', 'Lineups', 'players', 'Players');
      if (!Array.isArray(roster)) continue;
      for (const pl of roster) {
        const fid = playerIdOf(pl);
        const inner = pick(pl, 'player', 'Player') ?? pl;
        const nid = Number(pick(inner, 'normativeId', 'NormativeId') ?? 0);
        const name = formatPlayerName(pick(inner, 'preferredName', 'PreferredName', 'name', 'Name'));
        if (!name) continue;
        if (fid != null) idx.set(fid, name);
        if (nid > 0) idx.set(nid, name);
      }
    }
    if (idx.size) break;
  }
  return idx;
}

export interface LineupPlayer {
  id: number;            // fixturePlayerId
  normativeId: number;   // id used by live event messages
  name: string;
  number: string;
  starter: boolean;
  position: number;
  goals: number;
  yellow: number;
  red: number;
}
export interface TeamLineup { team: string; players: LineupPlayer[] }
export interface FixtureLineups { home: TeamLineup; away: TeamLineup; publishedAt: string }

function teamPlayers(team: any): LineupPlayer[] {
  const roster = pick(team, 'lineups', 'Lineups', 'players', 'Players');
  const players: LineupPlayer[] = [];
  if (Array.isArray(roster)) {
    for (const pl of roster) {
      const id = playerIdOf(pl);
      if (id == null) continue;
      const inner = pick(pl, 'player', 'Player') ?? pl;
      players.push({
        id,
        normativeId: Number(pick(inner, 'normativeId', 'NormativeId') ?? 0),
        name: fullPlayerName(pick(inner, 'preferredName', 'PreferredName', 'name', 'Name')),
        number: String(pick(pl, 'rosterNumber', 'RosterNumber', 'number', 'Number') ?? ''),
        starter: !!pick(pl, 'starter', 'Starter'),
        position: Number(pick(pl, 'positionId', 'PositionId') ?? 0),
        goals: 0,
        yellow: 0,
        red: 0,
      });
    }
  }
  players.sort((a, b) => (b.starter ? 1 : 0) - (a.starter ? 1 : 0) || (Number(a.number) || 99) - (Number(b.number) || 99));
  return players;
}

/**
 * Split parsed lineups into home/away. Teams are matched by name; if that fails,
 * falls back to feed order (first team = home). Returns null before kickoff.
 */
export function parseLineups(scores: unknown[], homeName: string, awayName: string): FixtureLineups | null {
  let teams: any[] | null = null;
  for (const entry of scores as Entry[]) {
    teams = lineupsOf(entry);
    if (teams) break;
  }
  if (!teams || teams.length < 2) return null;

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const toTeam = (team: any): TeamLineup => ({
    team: String(pick(team, 'preferredName', 'PreferredName', 'name', 'Name') ?? ''),
    players: teamPlayers(team),
  });
  const parsed = teams.map(toTeam);

  let home = parsed.find((t) => norm(t.team) && norm(t.team) === norm(homeName));
  let away = parsed.find((t) => norm(t.team) && norm(t.team) === norm(awayName));
  if (!home || !away || home === away) {
    home = parsed[0];
    away = parsed[1];
  }
  return { home, away, publishedAt: new Date().toISOString() };
}

/** fixturePlayerId → side, derived from a parsed lineup. */
export function sideMap(lineups: FixtureLineups | null): Map<number, Side> {
  const m = new Map<number, Side>();
  if (!lineups) return m;
  for (const p of lineups.home.players) { m.set(p.id, 'home'); if (p.normativeId > 0) m.set(p.normativeId, 'home'); }
  for (const p of lineups.away.players) { m.set(p.id, 'away'); if (p.normativeId > 0) m.set(p.normativeId, 'away'); }
  return m;
}

const BOOKING_ACTIONS = new Set(['booking', 'card', 'yellow_card', 'red_card', 'caution', 'dismissal', 'second_yellow', 'second_booking']);

export interface Attribution {
  /** latest scorer/booked name keyed by `${kind}:${side}` (corners are never attributed) */
  byKindSide: Record<string, string>;
  goalType: Record<string, string | undefined>; // `goal:${side}` → GoalType
}

/**
 * Latest goal/booking per side from the action stream, resolving side by roster.
 * Because the snapshot carries only the latest of each action, this attributes the
 * most recent scorer/booked player for a side — sufficient for per-tick settlement.
 */
export function attributeEvents(scores: unknown[], index: Map<number, string>, side: Map<number, Side>): Attribution {
  const byKindSide: Record<string, string> = {};
  const goalType: Record<string, string | undefined> = {};
  // newest entries first so the first match per (kind,side) wins
  const ordered = [...(scores as Entry[])].sort((a, b) => Number(b?.Seq ?? 0) - Number(a?.Seq ?? 0));
  for (const e of ordered) {
    const action = String(pick(e, 'Action', 'action') ?? '');
    const data = pick(e, 'Data', 'data');
    const pid = Number(pick(data, 'PlayerId', 'playerId') ?? 0);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    const s = side.get(pid);
    if (!s) continue;
    const name = index.get(pid);
    if (!name) continue;

    if (action === 'goal') {
      const k = `goal:${s}`;
      if (!(k in byKindSide)) { byKindSide[k] = name; goalType[k] = pick(data, 'GoalType', 'goalType'); }
    } else if (BOOKING_ACTIONS.has(action)) {
      const k = `card:${s}`;
      if (!(k in byKindSide)) byKindSide[k] = name;
    }
  }
  return { byKindSide, goalType };
}

export interface QueuedPlayer { kind: EventKind; side: Side; name: string; goalType?: string }

/**
 * Chronological (Seq asc) list of attributed goal/booking events across the whole
 * feed — used by the replay backfill, which consumes them FIFO per kind+side.
 */
export function eventPlayerQueue(scores: unknown[], index: Map<number, string>, side: Map<number, Side>): QueuedPlayer[] {
  const out: QueuedPlayer[] = [];
  const ordered = [...(scores as Entry[])].sort((a, b) => Number(a?.Seq ?? 0) - Number(b?.Seq ?? 0));
  for (const e of ordered) {
    const action = String(pick(e, 'Action', 'action') ?? '');
    const data = pick(e, 'Data', 'data');
    const pid = Number(pick(data, 'PlayerId', 'playerId') ?? 0);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    const s = side.get(pid);
    const name = index.get(pid);
    if (!s || !name) continue;
    if (action === 'goal') out.push({ kind: 'goal', side: s, name, goalType: pick(data, 'GoalType', 'goalType') });
    else if (BOOKING_ACTIONS.has(action)) out.push({ kind: 'card', side: s, name });
  }
  return out;
}

export interface PossessionInfo {
  type: string | null;                       // Safe | Attack | Danger | HighDanger
  possibleKind: EventKind | null;            // imminent event kind (no side available)
}

const POSSESSION_ACTION: Record<string, string> = {
  safe_possession: 'Safe',
  attack_possession: 'Attack',
  danger_possession: 'Danger',
  high_danger_possession: 'HighDanger',
};

/** Live possession intensity + imminent-event kind from the action stream. */
export function possessionFrom(scores: unknown[]): PossessionInfo {
  let type: string | null = null;
  let typeSeq = -1;
  let possibleKind: EventKind | null = null;
  let possibleSeq = -1;
  for (const e of scores as Entry[]) {
    const action = String(pick(e, 'Action', 'action') ?? '');
    const seq = Number(pick(e, 'Seq', 'seq') ?? 0);
    if (POSSESSION_ACTION[action] && seq > typeSeq) { type = POSSESSION_ACTION[action]; typeSeq = seq; }
    if (action === 'possible' && seq > possibleSeq) {
      possibleSeq = seq;
      const d = pick(e, 'Data', 'data') ?? {};
      possibleKind = pick(d, 'Goal', 'goal') ? 'goal' : pick(d, 'Corner', 'corner') ? 'corner' : null;
    }
  }
  return { type, possibleKind };
}
