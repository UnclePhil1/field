/* eslint-disable */
// Builds link previews for shared pages. Social apps don't run JavaScript, so the
// single-page app shows them nothing. This handles /match/:id, /tournaments/:id
// and /replay/:id, then returns index.html with the right title and image tags
// filled in. Normal browsers get the same page and load the app as usual.
// Reads use the public key only.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
// Fixed origin so a spoofed Host header can't poison a cached preview.
const CANONICAL = (process.env.APP_URL || 'https://www.fanfield.xyz').replace(/\/$/, '');

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function rest(path: string): Promise<any[]> {
  if (!SUPABASE_URL || !ANON) return [];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  if (!res.ok) return [];
  return (await res.json().catch(() => [])) as any[];
}

interface Card {
  title: string;
  description: string;
  image: string; // query string for /api/og
}

const DEFAULT: Omit<Card, 'image'> & { image: string } = {
  title: 'Field — call it, live.',
  description:
    'Predict the next five minutes of a live match. Build a streak, climb the board, join USDC prediction battles — every result provably fair on Solana.',
  image: 'type=default',
};

function scoreShown(status: string): boolean {
  return status === 'live' || status === 'finished';
}

async function matchCard(id: string, kind: 'match' | 'replay'): Promise<Card | null> {
  const rows = await rest(
    `matches?id=eq.${encodeURIComponent(id)}&select=home_code,away_code,home_name,away_name,home_score,away_score,status,stage,minute,competition&limit=1`,
  );
  const m = rows[0];
  if (!m) return null;
  const show = scoreShown(m.status);
  const vs = show ? `${m.home_name} ${m.home_score}–${m.away_score} ${m.away_name}` : `${m.home_name} v ${m.away_name}`;
  const stage = m.stage ? `${m.stage} · ` : '';
  const title = kind === 'replay' ? `Replay — ${vs}` : vs;
  const description =
    kind === 'replay'
      ? `Rewatch ${vs} on Field — ${stage}${m.competition}. Every verified moment, replayed.`
      : m.status === 'live'
        ? `LIVE ${m.minute}′ — ${stage}${m.competition}. Call the next goal, card or corner. Free coins, provably fair.`
        : m.status === 'finished'
          ? `Full time — ${stage}${m.competition}. See how it played out on Field.`
          : `${stage}${m.competition} — kicking off soon. Line up your first call on Field.`;
  const p = new URLSearchParams({
    type: kind,
    home: m.home_code,
    away: m.away_code,
    status: m.status ?? '',
    stage: m.stage ?? '',
    comp: m.competition ?? '',
  });
  if (show) { p.set('hs', String(m.home_score ?? 0)); p.set('as', String(m.away_score ?? 0)); }
  if (m.status === 'live' && m.minute != null) p.set('minute', String(m.minute));
  return { title, description, image: p.toString() };
}

async function tournamentCard(id: string): Promise<Card | null> {
  const rows = await rest(
    `tournaments?id=eq.${encodeURIComponent(id)}&select=title,prize_total,status,match_id&limit=1`,
  );
  const t = rows[0];
  if (!t) return null;
  let home = '', away = '';
  if (t.match_id) {
    const mr = await rest(`matches?id=eq.${encodeURIComponent(t.match_id)}&select=home_code,away_code&limit=1`);
    if (mr[0]) { home = mr[0].home_code; away = mr[0].away_code; }
  }
  const prize = Number(t.prize_total) || 0;
  const teams = home && away ? `${home} v ${away} · ` : '';
  const description = `${teams}Free 1,000-pt stack, host-funded $${prize} USDC prize. Play the match, climb the board — provably fair on Solana.`;
  const p = new URLSearchParams({
    type: 'tournament',
    title: t.title ?? 'Prediction Battle',
    prize: String(prize),
    home, away,
    status: t.status ?? '',
  });
  return { title: `${t.title} — Prediction Battle`, description, image: p.toString() };
}

// A brag card is built purely from query params (no DB) — the win/streak the
// player wants to show off.
function bragCard(sp: URLSearchParams): Card {
  const title = (sp.get('title') || 'Called it on FanField').slice(0, 80);
  const sub = (sp.get('sub') || '').slice(0, 90);
  const tag = (sp.get('tag') || '').slice(0, 20);
  const p = new URLSearchParams({ type: 'brag', title, sub, tag });
  return { title, description: sub || 'Play along the match on FanField.', image: p.toString() };
}

async function resolve(pathname: string, search: URLSearchParams): Promise<Card> {
  const parts = pathname.split('/').filter(Boolean); // ["match","123"]
  const [seg, id] = parts;
  let card: Card | null = null;
  try {
    if (seg === 'brag') return bragCard(search);
    if (seg === 'match' && id) card = await matchCard(id, 'match');
    else if (seg === 'replay' && id) card = await matchCard(id, 'replay');
    else if (seg === 'tournaments' && id) card = await tournamentCard(id);
  } catch {
    card = null;
  }
  return card ?? DEFAULT;
}

export default async function handler(req: any, res: any) {
  const u = new URL(req.url || '/', CANONICAL);
  const pathname = u.pathname;
  const pageUrl = `${CANONICAL}${req.url || ''}`;

  const card = await resolve(pathname, u.searchParams);
  const image = `${CANONICAL}/api/og?${card.image}`;

  let html = '';
  try {
    const r = await fetch(`${CANONICAL}/index.html`, { headers: { 'x-share-render': '1' } });
    html = await r.text();
  } catch {
    // As a last resort, ship a minimal shell so the link still previews.
    html = '<!doctype html><html><head></head><body><div id="root"></div></body></html>';
  }

  const T = esc(card.title);
  const D = esc(card.description);
  const I = esc(image);

  html = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${T}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${D}" />`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${T}" />`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${D}" />`)
    .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${I}" />`)
    .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${T}" />`)
    .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${D}" />`)
    .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${I}" />`);

  const extra =
    `<meta property="og:url" content="${esc(pageUrl)}" />` +
    `<meta property="og:image:width" content="1200" />` +
    `<meta property="og:image:height" content="630" />` +
    `<meta property="og:image:type" content="image/png" />` +
    `<meta name="twitter:image:alt" content="${T}" />`;
  html = html.replace('</head>', `${extra}</head>`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Short shared cache so live scores refresh in unfurls without hammering origin.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=120');
  res.status(200).send(html);
}
