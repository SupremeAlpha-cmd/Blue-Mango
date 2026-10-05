"use client";

import Link from "next/link";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import AppNav from "@/components/AppNav";
import DealTree from "@/components/DealTree";
import {
  BLUE_MANGO_ABI,
  BLUE_MANGO_ADDRESS,
  isConfigured,
  fmtUsdg,
  shortAddr,
  type MilestoneView,
} from "@/lib/contract";

function DealCard({ id, me }: { id: bigint; me: `0x${string}` }) {
  const { data: deal } = useReadContract({
    address: BLUE_MANGO_ADDRESS,
    abi: BLUE_MANGO_ABI,
    functionName: "getDeal",
    args: [id],
  });

  const n = deal ? Number((deal as any[])[6]) : 0;
  const { data: ms } = useReadContracts({
    contracts: Array.from({ length: n }, (_, i) => ({
      address: BLUE_MANGO_ADDRESS,
      abi: BLUE_MANGO_ABI,
      functionName: "getMilestone",
      args: [id, BigInt(i)],
    })),
  });

  if (!deal) return null;
  const [payer, payee, , total, released, , ] = deal as any[];
  const meLower = me.toLowerCase();
  if (payer.toLowerCase() !== meLower && payee.toLowerCase() !== meLower) return null;

  const milestones: MilestoneView[] = (ms ?? [])
    .map((r) => r.result as any)
    .filter(Boolean)
    .map((m: any) => ({
      description: m[0] as string,
      amount: m[1] as bigint,
      state: Number(m[2]),
      doneAt: m[3] as bigint,
    }));

  const role = payer.toLowerCase() === meLower ? "Payer" : "Payee";
  const counter = payee.toLowerCase() === meLower ? payer : payee;

  return (
    <Link href={`/app/deal/${id.toString()}`} className="card" style={{ display: "block" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span className="pill">
          <span className="dot" style={{ background: "var(--mango)" }} />
          Deal #{id.toString()} · {role}
        </span>
        <span className="addr">{shortAddr(counter)}</span>
      </div>
      <div style={{ display: "flex", gap: 18, fontSize: 13.5, color: "var(--muted)", marginBottom: 12 }}>
        <span>
          Locked <b style={{ color: "var(--text)" }}>{fmtUsdg(total as bigint)} USDG</b>
        </span>
        <span>
          Released <b style={{ color: "var(--green)" }}>{fmtUsdg(released as bigint)}</b>
        </span>
      </div>
      <DealTree milestones={milestones} total={total as bigint} compact />
    </Link>
  );
}

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const { data: count } = useReadContract({
    address: BLUE_MANGO_ADDRESS,
    abi: BLUE_MANGO_ABI,
    functionName: "dealCount",
    query: { enabled: isConfigured },
  });

  const ids: bigint[] =
    typeof count === "bigint"
      ? Array.from({ length: Number(count) }, (_, i) => count - 1n - BigInt(i))
      : [];

  return (
    <>
      <AppNav />
      <div className="wrap">
        <div className="app-head">
          <h1>🌳 Your deals</h1>
          {isConnected && (
            <Link href="/app/new" className="btn btn-primary btn-sm">
              + New deal
            </Link>
          )}
        </div>

        {!isConfigured && (
          <div className="notice">
            ⚠️ Contract not configured — set <b>NEXT_PUBLIC_BLUEMANGO_ADDRESS</b> and{" "}
            <b>NEXT_PUBLIC_USDG_ADDRESS</b> in <b>.env.local</b> (see .env.example), then restart.
          </div>
        )}

        {!isConnected ? (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <h3 style={{ marginTop: 0 }}>Connect your wallet to see your deals</h3>
            <p>Each deal grows as a tree — trunk is the locked total, branches are milestones.</p>
          </div>
        ) : !isConfigured ? null : ids.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 60 }}>
            <h3 style={{ marginTop: 0 }}>No deals yet</h3>
            <p>Plant your first one — it takes under a minute.</p>
            <Link href="/app/new" className="btn btn-mango" style={{ marginTop: 12 }}>
              Create a deal
            </Link>
          </div>
        ) : (
          <div className="grid-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
            {ids.map((id) => (
              <DealCard key={id.toString()} id={id} me={address!} />
            ))}
          </div>
        )}
        <div style={{ height: 60 }} />
      </div>
    </>
  );
}
