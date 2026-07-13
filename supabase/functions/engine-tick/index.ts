import { admin } from '../_shared/supabase.ts';
import { json } from '../_shared/cors.ts';
import { getSession, fetchFixtures, fetchScores, fetchOdds, fetchScoresHistorical, fetchStatValidation, type TxFixture } from '../_shared/txline.ts';
import { merkleRootFrom } from '../_shared/proof.ts';
import { generateCard, isLivePhase, type MatchPhase } from '../_shared/cards.ts';
import { stageFor } from '../_shared/stage.ts';
import { impliedWinProbability, multiplierFromProb } from '../_shared/odds.ts';
import { score } from '../_shared/scoring.ts';
import { countryToIso2 } from '../_shared/countries.ts';
import { prefAllows } from '../_shared/fcm.ts';
import { notifyAll, notifyInbox } from '../_shared/notify.ts';
import { broadcastTelegram, telegramEnabled } from '../_shared/telegram.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const WC_COMPETITION_ID = Number(Deno.env.get('TXLINE_COMPETITION_ID') ?? '0') || undefined;
const CARD_WINDOW_SECONDS = 300;

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

function statOf(entry: Entry | null, key: number): number | null {
  const s = (entry?.Stats ?? entry?.stats) as Record<string, unknown> | undefined;
  if (s && String(key) in s) return Number(s[String(key)]);
  return null;
}

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

function spotFor(kind: 'goal' | 'card' | 'corner', side: 'home' | 'away'): { x: number; y: number } {
  const r = () => Math.random();
  if (kind === 'goal') return { x: side === 'home' ? 0.96 : 0.04, y: 0.42 + r() * 0.16 };
  if (kind === 'corner') return { x: side === 'home' ? 0.97 : 0.03, y: r() > 0.5 ? 0.08 : 0.92 };
  return { x: side === 'home' ? 0.18 + r() * 0.22 : 0.6 + r() * 0.22, y: 0.2 + r() * 0.6 };
}

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

async function linkedUserIds(db: any): Promise<string[]> {
  const { data } = await db.from('telegram_links').select('user_id');
  return (data ?? []).map((r: any) => r.user_id);
}

async function fanOut(db: any, tg: string[], inbox: string[], payload: { title: string; body?: string; url?: string }, kind: string): Promise<void> {
  if (tg.length) await broadcastTelegram(db, tg, payload).catch(() => {});
  for (const uid of inbox) await notifyInbox(db, uid, { ...payload, kind }).catch(() => {});
}

function clockMinute(entry: Entry): number | null {
  const c = entry?.Clock;
  if (!c) return null;
  return Math.max(0, Math.min(130, Math.floor(Number(c.Seconds ?? 0) / 60)));
}

async function backfillReplay(db: any, session: any, m: Entry): Promise<boolean> {
  let hist: unknown[] = [];
  try {
    hist = await fetchScoresHistorical(session, Number(m.txline_fixture_id));
  } catch {
    return false;
  }
  if (!Array.isArray(hist) || hist.length === 0) return false;

  const entries = ([...hist] as Entry[]).sort((a, b) => Number(a?.Ts ?? 0) - Number(b?.Ts ?? 0));
  const prev: Record<string, number> = {};
  const events: Record<string, unknown>[] = [];
  let seq = Date.now();
  let lastMinute = 0;
  let finalHome = 0, finalAway = 0;

  for (const e of entries) {
    const minute = Math.max(lastMinute, clockMinute(e) ?? lastMinute);
    lastMinute = minute;
    const h = statOf(e, 1); if (h != null) finalHome = h;
    const a = statOf(e, 2); if (a != null) finalAway = a;
    for (const [keyStr, def] of Object.entries(EVENT_KEYS)) {
      const cur = statOf(e, Number(keyStr));
      if (cur == null) continue;
      const p = prev[keyStr] ?? 0;
      if (cur > p) {
        const teamCode = def.side === 'home' ? m.home_code : m.away_code;
        for (let i = p; i < cur; i++) {
          const spot = spotFor(def.kind, def.side);
          events.push({ match_id: m.id, kind: def.kind, side: def.side, minute, label: `${def.label} · ${teamCode}`, x: spot.x, y: spot.y, seq: seq++ });
        }
      }
      prev[keyStr] = Math.max(p, cur);
    }
  }

  await db.from('match_events').delete().eq('match_id', m.id);
  if (events.length) await db.from('match_events').insert(events);
  await db.from('matches').update({ replay_built: true, home_score: finalHome, away_score: finalAway }).eq('id', m.id);
  return true;
}

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return json({ error: 'forbidden' }, 403);
  }

  const db = admin();
  const log: Record<string, unknown> = {};

  let session;
  try {
    session = await getSession(db);
  } catch (e) {
    log.txline = `unavailable: ${e instanceof Error ? e.message : e}`;
    return json({ ok: true, ...log });
  }

  try {
    const fixtures: TxFixture[] = await fetchFixtures(session, WC_COMPETITION_ID);
    const now = Date.now();
    const { data: existing } = await db.from('matches').select('id, status');
    const terminal = new Set((existing ?? []).filter((m) => m.status === 'finished' || m.status === 'voided').map((m) => m.id));
    for (const f of fixtures) {
      const id = String(f.FixtureId);
      const start = Number(f.StartTime);
      const elapsedMin = Math.floor((now - start) / 60000);
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

  const linkedAll = telegramEnabled ? await linkedUserIds(db) : [];

  const PRE_WINDOWS = [60, 30, 10, 5, 1];
  try {
    const now = Date.now();
    const { data: upSoon } = await db
      .from('matches')
      .select('id, home_code, away_code, stage, kickoff, pre_stage')
      .eq('status', 'upcoming')
      .gte('kickoff', new Date(now).toISOString())
      .lte('kickoff', new Date(now + 66 * 60 * 1000).toISOString());
    for (const um of upSoon ?? []) {
      const minsLeft = (new Date(um.kickoff).getTime() - now) / 60000;
      let stage = um.pre_stage ?? 0;
      const fired: number[] = [];
      while (stage < PRE_WINDOWS.length && minsLeft <= PRE_WINDOWS[stage]) { fired.push(PRE_WINDOWS[stage]); stage++; }
      if (fired.length === 0) continue;
      await db.from('matches').update({ pre_stage: stage }).eq('id', um.id);
      const w = fired[fired.length - 1];
      const label = w >= 60 ? '1 hour' : `${w} minute${w === 1 ? '' : 's'}`;
      const interested = await interestedUsers(db, um.id);
      const tg = await allowed(db, linkedAll, (p) => p.match_events?.phases !== false);
      const inbox = await allowed(db, interested, (p) => p.match_events?.phases !== false);
      await fanOut(db, tg, inbox, {
        title: `⏰ ${um.home_code} v ${um.away_code} — kicks off in ${label}`,
        body: `${um.stage ? um.stage + ' · ' : ''}Get your Score Link and first call ready.`,
        url: `/match/${um.id}`,
      }, 'prematch');
    }
  } catch { /* reminders are best-effort */ }

  const { data: liveMatches } = await db
    .from('matches')
    .select('id, txline_fixture_id, home_code, away_code, home_name, away_name, stage, phase, minute, stat_snapshot, kickoff_notified, ft_notified')
    .eq('status', 'live');

  for (const m of liveMatches ?? []) {
    let scores: unknown[] = [];
    try {
      if (m.txline_fixture_id) scores = await fetchScores(session, Number(m.txline_fixture_id));
    } catch { /* tolerate; cards in this window will void */ }

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

      if (realStatus === 'live') {
        await db.from('tournaments').update({ status: 'live' }).eq('match_id', m.id).eq('status', 'upcoming');

        if (!m.kickoff_notified) {
          await db.from('matches').update({ kickoff_notified: true }).eq('id', m.id);
          {
            const tg = await allowed(db, linkedAll, (p) => p.match_events?.phases !== false);
            const inbox = await allowed(db, await interestedUsers(db, m.id), (p) => p.match_events?.phases !== false);
            await fanOut(db, tg, inbox, {
              title: `🟢 Kick-off — ${m.home_code} v ${m.away_code}`,
              body: `${m.stage ? m.stage + ' · ' : ''}It’s live. Call the next moment.`,
              url: `/match/${m.id}`,
            }, 'kickoff');
          }
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

      if ([15, 16, 17, 18].includes(statusId)) {
        await db.from('tournaments').update({ status: 'voided' })
          .eq('match_id', m.id).in('status', ['upcoming', 'live', 'settling']);
      } else if (realStatus === 'finished') {
        if (!m.ft_notified) {
          await db.from('matches').update({ ft_notified: true }).eq('id', m.id);
          {
            const tg = await allowed(db, linkedAll, (p) => p.match_events?.phases !== false);
            const inbox = await allowed(db, await interestedUsers(db, m.id), (p) => p.match_events?.phases !== false);
            await fanOut(db, tg, inbox, {
              title: `⏱️ Full time — ${m.home_code} ${statOf(latest, 1) ?? 0}–${statOf(latest, 2) ?? 0} ${m.away_code}`,
              body: 'Results are settling now. Rewatch it in Replay.',
              url: `/replay/${m.id}`,
            }, 'fulltime');
          }
        }
        const fh = statOf(latest, 1) ?? 0;
        const fa = statOf(latest, 2) ?? 0;
        const realResult = fh > fa ? 'home' : fh < fa ? 'away' : 'draw';
        const { data: callRows } = await db
          .from('match_predictions')
          .select('user_id, home_goals, away_goals, side')
          .eq('match_id', m.id)
          .eq('settled', false);
        for (const c of callRows ?? []) {
          const exact = c.home_goals === fh && c.away_goals === fa;
          const guess = c.home_goals > c.away_goals ? 'home' : c.home_goals < c.away_goals ? 'away' : 'draw';
          const points = exact ? 250 : guess === realResult ? 75 : 0;
          if (points > 0) {
            const { data: prof } = await db.from('profiles').select('coins').eq('id', c.user_id).maybeSingle();
            if (prof) await db.from('profiles').update({ coins: prof.coins + points }).eq('id', c.user_id);
            await notifyAll(db, c.user_id, {
              title: exact ? `🎯 Exact score! +${points}` : `✅ You called the result — +${points}`,
              body: `${m.home_code} ${fh}–${fa} ${m.away_code}`,
              url: `/match/${m.id}`,
              kind: 'call-score',
            }).catch(() => {});
          }
          await db.from('match_predictions').update({ settled: true, points }).eq('match_id', m.id).eq('user_id', c.user_id);
        }

        const { data: slPicks } = await db
          .from('score_link_picks')
          .select('id, user_id, home_goals, away_goals, stake, multiplier')
          .eq('match_id', m.id)
          .eq('settled', false);
        for (const sp of slPicks ?? []) {
          const won = sp.home_goals === fh && sp.away_goals === fa;
          const payout = won ? Math.round(sp.stake * Number(sp.multiplier)) : 0;
          if (won) {
            const { data: prof } = await db.from('profiles').select('coins').eq('id', sp.user_id).maybeSingle();
            if (prof) await db.from('profiles').update({ coins: prof.coins + payout }).eq('id', sp.user_id);
          }
          await db.from('score_link_picks').update({ settled: true, won, payout }).eq('id', sp.id);
          if (await prefAllows(db, sp.user_id, (p) => p.my_play?.settled !== false)) {
            await notifyAll(db, sp.user_id, {
              title: won ? `🎯 Score Link hit! +${payout}` : '✕ Score Link missed',
              body: `You called ${m.home_code} ${sp.home_goals}–${sp.away_goals} ${m.away_code} · final ${fh}–${fa}`,
              url: `/match/${m.id}`,
              kind: 'score-link',
            }).catch(() => {});
          }
        }

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

    if (newEvents.length) {
      const interested = await interestedUsers(db, m.id);
      const hs = statOf(latest, 1) ?? 0;
      const as = statOf(latest, 2) ?? 0;
      const tgCache: Record<string, string[]> = {};
      const inCache: Record<string, string[]> = {};
      const tgAud = async (cat: 'goals' | 'cards' | 'corners') => tgCache[cat] ??= await allowed(db, linkedAll, (p) => p.match_events?.[cat] !== false);
      const inAud = async (cat: 'goals' | 'cards' | 'corners') => inCache[cat] ??= await allowed(db, interested, (p) => p.match_events?.[cat] !== false);
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
        await fanOut(db, await tgAud(cat), await inAud(cat), {
          title,
          body: `${teamName} · ${ev.minute}'${m.stage ? ' · ' + m.stage : ''}`,
          url: `/match/${m.id}`,
        }, 'match-event');
      }
    }

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

      const seq = Number(latest?.Seq ?? 0);
      let merkleRoot = '—';
      let merkleRootFull: string | null = null;
      if (outcome != null && m.txline_fixture_id && card.txline_stat_key != null && seq > 0) {
        try {
          const validation = await fetchStatValidation(session, Number(m.txline_fixture_id), seq, Number(card.txline_stat_key));
          const r = merkleRootFrom(validation);
          merkleRoot = r.short;
          merkleRootFull = r.full;
        } catch { /* keep '—' */ }
      }

      const receipt = {
        source: 'TxLINE live feed',
        statVerified: resolvedLabel,
        merkleRoot,
        merkleRootFull,
        anchoredOn: CLUSTER_LABEL,
        txRef: m.txline_fixture_id ? `fix:${m.txline_fixture_id}/seq:${seq}/key:${card.txline_stat_key}` : '—',
        explorerUrl: PROGRAM_EXPLORER_URL,
        cardId: card.id,
      };

      await db.from('prediction_cards').update({
        status: 'settled',
        outcome: outcome ?? null,
        resolved_stat_label: resolvedLabel,
        receipt,
        txline_seq: Number(latest?.Seq ?? 0) || null,
      }).eq('id', card.id);

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

        if (await prefAllows(db, callRow.user_id, (p) => p.my_play?.settled !== false)) {
          const title = r.won ? `⚽ Your call hit — +${r.payout}` : '✕ Not this time';
          const streakLine = r.won
            ? `🔥 Streak: ${r.newStreak}${r.newStreak > 1 ? ` (${(1 + r.newStreak * 0.1).toFixed(1)}× payout)` : ''}`
            : prof.streak > 0 ? `💔 Streak reset (was ${prof.streak}) — start a new run.` : 'No points this time.';
          await notifyAll(db, callRow.user_id, {
            title,
            body: `${card.question}\n${streakLine}`,
            url: `/match/${m.id}`,
            kind: 'settled',
          }).catch(() => {});
        }
      }

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
        let delta = 0;
        if (outcome != null) delta = tc.pick === outcome ? Math.round(tc.stake * card.multiplier) : -tc.stake;
        const newPoints = Math.max(0, part.points + delta);
        await db.from('tournament_participants')
          .update({ points: newPoints })
          .eq('tournament_id', tc.tournament_id)
          .eq('user_id', tc.user_id);
        await db.from('tournament_predictions').update({ settled: true }).eq('id', tc.id);

        if (outcome != null && await prefAllows(db, tc.user_id, (p) => p.my_play?.settled !== false)) {
          const won = tc.pick === outcome;
          await notifyAll(db, tc.user_id, {
            title: won ? `🏆 Tournament call hit — +${delta}` : `✕ Tournament call missed — ${delta}`,
            body: `${card.question}\nStack: ${newPoints.toLocaleString('en-US')} pts`,
            url: `/tournaments/${tc.tournament_id}`,
            kind: 'settled',
          }).catch(() => {});
        }
      }
    }

    const { count: openCount } = await db
      .from('prediction_cards')
      .select('id', { count: 'exact', head: true })
      .eq('match_id', m.id)
      .neq('status', 'settled');

    if (!openCount || openCount === 0) {
      const phase = (m.phase as MatchPhase) ?? '2H';
      if (isLivePhase(phase) && phase !== 'HT') {
        const gen = generateCard({ phase, homeCode: m.home_code, awayCode: m.away_code, windowSeconds: CARD_WINDOW_SECONDS });
        const baseline = gen.txline_stat_key != null ? statOf(latest, gen.txline_stat_key) : null;

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

        {
          const tg = await allowed(db, linkedAll, (p) => p.my_play?.new_card !== false);
          const inbox = await allowed(db, await interestedUsers(db, m.id), (p) => p.my_play?.new_card !== false);
          await fanOut(db, tg, inbox, {
            title: `🎯 New Flash Pool — ${m.home_code} v ${m.away_code}`,
            body: `${gen.question} · ${m.minute}'`,
            url: `/match/${m.id}`,
          }, 'flash-pool');
        }
      }
    }
  }

  log.liveMatches = liveMatches?.length ?? 0;

  try {
    const { data: toBuild } = await db
      .from('matches')
      .select('id, txline_fixture_id, home_code, away_code')
      .eq('status', 'finished')
      .eq('replay_built', false)
      .not('txline_fixture_id', 'is', null)
      .order('kickoff', { ascending: true })
      .limit(4);
    let built = 0;
    for (const m of toBuild ?? []) {
      if (await backfillReplay(db, session, m as Entry).catch(() => false)) built++;
    }
    log.replaysBuilt = built;
  } catch (e) {
    log.replaysBuilt = `error: ${e instanceof Error ? e.message : e}`;
  }

  return json({ ok: true, ...log });
});
