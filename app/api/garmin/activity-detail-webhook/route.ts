export const dynamic = "force-dynamic";

import { waitUntil } from "@vercel/functions";
import { archiveActivityDetailPayloadIfConfigured } from "@/lib/garmin-events/archive-activity-detail-payload";
import { processActivityDetailWebhook } from "@/lib/garmin-events/process-activity-detail-webhook";

function readRawBody(request: Request): Promise<string> {
  return request.text().catch(() => "");
}

async function processInBackground(rawText: string, request: Request, method: "POST" | "PUT"): Promise<void> {
  try {
    await processActivityDetailWebhook(rawText, {
      method,
      contentType: request.headers.get("content-type"),
      contentLengthHeader: request.headers.get("content-length"),
      archiveRaw: archiveActivityDetailPayloadIfConfigured,
    });
  } catch (error: unknown) {
    console.error("❌ Garmin activity-detail webhook error:", error);
  }
}

/**
 * POST /api/garmin/activity-detail-webhook — Garmin activity detail payloads only.
 * Small/test payloads only on Vercel; point Garmin Activity Details to Cloud Run for production.
 */
export async function POST(request: Request) {
  const rawText = await readRawBody(request);
  waitUntil(processInBackground(rawText, request, "POST"));
  return new Response("OK", { status: 200 });
}

/**
 * PUT /api/garmin/activity-detail-webhook — same as POST (Garmin may use PUT).
 */
export async function PUT(request: Request) {
  const rawText = await readRawBody(request);
  waitUntil(processInBackground(rawText, request, "PUT"));
  return new Response("OK", { status: 200 });
}
