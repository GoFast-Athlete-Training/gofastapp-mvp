import express from "express";
import { prisma } from "../../../lib/prisma";
import {
  archiveActivityDetailPayloadIfConfigured,
} from "../../../lib/garmin-events/archive-activity-detail-payload";
import {
  processActivityDetailWebhook,
} from "../../../lib/garmin-events/process-activity-detail-webhook";

/** Alert when no Garmin detail has hydrated in this many hours. */
const DETAIL_STALE_HOURS = Number(process.env.DETAIL_STALE_HOURS ?? 6);

const PORT = Number(process.env.PORT ?? 8080);
/** Cloud Run HTTP/1 request cap is 32 MiB; stay slightly under. */
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES ?? 30 * 1024 * 1024);

const app = express();
app.disable("x-powered-by");

app.use(
  express.text({
    type: ["application/json", "application/json;charset=UTF-8", "text/plain"],
    limit: MAX_BODY_BYTES,
  })
);

async function readDetailHydrationHealth(): Promise<{
  ok: boolean;
  lastHydratedAt: string | null;
  staleHours: number;
  reason: string | null;
}> {
  const staleMs = DETAIL_STALE_HOURS * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - staleMs);
  const recent = await prisma.athlete_activities.findFirst({
    where: {
      source: "garmin",
      startTime: { gte: cutoff },
    },
    orderBy: { startTime: "desc" },
    select: { hydratedAt: true, startTime: true },
  });
  if (!recent) {
    return {
      ok: true,
      lastHydratedAt: null,
      staleHours: DETAIL_STALE_HOURS,
      reason: null,
    };
  }
  const last = await prisma.athlete_activities.findFirst({
    where: { source: "garmin", hydratedAt: { not: null } },
    orderBy: { hydratedAt: "desc" },
    select: { hydratedAt: true },
  });
  const lastHydratedAt = last?.hydratedAt?.toISOString() ?? null;
  if (!lastHydratedAt) {
    return {
      ok: false,
      lastHydratedAt: null,
      staleHours: DETAIL_STALE_HOURS,
      reason: `No Garmin detail hydrated in the last ${DETAIL_STALE_HOURS}h window`,
    };
  }
  const stale = Date.now() - new Date(lastHydratedAt).getTime() > staleMs;
  return {
    ok: !stale,
    lastHydratedAt,
    staleHours: DETAIL_STALE_HOURS,
    reason: stale
      ? `Last detail hydration ${lastHydratedAt} is older than ${DETAIL_STALE_HOURS}h`
      : null,
  };
}

app.get("/health", (_req, res) => {
  void (async () => {
    try {
      const hydration = await readDetailHydrationHealth();
      const status = hydration.ok ? 200 : 503;
      res.status(status).json({
        ok: hydration.ok,
        service: "garmin-activity-detail-ingest",
        maxBodyBytes: MAX_BODY_BYTES,
        detailHydration: hydration,
        archive: {
          gcsBucket: process.env.GCS_ARCHIVE_BUCKET ?? null,
          vercelBlob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
        },
      });
    } catch (error: unknown) {
      console.error("❌ Cloud Run health check error:", error);
      res.status(503).json({
        ok: false,
        service: "garmin-activity-detail-ingest",
        error: error instanceof Error ? error.message : "Health check failed",
      });
    }
  })();
});

async function handleWebhook(
  req: express.Request,
  res: express.Response,
  method: "POST" | "PUT"
): Promise<void> {
  const rawText = typeof req.body === "string" ? req.body : "";

  try {
    await processActivityDetailWebhook(rawText, {
      method,
      contentType: req.header("content-type") ?? null,
      contentLengthHeader: req.header("content-length") ?? null,
      archiveRaw: archiveActivityDetailPayloadIfConfigured,
    });
    res.status(200).send("OK");
  } catch (error: unknown) {
    console.error("❌ Cloud Run activity-detail webhook error:", error);
    res.status(500).send("Internal Server Error");
  }
}

app.post("/", (req, res) => {
  void handleWebhook(req, res, "POST");
});

app.put("/", (req, res) => {
  void handleWebhook(req, res, "PUT");
});

app.post("/activity-detail-webhook", (req, res) => {
  void handleWebhook(req, res, "POST");
});

app.put("/activity-detail-webhook", (req, res) => {
  void handleWebhook(req, res, "PUT");
});

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (
    err &&
    typeof err === "object" &&
    "type" in err &&
    (err as { type?: string }).type === "entity.too.large"
  ) {
    console.error("❌ Payload too large for Cloud Run ingest", {
      maxBodyBytes: MAX_BODY_BYTES,
    });
    res.status(413).send("Payload Too Large");
    return;
  }
  next(err);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Garmin activity-detail ingest listening on :${PORT}`, {
    maxBodyBytes: MAX_BODY_BYTES,
  });
});
