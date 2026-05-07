/** Race-day photos use the shared Vercel Blob upload endpoint (same as city run check-in). */

export async function uploadRacePhotoFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || typeof data.url !== "string") {
    throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
  }
  return data.url;
}
