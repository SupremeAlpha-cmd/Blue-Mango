"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { shortAddr } from "@/lib/program";

export default function ConnectButton() {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  if (publicKey) {
    const addr = publicKey.toBase58();
    return (
      <button className="connect-btn" onClick={() => disconnect()} title={addr}>
        {shortAddr(addr)}
      </button>
    );
  }

  return (
    <button className="connect-btn" disabled={connecting} onClick={() => setVisible(true)}>
      {connecting ? (
        "Connecting…"
      ) : (
        <>
          <span className="cb-full">Connect wallet</span>
          <span className="cb-short">Connect</span>
        </>
      )}
    </button>
  );
}
