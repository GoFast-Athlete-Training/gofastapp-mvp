import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  athleteLinkTreeSlugFromHandle,
  isValidAthleteLinkTreeSlug,
} from "@/lib/content/athlete-link-tree-slug";

export async function requireAthleteWithHandleForLinks(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return { ok: false as const, status: auth.status, error: auth.error };
  }

  const handle = auth.athlete.gofastHandle?.trim();
  if (!handle) {
    return {
      ok: false as const,
      status: 400 as const,
      error: "Set your GoFast handle in profile before editing your link page",
    };
  }

  const slug = athleteLinkTreeSlugFromHandle(handle);
  if (!isValidAthleteLinkTreeSlug(slug)) {
    return {
      ok: false as const,
      status: 400 as const,
      error: "Your handle must be 2–64 characters (letters, numbers, hyphens) for a public link page",
    };
  }

  const displayName =
    [auth.athlete.firstName, auth.athlete.lastName].filter(Boolean).join(" ").trim() || handle;

  return {
    ok: true as const,
    athlete: auth.athlete,
    handle,
    slug,
    displayName,
  };
}
