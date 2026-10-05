"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import AppNav from "@/components/AppNav";
import DealTree from "@/components/DealTree";
import {
  BLUE_MANGO_ABI,
  BLUE_MANGO_ADDRESS,
  isConfigured,
  fmtUsdg,
  shortAddr,
  MILESTONE_STATES,
  type MilestoneView,
} from "@/lib/contract";

const CLAIM_TIMEOUT_S = 7 * 24 * 3600;

export default function DealDetail() {
  const params = useParams();
  const id = BigInt(params.id as string);
  const { address } = useAccount();
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const { writeContractAsync } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { isLoading: txPending, isSuccess: txOk } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: deal, refetch: refetchDeal } = useReadContract({
    address: BLUE_MANGO_ADDRESS,
    abi: BLUE_MANGO_ABI,
    functionName: "getDeal",
    args: [id],
    query: { enabled: isConfigured },
  });

  const n = deal ? Number((deal as any[])[6]) : 0;
  const { data: ms, refetch: refetchMs } = useReadContracts({
    contracts: Array.from({ length: n }, (_, i) => ({
      address: BLUE_MANGO_ADDRESS,
      abi: BLUE_MANGO_ABI,
      functionName: "getMilestone",
      args: [id, BigInt(i)],
    })),
    query: { enabled: isConfigured && n > 0 },
  });

  const milestones: MilestoneView[] = (ms ?? [])
    .map((r) => r.result as any)
    .filter(Boolean)
    .map((m: any) => ({
      description: m[0] as string,
      amount: m[1] as bigint,
      state: Number(m[2]),
      doneAt: m[3] as bigint,
    }));

  async function act(label: string, fn: string, args: any[]) {
    setError("");
    setBusy(label);
    try {
      const h = await writeContractAsync({
        address: BLUE_MANGO_ADDRESS,
        abi: BLUE_MANGO_ABI,
        functionName: fn,
        args,
      });
      setTxHash(h);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "Transaction failed");
      setBusy("");
    }
  }

  async function refresh() {
    await Promise.all([refetchDeal(), refetchMs()]);
    setBusy("");
  }

  useEffect(() => {
    if (txOk && busy) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txOk]);

  if (!deal) {
    return (
      <>
        <AppNav />
        <div className="wrap">
          <div className="app-head"><h1>Deal #{params.id}</h1></div>
          <div className="card">Loading…</div>
        </div>
      </>
    );
  }

  const [payer, payee, arbiter, total, released, refunded] = deal as any[];
  const me = address?.toLowerCase();
  const isPayer = me === (payer as string).toLowerCase();
  const isPayee = me === (payee as string).toLowerCase();
  const isArbiter = me === (arbiter as string).toLowerCase();
  const nowS = Math.floor(Date.now() / 1000);

  const sel = selected != null ? milestones[selected] : null;
  const claimable =
    sel && sel.state === 1 && Number(sel.doneAt) + CLAIM_TIMEOUT_S <= nowS;

  const btn = (label: string, fn: string, args: any[], primary = false) => (
    <button
      key={label}
      className={`btn ${primary ? "btn-primary" : "btn-ghost"} btn-sm`}
      disabled={!!busy || txPending}
      onClick={() => act(label, fn, args)}
    >
      {busy === label && txPending ? "Confirming…" : label}
    </button>
  );

  return (
    <>
      <AppNav />
      <div className="wrap" style={{ maxWidth: 760 }}>
        <div className="app-head">
          <h1>🌳 Deal #{params.id}</h1>
          <span className="pill">
            {isPayer ? "You are the payer" : isPayee ? "You are the payee" : isArbiter ? "You are the arbiter" : "Viewer"}
          </span>
        </div>

        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, fontSize: 14 }}>
            <div><div className="addr">PAYER</div><b>{shortAddr(payer)}</b></div>
            <div><div className="addr">PAYEE</div><b>{shortAddr(payee)}</b></div>
            <div><div className="addr">ARBITER</div><b>{shortAddr(arbiter)}</b></div>
            <div><div className="addr">LOCKED</div><b>{fmtUsdg(total)} USDG</b></div>
            <div><div className="addr">RELEASED</div><b style={{ color: "var(--green)" }}>{fmtUsdg(released)}</b></div>
            <div><div className="addr">REFUNDED</div><b style={{ color: "var(--muted)" }}>{fmtUsdg(refunded)}</b></div>
          </div>
          {isPayer && milestones.some((m) => m.state === 0) && (
            <div className="milestone-actions">
              {btn("Cancel remaining milestones", "cancelRemaining", [id])}
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ margin: "0 0 6px" }}>Milestone tree</h3>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 10px" }}>
            Tap a branch to act on it.
          </p>
          <DealTree milestones={milestones} total={total} onSelect={setSelected} selected={selected} />
        </div>

        {sel && selected != null && (
          <div className="card" style={{ marginTop: 18, borderColor: "var(--mango)" }}>
            <h3 style={{ margin: "0 0 4px" }}>
              {sel.description || `Milestone ${selected + 1}`}
            </h3>
            <div style={{ color: "var(--muted)", fontSize: 14, marginBottom: 6 }}>
              {fmtUsdg(sel.amount)} USDG · <b>{MILESTONE_STATES[sel.state]}</b>
              {sel.state === 1 && (
                <span>
                  {" "}· marked done {Math.max(0, Math.round((Number(sel.doneAt) + CLAIM_TIMEOUT_S - nowS) / 3600))}h
                  until payee can claim
                </span>
              )}
            </div>
            <div className="milestone-actions">
              {sel.state === 0 && isPayee && btn("Mark done", "markDone", [id, BigInt(selected)], true)}
              {sel.state === 1 && isPayer && btn("Approve & release", "approveMilestone", [id, BigInt(selected)], true)}
              {sel.state === 1 && (isPayer || isPayee) && btn("Raise dispute", "raiseDispute", [id, BigInt(selected)])}
              {sel.state === 1 && isPayee && claimable && btn("Claim (7d timeout)", "claimMilestone", [id, BigInt(selected)], true)}
              {sel.state === 2 && isArbiter && btn("Release to payee", "resolveDispute", [id, BigInt(selected), true], true)}
              {sel.state === 2 && isArbiter && btn("Refund payer", "resolveDispute", [id, BigInt(selected), false])}
              {sel.state >= 3 && <span style={{ color: "var(--muted)", fontSize: 14 }}>Terminal — no further actions.</span>}
            </div>
            {error && <div className="tx-status" style={{ color: "var(--red)" }}>⚠️ {error}</div>}
            {txHash && <div className="tx-status">Tx: <span className="addr">{txHash}</span></div>}
          </div>
        )}
        <div style={{ height: 60 }} />
      </div>
    </>
  );
}
