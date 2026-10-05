import { formatUnits, parseUnits } from "viem";
import abi from "./abi.json";

export const BLUE_MANGO_ABI = abi as any;
export const BLUE_MANGO_ADDRESS = (process.env.NEXT_PUBLIC_BLUEMANGO_ADDRESS || "") as `0x${string}`;
export const USDG_ADDRESS = (process.env.NEXT_PUBLIC_USDG_ADDRESS || "") as `0x${string}`;
export const USDG_DECIMALS = 6;
export const CLAIM_TIMEOUT_DAYS = 7;

export const isConfigured = BLUE_MANGO_ADDRESS.startsWith("0x") && BLUE_MANGO_ADDRESS.length === 42;

export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

/** 0=Pending 1=Done 2=Disputed 3=Released 4=Refunded */
export const MILESTONE_STATES = ["Pending", "Done", "Disputed", "Released", "Refunded"] as const;

export const STATE_COLORS: Record<number, string> = {
  0: "#64748b", // pending — slate
  1: "#3b82f6", // done — blue
  2: "#f59e0b", // disputed — mango amber
  3: "#10b981", // released — green
  4: "#6b7280", // refunded — gray
};

export function fmtUsdg(raw: bigint): string {
  const s = formatUnits(raw, USDG_DECIMALS);
  const [w, f = ""] = s.split(".");
  return `${Number(w).toLocaleString()}${f ? "." + f.slice(0, 2) : ""}`;
}

export function parseUsdg(input: string): bigint {
  return parseUnits(input.trim() || "0", USDG_DECIMALS);
}

export function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export interface MilestoneView {
  description: string;
  amount: bigint;
  state: number;
  doneAt: bigint;
}
