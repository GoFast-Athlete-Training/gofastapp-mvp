/**
 * Smoke-check parser limits for Garmin activity-detail payloads.
 *
 * Usage (from repo root):
 *   cd services/garmin-activity-detail-ingest && npm run verify:payload-limits
 */

import assert from "node:assert/strict";
import { buildActivityDetailWebhookMeta } from "../../../lib/garmin-events/process-activity-detail-webhook";

const VERCEL_LIMIT = 4.5 * 1024 * 1024;
const CLOUD_RUN_LIMIT = 30 * 1024 * 1024;

function makePayload(byteSize: number) {
  const pad = "x".repeat(Math.max(0, byteSize - 120));
  return JSON.stringify({
    userId: "garmin-test-user",
    activityDetails: [
      {
        activityId: "123456789",
        userId: "garmin-test-user",
        padding: pad,
      },
    ],
  });
}

const small = makePayload(2_000);
const overVercel = makePayload(Math.ceil(VERCEL_LIMIT + 1024));
const underCloudRun = makePayload(Math.ceil(VERCEL_LIMIT + 1024));
const nearCloudRun = makePayload(Math.ceil(CLOUD_RUN_LIMIT - 4096));

assert.ok(Buffer.byteLength(small, "utf8") < VERCEL_LIMIT, "small payload should fit Vercel");
assert.ok(Buffer.byteLength(overVercel, "utf8") > VERCEL_LIMIT, "large payload should exceed Vercel");
assert.ok(Buffer.byteLength(underCloudRun, "utf8") < CLOUD_RUN_LIMIT, "mid payload should fit Cloud Run");
assert.ok(Buffer.byteLength(nearCloudRun, "utf8") < CLOUD_RUN_LIMIT, "near-limit payload should fit Cloud Run");

const meta = buildActivityDetailWebhookMeta(small, {
  method: "POST",
  contentType: "application/json",
  contentLengthHeader: String(Buffer.byteLength(small, "utf8")),
});

assert.equal(meta.garminUserId, "garmin-test-user");
assert.deepEqual(meta.activityIds, ["123456789"]);

console.log("verify:payload-limits OK", {
  smallBytes: Buffer.byteLength(small, "utf8"),
  overVercelBytes: Buffer.byteLength(overVercel, "utf8"),
  underCloudRunBytes: Buffer.byteLength(underCloudRun, "utf8"),
  nearCloudRunBytes: Buffer.byteLength(nearCloudRun, "utf8"),
  vercelLimit: VERCEL_LIMIT,
  cloudRunConfiguredLimit: CLOUD_RUN_LIMIT,
});
