import { getGoFastContentApiBase } from "@/lib/content/athlete-link-tree-client";

/** Content Studio run builder — staff signs in on Content. */
export function contentStudioRunBuildUrl(cityRunId: string): string | null {
  const base = getGoFastContentApiBase();
  if (!base) return null;
  return `${base}/dashboard/content/runs/${encodeURIComponent(cityRunId.trim())}/build`;
}
