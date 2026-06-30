import type { ReactNode } from 'react';

type Tone = 'turf' | 'grass' | 'flare' | 'muted';

interface ChipProps {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  /** render numeric content in mono */
  mono?: boolean;
}

const tones: Record<Tone, string> = {
  turf: 'bg-turf-2 text-chalk-dim border-edge',
  grass: 'bg-grass/10 text-grass border-grass/30',
  flare: 'bg-flare/10 text-flare-2 border-flare/30',
  muted: 'bg-transparent text-muted border-edge',
};

export function Chip({ tone = 'turf', icon, children, className = '', mono }: ChipProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-xs font-semibold leading-none',
        tones[tone],
        mono ? 'tabular' : '',
        className,
      ].join(' ')}
    >
      {icon}
      {children}
    </span>
  );
}
