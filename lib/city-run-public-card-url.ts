import { getPublicRunContentUrl } from "@/lib/publicRunUrl";

/** Public narrow run card on the city runs content host: dcruns…/runs/{slug}/card */
export function cityRunPublicCardUrl(
  runSlugOrId: string,
  citySlug?: string | null,
  runId?: string,
): string {
  const key = runSlugOrId.trim();
  const base = getPublicRunContentUrl({
    runId: runId?.trim() || key,
    slug: key,
    citySlug: citySlug ?? "dc",
  });
  return `${base}/card`;
}
