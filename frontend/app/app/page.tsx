"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import AppNav from "@/components/AppNav";
import DealTree from "@/components/DealTree";
import { IconTree, IconAlert, IconPlus, IconMango } from "@/components/icons";
import {
  fetchDeals,
  fetchRegistry,
  fmtToken,
  shortAddr,
  useBlueMango,
  type DealView,
} from "@/lib/program";
import {
  PAYMENT_DECIMALS,
  PAYMENT_SYMBOL,
  SOL_DECIMALS,
  SOL_SYMBOL,
  isConfigured,
} from "@/lib/solana";

function assetOf(d: DealView): { symbol: string; decimals: number } {
  return d.paymentMint
    ? { symbol: PAYMENT_SYMBOL, decimals: PAYMENT_DECIMALS }
    : { symbol: SOL_SYMBOL, decimals: SOL_DECIMALS };
}

function DealCard({ deal, id, me }: { deal: DealView; id: bigint; me: string }) {
  const role = deal.payer === me ? "Payer" : "Payee";
  const counter = deal.payee === me ? deal.payer : deal.payee;
  const { symbol, decimals } = assetOf(deal);

  return (
    <Link href={`/app/deal/${id.toString()}`} className="card" style={{ display: "block" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span className="pill">
          <span className="dot" style={{ background: "var(--fruit)" }} />
          Deal #{id.toString()} · {role} · {symbol}
        </span>
        <span className="addr">{shortAddr(counter)}</span>
      </div>
      <div style={{ display: "flex", gap: 18, fontSize: 13.5, color: "var(--muted)", marginBottom: 12 }}>
        <span>
          Locked <b style={{ color: "var(--text)" }}>{fmtToken(deal.total, decimals)} {symbol}</b>
        </span>
        <span>
          Released <b style={{ color: "var(--green)" }}>{fmtToken(deal.released, decimals)}</b>
        </span>
      </div>
      <DealTree milestones={deal.milestones} total={deal.total} compact symbol={symbol} decimals={decimals} />
    </Link>
  );
}

export default function Dashboard() {
  const { publicKey, connected } = useWallet();
  const program = useBlueMango();
  const [deals, setDeals] = useState<{ id: bigint; deal: DealView }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!program || !publicKey) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const reg = await fetchRegistry(program);
      if (!reg) {
        setDeals([]);
        setLoading(false);
        return;
      }
      const me = publicKey.toBase58();
      const ids: bigint[] = [];
      for (let i = reg.nextDealId - 1n; i >= 0n; i--) ids.push(i);
      const fetched = await fetchDeals(program, ids);
      const mine = fetched
        .map((d, i) => (d ? { id: ids[i], deal: d } : null))
        .filter((x): x is { id: bigint; deal: DealView } => !!x)
        .filter(({ deal }) => deal.payer === me || deal.payee === me);
      setDeals(mine);
      setLoading(false);
    })();
  }, [program, publicKey]);

  return (
    <>
      <AppNav />
      <div className="wrap">
        <div className="app-head">
          <h1><IconTree size={26} /> Your deals</h1>
          {connected && (
            <Link href="/app/new" className="btn btn-primary btn-sm">
              <IconPlus size={15} /> New deal
            </Link>
          )}
        </div>

        {!isConfigured && (
          <div className="notice">
            <IconAlert size={17} />
            <span>Program not configured — set <b>NEXT_PUBLIC_PROGRAM_ID</b> in <b>.env.local</b> (see .env.example), then restart.</span>
          </div>
        )}

        {!connected ? (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <h3 style={{ marginTop: 0 }}>Connect your wallet to see your deals</h3>
            <p>Each deal grows as a tree — trunk is the locked total, branches are milestones.</p>
          </div>
        ) : !isConfigured ? null : loading ? (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <h3 style={{ marginTop: 0 }}>Loading deals…</h3>
          </div>
        ) : deals.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <h3 style={{ marginTop: 0 }}>No deals yet</h3>
            <p>Plant your first one — it takes under a minute.</p>
            <Link href="/app/new" className="btn btn-primary" style={{ marginTop: 12 }}>
              <IconMango size={17} /> Create a deal
            </Link>
          </div>
        ) : (
          <div className="grid-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
            {deals.map(({ id, deal }) => (
              <DealCard key={id.toString()} id={id} deal={deal} me={publicKey!.toBase58()} />
            ))}
          </div>
        )}
        <div style={{ height: 60 }} />
      </div>
    </>
  );
}
