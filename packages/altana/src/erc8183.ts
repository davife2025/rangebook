import { hireErc8183Agent, getErc8183Job, getErc8183DeliverableUrl, settleErc8183Job, BNB, BNB_TESTNET } from "@altananetwork/sdk";
import { keccak256, toBytes } from "viem";

/**
 * The buyer side of ERC-8183 — the seller side comes free when we deploy
 * our own agents via Agent Studio (ERC-8183 task interface live
 * automatically). This is the missing half: our agents hiring other
 * agents in the wider BNB Agent Studio economy, funded in $U.
 *
 * Confirmed against docs.altana.network/sdk/erc8183 this session —
 * hireErc8183Agent, getErc8183Job, getErc8183DeliverableUrl,
 * settleErc8183Job are real, documented exports with the signatures used
 * below, not inferred. One real open question, flagged at the function
 * that hits it: the exact canonicalization used to hash the deliverable
 * manifest isn't specified in the docs.
 */

export interface HireAgentParams {
  wallet: unknown;
  signer: unknown;
  providerAddress: `0x${string}`;
  task: string;
  budget: bigint; // $U, 18 decimals
  env?: "mainnet" | "testnet";
}

export async function hireAgent(params: HireAgentParams): Promise<{ jobId: string }> {
  const network = params.env === "mainnet" ? BNB : BNB_TESTNET;
  const { jobId } = await hireErc8183Agent(
    params.wallet,
    params.signer,
    { provider: params.providerAddress, task: params.task, budget: params.budget },
    { network },
  );
  return { jobId };
}

export interface DeliverableResult {
  content: unknown;
  hashVerified: boolean;
}

const POLL_INTERVAL_MS = 5000;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Polls until the job submits a deliverable or the timeout elapses, then
 * fetches and verifies it.
 *
 * UNVERIFIED: the docs say the onchain job.deliverable is "the keccak256
 * of the canonical manifest" without specifying the canonicalization —
 * plain bytes, JSON.stringify, sorted-key JSON, and RFC 8785 (JCS) would
 * each hash differently. This hashes the raw response bytes exactly as
 * fetched, the most literal reading, but it hasn't been checked against a
 * real job. If hashVerified comes back false on a deliverable that
 * otherwise looks fine, try JCS re-serialization before assuming the job
 * itself is bad — that's a canonicalization mismatch, not necessarily a
 * corrupt or malicious deliverable.
 */
export async function waitForDeliverable(
  jobId: string,
  env: "mainnet" | "testnet" = "testnet",
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<DeliverableResult> {
  const network = env === "mainnet" ? BNB : BNB_TESTNET;
  const deadline = Date.now() + timeoutMs;

  let job = await getErc8183Job(network, jobId);
  while (job.submittedAt === 0n) {
    if (Date.now() >= deadline) {
      throw new Error(`ERC-8183 job ${jobId} did not submit a deliverable within ${timeoutMs}ms.`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    job = await getErc8183Job(network, jobId);
  }

  const url = await getErc8183DeliverableUrl(network, jobId);
  const rawText = await (await fetch(url)).text();
  const computedHash = keccak256(toBytes(rawText));
  const hashVerified = computedHash === job.deliverable;

  const manifest = JSON.parse(rawText);
  return { content: manifest.response?.content, hashVerified };
}

export async function settleJob(
  wallet: unknown,
  signer: unknown,
  jobId: string,
  env: "mainnet" | "testnet" = "testnet",
): Promise<void> {
  const network = env === "mainnet" ? BNB : BNB_TESTNET;
  await settleErc8183Job(wallet, signer, { jobId }, { network });
}

export async function disputeJob(
  wallet: unknown,
  signer: unknown,
  jobId: string,
  env: "mainnet" | "testnet" = "testnet",
): Promise<void> {
  const network = env === "mainnet" ? BNB : BNB_TESTNET;
  await settleErc8183Job(wallet, signer, { jobId, action: "dispute" }, { network });
}
