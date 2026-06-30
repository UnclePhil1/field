import type { Standing } from '../../types/tournament';
import { FlameIcon } from '../../components/Icons';
import { formatCoins } from '../../lib/format';

/** Tournament board: ordered by points; paid (top-N) rows glow grass. */
export function TournamentStandings({ standings }: { standings: Standing[] }) {
  if (standings.length === 0) {
    return <p className="text-sm text-muted">No players yet — be the first to join.</p>;
  }
  return (
    <ol className="flex flex-col gap-1.5">
      {standings.map((s) => (
        <li
          key={s.userId}
          className={[
            'flex items-center gap-3 rounded-[13px] border px-3 py-2.5',
            s.isMe
              ? 'border-grass/60 bg-grass/10'
              : s.paid
                ? 'border-grass/30 bg-grass/[0.06]'
                : 'border-edge bg-turf',
          ].join(' ')}
        >
          <span
            className={[
              'tabular grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold',
              s.paid ? 'bg-grass/15 text-grass' : 'bg-turf-2 text-muted',
            ].join(' ')}
          >
            {s.rank}
          </span>
          <p className={['min-w-0 flex-1 truncate text-sm font-semibold', s.isMe ? 'text-grass' : 'text-chalk'].join(' ')}>
            {s.displayName}
            {s.paid && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-grass">in the money</span>}
          </p>
          <span className="tabular flex items-center gap-1 text-xs font-semibold text-flare-2">
            <FlameIcon size={13} /> {s.streak}
          </span>
          <span className="tabular w-16 text-right text-sm font-bold text-chalk">{formatCoins(s.points)}</span>
        </li>
      ))}
    </ol>
  );
}
