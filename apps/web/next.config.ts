import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@rangebook/ui", "@rangebook/db"],
};

export default nextConfig;
