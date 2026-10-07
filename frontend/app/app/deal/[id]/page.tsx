"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import AppNav from "@/components/AppNav";
import DealTree from "@/components/DealTree";
import { IconTree, IconAlert } from "@/components/icons";
import {
  MILESTONE_STATES,
  ataFor,
  bn,
  dealPda,
  fetchDeal,
  fmtToken,
  maybeCreateAtaIx,
  shortAddr,
  useBlueMango,
  vaultPda,
  TOKEN_PROGRAM_ID,
  type DealView,
} from "@/lib/program";
import {
  PAYMENT_DECIMALS,
  PAYMENT_SYMBOL,
  SOL_DECIMALS,
  SOL_SYMBOL,
  isConfigured,
} from "@/lib/solana";

const CLAIM_TIMEOUT_S = 7 * 24 * 3600;

type PayoutTo = "payee" | "payer";

export default function DealDetail() {
  const params = useParams();
  const idStr = params.id as string;
  const dealId = (() => { try { return BigInt(idStr); } catch { return 0n; } })();

  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const program = useBlueMango();

  const [deal, setDeal] = useState<DealView | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [sig, setSig] = useState("");

  const refresh = useCallback(async () => {
    if (!program) return;
    const d = await fetchDeal(program, dealId);
    setDeal(d);
    setLoading(false);
    setBusy("");
  }, [program, dealId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isSpl = !!deal?.paymentMint;
  const decimals = isSpl ? PAYMENT_DECIMALS : SOL_DECIMALS;
  const symbol = isSpl ? PAYMENT_SYMBOL : SOL_SYMBOL;

  /**
   * Generic action runner.
   * - milestoneIdx: for per-milestone instructions (undefined for cancel).
   * - payoutTo: set for instructions that move funds (approve/claim/resolve/cancel).
   */
  async function act(
    label: string,
    method: string,
    milestoneIdx?: number,
    payoutTo?: PayoutTo,
    extraArgs: any[] = []
  ) {
    if (!program || !publicKey || !deal) return;
    setError("");
    setSig("");
    setBusy(label);
    try {
      const pda = dealPda(dealId);
      const args: any[] = [bn(dealId)];
      if (milestoneIdx !== undefined) args.push(milestoneIdx);
      args.push(...extraArgs);
      let b = (program.methods as any)[method](...args);

      if (payoutTo) {
        const to = new PublicKey(payoutTo === "payee" ? deal.payee : deal.payer);
        if (isSpl) {
          const mint = new PublicKey(deal.paymentMint!);
          const recipientAta = ataFor(mint, to);
          const preIx = await maybeCreateAtaIx(connection, mint, to, publicKey);
          b = b.accounts({
            deal: pda,
            vault: vaultPda(pda),
            recipientAta,
            signer: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          });
          if (preIx.length) b = b.preInstructions(preIx);
        } else {
          b = b.accounts({
            deal: pda,
            recipient: to,
            signer: publicKey,
            systemProgram: SystemProgram.programId,
          });
        }
      } else {
        b = b.accounts({ deal: pda, signer: publicKey });
      }

      const s: string = await b.rpc();
      setSig(s);
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Transaction failed");
      setBusy("");
    }
  }

  if (!isConfigured) {
    return (
      <>
        <AppNav />
        <div className="wrap">
          <div className="app-head"><h1>Deal #{idStr}</h1></div>
          <div className="card">Program not configured — set NEXT_PUBLIC_PROGRAM_ID first.</div>
        </div>
      </>
    );
  }

  if (loading || !deal) {
    return (
      <>
        <AppNav />
        <div className="wrap">
          <div className="app-head"><h1>Deal #{idStr}</h1></div>
          <div className="card">{loading ? "Loading…" : "Deal not found."}</div>
        </div>
      </>
    );
  }

  const me = publicKey?.toBase58();
  const isPayer = me === deal.payer;
  const isPayee = me === deal.payee;
  const isArbiter = me === deal.arbiter;
  const nowS = Math.floor(Date.now() / 1000);
  const milestones = deal.milestones;

  const sel = selected != null ? milestones[selected] : null;
  const claimable =
    sel && sel.state === 1 && Number(sel.doneAt) + CLAIM_TIMEOUT_S <= nowS;

  const btn = (label: string, onClick: () => void, primary = false) => (
    <button
      key={label}
      className={`btn ${primary ? "btn-primary" : "btn-ghost"} btn-sm`}
      disabled={!!busy}
      onClick={onClick}
    >
      {busy === label ? "Confirming…" : label}
    </button>
  );

  const sol = (m: string) => (isSpl ? `${m}Spl` : `${m}Sol`);

  return (
    <>
      <AppNav />
      <div className="wrap" style={{ maxWidth: 760 }}>
        <div className="app-head">
          <h1><IconTree size={26} /> Deal #{idStr}</h1>
          <span className="pill">
            {isPayer ? "You are the payer" : isPayee ? "You are the payee" : isArbiter ? "You are the arbiter" : "Viewer"}
          </span>
        </div>

        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, fontSize: 14 }}>
            <div><div className="addr">PAYER</div><b>{shortAddr(deal.payer)}</b></div>
            <div><div className="addr">PAYEE</div><b>{shortAddr(deal.payee)}</b></div>
            <div><div className="addr">ARBITER</div><b>{shortAddr(deal.arbiter)}</b></div>
            <div><div className="addr">ASSET</div><b>{symbol}</b></div>
            <div><div className="addr">LOCKED</div><b>{fmtToken(deal.total, decimals)} {symbol}</b></div>
            <div><div className="addr">RELEASED</div><b style={{ color: "var(--green)" }}>{fmtToken(deal.released, decimals)}</b></div>
            <div><div className="addr">REFUNDED</div><b style={{ color: "var(--muted)" }}>{fmtToken(deal.refunded, decimals)}</b></div>
          </div>
          {isPayer && milestones.some((x) => x.state === 0) && (
            <div className="milestone-actions">
              {btn("Cancel remaining milestones", () =>
                act("Cancel remaining milestones", sol("cancelRemaining"), undefined, "payer")
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ margin: "0 0 6px" }}>Milestone tree</h3>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 10px" }}>
            Tap a branch to act on it.
          </p>
          <DealTree milestones={milestones} total={deal.total} onSelect={setSelected} selected={selected} symbol={symbol} decimals={decimals} />
        </div>

        {sel && selected != null && (
          <div className="card" style={{ marginTop: 18, borderColor: "var(--fruit)" }}>
            <h3 style={{ margin: "0 0 4px" }}>
              {sel.description || `Milestone ${selected + 1}`}
            </h3>
            <div style={{ color: "var(--muted)", fontSize: 14, marginBottom: 6 }}>
              {fmtToken(sel.amount, decimals)} {symbol} · <b>{MILESTONE_STATES[sel.state]}</b>
              {sel.state === 1 && (
                <span>
                  {" "}· marked done {Math.max(0, Math.round((Number(sel.doneAt) + CLAIM_TIMEOUT_S - nowS) / 3600))}h
                  until payee can claim
                </span>
              )}
            </div>
            <div className="milestone-actions">
              {sel.state === 0 && isPayee && btn("Mark done", () => act("Mark done", "markDone", selected), true)}
              {sel.state === 1 && isPayer && btn("Approve & release", () => act("Approve & release", sol("approveMilestone"), selected, "payee"), true)}
              {sel.state === 1 && (isPayer || isPayee) && btn("Raise dispute", () => act("Raise dispute", "raiseDispute", selected))}
              {sel.state === 1 && isPayee && claimable && btn("Claim (7d timeout)", () => act("Claim (7d timeout)", sol("claimMilestone"), selected, "payee"), true)}
              {sel.state === 2 && isArbiter && btn("Release to payee", () => act("Release to payee", sol("resolveDispute"), selected, "payee", [true]), true)}
              {sel.state === 2 && isArbiter && btn("Refund payer", () => act("Refund payer", sol("resolveDispute"), selected, "payer", [false]))}
              {sel.state >= 3 && <span style={{ color: "var(--muted)", fontSize: 14 }}>Terminal — no further actions.</span>}
            </div>
            {error && <div className="tx-status" style={{ color: "var(--red)" }}><IconAlert size={15} /> {error}</div>}
            {sig && <div className="tx-status">Tx: <span className="addr">{sig}</span></div>}
          </div>
        )}
        <div style={{ height: 60 }} />
      </div>
    </>
  );
}
