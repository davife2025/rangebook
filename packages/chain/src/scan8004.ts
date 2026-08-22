const DEFAULT_BASE_URL = "https://8004scan.io/api";

export interface Scan8004Agent {
  agentId: string;
  ownerAddress: string;
  chainId: number;
  reputationScore?: number;
  feedbackCount?: number;
  [key: string]: unknown; // the live response has more fields than we need yet
}

/**
 * Wraps the 8004scan developer API. Rate limits: 10 req/min unauthenticated,
 * 500/min and 100k/day on the hackathon Pro tier — cache in
 * agent_metrics (packages/db) rather than calling this on every page load.
 */
export class Scan8004Client {
  constructor(
    private readonly apiKey: string | undefined = process.env.SCAN8004_API_KEY,
    private readonly baseUrl: string = process.env.SCAN8004_BASE_URL ?? DEFAULT_BASE_URL,
  ) {}

  async getAgent(agentId: string): Promise<Scan8004Agent> {
    return this.request<Scan8004Agent>(`/agents/${agentId}`);
  }

  async getAgentsByOwner(ownerAddress: string, chainId = 56): Promise<Scan8004Agent[]> {
    return this.request<Scan8004Agent[]>(`/agents?owner=${ownerAddress}&chain=${chainId}`);
  }

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
    });
    if (!res.ok) {
      throw new Error(`8004scan ${path} failed: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }
}
