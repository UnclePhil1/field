import type { MatchEvent } from '../../types';

const dot: Record<MatchEvent['kind'], string> = {
  goal: 'bg-grass',
  corner: 'bg-chalk-dim',
  card: 'bg-flare',
};

export function EventTicker({ events }: { events: MatchEvent[] }) {
  const shown = events.slice(0, 4);
  if (shown.length === 0) return null;
  return (
    <ul
      className="no-scrollbar mt-3 flex gap-2 overflow-x-auto"
      aria-label="Recent verified events"
    >
      {shown.map((e) => (
        <li
          key={e.id}
          className="animate-ticker-in flex shrink-0 items-center gap-2 rounded-full border border-edge bg-turf-2 px-3 py-1.5"
        >
          <span className={['h-1.5 w-1.5 rounded-full', dot[e.kind]].join(' ')} />
          <span className="tabular text-xs text-muted">{e.minute}'</span>
          <span className="text-xs font-semibold text-chalk-dim">{e.label}</span>
        </li>
      ))}
    </ul>
  );
}
