import { useState } from 'react';
import { ShareIcon, CheckIcon } from './Icons';

/** Copy a shareable link (defaults to the current page URL). */
export function ShareButton({ url, label = 'Share', className = '' }: { url?: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const link = url ?? window.location.href;
    try {
      // native share sheet on mobile where available, else clipboard
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ url: link, title: document.title });
        return;
      }
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard may be blocked; ignore
    }
  }

  return (
    <button
      onClick={copy}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border border-edge-2 bg-turf-2 px-3 py-1.5 text-xs font-semibold text-chalk-dim transition-colors hover:border-grass/60 hover:text-chalk',
        className,
      ].join(' ')}
      title="Copy shareable link"
    >
      {copied ? <CheckIcon size={14} className="text-grass" /> : <ShareIcon size={14} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}
