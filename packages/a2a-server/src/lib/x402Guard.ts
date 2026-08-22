import type { RequestHandler } from "express";

export interface X402GuardOptions {
  payTo: `0x${string}`;
  amount: string;
  token: string;
  network: "bnb" | "bnb-testnet";
}

/**
 * UNVERIFIED SHAPE. Altana's own docs example for @altananetwork/x402-server
 * wires it through Bun.serve, not Express — there's no confirmed Express
 * middleware example to copy exactly, and guessing the real export name
 * and options here would be the same mistake as hardcoding an unverified
 * ABI elsewhere in this repo.
 *
 * Defaults to a no-op so the A2A layer stays testable while that's
 * pending: set A2A_REQUIRE_PAYMENT=true only after checking
 * @altananetwork/x402-server's actual types post-install, and fill in the
 * real import below.
 */
export function x402Guard(_options: X402GuardOptions): RequestHandler {
  if (process.env.A2A_REQUIRE_PAYMENT !== "true") {
    return (_req, _res, next) => next();
  }

  throw new Error(
    "x402Guard: verify @altananetwork/x402-server's real Express export and options shape " +
      "before setting A2A_REQUIRE_PAYMENT=true. See the comment above.",
  );

  // Once verified, this becomes roughly:
  // import { createX402Guard } from "@altananetwork/x402-server";
  // return createX402Guard(_options);
}
