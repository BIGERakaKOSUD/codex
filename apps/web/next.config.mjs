import path from "node:path";
import { fileURLToPath } from "node:url";

const isGithubPages = process.env.DEPLOY_TARGET === "github-pages";
const repoName = process.env.NEXT_PUBLIC_BASE_PATH || "";
const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(appDir, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: isGithubPages ? repoName : "",
  assetPrefix: isGithubPages ? `${repoName}/` : "",
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ["@ozon-unit-economics/shared", "@ozon-unit-economics/unit-economics"],
};

export default nextConfig;
