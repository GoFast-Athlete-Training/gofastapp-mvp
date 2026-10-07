import { internalApiHeaders } from "@/lib/internal-api-auth";

export function getGoFastContentApiBase(): string {
  const base =
    process.env.GOFAST_CONTENT_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_GOFAST_CONTENT_API_URL?.trim() ||
    "";
  return base.replace(/\/$/, "");
}

export async function contentAthleteLinkTreeFetch(
  ownerAthleteId: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const base = getGoFastContentApiBase();
  if (!base) {
    return new Response(
      JSON.stringify({ success: false, error: "GOFAST_CONTENT_API_URL not configured" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const url = `${base}/api/internal/athlete-link-trees/${encodeURIComponent(ownerAthleteId)}${path}`;
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers = new Headers(init?.headers);
  const internal = internalApiHeaders();
  for (const [key, value] of Object.entries(internal)) {
    if (typeof value === "string") headers.set(key, value);
  }
  if (isFormData) {
    headers.delete("content-type");
  }

  return fetch(url, { ...init, headers, cache: "no-store" });
}
