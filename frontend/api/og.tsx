/* eslint-disable */
// Draws the preview image (1200x630 PNG) for shared links. Query params decide
// what the card shows for a match, tournament or replay.
import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

// Field brand tokens (mirror of the app's CSS variables).
const PITCH = '#091310';
const PITCH_2 = '#0c1a14';
const GRASS = '#39d353';
const CHALK = '#e8f0ea';
const MUTED = '#7d938a';
const FLARE = '#ff5c39';

let fontCache: { name: string; data: ArrayBuffer; weight: 400 | 600 | 800 }[] | null = null;

async function fonts() {
  if (fontCache) return fontCache;
  const base = 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files';
  const load = async (w: 400 | 600 | 800) => {
    const res = await fetch(`${base}/inter-latin-${w}-normal.woff`);
    return { name: 'Inter', data: await res.arrayBuffer(), weight: w };
  };
  fontCache = await Promise.all([load(400), load(600), load(800)]);
  return fontCache;
}

function q(url: URL, k: string): string {
  return (url.searchParams.get(k) ?? '').slice(0, 80);
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const type = q(url, 'type') || 'match';
  const home = q(url, 'home');
  const away = q(url, 'away');
  const hs = q(url, 'hs');
  const as = q(url, 'as');
  const status = q(url, 'status'); // live | finished | upcoming
  const stage = q(url, 'stage');
  const comp = q(url, 'comp') || 'World Cup';
  const title = q(url, 'title');
  const prize = q(url, 'prize');
  const minute = q(url, 'minute');

  const hasScore = hs !== '' && as !== '';

  // ── headline + pill per share type ──
  let headline: string;
  let pill: { text: string; bg: string; fg: string; dot?: boolean };
  let sub: string;

  if (type === 'brag') {
    headline = title || 'Called it.';
    pill = { text: (q(url, 'tag') || 'FANFIELD').toUpperCase(), bg: 'rgba(57,211,83,0.14)', fg: GRASS };
    sub = q(url, 'sub');
  } else if (type === 'default' || (!home && !away && !title)) {
    headline = 'Call it, live.';
    pill = { text: 'FIELD', bg: 'rgba(57,211,83,0.14)', fg: GRASS };
    sub = 'Predict the next 5 minutes · provably fair on Solana';
  } else if (type === 'tournament') {
    headline = title || 'Prediction Battle';
    pill = { text: prize ? `$${prize} USDC` : 'Battle', bg: 'rgba(57,211,83,0.14)', fg: GRASS };
    sub = [home && away ? `${home} v ${away}` : '', comp].filter(Boolean).join('  ·  ');
  } else if (type === 'replay') {
    headline = hasScore ? `${home} ${hs}–${as} ${away}` : `${home} v ${away}`;
    pill = { text: 'REPLAY', bg: 'rgba(57,211,83,0.14)', fg: GRASS };
    sub = [stage, comp].filter(Boolean).join('  ·  ');
  } else {
    headline = hasScore ? `${home} ${hs}–${as} ${away}` : `${home} v ${away}`;
    if (status === 'live') pill = { text: `LIVE${minute ? ` · ${minute}'` : ''}`, bg: 'rgba(255,92,57,0.16)', fg: FLARE, dot: true };
    else if (status === 'finished') pill = { text: 'FULL TIME', bg: 'rgba(125,147,138,0.18)', fg: CHALK };
    else pill = { text: 'KICK-OFF SOON', bg: 'rgba(57,211,83,0.14)', fg: GRASS };
    sub = [stage, comp].filter(Boolean).join('  ·  ');
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '68px 72px',
          background: `linear-gradient(150deg, ${PITCH} 0%, ${PITCH_2} 55%, #0a1712 100%)`,
          fontFamily: 'Inter',
          color: CHALK,
          position: 'relative',
        }}
      >
        {/* subtle grass edge glow */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: '10px', height: '630px', background: GRASS, display: 'flex' }} />

        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: '40px', fontWeight: 800, letterSpacing: '-1px' }}>
            <span>Field</span>
            <span style={{ color: GRASS }}>.</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 22px',
              borderRadius: '999px',
              background: pill.bg,
              color: pill.fg,
              fontSize: '26px',
              fontWeight: 800,
              letterSpacing: '1px',
            }}
          >
            {pill.dot && <div style={{ width: '14px', height: '14px', borderRadius: '999px', background: pill.fg, display: 'flex' }} />}
            {pill.text}
          </div>
        </div>

        {/* headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', fontSize: headline.length > 22 ? '84px' : '108px', fontWeight: 800, lineHeight: 1.02, letterSpacing: '-2px' }}>
            {headline}
          </div>
          {sub ? (
            <div style={{ display: 'flex', fontSize: '34px', fontWeight: 600, color: MUTED }}>{sub}</div>
          ) : null}
        </div>

        {/* footer tagline */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: '30px', fontWeight: 600, color: CHALK }}>
            {type === 'tournament' ? 'Join the battle — free 1,000-pt stack.' : 'Call the next moment.'}
          </div>
          <div style={{ display: 'flex', fontSize: '26px', fontWeight: 600, color: MUTED }}>fanfield.xyz</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: (await fonts()).map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: 'normal' as const })),
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' },
    },
  );
}
