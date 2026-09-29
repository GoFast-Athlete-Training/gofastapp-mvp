import { clubRunsHubPath } from "@/lib/clubRunsPaths";
import {
  clubManagerHubPath,
  clubManagerListPath,
  clubManagerNextRunsPath,
  clubManagerProfilePath,
  clubManagerSchedulePath,
  clubManagerValidationPath,
} from "@/lib/clubManagerPaths";

export type RunClubEditNavContext = "founder" | "club-manager";

/** Founder metadata / missing-data run club list. */
export function founderRunClubListPath(): string {
  return "/dashboard/entities/runclubs";
}

export function runClubEditBackHref(ctx: RunClubEditNavContext): string {
  return ctx === "club-manager" ? clubManagerValidationPath() : founderRunClubListPath();
}

export function runClubEditBackLabel(ctx: RunClubEditNavContext): string {
  return ctx === "club-manager" ? "Data Manager" : "Back to run clubs";
}

export function runClubEditProfilePath(
  ctx: RunClubEditNavContext,
  clubId: string,
  opts?: { section?: string; editSeries?: string }
): string {
  if (ctx === "club-manager") {
    return clubManagerProfilePath(clubId, opts);
  }
  const base = `/dashboard/entities/manage/runclubs/${encodeURIComponent(clubId)}/edit`;
  const params = new URLSearchParams();
  if (opts?.section?.trim()) params.set("section", opts.section.trim());
  if (opts?.editSeries?.trim()) params.set("editSeries", opts.editSeries.trim());
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function runClubContactDetailPath(
  ctx: RunClubEditNavContext,
  clubId: string,
  recordType: string,
  contactId: string
): string {
  if (ctx === "club-manager") {
    return `/dashboard/club-manager/${encodeURIComponent(clubId)}/contacts/${encodeURIComponent(recordType)}/${encodeURIComponent(contactId)}`;
  }
  return `/dashboard/entities/runclubs/${encodeURIComponent(clubId)}/contacts/${encodeURIComponent(recordType)}/${encodeURIComponent(contactId)}`;
}

export function runClubRunsHubHref(ctx: RunClubEditNavContext, clubId: string): string {
  return ctx === "club-manager" ? clubManagerHubPath(clubId) : clubRunsHubPath(clubId);
}

/** Founder vs club-manager from role or current route. */
export function resolveRunsNavContext(opts: {
  cockpitRole?: string | null;
  pathname?: string | null;
}): RunClubEditNavContext {
  if (opts.cockpitRole === "CLUB_MANAGER") return "club-manager";
  if (opts.pathname?.startsWith("/dashboard/club-manager")) return "club-manager";
  return "founder";
}

/** Back link from a club run hub to the runs list / command surface. */
export function runsListBackPath(ctx: RunClubEditNavContext): string {
  return ctx === "club-manager" ? clubManagerNextRunsPath() : "/dashboard/runs";
}

export function runsListBackLabel(ctx: RunClubEditNavContext): string {
  return ctx === "club-manager" ? "Build Run Instances" : "Run Ops Workbench";
}

/** When run manage has no clubId — fall back to schedule vs weekly publisher list. */
export function runsManageFallbackBackPath(ctx: RunClubEditNavContext): string {
  return ctx === "club-manager" ? clubManagerSchedulePath() : "/dashboard/runs/list";
}
