"use client";

import Link from "next/link";
import ConnectButton from "./ConnectButton";
import ThemeToggle from "./ThemeToggle";

export default function AppNav() {
  return (
    <nav className="nav">
      <div className="wrap nav-inner">
        <Link href="/" className="brand">
          <img src="/logo.webp" alt="Blue-Mango logo" />
          Blue<em>-</em>Mango
        </Link>
        <div className="nav-links">
          <Link href="/app">Deals</Link>
          <Link href="/app/new" className="btn btn-primary btn-sm">
            + New deal
          </Link>
        </div>
        <div className="topbar-right">
          <ThemeToggle />
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
}
