// engine-tick — the heartbeat. Runs every minute (pg_cron → pg_net).
// 1. Sync World Cup fixtures from TxLINE devnet into `matches`.
// 2. Advance live matches (clock / phase / score) best-effort from TxLINE scores.
// 3. Spawn a fresh prediction card on each live match that has none open.
// 4. Settle cards whose window has closed, write settlements + receipts, and
//    update each caller's coins/streak. If the feed can't resolve a card
//    fairly, it VOIDS (coins returned, streak preserved) — per the spec.
import { admin } from '../_shared/supabase.ts';
import { json } from '../_shared/cors.ts';
import { getSession, fetchFixtures, fetchScores, type TxFixture } from '../_shared/txline.ts';
import { generateCard, isLivePhase, type MatchPhase } from '../_shared/cards.ts';
import { score } from '../_shared/scoring.ts';
import { countryToIso2 } from '../_shared/countries.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const WC_COMPETITION_ID = Number(Deno.env.get('TXLINE_COMPETITION_ID') ?? '0') || undefined;
const CARD_WINDOW_SECONDS = 300;

// On-chain context for receipts. The TxODDS oracle program anchors the Merkle
// roots; we link players to it on the Solana explorer so the proof is trackable.
const SOLANA_CLUSTER = Deno.env.get('SOLANA_CLUSTER') ?? 'mainnet-beta';
const TXODDS_PROGRAM_ID =
  Deno.env.get('TXLINE_PROGRAM_ID') ?? '9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA';
const CLUSTER_LABEL = SOLANA_CLUSTER === 'mainnet-beta' ? 'Solana' : `Solana (${SOLANA_CLUSTER})`;
const CLUSTER_QS = SOLANA_CLUSTER === 'mainnet-beta' ? '' : `?cluster=${SOLANA_CLUSTER}`;
const PROGRAM_EXPLORER_URL = `https://explorer.solana.com/address/${TXODDS_PROGRAM_ID}${CLUSTER_QS}`;

function code(name: string): string {
  return (name ?? '???').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || '???';
}

function phaseForMinute(minute: number): MatchPhase {
  if (minute <= 0) return 'PRE';
  if (minute < 45) return '1H';
  if (minute < 46) return 'HT';
  if (minute <= 90) return '2H';
  return 'FT';
}

type Entry = Record<string, any>;

/** The current state = the scores entry with the latest timestamp. */
function pickLatest(scores: unknown[]): Entry | null {
  let best: Entry | null = null;
  for (const r of scores as Entry[]) {
    if (!best || Number(r?.Ts ?? r?.ts ?? 0) > Number(best?.Ts ?? best?.ts ?? 0)) best = r;
  }
  return best;
}

/** Read a cumulative stat value (by key) from a scores entry's Stats map. */
function statOf(entry: Entry | null, key: number): number | null {
  const s = (entry?.Stats ?? entry?.stats) as Record<string, unknown> | undefined;
  if (s && String(key) in s) return Number(s[String(key)]);
  return null;
}

// Game-phase id (StatusId) → our phase enum + match status.
const FINISHED_IDS = new Set([5, 10, 13, 15, 16, 17, 18]);
const UPCOMING_IDS = new Set([1, 19]);
function statusFromStatusId(id: number): 'upcoming' | 'live' | 'finished' {
  if (FINISHED_IDS.has(id)) return 'finished';
  if (UPCOMING_IDS.has(id)) return 'upcoming';
  return 'live';
}
function phaseFromStatusId(id: number): MatchPhase {
  switch (id) {
    case 1: case 19: return 'PRE';
    case 2: return '1H';
    case 3: return 'HT';
    case 4: return '2H';
    case 7: case 8: case 9: case 11: case 12: return 'ET';
    case 5: case 10: case 13: return 'FT';
    default: return '2H';
  }
}

/** Real match minute from the feed clock (extrapolated to now if running). */
function liveMinute(entry: Entry | null, phase: MatchPhase): number {
  if (phase === 'PRE') return 0;
  if (phase === 'HT') return 45;
  if (phase === 'FT') return 90;
  const clock = entry?.Clock;
  if (!clock) return 0;
  let secs = Number(clock.Seconds ?? 0);
  if (clock.Running && entry?.Ts) secs += (Date.now() - Number(entry.Ts)) / 1000;
  return Math.max(0, Math.min(130, Math.floor(secs / 60)));
}

// TxLINE stat keys we surface as pitch events → {kind, side, label, redCard}.
const EVENT_KEYS: Record<number, { kind: 'goal' | 'card' | 'corner'; side: 'home' | 'away'; label: string; red?: boolean }> = {
  1: { kind: 'goal', side: 'home', label: 'Goal' },
  2: { kind: 'goal', side: 'away', label: 'Goal' },
  3: { kind: 'card', side: 'home', label: 'Booking' },
  4: { kind: 'card', side: 'away', label: 'Booking' },
  5: { kind: 'card', side: 'home', label: 'Red card', red: true },
  6: { kind: 'card', side: 'away', label: 'Red card', red: true },
  7: { kind: 'corner', side: 'home', label: 'Corner' },
  8: { kind: 'corner', side: 'away', label: 'Corner' },
};

// Honest, illustrative positions on the pitch (home attacks toward x≈0.9).
function spotFor(kind: 'goal' | 'card' | 'corner', side: 'home' | 'away'): { x: number; y: number } {
  const r = () => Math.random();
  if (kind === 'goal') return { x: side === 'home' ? 0.96 : 0.04, y: 0.42 + r() * 0.16 };
  if (kind === 'corner') return { x: side === 'home' ? 0.97 : 0.03, y: r() > 0.5 ? 0.08 : 0.92 };
  // card: in that team's own half
  return { x: side === 'home' ? 0.18 + r() * 0.22 : 0.6 + r() * 0.22, y: 0.2 + r() * 0.6 };
}


Deno.serve(async (req) => {
  // Only the scheduler (or an operator with the secret) may run the engine.
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return json({ error: 'forbidden' }, 403);
  }

  const db = admin();
  const log: Record<string, unknown> = {};

  // ── TxLINE session (graceful: no token yet ⇒ skip feed work, app stays up) ──
  let session;
  try {
    session = await getSession(db);
  } catch (e) {
    log.txline = `unavailable: ${e instanceof Error ? e.message : e}`;
    return json({ ok: true, ...log });
  }

  // ── 1. Sync fixtures → matches ──
  try {
    const fixtures: TxFixture[] = await fetchFixtures(session, WC_COMPETITION_ID);
    const now = Date.now();
    // Preserve real terminal status: never downgrade a finished/voided match back
    // to "live" via the wall-clock guess below — the live loop owns that via the feed.
    const { data: existing } = await db.from('matches').select('id, status');
    const terminal = new Set((existing ?? []).filter((m) => m.status === 'finished' || m.status === 'voided').map((m) => m.id));
    for (const f of fixtures) {
      const id = String(f.FixtureId);
      const start = Number(f.StartTime);
      const elapsedMin = Math.floor((now - start) / 60000);
      // Wall-clock is only an INITIAL guess to get a started match into the live
      // loop; the loop then confirms phase/finish from the real feed and the
      // terminal set above stops it ever flipping back.
      const status = terminal.has(id)
        ? (existing!.find((m) => m.id === id)!.status as 'finished' | 'voided')
        : now < start ? 'upcoming' : elapsedMin <= 180 ? 'live' : 'finished';
      const minute = status === 'live' ? Math.max(0, Math.min(90, elapsedMin)) : status === 'finished' ? 90 : 0;
      await db.from('matches').upsert(
        {
          id,
          txline_fixture_id: f.FixtureId,
          competition: 'World Cup',
          home_code: code(f.Participant1),
          home_name: f.Participant1,
          home_country: countryToIso2(f.Participant1),
          away_code: code(f.Participant2),
          away_name: f.Participant2,
          away_country: countryToIso2(f.Participant2),
          status,
          phase: status === 'live' ? phaseForMinute(minute) : status === 'finished' ? 'FT' : 'PRE',
          minute,
          kickoff: new Date(start).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
    }
    log.fixtures = fixtures.length;
  } catch (e) {
    log.fixtures = `error: ${e instanceof Error ? e.message : e}`;
  }

  // ── Work the live matches ──
  const { data: liveMatches } = await db
    .from('matches')
    .select('id, txline_fixture_id, home_code, away_code, phase, minute, stat_snapshot')
    .eq('status', 'live');

  for (const m of liveMatches ?? []) {
    let scores: unknown[] = [];
    try {
      if (m.txline_fixture_id) scores = await fetchScores(session, Number(m.txline_fixture_id));
    } catch { /* tolerate; cards in this window will void */ }

    // ── 2. Authoritative clock/phase/score/cards from the real feed state ──
    const latest = pickLatest(scores);
    if (latest) {
      const statusId = Number(latest.StatusId ?? 0);
      const realPhase = phaseFromStatusId(statusId);
      const realStatus = statusFromStatusId(statusId);
      const realMinute = liveMinute(latest, realPhase);
      m.phase = realPhase;     // keep loop-local values in sync for events/cards below
      m.minute = realMinute;
      await db.from('matches').update({
        status: realStatus,
        phase: realPhase,
        minute: realMinute,
        home_score: statOf(latest, 1) ?? 0,
        away_score: statOf(latest, 2) ?? 0,
        home_yellow: statOf(latest, 3) ?? 0,
        away_yellow: statOf(latest, 4) ?? 0,
        home_red: statOf(latest, 5) ?? 0,
        away_red: statOf(latest, 6) ?? 0,
        updated_at: new Date().toISOString(),
      }).eq('id', m.id);

      // Match kicked off → flip its tournaments to live (also closes joining).
      if (realStatus === 'live') {
        await db.from('tournaments').update({ status: 'live' }).eq('match_id', m.id).eq('status', 'upcoming');
      }

      // Match abandoned/cancelled/coverage-cancelled → void its tournaments (no prize owed).
      if ([15, 16, 17, 18].includes(statusId)) {
        await db.from('tournaments').update({ status: 'voided' })
          .eq('match_id', m.id).in('status', ['upcoming', 'live', 'settling']);
      } else if (realStatus === 'finished') {
        // Match ended normally → finalize standings for its tournaments.
        const { data: tours } = await db
          .from('tournaments')
          .select('id')
          .eq('match_id', m.id)
          .in('status', ['upcoming', 'live', 'settling']);
        const base = Deno.env.get('SUPABASE_URL');
        for (const tour of tours ?? []) {
          try {
            await fetch(`${base}/functions/v1/tournaments/${tour.id}/settle`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
              body: '{}',
            });
          } catch { /* will retry next tick */ }
        }
      }
    }

    // ── 2b. Emit pitch events for any stat that ticked up since last poll ──
    const prevSnap: Record<string, number> = (m.stat_snapshot as Record<string, number>) ?? {};
    const nextSnap: Record<string, number> = { ...prevSnap };
    const newEvents: Record<string, unknown>[] = [];
    let seqBase = Date.now();
    for (const [keyStr, def] of Object.entries(EVENT_KEYS)) {
      const key = Number(keyStr);
      const current = statOf(latest, key);
      if (current == null) continue;
      nextSnap[keyStr] = current;
      const prev = prevSnap[keyStr];
      // Skip the very first observation (prev undefined) so we don't replay
      // the whole pre-existing tally as a flood of events.
      if (prev == null || current <= prev) continue;
      const teamCode = def.side === 'home' ? m.home_code : m.away_code;
      for (let i = prev; i < current; i++) {
        const spot = spotFor(def.kind, def.side);
        newEvents.push({
          match_id: m.id,
          kind: def.kind,
          side: def.side,
          minute: m.minute,
          label: `${def.label} · ${teamCode}`,
          x: spot.x,
          y: spot.y,
          seq: seqBase++,
        });
      }
    }
    if (newEvents.length) await db.from('match_events').insert(newEvents);
    await db.from('matches').update({ stat_snapshot: nextSnap }).eq('id', m.id);

    // ── 3. Settle due cards ──
    const { data: dueCards } = await db
      .from('prediction_cards')
      .select('*')
      .eq('match_id', m.id)
      .neq('status', 'settled')
      .lte('locks_at', new Date().toISOString());

    for (const card of dueCards ?? []) {
      const baseline = card.baseline_stat ?? 0;
      const current = card.txline_stat_key != null ? statOf(latest, card.txline_stat_key) : null;

      let outcome: 'yes' | 'no' | null;
      if (current == null) {
        outcome = null; // feed can't resolve → void
      } else {
        outcome = current > baseline ? 'yes' : 'no';
      }

      const resolvedLabel =
        outcome == null
          ? "Couldn't verify in window — voided"
          : outcome === 'yes'
            ? `${card.subject_team} ${card.stat} verified at ${m.minute}′`
            : `No ${card.stat} for ${card.subject_team} in the window`;

      const receipt = {
        source: 'TxLINE live feed',
        statVerified: resolvedLabel,
        merkleRoot: '—',
        anchoredOn: CLUSTER_LABEL,
        txRef: m.txline_fixture_id ? `fix:${m.txline_fixture_id}/key:${card.txline_stat_key}` : '—',
        explorerUrl: PROGRAM_EXPLORER_URL,
        cardId: card.id,
      };

      // mark the card settled (or void)
      await db.from('prediction_cards').update({
        status: 'settled',
        outcome: outcome ?? null,
        resolved_stat_label: resolvedLabel,
        receipt,
        txline_seq: Number(latest?.Seq ?? 0) || null,
      }).eq('id', card.id);

      // settle every player's prediction on this card
      const { data: calls } = await db
        .from('predictions')
        .select('user_id, pick, stake')
        .eq('card_id', card.id);

      for (const callRow of calls ?? []) {
        const { data: prof } = await db
          .from('profiles')
          .select('coins, streak')
          .eq('id', callRow.user_id)
          .maybeSingle();
        if (!prof) continue;

        if (outcome == null) {
          // VOID — stake returned, streak preserved, no win/loss.
          await db.from('settlements').upsert({
            card_id: card.id,
            user_id: callRow.user_id,
            result: 'void',
            pick: callRow.pick,
            stake: callRow.stake,
            payout: 0,
            points: 0,
            minute: m.minute,
            question: card.question,
            receipt,
          }, { onConflict: 'card_id,user_id' });
          continue;
        }

        const r = score({
          pick: callRow.pick,
          outcome,
          stake: callRow.stake,
          cardMultiplier: card.multiplier,
          streak: prof.streak,
          coins: prof.coins,
        });
        await db.from('profiles').update({ coins: r.newCoins, streak: r.newStreak }).eq('id', callRow.user_id);
        await db.from('settlements').upsert({
          card_id: card.id,
          user_id: callRow.user_id,
          result: r.won ? 'win' : 'loss',
          pick: callRow.pick,
          stake: callRow.stake,
          payout: r.payout,
          points: r.points,
          minute: m.minute,
          question: card.question,
          receipt,
        }, { onConflict: 'card_id,user_id' });
      }

      // ── 3b. Settle tournament-mode wagers on this card (separate stacks) ──
      const { data: tcalls } = await db
        .from('tournament_predictions')
        .select('id, tournament_id, user_id, pick, stake')
        .eq('card_id', card.id)
        .eq('settled', false);
      for (const tc of tcalls ?? []) {
        const { data: part } = await db
          .from('tournament_participants')
          .select('points')
          .eq('tournament_id', tc.tournament_id)
          .eq('user_id', tc.user_id)
          .maybeSingle();
        if (!part) continue;
        // void → no change; else odds-weighted (no per-tournament streak in v1). TODO: streak.
        let delta = 0;
        if (outcome != null) delta = tc.pick === outcome ? Math.round(tc.stake * card.multiplier) : -tc.stake;
        await db.from('tournament_participants')
          .update({ points: Math.max(0, part.points + delta) })
          .eq('tournament_id', tc.tournament_id)
          .eq('user_id', tc.user_id);
        await db.from('tournament_predictions').update({ settled: true }).eq('id', tc.id);
      }
    }

    // ── 4. Ensure one open card per live match ──
    const { count: openCount } = await db
      .from('prediction_cards')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', m.id)
      .neq('status', 'settled');

    if (!openCount || openCount === 0) {
      const phase = (m.phase as MatchPhase) ?? '2H';
      if (isLivePhase(phase)) {
        const gen = generateCard({ phase, homeCode: m.home_code, awayCode: m.away_code, windowSeconds: CARD_WINDOW_SECONDS });
        const baseline = gen.txline_stat_key != null ? statOf(latest, gen.txline_stat_key) : null;
        await db.from('prediction_cards').insert({
          match_id: m.id,
          status: 'live',
          stat: gen.stat,
          side: gen.side,
          question: gen.question,
          subject_team: gen.subject_team,
          multiplier: gen.multiplier,
          locks_at: new Date(Date.now() + gen.window_seconds * 1000).toISOString(),
          window_seconds: gen.window_seconds,
          crowd_yes: gen.crowd_yes,
          sync_line: gen.sync_line,
          txline_stat_key: gen.txline_stat_key,
          baseline_stat: baseline ?? 0,
        });
      }
    }
  }

  log.liveMatches = liveMatches?.length ?? 0;
  return json({ ok: true, ...log });
});
