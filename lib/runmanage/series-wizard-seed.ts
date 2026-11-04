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

/** Copy last run’s instance fields onto a new dated slot; keep title and date from the series seed. */
export function wizardValuesWithPriorRun(
  base: RunInstanceWizardValues,
  priorRun: CityRunData
): RunInstanceWizardValues {
  const prior = cityRunToWizardValues(priorRun);
  return {
    ...prior,
    title: base.title,
    date: base.date,
    dayOfWeek: base.dayOfWeek,
  };
}

/** Route, weekly sources, and workout — applied after the dated run exists (edit wizard). */
export function mergeOptionalAssociationsFromPrior(
  base: RunInstanceWizardValues,
  prior: RunInstanceWizardValues
): RunInstanceWizardValues {
  return {
    ...base,
    routeId: prior.routeId,
    linkedRouteName: prior.linkedRouteName,
    directionsText: prior.directionsText,
    stravaMapUrl: prior.stravaMapUrl,
    mapImageUrl: prior.mapImageUrl,
    routePhotos: prior.routePhotos,
    stravaEventUrl: prior.stravaEventUrl,
    stravaText: prior.stravaText,
    webUrl: prior.webUrl,
    webText: prior.webText,
    igPostText: prior.igPostText,
    plannedWorkoutId: prior.plannedWorkoutId,
    attachedWorkoutTitle: prior.attachedWorkoutTitle,
    clubWorkoutType: prior.clubWorkoutType,
    trackWorkoutDescription: prior.trackWorkoutDescription,
    routeDescription: prior.routeDescription,
  };
}
