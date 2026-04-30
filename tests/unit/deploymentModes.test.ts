import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBackendEndpoint,
  isForbiddenFrontendOzonUrl,
  normalizeBackendApiUrl,
} from "../../packages/shared/src/deployment.ts";

test("normalizes backend API URL without trailing slash", () => {
  assert.equal(normalizeBackendApiUrl(" https://example.com/api/ "), "https://example.com/api");
});

test("builds backend endpoint from normalized base URL", () => {
  assert.equal(buildBackendEndpoint("https://backend.example.com/", "/health"), "https://backend.example.com/health");
});

test("rejects direct Ozon Seller API URL for frontend API mode", () => {
  assert.equal(isForbiddenFrontendOzonUrl("https://api-seller.ozon.ru"), true);
  assert.equal(isForbiddenFrontendOzonUrl("https://backend.example.com"), false);
});
