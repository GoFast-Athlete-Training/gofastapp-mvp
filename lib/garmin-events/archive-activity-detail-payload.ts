import type { ActivityDetailWebhookMeta } from "./process-activity-detail-webhook";

function archiveKey(meta: ActivityDetailWebhookMeta): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const user = meta.garminUserId ?? "unknown-user";
  const activity = meta.activityIds[0] ?? "unknown-activity";
  return `garmin/activity-detail/${user}/${activity}/${ts}-${meta.rawByteLength}b.json`;
}

/**
 * Optional archival to Vercel Blob when BLOB_READ_WRITE_TOKEN is configured.
 */
export async function archiveActivityDetailToVercelBlob(
  rawText: string,
  meta: ActivityDetailWebhookMeta
): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return null;

  const { put } = await import("@vercel/blob");
  const blob = await put(archiveKey(meta), rawText, {
    access: "public",
    addRandomSuffix: true,
    contentType: "application/json",
    token,
  });

  console.log("📦 Archived activity-detail payload to Vercel Blob", {
    url: blob.url,
    rawByteLength: meta.rawByteLength,
    garminUserId: meta.garminUserId ?? "(none)",
  });

  return blob.url;
}

/**
 * Optional archival to Google Cloud Storage when GCS_ARCHIVE_BUCKET is configured.
 * Intended for the Cloud Run sidecar; uses Application Default Credentials.
 */
export async function archiveActivityDetailToGcs(
  rawText: string,
  meta: ActivityDetailWebhookMeta
): Promise<string | null> {
  const bucketName = process.env.GCS_ARCHIVE_BUCKET?.trim();
  if (!bucketName) return null;

  let Storage: any;
  try {
    ({ Storage } = await import("@google-cloud/storage"));
  } catch {
    console.warn("GCS archive skipped: @google-cloud/storage not installed");
    return null;
  }

  const storage = new Storage();
  const objectName = archiveKey(meta);
  const file = storage.bucket(bucketName).file(objectName);

  await file.save(rawText, {
    contentType: "application/json",
    metadata: {
      garminUserId: meta.garminUserId ?? "",
      activityIds: meta.activityIds.join(","),
      rawByteLength: String(meta.rawByteLength),
    },
  });

  const uri = `gs://${bucketName}/${objectName}`;
  console.log("📦 Archived activity-detail payload to GCS", {
    uri,
    rawByteLength: meta.rawByteLength,
    garminUserId: meta.garminUserId ?? "(none)",
  });

  return uri;
}

/**
 * Archive raw payload when any configured backend is available.
 */
export async function archiveActivityDetailPayloadIfConfigured(
  rawText: string,
  meta: ActivityDetailWebhookMeta
): Promise<void> {
  const gcsUri = await archiveActivityDetailToGcs(rawText, meta);
  if (gcsUri) return;

  await archiveActivityDetailToVercelBlob(rawText, meta);
}
