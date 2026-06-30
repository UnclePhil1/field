import { formatCountdown } from '../lib/format';

interface CountdownRingProps {
  /** 1 = full window, 0 = locked */
  progress: number;
  /** seconds remaining */
  remaining: number;
  size?: number;
  label?: string;
}

/**
 * Kickoff-circle countdown. The sweep is flare (urgent), the track is faint
 * chalk. Time renders in mono. Honors reduced motion via short transition.
 */
export function CountdownRing({
  progress,
  remaining,
  size = 92,
  label = 'TO LOCK',
}: CountdownRingProps) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - progress);
  const urgent = remaining <= 6 && remaining > 0;

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      role="timer"
      aria-live="off"
      aria-label={`${Math.ceil(remaining)} seconds to lock`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={urgent ? 'var(--flare)' : 'var(--grass)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className={['tabular text-xl font-extrabold leading-none', urgent ? 'text-flare-2' : 'text-chalk'].join(' ')}>
            {formatCountdown(remaining)}
          </div>
          <div className="eyebrow mt-1 text-[0.55rem]">{label}</div>
        </div>
      </div>
    </div>
  );
}
