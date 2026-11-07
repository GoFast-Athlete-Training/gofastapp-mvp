import { titleForAdvancedDate } from "@/lib/advance-club-instances";
import type { CityRunData } from "@/components/runmanage/RunManageStaffEditor";
import { cityRunToWizardValues } from "@/lib/runInstanceWizardMappers";
import type { RunInstanceWizardValues, SeriesBaseline } from "@/components/runmanage/runInstanceWizard/shared";
import { emptyWizardValues } from "@/components/runmanage/runInstanceWizard/shared";
import { nextYmdForDayOfWeek } from "@/lib/runmanage/series-operational-list";

export type SeriesWizardSeedSource = {
  id: string;
  dayOfWeek: string;
  name: string | null;
  description: string | null;
  meetUpPoint: string | null;
  meetUpStreetAddress: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  meetUpPlaceId: string | null;
  meetUpLat: number | null;
  meetUpLng: number | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  totalMiles: number | null;
  postRunActivity: string | null;
  runType: string | null;
  routeNeighborhood: string | null;
  workoutDescription: string | null;
  runClub?: { name: string | null } | null;
};

export function seriesBaselineFromRow(s: SeriesWizardSeedSource): SeriesBaseline {
  return {
    meetUpPoint: s.meetUpPoint?.trim() ?? "",
    meetUpStreetAddress: s.meetUpStreetAddress?.trim() ?? "",
    meetUpCity: s.meetUpCity?.trim() ?? "",
    meetUpState: s.meetUpState?.trim() ?? "",
    startTimeHour: s.startTimeHour != null ? String(s.startTimeHour) : "",
    startTimeMinute: s.startTimeMinute != null ? String(s.startTimeMinute) : "",
    startTimePeriod: s.startTimePeriod?.trim() ?? "AM",
    totalMiles: s.totalMiles != null ? String(s.totalMiles) : "",
    postRunActivity: s.postRunActivity?.trim() ?? "",
    runType: s.runType?.trim() ?? "",
  };
}

export function wizardValuesFromSeries(
  s: SeriesWizardSeedSource,
  opts?: { suggestedDateYmd?: string | null; priorTitle?: string | null }
): RunInstanceWizardValues {
  const baseline = seriesBaselineFromRow(s);
  const dateYmd =
    opts?.suggestedDateYmd?.trim() ||
    nextYmdForDayOfWeek(s.dayOfWeek) ||
    emptyWizardValues().date;

  const dayLabel = s.dayOfWeek.charAt(0) + s.dayOfWeek.slice(1).toLowerCase();
  const baseTitle =
    s.name?.trim() ||
    (s.runClub?.name ? `${s.runClub.name} ${dayLabel} Run` : `${dayLabel} Run`);
  const title = opts?.priorTitle
    ? titleForAdvancedDate(opts.priorTitle, dateYmd)
    : `${baseTitle} (${dateYmd.slice(5, 7)}/${dateYmd.slice(8, 10)})`;

  return {
    ...emptyWizardValues(dateYmd),
    title,
    dayOfWeek: s.dayOfWeek,
    date: dateYmd,
    startTimeHour: baseline.startTimeHour,
    startTimeMinute: baseline.startTimeMinute,
    startTimePeriod: baseline.startTimePeriod || "AM",
    meetUpPoint: baseline.meetUpPoint,
    meetUpStreetAddress: baseline.meetUpStreetAddress,
    meetUpCity: baseline.meetUpCity,
    meetUpState: baseline.meetUpState,
    meetUpPlaceId: s.meetUpPlaceId?.trim() ?? "",
    meetUpLat: s.meetUpLat != null ? String(s.meetUpLat) : "",
    meetUpLng: s.meetUpLng != null ? String(s.meetUpLng) : "",
    routeNeighborhood: s.routeNeighborhood?.trim() ?? "",
    runType: baseline.runType,
    totalMiles: baseline.totalMiles,
    postRunActivity: baseline.postRunActivity,
    routeDescription: s.workoutDescription?.trim() ?? "",
    description: s.description?.trim() ?? "",
  };
}

/** Last-run seed for create wizard: time and meet-up only (no route or workout). */
export function wizardValuesWithPriorRun(
  base: RunInstanceWizardValues,
  priorRun: CityRunData
): RunInstanceWizardValues {
  const prior = cityRunToWizardValues(priorRun);
  return {
    ...base,
    startTimeHour: prior.startTimeHour || base.startTimeHour,
    startTimeMinute: prior.startTimeMinute || base.startTimeMinute,
    startTimePeriod: prior.startTimePeriod || base.startTimePeriod,
    meetUpPoint: prior.meetUpPoint || base.meetUpPoint,
    meetUpStreetAddress: prior.meetUpStreetAddress || base.meetUpStreetAddress,
    meetUpCity: prior.meetUpCity || base.meetUpCity,
    meetUpState: prior.meetUpState || base.meetUpState,
    meetUpPlaceId: prior.meetUpPlaceId || base.meetUpPlaceId,
    meetUpLat: prior.meetUpLat || base.meetUpLat,
    meetUpLng: prior.meetUpLng || base.meetUpLng,
    totalMiles: prior.totalMiles || base.totalMiles,
    pace: prior.pace || base.pace,
    postRunActivity: prior.postRunActivity || base.postRunActivity,
    description: prior.description || base.description,
    routeNeighborhood: prior.routeNeighborhood || base.routeNeighborhood,
    runType: prior.runType || base.runType,
  };
}

/** Weekly copy fields after create — sources text only; no route or workout attach. */
export function mergeOptionalAssociationsFromPrior(
  base: RunInstanceWizardValues,
  prior: RunInstanceWizardValues
): RunInstanceWizardValues {
  return {
    ...base,
    stravaText: prior.stravaText || base.stravaText,
    webUrl: prior.webUrl || base.webUrl,
    webText: prior.webText || base.webText,
    igPostText: prior.igPostText || base.igPostText,
  };
}
