import { handleActivityDetail } from "./handleActivityDetail";

export type ActivityDetailWebhookMeta = {
  method: string;
  contentType: string | null;
  contentLengthHeader: string | null;
  rawByteLength: number;
  garminUserId: string | null;
  activityIds: string[];
};

function parseJsonSafe(rawText: string): unknown {
  try {
    const t = rawText?.trim() ?? "";
    if (!t) return {};
    return JSON.parse(t);
  } catch {
    return {};
  }
}

function normalizeParsedToBody(parsed: unknown): Record<string, unknown> {
  if (Array.isArray(parsed)) {
    return { activityDetails: parsed };
  }
  if (parsed === null || typeof parsed !== "object") {
    return {};
  }
  return parsed as Record<string, unknown>;
}

function readActivityIdCandidates(item: unknown): string[] {
  if (item === null || typeof item !== "object") return [];
  const detail = item as {
    activityId?: unknown;
    summaryId?: unknown;
    summary?: { activityId?: unknown } | null;
  };
  const ids = [
    detail.activityId,
    detail.summary?.activityId,
    typeof detail.summaryId === "string" && detail.summaryId.endsWith("-detail")
      ? detail.summaryId.slice(0, -"detail".length - 1)
      : detail.summaryId,
  ];
  return ids
    .filter((id) => id !== undefined && id !== null && String(id).length > 0)
    .map(String);
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

function readActivityIds(body: Record<string, unknown>): string[] {
  const details = body.activityDetails;
  if (!Array.isArray(details)) return [];
  return Array.from(new Set(details.flatMap(readActivityIdCandidates)));
}

export function buildActivityDetailWebhookMeta(
  rawText: string,
  options: {
    method?: string;
    contentType?: string | null;
    contentLengthHeader?: string | null;
  } = {}
): ActivityDetailWebhookMeta {
  const body = normalizeParsedToBody(parseJsonSafe(rawText));
  return {
    method: options.method ?? "POST",
    contentType: options.contentType ?? null,
    contentLengthHeader: options.contentLengthHeader ?? null,
    rawByteLength: Buffer.byteLength(rawText, "utf8"),
    garminUserId: resolveGarminUserIdFromBody(body),
    activityIds: readActivityIds(body),
  };
}

export type ProcessActivityDetailWebhookResult = {
  processed: number;
  skipped: number;
  errors: number;
  userId: string | null;
  count: number;
};

export type ProcessActivityDetailWebhookOptions = {
  method?: string;
  contentType?: string | null;
  contentLengthHeader?: string | null;
  archiveRaw?: (rawText: string, meta: ActivityDetailWebhookMeta) => Promise<void>;
};

/**
 * Parse and persist Garmin activity-detail webhook payloads.
 * Shared by Vercel route and Cloud Run sidecar.
 */
export async function processActivityDetailWebhook(
  rawText: string,
  options: ProcessActivityDetailWebhookOptions = {}
): Promise<ProcessActivityDetailWebhookResult | null> {
  const meta = buildActivityDetailWebhookMeta(rawText, options);

  console.log("📩 Garmin activity-detail webhook received", {
    method: meta.method,
    contentType: meta.contentType ?? "none",
    contentLengthHeader: meta.contentLengthHeader ?? "(none)",
    rawByteLength: meta.rawByteLength,
    garminUserId: meta.garminUserId ?? "(none)",
    activityIds: meta.activityIds,
  });

  if (options.archiveRaw) {
    try {
      await options.archiveRaw(rawText, meta);
    } catch (archiveErr) {
      console.warn("activity-detail raw archive failed:", archiveErr);
    }
  }

  const body = normalizeParsedToBody(parseJsonSafe(rawText));
  const activityDetails = body.activityDetails;
  const userId = meta.garminUserId ?? undefined;

  if (!Array.isArray(activityDetails) || activityDetails.length === 0) {
    console.warn("📩 Garmin activity-detail webhook: no activityDetails payload", {
      keys: Object.keys(body),
      userId: userId ?? "(none)",
      rawByteLength: meta.rawByteLength,
    });
    return null;
  }

  console.log("📩 Garmin activity-detail webhook processing", {
    count: activityDetails.length,
    userId: userId ?? "(none)",
    rawByteLength: meta.rawByteLength,
  });

  const result = await handleActivityDetail(
    activityDetails as Parameters<typeof handleActivityDetail>[0],
    userId
  );

  console.log("📩 Garmin activity-detail webhook result", {
    ...result,
    userId: userId ?? "(none)",
    rawByteLength: meta.rawByteLength,
  });

  return {
    ...result,
    userId: meta.garminUserId,
    count: activityDetails.length,
  };
}
