import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(appDir, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: ["@ozon-unit-economics/shared", "@ozon-unit-economics/unit-economics"],
};

export default nextConfig;
