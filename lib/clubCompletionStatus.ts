import { seriesIsWhole } from "@/lib/seriesDescriptionAi";
import { isTrackRun } from "@/lib/runTypes";
import { isDcClubLocation } from "@/lib/acqRunSeries";

export type ClubProfileTab = "source-info" | "core-info" | "run-series" | "socials" | "leader";

export type EntityWizardSection =
  | "source-info"
  | "core-info"
  | "membership"
  | "socials"
  | "races"
  | "run-series"
  | "leader";

export type WizardStepVisualStatus =
  | "notStarted"
  | "partial"
  | "needsRequired"
  | "complete";

export type ClubProfileInput = {
  name?: string | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  description?: string | null;
  logo?: string | null;
  membershipType?: string | null;
  instagramHandle?: string | null;
  url?: string | null;
  websiteUrl?: string | null;
  stravaUrl?: string | null;
  runUrl?: string | null;
};

export type SeriesRowInput = {
  meetUpPoint?: string | null;
  meetUpCity?: string | null;
  description?: string | null;
  runType?: string | null;
  routeNeighborhood?: string | null;
};

function filled(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function countFilled(values: Array<string | null | undefined>): number {
  return values.filter(filled).length;
}

/** Gray / amber / red / green for a fixed required field set. */
function statusFromRequiredFields(
  fields: Array<string | null | undefined>
): WizardStepVisualStatus {
  const total = fields.length;
  const filledCount = countFilled(fields);
  if (filledCount === 0) return "notStarted";
  if (filledCount === total) return "complete";
  return "partial";
}

export function clubDetailsTabStatus(club: ClubProfileInput): WizardStepVisualStatus {
  const fields: Array<string | null | undefined> = [
    club.name,
    club.city,
    club.description,
    club.logo,
  ];
  if (!isDcClubLocation(club.city, club.state)) {
    fields.splice(2, 0, club.state);
  }
  return statusFromRequiredFields(fields);
}

/** Source Info tab — source URLs, raw text, membership proof only. */
export function clubSourceInfoTabStatus(club: ClubProfileInput): WizardStepVisualStatus {
  const fields: Array<string | null | undefined> = [
    club.instagramHandle,
    club.stravaUrl,
    club.runUrl,
    club.membershipType === "FREE" || club.membershipType === "PAID"
      ? club.membershipType
      : null,
  ];
  return statusFromRequiredFields(fields);
}

/** Core Info tab — identity, presentation, location, final club description. */
export function clubCoreInfoTabStatus(club: ClubProfileInput): WizardStepVisualStatus {
  const fields: Array<string | null | undefined> = [
    club.name,
    club.city,
    club.description,
    club.logo,
  ];
  if (!isDcClubLocation(club.city, club.state)) {
    fields.splice(2, 0, club.state);
  }
  return statusFromRequiredFields(fields);
}

export function clubSocialsTabStatus(club: ClubProfileInput): WizardStepVisualStatus {
  const hasInstagram = filled(club.instagramHandle);
  const hasUrl = filled(club.url) || filled(club.websiteUrl);
  if (!hasInstagram && !hasUrl) return "notStarted";
  if (hasInstagram || hasUrl) return "complete";
  return "partial";
}

export function clubLeaderTabStatus(leaderCount: number): WizardStepVisualStatus {
  if (leaderCount <= 0) return "needsRequired";
  return "complete";
}

/** Optional section — estimate and activity types. */
export function clubMembershipTabStatus(
  membershipEstimate: string | null | undefined,
  activityTypeCount: number
): WizardStepVisualStatus {
  const hasEstimate = filled(membershipEstimate);
  const hasActivities = activityTypeCount > 0;
  if (!hasEstimate && !hasActivities) return "notStarted";
  if (hasActivities && hasEstimate) return "complete";
  return "partial";
}

/** Optional section — any named race entry is enough for green. */
export function clubRacesTabStatus(
  raceNames: Array<string | null | undefined>
): WizardStepVisualStatus {
  const named = raceNames.filter(filled);
  if (named.length === 0) return "notStarted";
  return "complete";
}

/** Run Series tab: all-series-whole = green; some-whole = amber; none-whole = red if series exist. */
export function clubRunSeriesTabStatus(series: SeriesRowInput[]): WizardStepVisualStatus {
  if (series.length === 0) return "notStarted";
  const wholeCount = series.filter((row) => seriesIsWhole(row)).length;
  if (wholeCount === series.length) return "complete";
  if (wholeCount > 0) return "partial";
  return "needsRequired";
}

/** @deprecated Use clubRunSeriesTabStatus */
export const clubRunsTabStatus = clubRunSeriesTabStatus;

export function entityWizardSectionStatuses(input: {
  club: ClubProfileInput;
  series: SeriesRowInput[];
  leaderCount: number;
  membershipEstimate?: string | null;
  activityTypeCount?: number;
  raceNames?: Array<string | null | undefined>;
}): Record<EntityWizardSection, WizardStepVisualStatus> {
  return {
    "source-info": clubSourceInfoTabStatus(input.club),
    "core-info": clubCoreInfoTabStatus(input.club),
    membership: clubMembershipTabStatus(
      input.membershipEstimate,
      input.activityTypeCount ?? 0
    ),
    socials: clubSocialsTabStatus(input.club),
    races: clubRacesTabStatus(input.raceNames ?? []),
    "run-series": clubRunSeriesTabStatus(input.series),
    leader: clubLeaderTabStatus(input.leaderCount),
  };
}

export function clubProfileTabStatuses(
  club: ClubProfileInput,
  series: SeriesRowInput[],
  leaderCount: number
): Record<ClubProfileTab, WizardStepVisualStatus> {
  return {
    "source-info": clubSourceInfoTabStatus(club),
    "core-info": clubCoreInfoTabStatus(club),
    "run-series": clubRunSeriesTabStatus(series),
    socials: clubSocialsTabStatus(club),
    leader: clubLeaderTabStatus(leaderCount),
  };
}

/** Club Viewer profile card — source info tab drives the headline status. */
export function clubProfileCardStatus(club: ClubProfileInput): WizardStepVisualStatus {
  return clubSourceInfoTabStatus(club);
}

export function seriesRowStatus(row: SeriesRowInput): WizardStepVisualStatus {
  return seriesIsWhole(row) ? "complete" : "needsRequired";
}

export function clubDetailsSummary(club: ClubProfileInput): string {
  return [club.name, club.city, club.description]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(" · ");
}

export function isClubProfileReadyForHub(
  club: ClubProfileInput,
  series: SeriesRowInput[]
): boolean {
  const tabs = clubProfileTabStatuses(club, series, 1);
  return tabs["source-info"] === "complete" && tabs["core-info"] === "complete" && tabs["run-series"] === "complete";
}

export function wizardStepStatusLabel(status: WizardStepVisualStatus): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "partial":
      return "Partial";
    case "needsRequired":
      return "Incomplete";
    case "notStarted":
      return "Not started";
  }
}

const PROFILE_FIELD_LABELS: Record<string, string> = {
  name: "name",
  city: "city",
  state: "state",
  description: "description",
  logo: "logo",
};

export function getMissingProfileFields(club: ClubProfileInput): string[] {
  const missing: string[] = [];
  if (!filled(club.name)) missing.push(PROFILE_FIELD_LABELS.name);
  if (!filled(club.city)) missing.push(PROFILE_FIELD_LABELS.city);
  if (!isDcClubLocation(club.city, club.state) && !filled(club.state)) {
    missing.push(PROFILE_FIELD_LABELS.state);
  }
  if (!filled(club.description)) missing.push(PROFILE_FIELD_LABELS.description);
  if (!filled(club.logo)) missing.push(PROFILE_FIELD_LABELS.logo);
  return missing;
}

export function getMissingSeriesFields(row: SeriesRowInput): string[] {
  const missing: string[] = [];
  if (!filled(row.meetUpPoint)) missing.push("meet-up place");
  if (!filled(row.description)) missing.push("description");
  return missing;
}

/** Optional enrichment — not required for create or build. */
export function getOptionalSeriesHints(row: SeriesRowInput): string[] {
  const hints: string[] = [];
  if (!filled(row.runType)) hints.push("run type");
  if (row.runType?.trim() && !isTrackRun(row.runType) && !filled(row.routeNeighborhood)) {
    hints.push("route area");
  }
  return hints;
}

export function getMissingSeriesCount(series: SeriesRowInput[]): {
  wholeCount: number;
  total: number;
  incompleteRows: Array<{ index: number; missing: string[] }>;
} {
  const incompleteRows: Array<{ index: number; missing: string[] }> = [];
  let wholeCount = 0;
  series.forEach((row, index) => {
    if (seriesIsWhole(row)) {
      wholeCount += 1;
    } else {
      incompleteRows.push({ index, missing: getMissingSeriesFields(row) });
    }
  });
  return { wholeCount, total: series.length, incompleteRows };
}

export function formatMissingList(missing: string[]): string {
  if (missing.length === 0) return "";
  return missing.join(", ");
}
