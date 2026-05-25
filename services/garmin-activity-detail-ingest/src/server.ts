import express from "express";
import {
  archiveActivityDetailPayloadIfConfigured,
} from "../../../lib/garmin-events/archive-activity-detail-payload";
import {
  processActivityDetailWebhook,
} from "../../../lib/garmin-events/process-activity-detail-webhook";

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

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "garmin-activity-detail-ingest",
    maxBodyBytes: MAX_BODY_BYTES,
    archive: {
      gcsBucket: process.env.GCS_ARCHIVE_BUCKET ?? null,
      vercelBlob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    },
  });
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
  } catch (error: unknown) {
    console.error("❌ Cloud Run activity-detail webhook error:", error);
  }

  res.status(200).send("OK");
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
