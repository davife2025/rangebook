import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@rangebook/ui", "@rangebook/db", "@rangebook/altana", "@rangebook/agent-grid-trading"],
};

export default nextConfig;
