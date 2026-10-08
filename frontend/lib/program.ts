import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import { Buffer } from "buffer";
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import idl from "./blue_mango_idl.json";
import { PROGRAM_ID } from "./solana";

/** 0=Pending 1=Done 2=Disputed 3=Released 4=Refunded */
export const MILESTONE_STATES = ["Pending", "Done", "Disputed", "Released", "Refunded"] as const;

/** @deprecated — use MANGO_STATE_COLORS from @/components/icons instead */
export const STATE_COLORS: Record<number, string> = {
  0: "#8fa383",
  1: "#3f8cff",
  2: "#8f5e1c",
  3: "#f0b429",
  4: "#78716c",
};

export interface MilestoneView {
  description: string;
  amount: bigint;
  state: number;
  doneAt: bigint;
}

export interface DealView {
  address: string;
  payer: string;
  payee: string;
  arbiter: string;
  /** null = native SOL deal */
  paymentMint: string | null;
  total: bigint;
  released: bigint;
  refunded: bigint;
  milestones: MilestoneView[];
}

const NATIVE_MINT = PublicKey.default.toBase58();

function bnToBigint(bn: any): bigint {
  return BigInt(bn.toString());
}

function decodeDescription(raw: number[], len: number): string {
  try {
    return Buffer.from(raw.slice(0, len)).toString("utf8");
  } catch {
    return "";
  }
}

export function decodeDeal(address: PublicKey, raw: any): DealView {
  const count: number = raw.milestoneCount;
  return {
    address: address.toBase58(),
    payer: raw.payer.toBase58(),
    payee: raw.payee.toBase58(),
    arbiter: raw.arbiter.toBase58(),
    paymentMint: raw.paymentMint.toBase58() === NATIVE_MINT ? null : raw.paymentMint.toBase58(),
    total: bnToBigint(raw.total),
    released: bnToBigint(raw.released),
    refunded: bnToBigint(raw.refunded),
    milestones: (raw.milestones as any[])
      .slice(0, count)
      .map((m) => ({
        description: decodeDescription(m.description, m.descriptionLen),
        amount: bnToBigint(m.amount),
        state: m.state as number,
        doneAt: bnToBigint(m.doneAt),
      })),
  };
}

// ── PDAs ─────────────────────────────────────────────────────────────

export function registryPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("registry")], PROGRAM_ID);
  return pda;
}

export function dealPda(dealId: bigint): PublicKey {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(dealId);
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("deal"), buf], PROGRAM_ID);
  return pda;
}

export function vaultPda(deal: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("vault"), deal.toBuffer()], PROGRAM_ID);
  return pda;
}

// ── program handle ───────────────────────────────────────────────────

export function getProgram(connection: Connection, wallet: any): Program {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  // IDL is hand-authored from programs/blue_mango/src/lib.rs —
  // regenerate with `anchor build` once the toolchain is available.
  // Anchor 0.30 reads the program id from the IDL's `address` field,
  // so inject the configured PROGRAM_ID (env-overridable).
  const idlWithAddress = { ...(idl as any), address: PROGRAM_ID.toBase58() };
  return new Program(idlWithAddress, provider);
}

export async function fetchRegistry(program: Program): Promise<{ nextDealId: bigint } | null> {
  try {
    const raw: any = await (program.account as any).registry.fetch(registryPda());
    return { nextDealId: bnToBigint(raw.nextDealId) };
  } catch {
    return null;
  }
}

export async function fetchDeal(program: Program, dealId: bigint): Promise<DealView | null> {
  try {
    const pda = dealPda(dealId);
    const raw: any = await (program.account as any).deal.fetch(pda);
    return decodeDeal(pda, raw);
  } catch {
    return null;
  }
}

/** Fetch many deals at once (dashboard). Returns null for missing ids. */
export async function fetchDeals(
  program: Program,
  dealIds: bigint[]
): Promise<(DealView | null)[]> {
  if (dealIds.length === 0) return [];
  const pdas = dealIds.map(dealPda);
  const raws: any[] = await (program.account as any).deal.fetchMultiple(pdas);
  return raws.map((raw, i) => (raw ? decodeDeal(pdas[i], raw) : null));
}

// ── token helpers ────────────────────────────────────────────────────

export function ataFor(mint: PublicKey, owner: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner);
}

/**
 * Returns a create-ATA instruction if the ATA doesn't exist yet,
 * so it can be prepended via `.preInstructions([...])`.
 */
export async function maybeCreateAtaIx(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
  payer: PublicKey
): Promise<TransactionInstruction[]> {
  const ata = ataFor(mint, owner);
  const info = await connection.getAccountInfo(ata);
  if (info) return [];
  return [
    createAssociatedTokenAccountInstruction(payer, ata, owner, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
  ];
}

export { TOKEN_PROGRAM_ID, SystemProgram };

// ── formatting ───────────────────────────────────────────────────────

export function fmtToken(raw: bigint, decimals: number): string {
  const neg = raw < 0n;
  const abs = neg ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const w = abs / base;
  const f = abs % base;
  const whole = Number(w).toLocaleString();
  if (f === 0n) return `${neg ? "-" : ""}${whole}`;
  let frac = f.toString().padStart(decimals, "0").replace(/0+$/, "");
  frac = frac.slice(0, 4);
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

export function parseToken(input: string, decimals: number): bigint {
  const t = input.trim();
  if (!t) return 0n;
  const [w = "0", f = ""] = t.split(".");
  const frac = (f + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(w || "0") * 10n ** BigInt(decimals) + BigInt(frac || "0");
}

export function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

export function isValidPubkey(s: string): boolean {
  try {
    new PublicKey(s.trim());
    return true;
  } catch {
    return false;
  }
}

export function bn(n: bigint | number): BN {
  return new BN(n.toString());
}

// ── react hook ───────────────────────────────────────────────────────

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useMemo } from "react";

/** Anchor program handle bound to the connected wallet (null until connected). */
export function useBlueMango(): Program | null {
  const { connection } = useConnection();
  const wallet = useWallet();
  return useMemo(() => {
    if (!wallet.publicKey) return null;
    try {
      return getProgram(connection, wallet);
    } catch {
      return null;
    }
  }, [connection, wallet]);
}
