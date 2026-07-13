import { useState } from 'react';

interface FlagProps {
  country?: string; 
  code: string; // fallback 3-letter code, e.g. 'NED'
  size?: number;
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
