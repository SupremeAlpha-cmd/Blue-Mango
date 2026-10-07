import type { Metadata } from "next";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blue-Mango — Milestone escrow for crypto deals",
  description:
    "Lock SOL or SPL tokens in a Solana program, release it milestone by milestone. No middlemen, no chargebacks, no “trust me bro”.",
  icons: { icon: "/logo.webp", apple: "/logo.webp" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
