import type { Player } from '../../types';
import { FlameIcon } from '../../components/Icons';
import { formatCoins } from '../../lib/format';

export function LeaderboardTable({ players, compact = false }: { players: Player[]; compact?: boolean }) {
  return (
    <ol className="flex flex-col gap-1.5">
      {players.map((p, i) => {
        const rank = p.rank ?? i + 1;
        return (
          <li
            key={p.id}
            className={[
              'flex items-center gap-3 rounded-[13px] border px-3 py-2.5',
              p.isMe ? 'border-grass/45 bg-grass/10' : 'border-edge bg-turf',
            ].join(' ')}
          >
            <span
              className={[
                'tabular grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold',
                rank <= 3 ? 'bg-grass/15 text-grass' : 'bg-turf-2 text-muted',
              ].join(' ')}
            >
              {rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className={['truncate text-sm font-semibold', p.isMe ? 'text-grass' : 'text-chalk'].join(' ')}>
                {p.name}
              </p>
              {!compact && <p className="text-xs text-muted">{p.handle}</p>}
            </div>
            <span className="tabular flex items-center gap-1 text-xs font-semibold text-flare-2">
              <FlameIcon size={13} /> {p.streak}
            </span>
            <span className="tabular w-16 text-right text-sm font-bold text-chalk">{formatCoins(p.points)}</span>
          </li>
        );
      })}
    </ol>
  );
}
