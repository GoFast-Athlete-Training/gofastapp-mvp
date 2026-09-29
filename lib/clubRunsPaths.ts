/** Club-scoped hydrated run instance routes (user-facing, not internal model names). */

import type { RunClubEditNavContext } from "@/lib/runClubEditNav";
import { runClubEditProfilePath } from "@/lib/runClubEditNav";

export function clubRunsHubPath(clubId: string): string {
  return `/dashboard/club-runs/${encodeURIComponent(clubId)}`;
}

export function clubRunsBuildPath(clubId: string, seriesId: string): string {
  return `/dashboard/club-runs/${encodeURIComponent(clubId)}/build/${encodeURIComponent(seriesId)}`;
}

export function clubRunsCreatePath(clubId: string): string {
  return `/dashboard/club-runs/${encodeURIComponent(clubId)}/create`;
}

export type RunInstanceManageMode = "edit" | "view" | "rsvps";

function runInstanceManageQuery(
  clubId?: string | null,
  mode?: RunInstanceManageMode,
  step?: string | null
): string {
  const params = new URLSearchParams();
  if (clubId?.trim()) params.set("clubId", clubId.trim());
  if (mode) params.set("mode", mode);
  if (step?.trim()) params.set("step", step.trim());
  const q = params.toString();
  return q ? `?${q}` : "";
}

export function runInstanceManagePath(
  runId: string,
  opts?: { clubId?: string | null; mode?: RunInstanceManageMode; step?: string | null }
): string {
  return `/dashboard/runs/manage/${encodeURIComponent(runId)}${runInstanceManageQuery(opts?.clubId, opts?.mode, opts?.step)}`;
}

export function runInstanceViewPath(runId: string, clubId?: string | null): string {
  return runInstanceManagePath(runId, { clubId, mode: "view" });
}

/** Review submitted runs: preview + publish/approve actions in view mode. */
export function runInstanceReviewPath(runId: string, clubId?: string | null): string {
  return runInstanceManagePath(runId, { clubId, mode: "view" });
}

export function runInstanceEditPath(
  runId: string,
  clubId?: string | null,
  step?: string | null
): string {
  return runInstanceManagePath(runId, { clubId, mode: "edit", step });
}

export function runInstanceEditWorkoutPath(runId: string, clubId?: string | null): string {
  return runInstanceEditPath(runId, clubId, "workout");
}

export function runInstanceRsvpsPath(runId: string, clubId?: string | null): string {
  return runInstanceManagePath(runId, { clubId, mode: "rsvps" });
}

export function clubSeriesEditPath(
  clubId: string,
  seriesId?: string,
  opts?: { navContext?: RunClubEditNavContext }
): string {
  const ctx = opts?.navContext ?? "founder";
  const base = runClubEditProfilePath(ctx, clubId, { section: "run-series" });
  if (!seriesId) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}editSeries=${encodeURIComponent(seriesId)}`;
}
