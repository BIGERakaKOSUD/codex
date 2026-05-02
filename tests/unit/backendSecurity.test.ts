import test from "node:test";
import assert from "node:assert/strict";

import {
  isWildcardCorsOrigin,
  maskSecret,
  normalizeCorsOrigin,
  sanitizeLogValue,
} from "../../apps/api/src/lib/http/security.ts";
import { validateEditableProductUpdate } from "../../apps/api/src/lib/http/validation.ts";
import { isOzonCredentialsConfigured, OzonApiClient, OzonApiError } from "../../apps/api/src/lib/ozon/client.ts";

test("masks secrets without exposing full values", () => {
  assert.equal(maskSecret("abcdef123456"), "abcd...3456");
  assert.equal(maskSecret("short"), "[redacted]");
  assert.equal(maskSecret(null), "[redacted]");
});

test("sanitizes nested log values that contain secret-like keys", () => {
  const sanitized = sanitizeLogValue({
    message: "failed",
    api_key: "secret-api-key",
    nested: {
      clientId: "1234567890",
      payload: [{ token: "secret-token" }],
    },
  });

  assert.deepEqual(sanitized, {
    message: "failed",
    api_key: "[redacted]",
    nested: {
      clientId: "1234...7890",
      payload: [{ token: "[redacted]" }],
    },
  });
});

test("detects wildcard CORS configuration", () => {
  assert.equal(isWildcardCorsOrigin("*"), true);
  assert.equal(isWildcardCorsOrigin("https://bigerakakosud.github.io/codex"), false);
});

test("normalizes CORS origin by removing path", () => {
  assert.equal(normalizeCorsOrigin("https://bigerakakosud.github.io/codex"), "https://bigerakakosud.github.io");
  assert.equal(normalizeCorsOrigin("http://localhost:3000/ozon-unit-economics"), "http://localhost:3000");
});

test("validates editable product update body and rejects unknown fields", () => {
  const parsed = validateEditableProductUpdate({
    offer_id: "OFFER-1",
    field: "cost_price",
    value: "123.45",
  });

  assert.deepEqual(parsed, {
    offer_id: "OFFER-1",
    barcode: null,
    field: "cost_price",
    value: "123.45",
  });

  assert.throws(
    () => validateEditableProductUpdate({ offer_id: "OFFER-1", field: "product_name", value: "bad" }),
    /Field is not editable/,
  );
});

test("Ozon client reports missing credentials as a safe client error", () => {
  assert.equal(isOzonCredentialsConfigured({ clientId: "", apiKey: "" }), false);
  assert.equal(isOzonCredentialsConfigured({ clientId: "client", apiKey: "key" }), true);

  assert.throws(
    () => new OzonApiClient({ clientId: "", apiKey: "" }),
    (error: unknown) =>
      error instanceof OzonApiError &&
      error.status === 400 &&
      error.message === "Ozon API credentials are missing on backend",
  );
});
