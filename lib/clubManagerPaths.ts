/** Club Manager routes — stats dashboard, data manager cue, runs manager, profile wizard, and run hub drill-ins. */

const CLUB_MANAGER_RESERVED_SEGMENTS = new Set([
  "clubs",
  "validation",
  "runs",
  "schedule",
  "next-runs",
  "people",
]);

export const CLUB_MANAGER_PEOPLE_TITLE = "Club People";

export const CLUB_MANAGER_PEOPLE_DESCRIPTION =
  "Build and manage leadership and ops contacts for clubs assigned to you.";

export const BACK_TO_CLUB_MANAGER_PEOPLE = `Back to ${CLUB_MANAGER_PEOPLE_TITLE}`;

/** Assignee-scoped people hub — same UX as founder Club People Management, assigned clubs only. */
export function clubManagerPeopleHubPath(): string {
  return "/dashboard/club-manager/people";
}

export function clubManagerPeoplePath(clubId: string): string {
  return `/dashboard/club-manager/${encodeURIComponent(clubId)}/people`;
}

export function clubManagerPeopleAddPath(clubId: string): string {
  return `${clubManagerPeoplePath(clubId)}/add`;
}

export function clubManagerPeopleAddManualPath(clubId: string): string {
  return `${clubManagerPeopleAddPath(clubId)}/manual`;
}

export function clubManagerPeopleAddCsvPath(clubId: string): string {
  return `${clubManagerPeopleAddPath(clubId)}/csv`;
}

export function clubManagerPeopleAddPastePath(clubId: string): string {
  return `${clubManagerPeopleAddPath(clubId)}/paste`;
}

export function clubManagerPeopleAddAssociatePath(clubId: string): string {
  return `${clubManagerPeopleAddPath(clubId)}/associate`;
}

export function isClubManagerPeopleHubPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === clubManagerPeopleHubPath() ||
    pathname.startsWith(`${clubManagerPeopleHubPath()}?`)
  );
}

export function isClubManagerPeoplePath(pathname: string | null, clubId?: string): boolean {
  if (!pathname) return false;
  const m = pathname.match(/^\/dashboard\/club-manager\/([^/]+)\/people(?:\/|$|\?)/);
  const id = m?.[1] ? decodeURIComponent(m[1]) : null;
  if (!id || CLUB_MANAGER_RESERVED_SEGMENTS.has(id)) return false;
  if (clubId) return id === clubId;
  return true;
}

export function clubManagerDashboardPath(): string {
  return "/dashboard/club-manager";
}

/** Step 1 — assigned club metadata validation (assigned-to-me). */
export function clubManagerValidationPath(): string {
  return "/dashboard/club-manager/validation";
}

/** Step 2 — approved + published clubs ready for series / run instance work. */
export function clubManagerListPath(): string {
  return "/dashboard/club-manager/clubs";
}

export function clubManagerViewerPath(clubId: string): string {
  return `/dashboard/club-manager/${encodeURIComponent(clubId)}`;
}

/** Founder entity edit wizard (admin / acquisition). */
export function clubManagerEntityEditPath(
  clubId: string,
  opts?: { section?: string; editSeries?: string }
): string {
  const base = `/dashboard/entities/manage/runclubs/${encodeURIComponent(clubId)}/edit`;
  const params = new URLSearchParams();
  if (opts?.section?.trim()) params.set("section", opts.section.trim());
  if (opts?.editSeries?.trim()) params.set("editSeries", opts.editSeries.trim());
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Club Manager profile wizard — same editor UX, club-manager navigation. */
export function clubManagerProfilePath(
  clubId: string,
  opts?: { section?: string; editSeries?: string }
): string {
  const base = `/dashboard/club-manager/${encodeURIComponent(clubId)}/profile`;
  const params = new URLSearchParams();
  if (opts?.section?.trim()) params.set("section", opts.section.trim());
  if (opts?.editSeries?.trim()) params.set("editSeries", opts.editSeries.trim());
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function clubManagerHubPath(clubId: string): string {
  return `/dashboard/club-manager/${encodeURIComponent(clubId)}/hub`;
}

export function clubManagerRunsPath(): string {
  return "/dashboard/club-manager/runs";
}

export function clubManagerSchedulePath(): string {
  return "/dashboard/club-manager/schedule";
}

export function clubManagerNextRunsPath(): string {
  return "/dashboard/club-manager/next-runs";
}

const ENTITY_EDIT_RE =
  /^\/dashboard\/entities\/manage\/runclubs\/([^/]+)\/edit(?:\/|$|\?)/;

const CLUB_MANAGER_PROFILE_RE =
  /^\/dashboard\/club-manager\/([^/]+)\/profile(?:\/|$|\?)/;

export function clubIdFromEntityEditPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(ENTITY_EDIT_RE);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

export function clubIdFromClubManagerProfilePath(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(CLUB_MANAGER_PROFILE_RE);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

export function isClubManagerProfilePath(
  pathname: string | null,
  clubId?: string
): boolean {
  const id = clubIdFromClubManagerProfilePath(pathname);
  if (!id) return false;
  if (clubId) return id === clubId;
  return true;
}

/** @deprecated Legacy — club managers should use profile path. Kept for bookmark redirects. */
export function isClubManagerEntityEditPath(
  pathname: string | null,
  clubId?: string
): boolean {
  const id = clubIdFromEntityEditPath(pathname);
  if (!id) return false;
  if (clubId) return id === clubId;
  return true;
}

export function clubIdFromClubManagerRoutes(pathname: string | null): string | null {
  return (
    clubIdFromClubManagerProfilePath(pathname) ??
    clubIdFromClubManagerPath(pathname) ??
    clubIdFromEntityEditPath(pathname) ??
    null
  );
}

/** Club id from `/dashboard/club-manager/[clubId]/…` — excludes reserved segments like `clubs`. */
export function clubIdFromClubManagerPath(pathname: string | null): string | null {
  if (!pathname) return null;
  const m = pathname.match(/^\/dashboard\/club-manager\/([^/]+)(?:\/|$|\?)/);
  const id = m?.[1] ? decodeURIComponent(m[1]) : null;
  if (!id || CLUB_MANAGER_RESERVED_SEGMENTS.has(id)) return null;
  return id;
}

export function isClubManagerDashboardPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === clubManagerDashboardPath() || pathname === `${clubManagerDashboardPath()}/`;
}

export function isClubManagerListPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === clubManagerListPath() || pathname.startsWith(`${clubManagerListPath()}?`);
}

export function isClubManagerValidationPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === clubManagerValidationPath() ||
    pathname.startsWith(`${clubManagerValidationPath()}?`)
  );
}

/** Routes that use the dedicated Club Manager sidebar (not the founder nav). */
export function isClubManagerShellPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname === clubManagerDashboardPath() ||
    pathname.startsWith(`${clubManagerDashboardPath()}/`)
  );
}
