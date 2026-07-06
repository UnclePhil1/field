import { useState } from 'react';
import { ShareIcon, CheckIcon } from './Icons';
import { buildBragUrl } from '../lib/brag';

interface BragButtonProps {
  title: string;      // headline on the card, e.g. "Called Spain's corner"
  sub?: string;       // context line, e.g. "Portugal 2–1 Spain · 67'"
  tag?: string;       // pill text, e.g. "CALLED IT"
  text?: string;      // caption used when sharing
  label?: string;
  className?: string;
}

/** Shares a brag link that unfurls as a personal FanField card. */
export function BragButton({ title, sub, tag, text, label = 'Share', className = '' }: BragButtonProps) {
  const [done, setDone] = useState(false);

  async function share() {
    const url = buildBragUrl({ title, sub, tag });
    const caption = text ?? `${title} on FanField`;
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ title: 'FanField', text: caption, url });
        return;
      }
      await navigator.clipboard.writeText(`${caption} ${url}`);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      /* cancelled or blocked */
    }
  }

  return (
    <button
      onClick={share}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border border-grass/40 bg-grass/10 px-3 py-1.5 text-xs font-semibold text-grass transition-colors hover:bg-grass/15',
        className,
      ].join(' ')}
      title="Share your moment"
    >
      {done ? <CheckIcon size={14} /> : <ShareIcon size={14} />}
      {done ? 'Copied!' : label}
    </button>
  );
}
