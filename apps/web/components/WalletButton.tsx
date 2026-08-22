"use client";

import { useWallet, Button } from "@rangebook/ui";

export function WalletButton() {
  const wallet = useWallet("testnet");

  if (wallet.address) {
    return (
      <Button variant="ghost" disabled style={{ fontFamily: "var(--font-data)" }}>
        {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
      </Button>
    );
  }

  return (
    <Button variant="ghost" onClick={wallet.connect} disabled={wallet.connecting}>
      {wallet.connecting ? "Connecting…" : "Connect wallet"}
    </Button>
  );
}
