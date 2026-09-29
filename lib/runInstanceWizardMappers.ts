import type { CityRunData } from "@/components/runmanage/RunManageStaffEditor";
import {
  emptyWizardValues,
  type RunInstanceWizardValues,
} from "@/components/runmanage/runInstanceWizard/shared";
import { isTrackRun, normalizeRunType, nullRouteFieldsForTrackRun } from "@/lib/runTypes";
import { parseRunTotalMiles } from "@/lib/parse-run-total-miles";

function routeMapFields(run: CityRunData) {
  const route = run.route;
  const stravaMapUrl = route?.stravaMapUrl?.trim() || run.stravaMapUrl || "";
  const mapImageUrl = route?.mapImageUrl?.trim() || run.mapImageUrl || "";
  const routePhotos = Array.isArray(route?.routePhotos)
    ? (route.routePhotos as string[])
    : Array.isArray(run.routePhotos)
      ? (run.routePhotos as string[])
      : [];
  const routeNeighborhood = route?.routeNeighborhood?.trim() || run.routeNeighborhood || "";
  return { stravaMapUrl, mapImageUrl, routePhotos, routeNeighborhood };
}

export function cityRunToWizardValues(run: CityRunData): RunInstanceWizardValues {
  const dateStr = run.date;
  const dateForInput = dateStr ? new Date(dateStr).toISOString().split("T")[0] : "";
  const isTrack = isTrackRun(run.runType);
  const routeFields = routeMapFields(run);

  return {
    title: run.title || "",
    dayOfWeek: run.dayOfWeek || "",
    date: dateForInput,
    startTimeHour: run.startTimeHour?.toString() || "",
    startTimeMinute: run.startTimeMinute?.toString().padStart(2, "0") || "",
    startTimePeriod: run.startTimePeriod || "AM",
    meetUpPoint: run.meetUpPoint || "",
    meetUpStreetAddress: run.meetUpStreetAddress || "",
    meetUpCity: run.meetUpCity || "",
    meetUpState: run.meetUpState || "",
    meetUpZip: run.meetUpZip || "",
    meetUpPlaceId: run.meetUpPlaceId || "",
    meetUpLat: run.meetUpLat != null ? String(run.meetUpLat) : "",
    meetUpLng: run.meetUpLng != null ? String(run.meetUpLng) : "",
    endPointSameAsStart: !run.endPoint || run.endPoint === run.meetUpPoint,
    endPoint: run.endPoint || "",
    endStreetAddress: run.endStreetAddress || "",
    endCity: run.endCity || "",
    endState: run.endState || "",
    routeNeighborhood: routeFields.routeNeighborhood,
    directionsText: run.directionsText || "",
    runType: run.runType || "",
    routeDescription: isTrack ? "" : run.workoutDescription || "",
    trackWorkoutDescription: isTrack ? run.workoutDescription || "" : "",
    totalMiles:
      run.totalMiles?.toString() ||
      (run.route?.distanceMiles != null ? String(run.route.distanceMiles) : ""),
    pace: run.pace || "",
    stravaMapUrl: routeFields.stravaMapUrl,
    mapImageUrl: routeFields.mapImageUrl,
    routePhotos: routeFields.routePhotos,
    description: run.description || "",
    postRunActivity: run.postRunActivity || "",
    staffNotes: run.staffNotes || "",
    stravaEventUrl: run.stravaEventUrl || "",
    stravaText: run.stravaText || "",
    webUrl: run.webUrl || "",
    webText: run.webText || "",
    igPostText: run.igPostText || "",
    workoutId: "",
    plannedWorkoutId: run.plannedWorkoutId || "",
    attachedWorkoutTitle: run.plannedWorkout?.title?.trim() || "",
  };
}

/** Stable JSON for dirty-checking wizard edits against last saved payload. */
export function serializeWizardSnapshot(
  values: RunInstanceWizardValues,
  extras?: {
    runClubWebsiteUrl?: string;
    runClubInstagramUrl?: string;
    runClubStravaUrl?: string;
  }
): string {
  return JSON.stringify(wizardValuesToSavePayload(values, extras));
}

export function wizardValuesToSavePayload(
  values: RunInstanceWizardValues,
  extras?: {
    runClubWebsiteUrl?: string;
    runClubInstagramUrl?: string;
    runClubStravaUrl?: string;
  }
) {
  const dateObj = values.date ? new Date(values.date) : new Date();
  const trackRouteNulls = nullRouteFieldsForTrackRun(values.runType);
  const isTrack = isTrackRun(values.runType);

  return {
    title: values.title.trim(),
    dayOfWeek: values.dayOfWeek?.trim() || null,
    date: dateObj.toISOString(),
    startTimeHour: values.startTimeHour.trim() ? parseInt(values.startTimeHour, 10) : null,
    startTimeMinute: values.startTimeMinute.trim() ? parseInt(values.startTimeMinute, 10) : null,
    startTimePeriod: values.startTimePeriod || null,
    meetUpPoint: values.meetUpPoint.trim(),
    meetUpStreetAddress: values.meetUpStreetAddress.trim() || null,
    meetUpCity: values.meetUpCity.trim() || null,
    meetUpState: values.meetUpState.trim() || null,
    meetUpZip: values.meetUpZip.trim() || null,
    meetUpPlaceId: values.meetUpPlaceId.trim() || null,
    meetUpLat: values.meetUpLat.trim() ? parseFloat(values.meetUpLat) : null,
    meetUpLng: values.meetUpLng.trim() ? parseFloat(values.meetUpLng) : null,
    endPoint: values.endPointSameAsStart ? null : values.endPoint.trim() || null,
    endStreetAddress: values.endPointSameAsStart ? null : values.endStreetAddress.trim() || null,
    endCity: values.endPointSameAsStart ? null : values.endCity.trim() || null,
    endState: values.endPointSameAsStart ? null : values.endState.trim() || null,
    routeNeighborhood: trackRouteNulls ? null : values.routeNeighborhood.trim() || null,
    runType: normalizeRunType(values.runType) || values.runType.trim() || null,
    workoutDescription: isTrack
      ? values.trackWorkoutDescription.trim() || null
      : values.routeDescription.trim() || null,
    directionsText: trackRouteNulls ? null : values.directionsText.trim() || null,
    totalMiles: isTrack ? null : parseRunTotalMiles(values.totalMiles),
    pace: isTrack ? null : values.pace.trim() || null,
    stravaMapUrl: trackRouteNulls ? null : values.stravaMapUrl.trim() || null,
    mapImageUrl: trackRouteNulls ? null : values.mapImageUrl.trim() || null,
    routePhotos: trackRouteNulls
      ? []
      : (values.routePhotos || []).filter((u) => typeof u === "string" && u.trim()),
    description: values.description.trim() || null,
    postRunActivity: values.postRunActivity.trim() || null,
    staffNotes: values.staffNotes.trim() || null,
    stravaEventUrl: values.stravaEventUrl.trim() || null,
    stravaText: values.stravaText.trim() || null,
    webUrl: values.webUrl.trim() || null,
    webText: values.webText.trim() || null,
    igPostText: values.igPostText.trim() || null,
    workoutId: null,
    ...extras,
  };
}

export { emptyWizardValues };
