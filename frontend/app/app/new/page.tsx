"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import AppNav from "@/components/AppNav";
import {
  BLUE_MANGO_ABI,
  BLUE_MANGO_ADDRESS,
  USDG_ADDRESS,
  ERC20_ABI,
  isConfigured,
  parseUsdg,
  fmtUsdg,
} from "@/lib/contract";

interface Row {
  desc: string;
  amount: string;
}

export default function NewDeal() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [payee, setPayee] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { desc: "", amount: "" },
    { desc: "", amount: "" },
  ]);
  const [step, setStep] = useState<"form" | "approve" | "create" | "done">("form");
  const [error, setError] = useState("");

  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: dealCount } = useReadContract({
    address: BLUE_MANGO_ADDRESS,
    abi: BLUE_MANGO_ABI,
    functionName: "dealCount",
    query: { enabled: isConfigured },
  });

  const validRows = rows.filter((r) => r.desc.trim() && Number(r.amount) > 0);
  const total = validRows.reduce((s, r) => s + parseUsdg(r.amount), 0n);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function handleApprove() {
    setError("");
    try {
      setStep("approve");
      const h = await writeContractAsync({
        address: USDG_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [BLUE_MANGO_ADDRESS, total],
      });
      setTxHash(h);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "Approval failed");
      setStep("form");
    }
  }

  async function handleCreate() {
    setError("");
    try {
      setStep("create");
      const h = await writeContractAsync({
        address: BLUE_MANGO_ADDRESS,
        abi: BLUE_MANGO_ABI,
        functionName: "createDeal",
        args: [
          payee as `0x${string}`,
          arbiter as `0x${string}`,
          validRows.map((r) => r.desc.trim()),
          validRows.map((r) => parseUsdg(r.amount)),
          total,
        ],
      });
      setTxHash(h);
      setStep("done");
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "Create failed");
      setStep("approve");
    }
  }

  // after create tx confirms, jump to the new deal
  useEffect(() => {
    if (step === "done" && txConfirmed && typeof dealCount === "bigint") {
      router.push(`/app/deal/${(dealCount - 1n).toString()}`);
    }
  }, [step, txConfirmed, dealCount, router]);

  return (
    <>
      <AppNav />
      <div className="wrap" style={{ maxWidth: 680 }}>
        <div className="app-head">
          <h1>🌱 Plant a new deal</h1>
        </div>

        {!isConfigured && (
          <div className="notice">⚠️ Contract not configured — set addresses in .env.local first.</div>
        )}
        {!isConnected && (
          <div className="notice">Connect your wallet to create a deal.</div>
        )}

        <div className="card">
          <div className="field">
            <label>Payee address</label>
            <input
              placeholder="0x…"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="field">
            <label>Arbiter address (neutral third party)</label>
            <input
              placeholder="0x…"
              value={arbiter}
              onChange={(e) => setArbiter(e.target.value)}
              spellCheck={false}
            />
          </div>

          <label
            style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--muted)", margin: "22px 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            Milestones (branches)
          </label>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <input
                placeholder={`Milestone ${i + 1} description`}
                value={r.desc}
                onChange={(e) => setRow(i, { desc: e.target.value })}
                style={{ flex: 3, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 12, padding: "12px 14px", fontSize: 15, outline: "none" }}
              />
              <input
                placeholder="USDG"
                inputMode="decimal"
                value={r.amount}
                onChange={(e) => setRow(i, { amount: e.target.value })}
                style={{ flex: 1, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 12, padding: "12px 14px", fontSize: 15, outline: "none" }}
              />
              {rows.length > 1 && (
                <button className="btn btn-ghost btn-sm" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setRows([...rows, { desc: "", amount: "" }])}
            style={{ marginBottom: 18 }}
          >
            + Add milestone
          </button>

          <div
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "14px 0", borderTop: "1px solid var(--border)", marginBottom: 6,
            }}
          >
            <span style={{ color: "var(--muted)", fontWeight: 700 }}>Total to lock</span>
            <b style={{ fontSize: 20 }}>{fmtUsdg(total)} USDG</b>
          </div>

          {error && <div className="notice" style={{ borderColor: "var(--red)" }}>⚠️ {error}</div>}

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button
              className="btn btn-ghost"
              style={{ flex: 1 }}
              disabled={!isConnected || !isConfigured || validRows.length === 0 || step !== "form" || !payee || !arbiter}
              onClick={handleApprove}
            >
              {step === "approve" && !txConfirmed ? "Approving…" : "1 · Approve USDG"}
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={step !== "approve" || !txConfirmed}
              onClick={handleCreate}
            >
              {step === "create" ? "Creating…" : step === "done" ? "Opening deal…" : "2 · Create deal"}
            </button>
          </div>
          <p className="tx-status">
            Two steps: first approve Blue-Mango to pull {fmtUsdg(total)} USDG, then create &amp; fund the deal in one transaction.
          </p>
        </div>
        <div style={{ height: 60 }} />
      </div>
    </>
  );
}
