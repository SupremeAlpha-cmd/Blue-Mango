"use client";

import { useEffect, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { SOLANA_RPC } from "@/lib/solana";

import "@solana/wallet-adapter-react-ui/styles.css";

function ThemeInit() {
  useEffect(() => {
    const stored = localStorage.getItem("bm-theme");
    const theme =
      stored || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.setAttribute("data-theme", theme);
  }, []);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={SOLANA_RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ThemeInit />
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
