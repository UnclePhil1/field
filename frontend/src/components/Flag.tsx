// Country flag rendered from an ISO 3166-1 alpha-2 code via flagcdn.com.
// Falls back to the team's letter code when no country is known (or the image
// fails). Image-based (not emoji) so flags render on every OS, including Windows.
import { useState } from 'react';

interface FlagProps {
  country?: string; // 'nl', 'gb-eng', …
  code: string; // fallback 3-letter code, e.g. 'NED'
  size?: number; // px height
  className?: string;
}

export function Flag({ country, code, size = 36, className = '' }: FlagProps) {
  const [failed, setFailed] = useState(false);

  if (!country || failed) {
    return (
      <span
        style={{ height: size, minWidth: size }}
        className={[
          'inline-flex items-center justify-center rounded-full border border-edge-2 bg-turf-2 px-2 text-[11px] font-bold leading-none tracking-wide text-chalk-dim',
          className,
        ].join(' ')}
      >
        {code}
      </span>
    );
  }

  // flagcdn uses lowercase codes; height variants: 20/40/80/160…
  const h = size <= 20 ? 'h20' : size <= 40 ? 'h40' : 'h80';
  return (
    <img
      src={`https://flagcdn.com/${h}/${country}.png`}
      srcSet={`https://flagcdn.com/${h === 'h20' ? 'h40' : 'h80'}/${country}.png 2x`}
      width={size * 1.4}
      height={size}
      alt={`${code} flag`}
      onError={() => setFailed(true)}
      className={['rounded-[5px] border border-edge-2 object-cover', className].join(' ')}
      style={{ height: size, width: size * 1.4 }}
      loading="lazy"
    />
  );
}
