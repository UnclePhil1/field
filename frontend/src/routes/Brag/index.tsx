import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';

export function Brag() {
  const [params] = useSearchParams();
  const title = params.get('title') || 'Called it on FanField';
  const sub = params.get('sub') || '';
  const tag = params.get('tag') || '';

  const q = new URLSearchParams({ type: 'brag', title, sub, tag });
  const img = `/api/og?${q.toString()}`;

  return (
    <div className="mx-auto w-full max-w-[680px] px-4 py-8 text-center">
      <img src={img} alt={title} className="w-full rounded-card-lg border border-edge-2 shadow-card" />
      <h1 className="mt-5 text-2xl font-extrabold tracking-display text-chalk">{title}</h1>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      <p className="mt-4 text-sm text-chalk-dim">Play along the match — call the next goal, card or corner, live.</p>
      <Link to="/play" className="mt-4 inline-block">
        <Button variant="grass" size="lg">Play FanField</Button>
      </Link>
    </div>
  );
}
