export const MAX_ROUTE_PHOTOS = 8;

export async function uploadImageFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!data.url) {
    throw new Error(data.error || "Upload failed");
  }
  return String(data.url);
}

/** Upload several images in parallel; rejects if any file fails. */
export async function uploadImageFiles(files: File[]): Promise<string[]> {
  if (files.length === 0) return [];
  return Promise.all(files.map(uploadImageFile));
}

/** Cap selection to remaining slots under MAX_ROUTE_PHOTOS. */
export function pickRoutePhotoFiles(
  fileList: FileList | null,
  currentCount: number
): { files: File[]; skipped: number } {
  if (!fileList?.length) return { files: [], skipped: 0 };
  const remaining = Math.max(0, MAX_ROUTE_PHOTOS - currentCount);
  const all = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
  return {
    files: all.slice(0, remaining),
    skipped: Math.max(0, all.length - remaining),
  };
}
