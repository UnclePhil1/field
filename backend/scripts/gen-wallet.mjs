import { writeFileSync, existsSync } from 'node:fs';
import { Keypair } from '@solana/web3.js';

const out = process.argv[2] ?? './my-wallet.json';
if (existsSync(out)) {
  console.error(`Refusing to overwrite existing file: ${out}`);
  console.error('Pass a different path or delete it first.');
  process.exit(1);
}

const kp = Keypair.generate();
writeFileSync(out, JSON.stringify(Array.from(kp.secretKey)));

console.log('Wallet created:', out);
console.log('Public address:', kp.publicKey.toBase58());
console.log('\nNext:');
console.log(`  1. Send ~0.01 SOL to ${kp.publicKey.toBase58()} (a couple of cents, for gas).`);
console.log(`  2. node txline-subscribe.mjs ${out}`);
console.log('\nKeep this file private — it controls the wallet. Never commit it.');
