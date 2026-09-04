import { hireAgent, waitForDeliverable } from "@rangebook/altana";

const LISTA_TASK =
  "Report the current slisBNB/BNB exchange-rate-implied liquid-staking APR on BNB Chain, as a percentage.";

export interface HireForListaAprParams {
  wallet: unknown;
  signer: unknown;
  env?: "mainnet" | "testnet";
}

/**
 * Closes the gap flagged in rates.ts's getListaApr — rather than building
 * exchange-rate tracking or a Lista API integration ourselves, this hires
 * an existing Agent Studio agent that already has that capability, via
 * the exact ERC-8183 buyer-side mechanism this bonus is about. Turns a
 * data-source gap into a use case for the feature the hackernoon brief
 * names as a bonus, instead of two unrelated pieces of work.
 *
 * Two real things left open, not glossed over:
 * 1. Which agent to hire is unresolved — see ERC8183_LISTA_PROVIDER_ADDRESS
 *    in .env.example. Finding a real, trustworthy candidate (via 8004scan)
 *    is a research task, not a code one.
 * 2. Whose wallet pays isn't fully settled either. This takes wallet/signer
 *    as plain params rather than assuming — reusing the category's session
 *    signer is the simplest option given what's already built, but that
 *    signer was designed for acting inside a user's DeFi session, not for
 *    the agent spending its own money. Worth a deliberate decision, not
 *    the default this happened to fall into.
 */
export async function hireForListaApr(params: HireForListaAprParams): Promise<number> {
  const providerAddress = requireEnv("ERC8183_LISTA_PROVIDER_ADDRESS") as `0x${string}`;
  const budget = BigInt(process.env.ERC8183_DEFAULT_BUDGET ?? "100000000000000000"); // 0.1 $U default

  const { jobId } = await hireAgent({
    wallet: params.wallet,
    signer: params.signer,
    providerAddress,
    task: LISTA_TASK,
    budget,
    env: params.env,
  });

  const { content, hashVerified } = await waitForDeliverable(jobId, params.env);
  if (!hashVerified) {
    throw new Error(
      `ERC-8183 job ${jobId}: deliverable hash didn't verify — see the canonicalization note on ` +
        `waitForDeliverable in packages/altana/src/erc8183.ts before trusting this result.`,
    );
  }

  const apr = extractAprFromDeliverable(content);
  if (apr == null) {
    throw new Error(`ERC-8183 job ${jobId}: couldn't find an APR figure in the deliverable — see extractAprFromDeliverable.`);
  }
  return apr;
}

/**
 * INFERRED, not standardized anywhere read this session: what shape a
 * hired agent's deliverable actually takes isn't specified by ERC-8183
 * itself — this tries a bare number, a numeric string, and a few likely
 * object keys. A real hired agent's response could easily not match any
 * of these; this is a reasonable first guess, not a confirmed schema.
 */
function extractAprFromDeliverable(content: unknown): number | null {
  if (typeof content === "number") return content;
  if (typeof content === "string" && !isNaN(Number(content))) return Number(content);
  if (content && typeof content === "object") {
    const obj = content as Record<string, unknown>;
    for (const key of ["apr", "APR", "percentage", "rate"]) {
      if (typeof obj[key] === "number") return obj[key] as number;
    }
  }
  return null;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — find a real candidate agent via 8004scan before setting this.`);
  return value;
}
