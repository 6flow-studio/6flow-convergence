import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  transpilePackages: ["@6flow/shared"],
};

export default nextConfig;
