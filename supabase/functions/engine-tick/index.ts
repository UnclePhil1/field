// engine-tick — the heartbeat. Runs every minute (pg_cron → pg_net).
// 1. Sync World Cup fixtures from TxLINE devnet into `matches`.
// 2. Advance live matches (clock / phase / score) best-effort from TxLINE scores.
// 3. Spawn a fresh prediction card on each live match that has none open.
// 4. Settle cards whose window has closed, write settlements + receipts, and
//    update each caller's coins/streak. If the feed can't resolve a card
//    fairly, it VOIDS (coins returned, streak preserved) — per the spec.
import { admin } from '../_shared/supabase.ts';
import { json } from '../_shared/cors.ts';
import { getSession, fetchFixtures, fetchScores, fetchOdds, type TxFixture } from '../_shared/txline.ts';
import { generateCard, isLivePhase, type MatchPhase } from '../_shared/cards.ts';
import { stageFor } from '../_shared/stage.ts';
import { impliedWinProbability, multiplierFromProb } from '../_shared/odds.ts';
import { score } from '../_shared/scoring.ts';
import { countryToIso2 } from '../_shared/countries.ts';
import { prefAllows } from '../_shared/fcm.ts';
import { notifyAll } from '../_shared/notify.ts';
import { broadcastTelegram, telegramEnabled } from '../_shared/telegram.ts';

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

/**
 * The current state = the latest entry that actually carries a game StatusId.
 * TxODDS interleaves "scheduled" placeholder entries (no StatusId/Clock) that
 * can have the highest timestamp — trusting those made finished games look live.
 */
function pickLatest(scores: unknown[]): Entry | null {
  const ts = (r: Entry) => Number(r?.Ts ?? r?.ts ?? 0);
  let best: Entry | null = null; // latest WITH a StatusId
  let anyLatest: Entry | null = null; // overall latest (fallback only)
  for (const r of scores as Entry[]) {
    if (!anyLatest || ts(r) > ts(anyLatest)) anyLatest = r;
    if (r?.StatusId != null && (!best || ts(r) > ts(best))) best = r;
  }
  return best ?? anyLatest;
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


// Users to alert for a match: anyone who has played it or is following it.
async function interestedUsers(db: any, matchId: string): Promise<string[]> {
  const set = new Set<string>();
  const { data: cards } = await db.from('prediction_cards').select('id').eq('match_id', matchId);
  const ids = (cards ?? []).map((c: any) => c.id);
  if (ids.length) {
    const { data: preds } = await db.from('predictions').select('user_id').in('card_id', ids);
    for (const p of preds ?? []) set.add(p.user_id);
  }
  const { data: followers } = await db
    .from('notification_preferences').select('user_id').contains('followed', [matchId]);
  for (const f of followers ?? []) set.add(f.user_id);
  return [...set];
}

/** Keep only users whose prefs allow `check` (default on when no row exists). */
async function allowed(db: any, userIds: string[], check: (p: any) => boolean): Promise<string[]> {
  if (!userIds.length) return [];
  const { data: prefs } = await db.from('notification_preferences').select('*').in('user_id', userIds);
  const map = new Map((prefs ?? []).map((p: any) => [p.user_id, p]));
  return userIds.filter((id) => {
    const p = map.get(id);
    if (!p) return true;
    if (p.enabled === false) return false;
    return check(p);
  });
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
          stage: stageFor(start, 'World Cup'),
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

  // ── Pre-match reminders: matches kicking off within 15 min, once each ──
  if (telegramEnabled) {
    try {
      const nowIso = new Date().toISOString();
      const soon = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const { data: upSoon } = await db
        .from('matches')
        .select('id, home_code, away_code, stage')
        .eq('status', 'upcoming')
        .eq('pre_notified', false)
        .gte('kickoff', nowIso)
        .lte('kickoff', soon);
      for (const um of upSoon ?? []) {
        await db.from('matches').update({ pre_notified: true }).eq('id', um.id);
        const fans = await allowed(db, await interestedUsers(db, um.id), (p) => p.match_events?.phases !== false);
        await broadcastTelegram(db, fans, {
          title: `⏰ Starting soon — ${um.home_code} v ${um.away_code}`,
          body: `${um.stage ? um.stage + ' · ' : ''}Kicks off within 15 minutes. Line up your first call.`,
          url: `/match/${um.id}`,
        }).catch(() => {});
      }
    } catch { /* reminders are best-effort */ }
  }

  // ── Work the live matches ──
  const { data: liveMatches } = await db
    .from('matches')
    .select('id, txline_fixture_id, home_code, away_code, home_name, away_name, stage, phase, minute, stat_snapshot, kickoff_notified, ft_notified')
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

        // Kick-off broadcast (once) to everyone following/playing this match.
        if (!m.kickoff_notified) {
          await db.from('matches').update({ kickoff_notified: true }).eq('id', m.id);
          if (telegramEnabled) {
            const fans = await allowed(db, await interestedUsers(db, m.id), (p) => p.match_events?.phases !== false);
            await broadcastTelegram(db, fans, {
              title: `🟢 Kick-off — ${m.home_code} v ${m.away_code}`,
              body: `${m.stage ? m.stage + ' · ' : ''}It’s live. Call the next moment.`,
              url: `/match/${m.id}`,
            }).catch(() => {});
          }
          // Any tournaments now live → tell participants play is open.
          const { data: liveTours } = await db.from('tournaments').select('id, title').eq('match_id', m.id).eq('status', 'live');
          for (const t of liveTours ?? []) {
            const { data: parts } = await db.from('tournament_participants').select('user_id').eq('tournament_id', t.id);
            const uids = await allowed(db, (parts ?? []).map((p: any) => p.user_id), (p) => p.tournaments?.results !== false);
            await broadcastTelegram(db, uids, {
              title: `🏆 ${t.title} is live`,
              body: `${m.home_code} v ${m.away_code} kicked off — your 1,000-pt stack is in play.`,
              url: `/tournaments/${t.id}`,
            }).catch(() => {});
          }
        }
      }

      // Match abandoned/cancelled/coverage-cancelled → void its tournaments (no prize owed).
      if ([15, 16, 17, 18].includes(statusId)) {
        await db.from('tournaments').update({ status: 'voided' })
          .eq('match_id', m.id).in('status', ['upcoming', 'live', 'settling']);
      } else if (realStatus === 'finished') {
        // Full-time broadcast (once) with the final score.
        if (!m.ft_notified) {
          await db.from('matches').update({ ft_notified: true }).eq('id', m.id);
          if (telegramEnabled) {
            const fans = await allowed(db, await interestedUsers(db, m.id), (p) => p.match_events?.phases !== false);
            await broadcastTelegram(db, fans, {
              title: `⏱️ Full time — ${m.home_code} ${statOf(latest, 1) ?? 0}–${statOf(latest, 2) ?? 0} ${m.away_code}`,
              body: 'Results are settling now. Rewatch it in Replay.',
              url: `/replay/${m.id}`,
            }).catch(() => {});
          }
        }
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

    // ── 2c. Broadcast each new event to interested users over Telegram ──
    if (newEvents.length && telegramEnabled) {
      const fans = await interestedUsers(db, m.id);
      if (fans.length) {
        const hs = statOf(latest, 1) ?? 0;
        const as = statOf(latest, 2) ?? 0;
        // Resolve pref-eligible audiences once per category, not per event.
        const cache: Record<string, string[]> = {};
        const audience = async (cat: 'goals' | 'cards' | 'corners') =>
          cache[cat] ??= await allowed(db, fans, (p) => p.match_events?.[cat] !== false);
        for (const ev of newEvents) {
          const kind = ev.kind as 'goal' | 'card' | 'corner';
          const teamCode = ev.side === 'home' ? m.home_code : m.away_code;
          const teamName = ev.side === 'home' ? (m.home_name ?? m.home_code) : (m.away_name ?? m.away_code);
          let title: string, cat: 'goals' | 'cards' | 'corners';
          if (kind === 'goal') {
            title = `⚽ GOAL! ${m.home_code} ${hs}–${as} ${m.away_code}`;
            cat = 'goals';
          } else if (kind === 'card') {
            const red = /red/i.test(String(ev.label));
            title = `${red ? '🟥 Red card' : '🟨 Booking'} — ${teamCode}`;
            cat = 'cards';
          } else {
            title = `⛳ Corner — ${teamCode}`;
            cat = 'corners';
          }
          await broadcastTelegram(db, await audience(cat), {
            title,
            body: `${teamName} · ${ev.minute}'${m.stage ? ' · ' + m.stage : ''}`,
            url: `/match/${m.id}`,
          }).catch(() => {});
        }
      }
    }

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

        // notify "your call settled" across every channel (inbox + push + Telegram).
        if (await prefAllows(db, callRow.user_id, (p) => p.my_play?.settled !== false)) {
          const title = r.won ? `⚽ Your call hit — +${r.payout}` : '✕ Not this time';
          await notifyAll(db, callRow.user_id, { title, body: card.question, url: `/match/${m.id}`, kind: 'settled' }).catch(() => {});
        }
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
      // No new cards during half-time — predictions resume when the ball is in play.
      if (isLivePhase(phase) && phase !== 'HT') {
        const gen = generateCard({ phase, homeCode: m.home_code, awayCode: m.away_code, windowSeconds: CARD_WINDOW_SECONDS });
        const baseline = gen.txline_stat_key != null ? statOf(latest, gen.txline_stat_key) : null;

        // Odds-weighted pricing (defensive): for goal cards, price off the live
        // market's implied win probability when odds are available; else heuristic.
        let multiplier = gen.multiplier;
        let crowdYes = gen.crowd_yes;
        if (gen.stat === 'goal' && m.txline_fixture_id) {
          try {
            const offers = await fetchOdds(session, Number(m.txline_fixture_id));
            const prob = impliedWinProbability(offers, gen.side);
            if (prob != null) {
              multiplier = multiplierFromProb(prob);
              crowdYes = Math.round(prob * 100);
            }
          } catch { /* no odds → keep heuristic */ }
        }

        await db.from('prediction_cards').insert({
          match_id: m.id,
          status: 'live',
          stat: gen.stat,
          side: gen.side,
          question: gen.question,
          subject_team: gen.subject_team,
          multiplier,
          locks_at: new Date(Date.now() + gen.window_seconds * 1000).toISOString(),
          window_seconds: gen.window_seconds,
          crowd_yes: crowdYes,
          sync_line: gen.sync_line,
          txline_stat_key: gen.txline_stat_key,
          baseline_stat: baseline ?? 0,
        });

        // A fresh card is open — tell the people playing or following this match.
        if (telegramEnabled) {
          const fans = await allowed(db, await interestedUsers(db, m.id), (p) => p.my_play?.new_card !== false);
          await broadcastTelegram(db, fans, {
            title: `🎯 New prediction — ${m.home_code} v ${m.away_code}`,
            body: `${gen.question} · ${m.minute}'`,
            url: `/match/${m.id}`,
          }).catch(() => {});
        }
      }
    }
  }

  log.liveMatches = liveMatches?.length ?? 0;
  return json({ ok: true, ...log });
});
