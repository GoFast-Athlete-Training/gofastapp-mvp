export const dynamic = "force-dynamic";

import { waitUntil } from "@vercel/functions";
import { handleActivityDetail } from "@/lib/garmin-events/handleActivityDetail";

function readRawBody(request: Request): Promise<string> {
  return request.text().catch(() => "");
}

function parseJsonSafe(rawText: string): unknown {
  try {
    const t = rawText?.trim() ?? "";
    if (!t) return {};
    return JSON.parse(t);
  } catch {
    return {};
  }
}

function normalizeParsedToObject(parsed: unknown): Record<string, unknown> {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  return parsed as Record<string, unknown>;
}

function readUserIdFromObject(item: unknown): string | null {
  if (item !== null && typeof item === "object" && "userId" in item) {
    const u = (item as { userId?: unknown }).userId;
    if (u !== undefined && u !== null && String(u).length > 0) {
      return String(u);
    }
  }
  return null;
}

function resolveGarminUserIdFromBody(body: Record<string, unknown>): string | null {
  if (body.userId !== undefined && body.userId !== null && String(body.userId).length > 0) {
    return String(body.userId);
  }
  const details = body.activityDetails;
  if (Array.isArray(details) && details.length > 0) {
    return readUserIdFromObject(details[0]);
  }
  return null;
}

async function processActivityDetailWebhook(rawText: string): Promise<void> {
  try {
    const body = normalizeParsedToObject(parseJsonSafe(rawText));
    const activityDetails = body.activityDetails;
    const userId = resolveGarminUserIdFromBody(body) ?? undefined;

    if (!Array.isArray(activityDetails) || activityDetails.length === 0) {
      console.warn("📩 Garmin activity-detail webhook: no activityDetails payload", {
        keys: Object.keys(body),
        userId: userId ?? "(none)",
        rawLength: rawText.length,
      });
      return;
    }

    console.log("📩 Garmin activity-detail webhook processing", {
      count: activityDetails.length,
      userId: userId ?? "(none)",
    });

    const result = await handleActivityDetail(
      activityDetails as Parameters<typeof handleActivityDetail>[0],
      userId
    );

    console.log("📩 Garmin activity-detail webhook result", {
      ...result,
      userId: userId ?? "(none)",
    });
  } catch (error: unknown) {
    console.error("❌ Garmin activity-detail webhook error:", error);
  }
}

/**
 * POST /api/garmin/activity-detail-webhook — Garmin activity detail payloads only.
 */
export async function POST(request: Request) {
  console.log("📩 Garmin activity-detail webhook POST received", {
    timestamp: new Date().toISOString(),
    contentType: request.headers.get("content-type") ?? "none",
  });

  const rawText = await readRawBody(request);
  waitUntil(processActivityDetailWebhook(rawText));
  return new Response("OK", { status: 200 });
}

/**
 * PUT /api/garmin/activity-detail-webhook — same as POST (Garmin may use PUT).
 */
export async function PUT(request: Request) {
  console.log("📩 Garmin activity-detail webhook PUT received", {
    timestamp: new Date().toISOString(),
    contentType: request.headers.get("content-type") ?? "none",
  });

  const rawText = await readRawBody(request);
  waitUntil(processActivityDetailWebhook(rawText));
  return new Response("OK", { status: 200 });
}
