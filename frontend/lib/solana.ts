import { PublicKey } from "@solana/web3.js";

/** Solana RPC endpoint — override with NEXT_PUBLIC_SOLANA_RPC (devnet default). */
export const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";

/** Blue-Mango Anchor program id. Set NEXT_PUBLIC_PROGRAM_ID after deploy. */
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "11111111111111111111111111111111"
);

export const isConfigured =
  (process.env.NEXT_PUBLIC_PROGRAM_ID || "").length >= 32;

/** SPL token used for token-denominated deals (e.g. USDC). */
export const PAYMENT_MINT = process.env.NEXT_PUBLIC_PAYMENT_MINT || "";
export const PAYMENT_SYMBOL = process.env.NEXT_PUBLIC_PAYMENT_SYMBOL || "USDC";
export const PAYMENT_DECIMALS = Number(process.env.NEXT_PUBLIC_PAYMENT_DECIMALS || 6);

export const SOL_DECIMALS = 9;
export const SOL_SYMBOL = "SOL";

export const CLAIM_TIMEOUT_DAYS = 7;
