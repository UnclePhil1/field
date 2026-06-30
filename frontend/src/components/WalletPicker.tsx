import { Modal } from './Modal';
import { ArrowIcon } from './Icons';
import { detectWallets, type SolanaProvider, type WalletOption } from '../lib/wallet';

interface WalletPickerProps {
  open: boolean;
  onClose: () => void;
  /** called with the chosen wallet's provider; parent runs connect+sign */
  onSelect: (provider: SolanaProvider) => void;
  connecting?: boolean;
}

/** A round badge with the wallet's initial, tinted with its brand colour. */
function Badge({ name, brand }: { name: string; brand: string }) {
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold text-ink"
      style={{ backgroundColor: brand }}
    >
      {name[0]}
    </span>
  );
}

export function WalletPicker({ open, onClose, onSelect, connecting }: WalletPickerProps) {
  const wallets: WalletOption[] = detectWallets();
  const installed = wallets.filter((w) => w.provider);
  const others = wallets.filter((w) => !w.provider);

  return (
    <Modal open={open} onClose={onClose} labelledBy="wallet-picker-title">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <h2 id="wallet-picker-title" className="text-lg font-extrabold tracking-display text-chalk">
            Choose a wallet
          </h2>
          <button onClick={onClose} className="rounded-full px-2 py-1 text-sm text-muted hover:text-chalk" aria-label="Close">
            Close
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">Connect a Solana wallet to sign in.</p>

        {/* installed → connect */}
        {installed.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {installed.map((w) => (
              <li key={w.id}>
                <button
                  onClick={() => w.provider && onSelect(w.provider)}
                  disabled={connecting}
                  className="flex w-full items-center gap-3 rounded-[14px] border border-edge-2 bg-turf-2 px-3 py-3 text-left transition-colors hover:border-grass/60 disabled:opacity-60"
                >
                  <Badge name={w.name} brand={w.brand} />
                  <span className="flex-1 text-sm font-bold text-chalk">{w.name}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-grass">Detected</span>
                  <ArrowIcon size={16} className="text-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {installed.length === 0 && (
          <p className="mt-4 rounded-[12px] border border-edge bg-turf-2 px-3 py-3 text-sm text-chalk-dim">
            No Solana wallet detected. Install one below, then come back.
          </p>
        )}

        {/* not installed → install link */}
        {others.length > 0 && (
          <>
            <p className="eyebrow mt-5">More wallets</p>
            <ul className="mt-2 flex flex-col gap-2">
              {others.map((w) => (
                <li key={w.id}>
                  <a
                    href={w.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center gap-3 rounded-[14px] border border-edge bg-turf px-3 py-3 transition-colors hover:border-edge-2"
                  >
                    <Badge name={w.name} brand={w.brand} />
                    <span className="flex-1 text-sm font-semibold text-chalk-dim">{w.name}</span>
                    <span className="text-[11px] font-semibold text-muted">Install ↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}

        {connecting && <p className="mt-4 text-center text-xs text-grass">Approve the request in your wallet…</p>}
      </div>
    </Modal>
  );
}
