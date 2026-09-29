import {
  formatDayLabel,
  formatSeriesTime,
  sortSeriesByWeekday,
} from "@/lib/acqRunSeriesDisplay";
import {
  clubRunsBuildPath,
  clubRunsHubPath,
  clubSeriesEditPath,
  runInstanceEditPath,
  runInstanceReviewPath,
  runInstanceRsvpsPath,
  type RunInstanceManageMode,
} from "@/lib/clubRunsPaths";
import { clubManagerHubPath, clubManagerProfilePath } from "@/lib/clubManagerPaths";
import type { RunClubEditNavContext } from "@/lib/runClubEditNav";
import type { AcqSeriesSummary } from "@/lib/acqRunClubSeriesSummary";
import type { RunInstanceSummary, SeriesLaneSummary } from "@/lib/runInstanceSummary";
import { formatRunCalendarDate } from "@/lib/formatRunCalendarDate";
import { blocksPublicRunCreation } from "@/lib/clubRunAccess";
import { duplicateGroupSizeBySeriesId, seriesScopeCityLabel } from "@/lib/runSeriesScopeDiagnostics";

export type SeriesWithInstances = AcqSeriesSummary & {
  instanceCount?: number;
  instances?: RunInstanceSummary[];
  lane?: SeriesLaneSummary;
};

export type RunClubBoardRow = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  approvalStatus?: string | null;
  publishingStatus?: string | null;
  seriesCount?: number;
  syncedSeriesCount?: number;
  series?: SeriesWithInstances[];
  instanceCount?: number;
  upcomingInstanceCount?: number;
  needsAdvanceCount?: number;
  latestInstance?: RunInstanceSummary | null;
  nextUpcomingInstance?: RunInstanceSummary | null;
  assignedStaffId?: string | null;
  assigned_staff?: { id: string; name: string | null; email: string | null } | null;
  membershipType?: string | null;
  runsRequireMembership?: boolean | null;
};

/** Staff-facing instance lifecycle (runs fork). */
export type InstanceStaffState = "no_built" | "built" | "submitted" | "live";

export type RunsBoardNavContext = RunClubEditNavContext;

export type RunsBoardFilter =
  | "all"
  | "actionable"
  | "needs_review"
  | "built"
  | "no_built"
  | "needs_sync"
  | "live"
  | "no_series"
  | "blocked"
  | "unassigned"
  | "assigned";

export type SubmittedInstanceRef = {
  runId: string;
  clubId: string;
  clubName: string;
  seriesId: string;
  instance: RunInstanceSummary;
};

export const RUNS_BOARD_FILTERS: { id: RunsBoardFilter; label: string }[] = [
  { id: "actionable", label: "Needs action" },
  { id: "all", label: "All run clubs" },
  { id: "needs_review", label: "Needs review" },
  { id: "built", label: "Drafts" },
  { id: "no_built", label: "No runs yet" },
  { id: "needs_sync", label: "Series not on app" },
  { id: "live", label: "On public app" },
  { id: "no_series", label: "No series" },
  { id: "unassigned", label: "Unassigned" },
  { id: "assigned", label: "Assigned" },
  { id: "blocked", label: "Blocked" },
];

/** @deprecated Use RUNS_BOARD_FILTERS */
export type RunClubStatusFilter = RunsBoardFilter;
/** @deprecated Use RUNS_BOARD_FILTERS */
export const RUN_CLUB_STATUS_FILTERS = RUNS_BOARD_FILTERS;

export type ClubSetupStatus = "no_series" | "needs_publish" | "partial" | "ready";

function getStartOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function instanceStaffState(instance: RunInstanceSummary): InstanceStaffState {
  if (instance.published) return "live";
  if (instance.workflowStatus === "SUBMITTED") return "submitted";
  return "built";
}

export type InstanceDisplayEmphasis = "neutral" | "warning" | "success" | "danger";

export type InstanceDisplayStatus = {
  label: string;
  hint: string;
  emphasis: InstanceDisplayEmphasis;
};

/** Plain-language run status for staff — not clickable, explains what the row means. */
export function instanceDisplayStatus(instance: RunInstanceSummary): InstanceDisplayStatus {
  const startOfToday = getStartOfTodayUTC();
  const isPast = new Date(instance.date) < startOfToday;
  const state = instanceStaffState(instance);

  if (state === "live") {
    return isPast
      ? {
          label: "Was on app",
          hint: "This date passed while published — athletes could RSVP.",
          emphasis: "success",
        }
      : {
          label: "On public app",
          hint: "Published — athletes can discover this run and RSVP.",
          emphasis: "success",
        };
  }
  if (state === "submitted") {
    return {
      label: isPast ? "Past · awaiting review" : "Awaiting your review",
      hint: "Submitted by club staff — review content, then publish selected runs.",
      emphasis: "warning",
    };
  }
  if (isPast) {
    return {
      label: "Past draft",
      hint: "Run date passed without publishing. Create the next week or clean up in All Runs Viewer.",
      emphasis: "danger",
    };
  }
  return {
    label: "Draft · not public",
    hint: "Saved in Product only — edit, submit, then publish when ready.",
    emphasis: "neutral",
  };
}

export function instanceDisplayBadgeClasses(emphasis: InstanceDisplayEmphasis): string {
  switch (emphasis) {
    case "success":
      return "border-emerald-200 bg-emerald-50/80 text-emerald-900";
    case "warning":
      return "border-amber-200 bg-amber-50/80 text-amber-950";
    case "danger":
      return "border-red-200 bg-red-50/80 text-red-900";
    case "neutral":
      return "border-gray-200 bg-gray-50 text-gray-700";
  }
}

export type SeriesSyncDisplay = {
  label: string;
  hint: string;
};

export function seriesSyncDisplay(synced: boolean): SeriesSyncDisplay {
  return synced
    ? {
        label: "Series in Product",
        hint: "Weekly schedule template is synced — run instances are built from this series.",
      }
    : {
        label: "Not in Product yet",
        hint: "Series exists in Company only — sync before athletes can see runs.",
      };
}

export function seriesSyncBadgeClasses(synced: boolean): string {
  return synced
    ? "border-sky-200 bg-sky-50/80 text-sky-900"
    : "border-amber-200 bg-amber-50/80 text-amber-950";
}

/** @deprecated Prefer instanceDisplayStatus().label */
export function instanceStaffStateLabel(state: InstanceStaffState): string {
  switch (state) {
    case "no_built":
      return "No run yet";
    case "built":
      return "Draft";
    case "submitted":
      return "In review";
    case "live":
      return "On app";
  }
}

/** @deprecated Prefer instanceDisplayBadgeClasses */
export function instanceStaffStateBadgeClasses(state: InstanceStaffState): string {
  switch (state) {
    case "no_built":
      return "bg-gray-100 text-gray-700 ring-gray-300";
    case "built":
      return "bg-gray-50 text-gray-800 ring-gray-300";
    case "submitted":
      return "bg-amber-50 text-amber-900 ring-amber-600/20";
    case "live":
      return "bg-emerald-100 text-emerald-900 ring-emerald-600/30";
  }
}

export function pickSeriesHighlightInstance(
  instances: RunInstanceSummary[] | undefined
): RunInstanceSummary | null {
  if (!instances?.length) return null;
  const startOfToday = getStartOfTodayUTC();
  const upcoming = instances
    .filter((r) => new Date(r.date) >= startOfToday)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (upcoming[0]) return upcoming[0];
  const sorted = [...instances].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  return sorted[0] ?? null;
}

export function seriesManageHref(
  clubId: string,
  series: SeriesWithInstances,
  navContext: RunsBoardNavContext = "founder"
): string {
  if (series.syncedToProd) {
    return `/dashboard/runs/series/${encodeURIComponent(series.id)}`;
  }
  return clubSeriesEditPath(clubId, series.id, { navContext });
}

export function runsHubPath(clubId: string, navContext: RunsBoardNavContext): string {
  return navContext === "club-manager" ? clubManagerHubPath(clubId) : clubRunsHubPath(clubId);
}

export function runsBuildPath(
  clubId: string,
  seriesId: string,
  _navContext: RunsBoardNavContext
): string {
  return clubRunsBuildPath(clubId, seriesId);
}

export function runsSetupSeriesPath(clubId: string, navContext: RunsBoardNavContext): string {
  if (navContext === "club-manager") {
    return clubManagerProfilePath(clubId, { section: "run-series" });
  }
  return clubSeriesEditPath(clubId, undefined, { navContext: "founder" });
}

export function formatSeriesRowLabel(series: SeriesWithInstances): string {
  const day = formatDayLabel(series.dayOfWeek);
  const time = formatSeriesTime(
    series.startTimeHour,
    series.startTimeMinute,
    series.startTimePeriod
  );
  const cityLabel =
    seriesScopeCityLabel({
      citySlug: series.citySlug,
      meetUpCity: series.meetUpCity,
      meetUpState: series.meetUpState,
    }) ?? series.meetUpCity?.trim() ?? null;
  const name = series.name?.trim();
  const parts: string[] = [];
  if (name && name !== day && !name.toLowerCase().includes(day.toLowerCase())) {
    parts.push(name);
  }
  if (cityLabel) parts.push(cityLabel);
  parts.push(day);
  if (time) parts.push(time);
  return parts.join(" · ");
}

export function countInstancesByState(club: RunClubBoardRow): {
  live: number;
  submitted: number;
  built: number;
} {
  let live = 0;
  let submitted = 0;
  let built = 0;
  for (const series of club.series ?? []) {
    for (const inst of series.instances ?? []) {
      const state = instanceStaffState(inst);
      if (state === "live") live++;
      else if (state === "submitted") submitted++;
      else if (state === "built") built++;
    }
  }
  return { live, submitted, built };
}

/** Series with zero built instances in Product. */
export function countEmptySeries(club: RunClubBoardRow): number {
  return (club.series ?? []).filter(
    (s) => (s.instanceCount ?? s.instances?.length ?? 0) === 0
  ).length;
}

export function clubHasSubmittedInstances(club: RunClubBoardRow): boolean {
  return countInstancesByState(club).submitted > 0;
}

export function countSubmittedInstances(clubs: RunClubBoardRow[]): number {
  return collectSubmittedInstances(clubs).length;
}

export function filterInstancesByStaffState(
  instances: RunInstanceSummary[],
  filter: "all" | InstanceStaffState
): RunInstanceSummary[] {
  if (filter === "all") return instances;
  return instances.filter((inst) => instanceStaffState(inst) === filter);
}

export function seriesHasSubmittedInstances(series: SeriesWithInstances): boolean {
  return filterInstancesByStaffState(series.instances ?? [], "submitted").length > 0;
}

export function collectSubmittedInstances(clubs: RunClubBoardRow[]): SubmittedInstanceRef[] {
  const out: SubmittedInstanceRef[] = [];
  for (const club of clubs) {
    for (const series of club.series ?? []) {
      for (const inst of filterInstancesByStaffState(series.instances ?? [], "submitted")) {
        out.push({
          runId: inst.id,
          clubId: club.id,
          clubName: club.name,
          seriesId: series.id,
          instance: inst,
        });
      }
    }
  }
  return out;
}

export function clubHasBuiltInstances(club: RunClubBoardRow): boolean {
  return countInstancesByState(club).built > 0;
}

export function clubHasLiveInstances(club: RunClubBoardRow): boolean {
  return countInstancesByState(club).live > 0;
}

export function clubHasNoBuiltSeries(club: RunClubBoardRow): boolean {
  const series = club.series ?? [];
  if (series.length === 0) return false;
  return series.some((s) => (s.instanceCount ?? s.instances?.length ?? 0) === 0);
}

export function clubIsRunBuildBlocked(club: RunClubBoardRow): boolean {
  return blocksPublicRunCreation(club);
}

export function clubHasAssignedStaff(club: RunClubBoardRow): boolean {
  return Boolean(club.assignedStaffId?.trim());
}

export function clubNeedsAction(club: RunClubBoardRow): boolean {
  if (clubIsRunBuildBlocked(club)) return false;
  if (clubHasSubmittedInstances(club)) return true;
  if ((club.needsAdvanceCount ?? 0) > 0) return true;
  if (clubHasNoBuiltSeries(club)) return true;
  return false;
}

/** Lower score = higher priority in founder ops queue. */
export function clubOpsPriorityScore(club: RunClubBoardRow): number {
  if (clubIsRunBuildBlocked(club)) return 900;
  let score = 500;
  if (clubHasSubmittedInstances(club)) score -= 200;
  if ((club.needsAdvanceCount ?? 0) > 0) score -= 100 + (club.needsAdvanceCount ?? 0);
  if (!clubHasAssignedStaff(club)) score -= 50;
  if (clubHasNoBuiltSeries(club)) score -= 30;
  if ((club.upcomingInstanceCount ?? 0) > 0) score += 20;
  return score;
}

export function sortClubsForOpsQueue(clubs: RunClubBoardRow[]): RunClubBoardRow[] {
  return [...clubs].sort((a, b) => {
    const scoreDiff = clubOpsPriorityScore(a) - clubOpsPriorityScore(b);
    if (scoreDiff !== 0) return scoreDiff;
    return a.name.localeCompare(b.name);
  });
}

export function matchesRunsBoardFilter(club: RunClubBoardRow, filter: RunsBoardFilter): boolean {
  if (filter === "blocked") return clubIsRunBuildBlocked(club);
  if (filter === "unassigned") return !clubHasAssignedStaff(club);
  if (filter === "assigned") return clubHasAssignedStaff(club);
  if (filter === "actionable") return clubNeedsAction(club);
  if (filter === "all") return true;
  if (filter === "no_series") return (club.seriesCount ?? 0) === 0;
  if (filter === "needs_sync") {
    const n = club.seriesCount ?? 0;
    const synced = club.syncedSeriesCount ?? 0;
    return n > 0 && synced < n;
  }
  if (filter === "needs_review") return clubHasSubmittedInstances(club);
  if (filter === "built") return clubHasBuiltInstances(club);
  if (filter === "live") return clubHasLiveInstances(club);
  if (filter === "no_built") return clubHasNoBuiltSeries(club);
  return true;
}

/** @deprecated Use matchesRunsBoardFilter */
export function matchesRunClubStatusFilter(
  club: RunClubBoardRow,
  filter: RunsBoardFilter
): boolean {
  return matchesRunsBoardFilter(club, filter);
}

export function formatRunsSummary(club: RunClubBoardRow): string | null {
  const { live, submitted, built } = countInstancesByState(club);
  const needsAdvance = club.needsAdvanceCount ?? 0;
  const seriesCount = club.seriesCount ?? club.series?.length ?? 0;
  const parts: string[] = [];
  if (live > 0) parts.push(`${live} on app`);
  if (submitted > 0) parts.push(`${submitted} need review`);
  if (built > 0) parts.push(`${built} draft${built === 1 ? "" : "s"}`);
  if (needsAdvance > 0) parts.push(`${needsAdvance} need next run`);
  if (parts.length === 0 && seriesCount > 0) {
    return `${seriesCount} series · no run instances yet`;
  }
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

/** Founder Run Clubs row — club-level instance totals plus empty-series coverage. */
export function formatFounderRunsSummary(club: RunClubBoardRow): string | null {
  const seriesCount = club.seriesCount ?? club.series?.length ?? 0;
  const instanceCount = club.instanceCount ?? 0;
  if (seriesCount === 0 && instanceCount === 0) return null;

  const { live, submitted, built } = countInstancesByState(club);
  const emptySeries = countEmptySeries(club);
  const needsAdvance = club.needsAdvanceCount ?? 0;
  const parts: string[] = [];

  if (seriesCount > 0) parts.push(`${seriesCount} series`);
  if (live > 0) parts.push(`${live} live`);
  if (submitted > 0) parts.push(`${submitted} need review`);
  if (built > 0) parts.push(`${built} draft${built === 1 ? "" : "s"}`);
  if (needsAdvance > 0) parts.push(`${needsAdvance} need next run`);
  if (emptySeries > 0) {
    parts.push(`${emptySeries} empty series${emptySeries === 1 ? "" : ""}`);
  }

  if (parts.length === 0) {
    return seriesCount > 0 ? `${seriesCount} series · no run instances yet` : null;
  }
  return parts.join(" · ");
}

export function formatShortRunDate(iso: string): string {
  return formatRunCalendarDate(iso, { month: "short", day: "numeric" });
}

export function formatExpectedNextDate(ymd: string): string {
  return formatRunCalendarDate(ymd, { month: "short", day: "numeric" });
}

export function clubNeedsAdvance(club: RunClubBoardRow): boolean {
  return (club.needsAdvanceCount ?? 0) > 0;
}

export function countNeedsAdvanceInstances(clubs: RunClubBoardRow[]): number {
  return clubs.reduce((sum, club) => sum + (club.needsAdvanceCount ?? 0), 0);
}

export function clubSetupStatus(club: RunClubBoardRow): ClubSetupStatus {
  const n = club.seriesCount ?? 0;
  const live = club.syncedSeriesCount ?? 0;
  if (n === 0) return "no_series";
  if (live === 0) return "needs_publish";
  if (live < n) return "partial";
  return "ready";
}

export function formatSeriesDaySummary(seriesRows: SeriesWithInstances[]): string | null {
  if (seriesRows.length === 0) return null;
  return sortSeriesByWeekday(seriesRows)
    .map((s) => formatDayLabel(s.dayOfWeek).slice(0, 3))
    .join(" · ");
}

export type ClubPrimaryAction = {
  label: string;
  href: string;
  variant: "hub" | "setup";
};

export function clubPrimaryAction(
  club: RunClubBoardRow,
  opts?: { hubPath?: (clubId: string) => string; setupPath?: (clubId: string) => string }
): ClubPrimaryAction {
  const hubPath = opts?.hubPath ?? clubRunsHubPath;
  const setupPath = opts?.setupPath ?? clubSeriesEditPath;
  const hasSeries = (club.seriesCount ?? 0) > 0;
  const hasInstances = (club.instanceCount ?? 0) > 0;

  if (!hasSeries && !hasInstances) {
    return {
      label: "Set up series",
      href: setupPath(club.id),
      variant: "setup",
    };
  }

  return {
    label: opts?.hubPath ? "Manage runs" : "Open run hub",
    href: hubPath(club.id),
    variant: "hub",
  };
}

export function clubManagerPrimaryRunAction(club: RunClubBoardRow): ClubPrimaryAction {
  return clubPrimaryAction(club, {
    hubPath: clubManagerHubPath,
    setupPath: (id) => clubManagerProfilePath(id, { section: "run-series" }),
  });
}

export function formatClubCounts(club: RunClubBoardRow): string {
  return `${club.seriesCount ?? 0} series · ${club.syncedSeriesCount ?? 0} synced · ${club.instanceCount ?? 0} instances`;
}

export function formatClubLocation(club: RunClubBoardRow): string {
  return [club.city, club.state].filter(Boolean).join(", ") || "No location";
}

export function sortedSeriesWithInstances(club: RunClubBoardRow): SeriesWithInstances[] {
  return sortSeriesByWeekday(club.series ?? []);
}

/** Duplicate scope group size for a series row (1 = unique). */
export function seriesDuplicateGroupSize(
  clubId: string,
  series: SeriesWithInstances,
  clubSeries?: SeriesWithInstances[]
): number {
  const rows = clubSeries ?? [series];
  const map = duplicateGroupSizeBySeriesId(clubId, rows);
  return map.get(series.id) ?? 1;
}

export function seriesHasDuplicateScope(
  clubId: string,
  series: SeriesWithInstances,
  clubSeries: SeriesWithInstances[]
): boolean {
  return seriesDuplicateGroupSize(clubId, series, clubSeries) > 1;
}

export function highlightInstancePrefix(
  instance: RunInstanceSummary,
  instances: RunInstanceSummary[]
): string {
  const startOfToday = getStartOfTodayUTC();
  const isUpcoming = new Date(instance.date) >= startOfToday;
  if (isUpcoming) return "Upcoming: ";
  const hasUpcoming = instances.some((r) => new Date(r.date) >= startOfToday);
  return hasUpcoming ? "Latest past: " : "Past: ";
}

/** True when a series has no today/future instance — staff should create next. */
export function seriesMissingUpcomingRun(
  instances: RunInstanceSummary[],
  lane?: SeriesLaneSummary | null
): { missing: boolean; seedRun: RunInstanceSummary | null } {
  const startOfToday = getStartOfTodayUTC();
  if (lane?.nextRun) return { missing: false, seedRun: null };
  if (lane?.needsAdvance && lane.latestPriorRun) {
    return { missing: true, seedRun: lane.latestPriorRun };
  }
  const hasUpcoming = instances.some((r) => new Date(r.date) >= startOfToday);
  if (hasUpcoming) return { missing: false, seedRun: null };
  if (instances.length === 0) return { missing: false, seedRun: null };
  const sorted = [...instances].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const latestPrior =
    sorted.find((r) => new Date(r.date) < startOfToday) ?? sorted[0] ?? null;
  return { missing: true, seedRun: latestPrior };
}

export function runInstanceEditHref(
  runId: string,
  clubId: string,
  navContext: RunsBoardNavContext
): string {
  return runInstanceEditPath(runId, clubId);
}

export function runInstanceManageHref(
  runId: string,
  clubId: string,
  _navContext: RunsBoardNavContext,
  mode: RunInstanceManageMode = "edit"
): string {
  if (mode === "view") return runInstanceReviewPath(runId, clubId);
  if (mode === "rsvps") return runInstanceRsvpsPath(runId, clubId);
  return runInstanceEditPath(runId, clubId);
}
