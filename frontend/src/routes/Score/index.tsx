import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';

export function Score() {
  const [params] = useSearchParams();
  const home = params.get('home') || '';
  const away = params.get('away') || '';
  const hs = params.get('hs') || '0';
  const as = params.get('as') || '0';
  const mult = params.get('mult') || '';
  const tag = params.get('tag') || 'Pick';
  const [busy, setBusy] = useState(false);

  const q = new URLSearchParams({ type: 'scoreline', home, away, hs, as, mult, tag });
  const img = `/api/og?${q.toString()}`;

  async function download() {
    setBusy(true);
    try {
      const res = await fetch(img);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `fanfield-${home}-${hs}-${as}-${away}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { /* ignore */ } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto w-full max-w-[680px] px-4 py-8 text-center">
      <img src={img} alt={`${home} ${hs}-${as} ${away}`} className="w-full rounded-card-lg border border-edge-2 shadow-card" />
      <h1 className="mt-5 text-2xl font-extrabold tracking-display text-chalk">
        {home} {hs}–{as} {away}
      </h1>
      <p className="mt-1 text-sm text-muted">{mult ? `${tag} · ${mult}× · $1 pays $${mult}` : tag}</p>
      <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button variant="turf" size="lg" disabled={busy} onClick={download}>{busy ? 'Preparing…' : 'Download card'}</Button>
        <Link to="/play"><Button variant="grass" size="lg">Pick your scoreline</Button></Link>
      </div>
    </div>
  );
}
