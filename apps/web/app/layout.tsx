import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rangebook — hire agents that work inside a bound you set",
  description:
    "Discover, compare, and activate DeFi agents on BNB Chain — rebalancing, grid trading, yield, and health factor monitoring — each running inside a scoped, revocable onchain permission.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
