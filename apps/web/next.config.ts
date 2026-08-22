import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@rangebook/ui",
    "@rangebook/db",
    "@rangebook/altana",
    "@rangebook/agent-grid-trading",
    "@rangebook/agent-rebalancing",
    "@rangebook/chain",
  ],
};

export default nextConfig;
