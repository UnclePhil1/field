import { useState } from 'react';
import { Pitch } from '../../components/Pitch';
import { Flag } from '../../components/Flag';
import { EventTicker } from '../match/EventTicker';
import { StatLabel } from '../../components/StatLabel';
import { Button } from '../../components/Button';
import { PlayIcon } from '../../components/Icons';
import { phaseLabel } from '../../lib/format';
import { useReplay, type ReplayEvent } from '../../lib/replay/useReplay';
import type { Team } from '../../types';

const SPEEDS = [2, 6, 12];

interface ReplayPlayerProps {
  home: Team;
  away: Team;
  competition: string;
  stage?: string;
  timeline: ReplayEvent[];
}

export function ReplayPlayer({ home, away, competition, stage, timeline }: ReplayPlayerProps) {
  const r = useReplay(timeline);
  const [started, setStarted] = useState(false);

  return (
    <section className="relative corner-arcs overflow-hidden rounded-card-lg border border-edge-2 bg-turf p-4 shadow-card sm:p-5">
      <span className="arc-b" aria-hidden />

      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-grass/40 bg-grass/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-grass">
          Replay
        </span>
        <span className="tabular text-sm text-chalk-dim">
          {phaseLabel(r.phase)} · <span aria-live="polite">{r.minute}'</span>
        </span>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 sm:gap-4">
        <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Flag country={home.country} code={home.code} size={22} />
          <span className="text-sm font-bold text-chalk-dim">{home.code}</span>
        </span>
        <span className="tabular shrink-0 whitespace-nowrap text-2xl font-extrabold text-chalk sm:text-3xl">
          {r.homeScore} – {r.awayScore}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <span className="text-sm font-bold text-chalk-dim">{away.code}</span>
          <Flag country={away.country} code={away.code} size={22} />
        </span>
      </div>
      <p className="mt-0.5 text-center text-xs text-muted">
        {home.name} v {away.name}{stage ? ` · ${stage}` : ''} · {competition}
      </p>

      <div className="relative mt-4">
        <Pitch events={r.events} />

        {!started && (
          <button
            onClick={() => { setStarted(true); r.play(); }}
            className="absolute inset-0 grid place-items-center rounded-[14px] bg-pitch-deep/70 backdrop-blur-[2px]"
          >
            <span className="flex flex-col items-center gap-2">
              <span className="grid h-14 w-14 animate-live-pulse place-items-center rounded-full bg-grass text-ink shadow-grass"><PlayIcon size={28} /></span>
              <span className="text-sm font-bold text-chalk">Play the replay</span>
            </span>
          </button>
        )}
        {r.finished && (
          <div className="absolute inset-0 grid place-items-center rounded-[14px] bg-pitch-deep/75 backdrop-blur-[2px]">
            <div className="animate-win-reveal text-center">
              <p className="eyebrow text-grass">Full time</p>
              <p className="tabular mt-1 text-4xl font-extrabold text-chalk">{r.homeScore} – {r.awayScore}</p>
              <Button variant="grass" size="md" className="mt-4" onClick={() => r.restart()}>Watch again</Button>
            </div>
          </div>
        )}
      </div>

      <EventTicker events={r.events} />

      <div className="mt-4 flex flex-col gap-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-pitch-deep">
          <div className="h-full rounded-full bg-grass transition-[width] duration-300" style={{ width: `${r.progress * 100}%` }} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-y-2">
          <div className="flex items-center gap-2">
            {started && !r.finished && (
              <Button variant="turf" size="sm" onClick={() => (r.playing ? r.pause() : r.play())}>{r.playing ? 'Pause' : 'Resume'}</Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => { setStarted(true); r.restart(); }}>Restart</Button>
          </div>
          <div className="flex items-center gap-1">
            <StatLabel>Speed</StatLabel>
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => r.setSpeed(s)}
                className={['tabular rounded-full px-2 py-1 text-xs font-bold transition-colors', r.speed === s ? 'bg-grass/15 text-grass' : 'text-muted hover:text-chalk'].join(' ')}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
