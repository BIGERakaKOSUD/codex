import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(root, path), "utf8")) as T;
}

function readText(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

test("root package scripts expose web/api build and Prisma deploy commands", () => {
  const pkg = readJson<{ scripts: Record<string, string> }>("package.json");

  assert.equal(pkg.scripts["build:web"], "npm run build -w apps/web");
  assert.equal(pkg.scripts["build:api"], "npm run build -w apps/api");
  assert.equal(pkg.scripts["prisma:deploy"], "npm run prisma:deploy -w apps/api");
});

test("api package deploys Prisma migrations, not db push", () => {
  const pkg = readJson<{ scripts: Record<string, string> }>("apps/api/package.json");

  assert.equal(pkg.scripts["prisma:deploy"], "prisma migrate deploy --schema prisma/schema.prisma");
});

test("env examples keep frontend and backend secrets separated", () => {
  assert.equal(existsSync(join(root, "apps/api/.env.example")), true);

  const apiEnv = readText("apps/api/.env.example");
  const prodEnv = readText(".env.production.example");

  assert.match(apiEnv, /CORS_ALLOWED_ORIGIN=http:\/\/localhost:3000/);
  assert.match(prodEnv, /CORS_ALLOWED_ORIGIN=https:\/\/bigerakakosud\.github\.io\s/);
  assert.doesNotMatch(prodEnv, /CORS_ALLOWED_ORIGIN=.*\/codex/);
  assert.doesNotMatch(apiEnv, /NEXT_PUBLIC_/);
});

test("only deploy-pages workflow remains for GitHub Pages", () => {
  assert.equal(existsSync(join(root, ".github/workflows/deploy-pages.yml")), true);
  assert.equal(existsSync(join(root, ".github/workflows/nextjs.yml")), false);
});
