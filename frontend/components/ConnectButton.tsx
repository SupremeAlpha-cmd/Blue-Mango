"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortAddr } from "@/lib/contract";

export default function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button className="connect-btn" onClick={() => disconnect()} title={address}>
        {shortAddr(address)}
      </button>
    );
  }

  const injected = connectors[0];
  return (
    <button
      className="connect-btn"
      disabled={!injected || isPending}
      onClick={() => injected && connect({ connector: injected })}
    >
      {isPending ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
