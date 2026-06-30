// txline-proof — expand a settled card's receipt into the underlying Merkle
// proof on demand (read-only). Powers the "View the proof" modal.
import { admin } from '../_shared/supabase.ts';
import { json, preflight } from '../_shared/cors.ts';
import { getSession, fetchStatValidation } from '../_shared/txline.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const url = new URL(req.url);
  let cardId = url.searchParams.get('cardId');
  if (!cardId && req.method === 'POST') {
    cardId = await req.json().then((b) => b?.cardId ?? null).catch(() => null);
  }
  if (!cardId) return json({ error: 'cardId required' }, 400);

  const db = admin();
  const { data: card } = await db
    .from('prediction_cards')
    .select('txline_stat_key, txline_seq, receipt, match_id, resolved_stat_label')
    .eq('id', cardId)
    .maybeSingle();
  if (!card) return json({ error: 'card not found' }, 404);

  const { data: match } = await db
    .from('matches')
    .select('txline_fixture_id')
    .eq('id', card.match_id)
    .maybeSingle();

  // No on-chain data available (e.g. token not set / voided) → return the
  // receipt we already have so the modal still renders honestly.
  if (!match?.txline_fixture_id || card.txline_seq == null || card.txline_stat_key == null) {
    return json({ receipt: card.receipt, proof: null, note: 'Proof data not available for this card.' });
  }

  try {
    const session = await getSession(db);
    const validation = await fetchStatValidation(
      session,
      Number(match.txline_fixture_id),
      Number(card.txline_seq),
      Number(card.txline_stat_key),
    );
    const merkleRoot =
      (validation.eventStatRoot as string) ??
      ((validation.summary as Record<string, unknown>)?.eventStatsSubTreeRoot as string) ??
      '—';
    return json({
      receipt: { ...(card.receipt as Record<string, unknown>), merkleRoot },
      proof: validation,
    });
  } catch (e) {
    return json({ receipt: card.receipt, proof: null, note: `Proof fetch failed: ${e instanceof Error ? e.message : e}` });
  }
});
