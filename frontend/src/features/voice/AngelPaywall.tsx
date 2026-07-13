import { useState } from 'react';
import { voiceApi, type VoiceAccess } from '../../lib/voiceApi';
import { Button } from '../../components/Button';

export function AngelPaywall({ access, onSubscribed }: { access: VoiceAccess | null; onSubscribed: () => void }) {
  const [txSig, setTxSig] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const treasury = access?.treasury;

  async function submit() {
    setBusy(true); setErr(null);
    try {
      await voiceApi.subscribe(txSig.trim());
      onSubscribed();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not verify payment');
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-card-lg border border-grass/30 bg-pitch-deep/80 p-5 text-center backdrop-blur">
      <p className="eyebrow text-grass">Angel Pro</p>
      <h3 className="mt-1 text-xl font-extrabold tracking-display text-chalk">Your 5 free sessions are used</h3>
      <p className="mt-2 text-sm text-chalk-dim">
        Keep talking to Angel for <span className="font-bold text-grass">${access?.priceUsdc ?? 5} USDC / month</span>.
      </p>

      {treasury ? (
        <div className="mt-4 text-left">
          <p className="text-xs text-muted">1. Send ${access?.priceUsdc ?? 5} USDC on Solana to:</p>
          <button
            onClick={() => { navigator.clipboard.writeText(treasury); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="tabular mt-1 w-full truncate rounded-card border border-edge-2 bg-turf px-3 py-2 text-left text-xs text-chalk hover:border-grass/50"
            title="Copy address"
          >
            {copied ? 'Copied!' : treasury}
          </button>
          <p className="mt-3 text-xs text-muted">2. Paste the transaction signature:</p>
          <input
            value={txSig}
            onChange={(e) => { setTxSig(e.target.value); setErr(null); }}
            placeholder="Transaction signature"
            className="tabular mt-1 h-11 w-full rounded-[13px] border border-edge-2 bg-turf px-3 text-sm text-chalk outline-none focus:border-grass/60"
          />
          {err && <p className="mt-2 text-xs text-flare-2">{err}</p>}
          <Button variant="grass" size="md" fullWidth className="mt-3" disabled={busy || !txSig.trim()} onClick={submit}>
            {busy ? 'Verifying on Solana…' : 'Verify & unlock 30 days'}
          </Button>
        </div>
      ) : (
        <p className="mt-4 rounded-card border border-edge-2 bg-turf px-3 py-2.5 text-xs font-semibold text-chalk-dim">
          Subscriptions open soon — check back shortly.
        </p>
      )}
    </div>
  );
}
