// Reown AppKit — wallet connection modal (WalletConnect + injected + mobile deep
// links). Configured once at module scope; hooks read from its global store.
import { createAppKit } from '@reown/appkit/react';
import { SolanaAdapter } from '@reown/appkit-adapter-solana/react';
import { solana } from '@reown/appkit/networks';

const projectId = 'df4b33c621ff53615df4b05f1b15d13a';

const metadata = {
  name: 'Field',
  description: 'Live play-along football predictions — provably fair on Solana.',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://field.app',
  icons: ['https://avatars.githubusercontent.com/u/179229932'],
};

// Field runs on Solana mainnet (data + payouts).
createAppKit({
  adapters: [new SolanaAdapter()],
  networks: [solana],
  metadata,
  projectId,
  // On-chain wallets only — no email or social logins.
  features: {
    analytics: false,
    email: false,
    socials: false,
    emailShowWallets: false,
    onramp: false,
    swaps: false,
  },
});
