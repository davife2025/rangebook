"use client";

import { useCallback, useEffect, useState } from "react";
import { createWalletClient, custom, type WalletClient } from "viem";
import { bsc, bscTestnet } from "viem/chains";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

export interface WalletState {
  address: `0x${string}` | null;
  client: WalletClient | null;
  connecting: boolean;
  error: string | null;
}

/**
 * Standard, well-established pattern — an injected EIP-1193 provider
 * (MetaMask or compatible) wrapped by viem's custom() transport. Nothing
 * here is protocol-specific the way the DeFi integrations elsewhere in
 * this repo are, so it doesn't carry the same "verify before trusting"
 * flags. Testnet by default; pass mainnet once ready for that.
 */
export function useWallet(chain: "testnet" | "mainnet" = "testnet") {
  const [state, setState] = useState<WalletState>({
    address: null,
    client: null,
    connecting: false,
    error: null,
  });

  // Silently pick up an already-connected wallet on load — eth_accounts
  // (unlike eth_requestAccounts) never prompts, so this is safe to call
  // without the user having clicked anything yet.
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const list = accounts as string[];
        if (list.length > 0) {
          const client = createWalletClient({
            chain: chain === "mainnet" ? bsc : bscTestnet,
            transport: custom(window.ethereum!),
          });
          setState((s) => ({ ...s, address: list[0] as `0x${string}`, client }));
        }
      })
      .catch(() => {
        // No wallet, or the call failed — fine, connect() below handles the real prompt.
      });
  }, [chain]);

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, connecting: true, error: null }));
    try {
      if (!window.ethereum) {
        throw new Error("No wallet found — install MetaMask or a compatible browser wallet.");
      }
      const client = createWalletClient({
        chain: chain === "mainnet" ? bsc : bscTestnet,
        transport: custom(window.ethereum),
      });
      const [address] = await client.requestAddresses();
      setState({ address, client, connecting: false, error: null });
    } catch (err) {
      setState((s) => ({
        ...s,
        connecting: false,
        error: err instanceof Error ? err.message : "Connection failed",
      }));
    }
  }, [chain]);

  return { ...state, connect };
}
