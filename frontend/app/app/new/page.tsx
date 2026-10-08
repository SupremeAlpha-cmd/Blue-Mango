"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import AppNav from "@/components/AppNav";
import { IconSprout, IconAlert, IconX, IconPlus } from "@/components/icons";
import {
  ataFor,
  bn,
  dealPda,
  fetchRegistry,
  fmtToken,
  isValidPubkey,
  maybeCreateAtaIx,
  parseToken,
  registryPda,
  useBlueMango,
  vaultPda,
  TOKEN_PROGRAM_ID,
} from "@/lib/program";
import {
  PAYMENT_DECIMALS,
  PAYMENT_MINT,
  PAYMENT_SYMBOL,
  SOL_DECIMALS,
  SOL_SYMBOL,
  isConfigured,
} from "@/lib/solana";

interface Row {
  desc: string;
  amount: string;
}

export default function NewDeal() {
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const program = useBlueMango();

  const [payee, setPayee] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [asset, setAsset] = useState<"SOL" | "SPL">("SOL");
  const [rows, setRows] = useState<Row[]>([
    { desc: "", amount: "" },
    { desc: "", amount: "" },
  ]);
  const [step, setStep] = useState<"form" | "creating" | "done">("form");
  const [error, setError] = useState("");
  const [registryOk, setRegistryOk] = useState<boolean | null>(null);

  const decimals = asset === "SOL" ? SOL_DECIMALS : PAYMENT_DECIMALS;
  const symbol = asset === "SOL" ? SOL_SYMBOL : PAYMENT_SYMBOL;

  useEffect(() => {
    if (!program) return;
    fetchRegistry(program).then((r) => setRegistryOk(!!r));
  }, [program]);

  const validRows = rows.filter((r) => r.desc.trim() && Number(r.amount) > 0);
  const total = validRows.reduce((s, r) => s + parseToken(r.amount, decimals), 0n);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const formValid =
    connected &&
    isConfigured &&
    registryOk &&
    isValidPubkey(payee) &&
    isValidPubkey(arbiter) &&
    validRows.length > 0 &&
    total > 0n &&
    (asset === "SOL" || PAYMENT_MINT.length > 0);

  async function handleCreate() {
    if (!program || !publicKey) return;
    setError("");
    setStep("creating");
    try {
      const reg = await fetchRegistry(program);
      if (!reg) throw new Error("Program registry not initialized.");
      const dealId = reg.nextDealId;
      const deal = dealPda(dealId);
      const payeePk = new PublicKey(payee.trim());
      const arbiterPk = new PublicKey(arbiter.trim());
      const descriptions = validRows.map((r) => r.desc.trim().slice(0, 128));
      const amounts = validRows.map((r) => bn(parseToken(r.amount, decimals)));

      if (asset === "SOL") {
        await (program.methods as any)
          .createDealSol(bn(dealId), payeePk, arbiterPk, descriptions, amounts)
          .accounts({
            registry: registryPda(),
            deal,
            payer: publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      } else {
        const mint = new PublicKey(PAYMENT_MINT);
        const payerAta = ataFor(mint, publicKey);
        const preIx = await maybeCreateAtaIx(connection, mint, publicKey, publicKey);
        await (program.methods as any)
          .createDealSpl(bn(dealId), payeePk, arbiterPk, descriptions, amounts)
          .accounts({
            registry: registryPda(),
            deal,
            vault: vaultPda(deal),
            payerAta,
            mint,
            payer: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .preInstructions(preIx)
          .rpc();
      }

      setStep("done");
      router.push(`/app/deal/${dealId.toString()}`);
    } catch (e: any) {
      setError(e?.message || "Create failed");
      setStep("form");
    }
  }

  return (
    <>
      <AppNav />
      <div className="wrap" style={{ maxWidth: 680 }}>
        <div className="app-head">
          <h1><IconSprout size={26} /> Plant a new deal</h1>
        </div>

        {!isConfigured && (
          <div className="notice"><IconAlert size={17} /><span>Program not configured — set NEXT_PUBLIC_PROGRAM_ID in .env.local first.</span></div>
        )}
        {isConfigured && registryOk === false && (
          <div className="notice"><IconAlert size={17} /><span>Program registry not initialized yet — the deployer must run <b>initialize_registry</b> once.</span></div>
        )}
        {!connected && (
          <div className="notice">Connect your wallet to create a deal.</div>
        )}

        <div className="card">
          <div className="field">
            <label>Payee address</label>
            <input
              placeholder="Solana address…"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="field">
            <label>Arbiter address (neutral third party)</label>
            <input
              placeholder="Solana address…"
              value={arbiter}
              onChange={(e) => setArbiter(e.target.value)}
              spellCheck={false}
            />
          </div>

          <label
            style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--muted)", margin: "22px 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}
          >
            Escrow asset
          </label>
          <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
            {(["SOL", "SPL"] as const).map((a) => (
              <button
                key={a}
                type="button"
                className={`btn btn-sm ${asset === a ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setAsset(a)}
                disabled={a === "SPL" && !PAYMENT_MINT}
                title={a === "SPL" && !PAYMENT_MINT ? "Set NEXT_PUBLIC_PAYMENT_MINT first" : undefined}
              >
                {a === "SOL" ? "SOL" : PAYMENT_SYMBOL}
              </button>
            ))}
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
                placeholder={symbol}
                inputMode="decimal"
                value={r.amount}
                onChange={(e) => setRow(i, { amount: e.target.value })}
                style={{ flex: 1, background: "var(--bg-deep)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 12, padding: "12px 14px", fontSize: 15, outline: "none" }}
              />
              {rows.length > 1 && (
                <button className="icon-btn" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove milestone">
                  <IconX size={17} />
                </button>
              )}
            </div>
          ))}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setRows([...rows, { desc: "", amount: "" }])}
            style={{ marginBottom: 18 }}
          >
            <IconPlus size={15} /> Add milestone
          </button>

          <div
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "14px 0", borderTop: "1px solid var(--border)", marginBottom: 6,
            }}
          >
            <span style={{ color: "var(--muted)", fontWeight: 700 }}>Total to lock</span>
            <b style={{ fontSize: 20 }}>{fmtToken(total, decimals)} {symbol}</b>
          </div>

          {error && <div className="notice" style={{ borderColor: "var(--red)" }}><IconAlert size={17} /><span>{error}</span></div>}

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={!formValid || step !== "form"}
              onClick={handleCreate}
            >
              {step === "creating" ? "Creating…" : step === "done" ? "Opening deal…" : "Create & fund deal"}
            </button>
          </div>
          <p className="tx-status">
            One transaction: {fmtToken(total, decimals)} {symbol} moves straight from your wallet into the deal vault.
            No separate approval step on Solana.
          </p>
        </div>
        <div style={{ height: 60 }} />
      </div>
    </>
  );
}
