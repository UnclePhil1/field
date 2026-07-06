// Tournaments API — real REST over Postgres. Public reads; writes are validated
// server-side and performed with the service role. No funds are ever held: the
// host pays winners directly and submits a tx we VERIFY on-chain (read-only).
import { admin, getUser } from '../_shared/supabase.ts';
import { json, preflight } from '../_shared/cors.ts';
import { isValidSolanaAddress, verifyUsdcPayment } from '../_shared/solana.ts';
import { prefAllows } from '../_shared/fcm.ts';
import { notifyAll } from '../_shared/notify.ts';

const PAYOUT_WINDOW_MS = 48 * 60 * 60 * 1000;

/* ------------------------------ row mappers ------------------------------ */
// deno-lint-ignore no-explicit-any
function toTournament(r: any) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    bannerUrl: r.banner_url,
    hostUserId: r.host_user_id,
    hostPayoutWallet: r.host_payout_wallet,
    matchId: r.match_id,
    status: r.status,
    prize: { asset: r.prize_asset, total: Number(r.prize_total) },
    capacity: r.capacity_type === 'slots' ? { type: 'slots', max: r.capacity_max } : { type: 'open' },
    winnersCount: r.winners_count,
    split: r.split,
    startingPoints: r.starting_points,
    joinCloses: r.join_closes,
    participantCount: r.participant_count,
    settledAt: r.settled_at ?? undefined,
    payoutDeadline: r.payout_deadline ?? undefined,
    createdAt: r.created_at,
  };
}

/* ------------------------------ validation ------------------------------- */
// deno-lint-ignore no-explicit-any
function validateTournament(b: any, requireMatch: boolean): string | null {
  if (!b.title || String(b.title).length > 60) return 'Title is required (≤60 chars)';
  if (String(b.description ?? '').length > 280) return 'Description must be ≤280 chars';
  if (requireMatch && !b.matchId) return 'A match is required';
  if (!isValidSolanaAddress(b.hostPayoutWallet ?? '')) return 'A valid Solana payout wallet is required';
  if (!(b.prize?.total > 0)) return 'Prize must be greater than 0';
  const wc = Number(b.winnersCount);
  if (!(wc >= 1 && wc <= 5)) return 'Winners must be between 1 and 5';
  if (!Array.isArray(b.split) || b.split.length !== wc) return 'Split must have one % per winner';
  if (b.split.reduce((a: number, n: number) => a + Number(n), 0) !== 100) return 'Split must sum to 100%';
  if (b.capacity?.type === 'slots') {
    if (!(b.capacity.max >= wc)) return 'Slots must be ≥ winners count';
  }
  return null;
}

/* -------------------------------- router --------------------------------- */
Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const db = admin();
  const url = new URL(req.url);
  const seg = url.pathname.split('/').filter(Boolean);
  // drop everything up to and including 'tournaments'
  const i = seg.indexOf('tournaments');
  const path = i >= 0 ? seg.slice(i + 1) : seg;
  const method = req.method;

  try {
    // GET /tournaments
    if (method === 'GET' && path.length === 0) {
      const filter = url.searchParams.get('filter');
      let q = db.from('tournaments').select('*').order('created_at', { ascending: false });
      if (filter === 'joinable') q = q.eq('status', 'upcoming');
      else if (filter === 'live') q = q.eq('status', 'live');
      else if (filter === 'completed') q = q.in('status', ['awaiting_payout', 'completed', 'voided']);
      const { data, error } = await q;
      if (error) throw error;
      return json(data.map(toTournament));
    }

    // POST /tournaments  (create) — must be before the :id guard below
    if (method === 'POST' && path.length === 0) {
      const user = await getUser(req);
      if (!user) return json({ error: 'unauthorized' }, 401);
      const body = await req.json();
      const err = validateTournament(body, true);
      if (err) return json({ error: err }, 400);
      const { data: match } = await db.from('matches').select('status').eq('id', body.matchId).maybeSingle();
      if (!match) return json({ error: 'match not found' }, 404);
      if (match.status !== 'upcoming') return json({ error: 'match already kicked off' }, 409);
      const { data, error } = await db
        .from('tournaments')
        .insert({
          title: body.title,
          description: body.description ?? '',
          banner_url: body.bannerUrl ?? '',
          host_user_id: user.id,
          host_payout_wallet: body.hostPayoutWallet,
          match_id: body.matchId,
          prize_total: body.prize.total,
          prize_asset: 'USDC',
          capacity_type: body.capacity?.type ?? 'open',
          capacity_max: body.capacity?.type === 'slots' ? body.capacity.max : null,
          winners_count: body.winnersCount,
          split: body.split,
          starting_points: body.startingPoints ?? 1000,
          join_closes: body.joinCloses ?? 'kickoff',
        })
        .select('*')
        .single();
      if (error) throw error;
      return json(toTournament(data), 201);
    }

    // GET /tournaments/mine  (hosting + joined)
    if (method === 'GET' && path[0] === 'mine') {
      const user = await getUser(req);
      if (!user) return json({ error: 'unauthorized' }, 401);
      const [{ data: hosted }, { data: parts }] = await Promise.all([
        db.from('tournaments').select('*').eq('host_user_id', user.id),
        db.from('tournament_participants').select('tournament_id').eq('user_id', user.id),
      ]);
      const joinedIds = (parts ?? []).map((p) => p.tournament_id);
      const { data: joined } = joinedIds.length
        ? await db.from('tournaments').select('*').in('id', joinedIds)
        : { data: [] };
      return json({ hosting: (hosted ?? []).map(toTournament), joined: (joined ?? []).map(toTournament) });
    }

    const id = path[0];
    if (!id) return json({ error: 'not found' }, 404);

    // GET /tournaments/:id
    if (method === 'GET' && path.length === 1) {
      const { data } = await db.from('tournaments').select('*').eq('id', id).maybeSingle();
      return data ? json(toTournament(data)) : json({ error: 'not found' }, 404);
    }

    // PATCH /tournaments/:id  (host edits before kickoff)
    if (method === 'PATCH' && path.length === 1) {
      const user = await getUser(req);
      if (!user) return json({ error: 'unauthorized' }, 401);
      const { data: t } = await db.from('tournaments').select('host_user_id, status').eq('id', id).maybeSingle();
      if (!t) return json({ error: 'not found' }, 404);
      if (t.host_user_id !== user.id) return json({ error: 'only the host can edit this tournament' }, 403);
      if (t.status !== 'upcoming') return json({ error: 'the match has started — this tournament can no longer be edited' }, 409);

      const body = await req.json();
      const verr = validateTournament(body, false);
      if (verr) return json({ error: verr }, 400);
      const { data, error } = await db
        .from('tournaments')
        .update({
          title: body.title,
          description: body.description ?? '',
          banner_url: body.bannerUrl ?? '',
          host_payout_wallet: body.hostPayoutWallet,
          prize_total: body.prize.total,
          capacity_type: body.capacity?.type ?? 'open',
          capacity_max: body.capacity?.type === 'slots' ? body.capacity.max : null,
          winners_count: body.winnersCount,
          split: body.split,
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return json(toTournament(data));
    }

    // DELETE /tournaments/:id  (host deletes before kickoff)
    if (method === 'DELETE' && path.length === 1) {
      const user = await getUser(req);
      if (!user) return json({ error: 'unauthorized' }, 401);
      const { data: t } = await db.from('tournaments').select('host_user_id, status').eq('id', id).maybeSingle();
      if (!t) return json({ error: 'not found' }, 404);
      if (t.host_user_id !== user.id) return json({ error: 'only the host can delete this tournament' }, 403);
      if (t.status !== 'upcoming') return json({ error: 'the match has started — this tournament can no longer be deleted' }, 409);
      const { error } = await db.from('tournaments').delete().eq('id', id);
      if (error) throw error;
      return json({ ok: true });
    }

    // GET /tournaments/:id/standings
    if (method === 'GET' && path[1] === 'standings') {
      const user = await getUser(req);
      const { data: t } = await db.from('tournaments').select('winners_count').eq('id', id).maybeSingle();
      const { data: rows } = await db
        .from('tournament_participants')
        .select('user_id, points, joined_at, profiles(username, streak)')
        .eq('tournament_id', id)
        .order('points', { ascending: false })
        .order('joined_at', { ascending: true });
      const winners = t?.winners_count ?? 0;
      const standings = (rows ?? []).map((r, idx) => ({
        rank: idx + 1,
        userId: r.user_id,
        // deno-lint-ignore no-explicit-any
        displayName: (r as any).profiles?.username ?? 'anon',
        points: r.points,
        // deno-lint-ignore no-explicit-any
        streak: (r as any).profiles?.streak ?? 0,
        isMe: user ? r.user_id === user.id : false,
        paid: idx + 1 <= winners,
      }));
      return json(standings);
    }

    // GET /tournaments/:id/payouts
    if (method === 'GET' && path[1] === 'payouts' && path.length === 2) {
      const user = await getUser(req);
      const { data } = await db.from('tournament_payouts').select('*').eq('tournament_id', id).order('rank');
      return json(
        (data ?? []).map((p) => ({
          tournamentId: p.tournament_id,
          rank: p.rank,
          userId: p.user_id,
          amount: Number(p.amount),
          asset: p.asset,
          winnerWallet: p.winner_wallet ?? undefined,
          status: p.status,
          txSig: p.tx_sig ?? undefined,
          verified: p.verified,
          paidAt: p.paid_at ?? undefined,
          isMe: user ? p.user_id === user.id : false,
        })),
      );
    }

    // GET /tournaments/:id/me  (my participation: points, rank)
    if (method === 'GET' && path[1] === 'me') {
      const user = await getUser(req);
      if (!user) return json({ joined: false });
      const { data: p } = await db
        .from('tournament_participants')
        .select('points, rank')
        .eq('tournament_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      return json(p ? { joined: true, points: p.points, rank: p.rank ?? undefined } : { joined: false });
    }

    // POST /tournaments/:id/predict  (tournament-mode wager from the stack)
    if (method === 'POST' && path[1] === 'predict') {
      const user = await getUser(req);
      if (!user) return json({ error: 'unauthorized' }, 401);
      const { cardId, pick, stake } = await req.json();
      if (!cardId || (pick !== 'yes' && pick !== 'no') || stake == null || stake < 0) {
        return json({ error: 'cardId, pick and stake required' }, 400);
      }
      const { data: part } = await db
        .from('tournament_participants')
        .select('points')
        .eq('tournament_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!part) return json({ error: 'join the tournament first' }, 403);
      if (stake > part.points) return json({ error: 'stake exceeds your points' }, 402);
      const { data: card } = await db.from('prediction_cards').select('status, locks_at').eq('id', cardId).maybeSingle();
      if (!card || card.status !== 'live' || new Date(card.locks_at).getTime() <= Date.now()) {
        return json({ error: 'card is locked' }, 409);
      }
      const { error: insErr } = await db
        .from('tournament_predictions')
        .insert({ tournament_id: id, card_id: cardId, user_id: user.id, pick, stake });
      if (insErr) {
        if (insErr.code === '23505') return json({ error: 'already called this card' }, 409);
        throw insErr;
      }
      return json({ ok: true });
    }

    // POST /tournaments/:id/join  (free)
    if (method === 'POST' && path[1] === 'join') {
      const user = await getUser(req);
      if (!user) return json({ error: 'unauthorized' }, 401);
      const { data: t } = await db.from('tournaments').select('*').eq('id', id).maybeSingle();
      if (!t) return json({ error: 'not found' }, 404);
      const { data: match } = await db.from('matches').select('status').eq('id', t.match_id).maybeSingle();
      const closed =
        t.status !== 'upcoming' ||
        (t.join_closes === 'kickoff' && match && match.status !== 'upcoming');
      if (closed) return json({ error: 'joining closed' }, 409);
      if (t.capacity_type === 'slots' && t.participant_count >= t.capacity_max) {
        return json({ error: 'tournament is full' }, 409);
      }
      const { error: insErr } = await db
        .from('tournament_participants')
        .insert({ tournament_id: id, user_id: user.id, points: t.starting_points });
      if (insErr && insErr.code !== '23505') throw insErr; // ignore duplicate (idempotent)
      if (!insErr) await db.from('tournaments').update({ participant_count: t.participant_count + 1 }).eq('id', id);
      return json({ ok: true, points: t.starting_points });
    }

    // POST /tournaments/:id/payouts/me/address  (winner submits wallet)
    if (method === 'POST' && path[1] === 'payouts' && path[2] === 'me' && path[3] === 'address') {
      const user = await getUser(req);
      if (!user) return json({ error: 'unauthorized' }, 401);
      const { wallet } = await req.json();
      if (!isValidSolanaAddress(wallet ?? '')) return json({ error: 'invalid Solana address' }, 400);
      const { data: payout } = await db
        .from('tournament_payouts')
        .select('*')
        .eq('tournament_id', id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!payout) return json({ error: 'no prize for you in this tournament' }, 404);
      if (payout.status === 'paid') return json({ error: 'already paid' }, 409);
      await db
        .from('tournament_payouts')
        .update({ winner_wallet: wallet, status: 'awaiting_payment' })
        .eq('id', payout.id);
      return json({ ok: true });
    }

    // POST /tournaments/:id/payouts/:rank/mark-paid  (host → verify on-chain)
    if (method === 'POST' && path[1] === 'payouts' && path[3] === 'mark-paid') {
      const user = await getUser(req);
      if (!user) return json({ error: 'unauthorized' }, 401);
      const rank = Number(path[2]);
      const { txSig } = await req.json();
      const { data: t } = await db.from('tournaments').select('host_user_id').eq('id', id).maybeSingle();
      if (!t) return json({ error: 'not found' }, 404);
      if (t.host_user_id !== user.id) return json({ error: 'only the host can mark payouts' }, 403);
      const { data: payout } = await db
        .from('tournament_payouts')
        .select('*')
        .eq('tournament_id', id)
        .eq('rank', rank)
        .maybeSingle();
      if (!payout) return json({ error: 'payout not found' }, 404);
      if (!payout.winner_wallet) return json({ error: 'winner has not submitted an address yet' }, 409);
      if (payout.status === 'paid') return json({ ok: true, alreadyPaid: true });

      const result = await verifyUsdcPayment(txSig, payout.winner_wallet, Number(payout.amount));
      if (!result.ok) return json({ error: `verification failed: ${result.reason}`, verified: false }, 422);

      await db
        .from('tournament_payouts')
        .update({ status: 'paid', verified: true, tx_sig: txSig, paid_at: new Date().toISOString() })
        .eq('id', payout.id);
      // if every payout is paid, complete the tournament
      const { data: remaining } = await db
        .from('tournament_payouts')
        .select('id')
        .eq('tournament_id', id)
        .neq('status', 'paid');
      if (!remaining || remaining.length === 0) {
        await db.from('tournaments').update({ status: 'completed' }).eq('id', id);
      }
      return json({ ok: true, verified: true });
    }

    // POST /tournaments/:id/settle  (finalize standings → payouts + 48h window)
    if (method === 'POST' && path[1] === 'settle') {
      // internal: guarded by the cron secret (same as engine-tick)
      const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
      if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
        return json({ error: 'forbidden' }, 403);
      }
      const { data: t } = await db.from('tournaments').select('*').eq('id', id).maybeSingle();
      if (!t) return json({ error: 'not found' }, 404);
      if (t.status === 'awaiting_payout' || t.status === 'completed') return json({ ok: true, already: true });

      const { data: parts } = await db
        .from('tournament_participants')
        .select('user_id, points, joined_at')
        .eq('tournament_id', id)
        .order('points', { ascending: false })
        .order('joined_at', { ascending: true });
      const ranked = parts ?? [];
      // under-subscribed → shrink winners to actual participant count
      const winners = Math.min(t.winners_count, ranked.length);
      const split: number[] = t.split;
      const now = Date.now();
      // assign ranks
      for (let r = 0; r < ranked.length; r++) {
        await db.from('tournament_participants').update({ rank: r + 1 }).eq('tournament_id', id).eq('user_id', ranked[r].user_id);
      }
      // create payouts for the top-N
      for (let r = 0; r < winners; r++) {
        const amount = Math.round(((Number(t.prize_total) * split[r]) / 100) * 100) / 100;
        await db.from('tournament_payouts').upsert(
          { tournament_id: id, rank: r + 1, user_id: ranked[r].user_id, amount, asset: 'USDC', status: 'awaiting_address' },
          { onConflict: 'tournament_id,rank' },
        );
        // notify "you won — submit your payout address" across every channel.
        if (await prefAllows(db, ranked[r].user_id, (p) => p.tournaments?.results !== false)) {
          const title = `🏆 Results are in — you finished #${r + 1}`;
          const body = `Claim $${amount} USDC in ${t.title}`;
          await notifyAll(db, ranked[r].user_id, { title, body, url: `/tournaments/${id}`, kind: 'tournament' }).catch(() => {});
        }
      }
      await db
        .from('tournaments')
        .update({
          status: 'awaiting_payout',
          settled_at: new Date(now).toISOString(),
          payout_deadline: new Date(now + PAYOUT_WINDOW_MS).toISOString(),
        })
        .eq('id', id);
      return json({ ok: true, winners });
    }

    return json({ error: 'not found' }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
