import type { RunInstanceWizardValues } from "@/components/runmanage/runInstanceWizard/shared";
import { generateCitySlugFromParts } from "@/lib/parse-google-address";

export type AthleteHostedInviteDetail = {
  id: string;
  title: string;
  date: string;
  meetUpPoint: string;
  meetUpStreetAddress: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  meetUpZip: string | null;
  meetUpPlaceId: string | null;
  meetUpLat: number | null;
  meetUpLng: number | null;
  description: string | null;
  routeId: string | null;
  stravaMapUrl: string | null;
  mapImageUrl: string | null;
  routeNeighborhood: string | null;
  workoutDescription: string | null;
  profileEmoji: string | null;
  coverPhotoUrl: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  totalMiles: number | null;
  pace: string | null;
  plannedWorkoutId: string | null;
  workoutId: string | null;
  route: { id: string; name: string | null } | null;
};

export type MeetupTemplateSeed = {
  title?: string;
  description?: string | null;
  meetUpPoint?: string;
  meetUpStreetAddress?: string | null;
  meetUpCity?: string | null;
  meetUpState?: string | null;
  meetUpZip?: string | null;
  meetUpPlaceId?: string | null;
  meetUpLat?: number | null;
  meetUpLng?: number | null;
  totalMiles?: number | null;
  pace?: string | null;
  startTimeHour?: number | null;
  startTimeMinute?: number | null;
  startTimePeriod?: string | null;
  profileEmoji?: string | null;
  coverPhotoUrl?: string | null;
};

function dateInputFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function wizardValuesFromHostedInvite(
  inv: AthleteHostedInviteDetail,
  base: RunInstanceWizardValues,
): RunInstanceWizardValues {
  return {
    ...base,
    title: inv.title?.trim() || "",
    date: dateInputFromIso(inv.date),
    startTimeHour: inv.startTimeHour != null ? String(inv.startTimeHour) : "",
    startTimeMinute:
      inv.startTimeMinute != null ? String(inv.startTimeMinute).padStart(2, "0") : "",
    startTimePeriod: inv.startTimePeriod?.trim() || "AM",
    meetUpPoint: inv.meetUpPoint?.trim() || "",
    meetUpStreetAddress: inv.meetUpStreetAddress?.trim() || "",
    meetUpCity: inv.meetUpCity?.trim() || "",
    meetUpState: inv.meetUpState?.trim() || "",
    meetUpZip: inv.meetUpZip?.trim() || "",
    meetUpPlaceId: inv.meetUpPlaceId?.trim() || "",
    meetUpLat: inv.meetUpLat != null ? String(inv.meetUpLat) : "",
    meetUpLng: inv.meetUpLng != null ? String(inv.meetUpLng) : "",
    totalMiles: inv.totalMiles != null ? String(inv.totalMiles) : "",
    pace: inv.pace?.trim() || "",
    description: inv.description?.trim() || "",
    routeId: inv.routeId?.trim() || inv.route?.id?.trim() || "",
    linkedRouteName: inv.route?.name?.trim() || "",
    stravaMapUrl: inv.stravaMapUrl?.trim() || "",
    mapImageUrl: inv.mapImageUrl?.trim() || "",
    routeNeighborhood: inv.routeNeighborhood?.trim() || "",
    routeDescription: inv.workoutDescription?.trim() || "",
    plannedWorkoutId: inv.plannedWorkoutId?.trim() || "",
    workoutId: inv.workoutId?.trim() || "",
  };
}

export function wizardValuesFromMeetupTemplate(
  template: MeetupTemplateSeed,
  base: RunInstanceWizardValues,
): RunInstanceWizardValues {
  return {
    ...base,
    title: template.title?.trim() || "",
    description: template.description?.trim() || "",
    meetUpPoint: template.meetUpPoint?.trim() || "",
    meetUpStreetAddress: template.meetUpStreetAddress?.trim() || "",
    meetUpCity: template.meetUpCity?.trim() || "",
    meetUpState: template.meetUpState?.trim() || "",
    meetUpZip: template.meetUpZip?.trim() || "",
    meetUpPlaceId: template.meetUpPlaceId?.trim() || "",
    meetUpLat: template.meetUpLat != null ? String(template.meetUpLat) : "",
    meetUpLng: template.meetUpLng != null ? String(template.meetUpLng) : "",
    totalMiles: template.totalMiles != null ? String(template.totalMiles) : "",
    pace: template.pace?.trim() || "",
    startTimeHour: template.startTimeHour != null ? String(template.startTimeHour) : "",
    startTimeMinute:
      template.startTimeMinute != null ? String(template.startTimeMinute).padStart(2, "0") : "",
    startTimePeriod: template.startTimePeriod?.trim() || "AM",
  };
}

export function parseWizardStartTime(values: RunInstanceWizardValues): {
  hourNum: number;
  minuteNum: number;
  period: "AM" | "PM";
} | null {
  const h = parseInt(values.startTimeHour, 10);
  const m = parseInt(values.startTimeMinute, 10);
  const p = values.startTimePeriod.trim().toUpperCase();
  if (
    !Number.isFinite(h) ||
    h < 1 ||
    h > 12 ||
    !Number.isFinite(m) ||
    m < 0 ||
    m > 59 ||
    (p !== "AM" && p !== "PM")
  ) {
    return null;
  }
  return { hourNum: h, minuteNum: m, period: p as "AM" | "PM" };
}

export function buildFromWorkoutCreateBody(
  values: RunInstanceWizardValues,
  opts: {
    profileEmoji: string;
    coverPhotoUrl: string;
    plannedWorkoutId?: string | null;
    workoutId?: string | null;
    routeId?: string | null;
  },
): Record<string, unknown> | { error: string } {
  if (!values.title.trim()) return { error: "Add a title." };
  if (!values.meetUpPoint.trim() || !values.meetUpCity.trim()) {
    return { error: "Choose a meetup spot from search." };
  }
  if (!values.date.trim()) return { error: "Pick a date." };
  const time = parseWizardStartTime(values);
  if (!time) return { error: "Add a valid start time." };

  const citySlug = generateCitySlugFromParts(values.meetUpCity, values.meetUpState);
  if (!citySlug) return { error: "We need a valid city for listings." };

  const milesNum = parseFloat(values.totalMiles);
  const lat = values.meetUpLat.trim() ? Number(values.meetUpLat) : undefined;
  const lng = values.meetUpLng.trim() ? Number(values.meetUpLng) : undefined;

  return {
    title: values.title.trim(),
    citySlug,
    cityName: values.meetUpCity.trim(),
    state: values.meetUpState.trim() || undefined,
    date: values.date.trim(),
    meetUpPoint: values.meetUpPoint.trim(),
    meetUpStreetAddress: values.meetUpStreetAddress.trim() || values.meetUpPoint.trim(),
    meetUpCity: values.meetUpCity.trim(),
    meetUpState: values.meetUpState.trim() || undefined,
    meetUpZip: values.meetUpZip.trim() || undefined,
    meetUpPlaceId: values.meetUpPlaceId.trim() || undefined,
    meetUpLat: Number.isFinite(lat) ? lat : undefined,
    meetUpLng: Number.isFinite(lng) ? lng : undefined,
    description: values.description.trim() || undefined,
    workoutDescription: values.routeDescription.trim() || undefined,
    pace: values.pace.trim() || undefined,
    totalMiles: Number.isFinite(milesNum) && milesNum > 0 ? milesNum : undefined,
    startTimeHour: time.hourNum,
    startTimeMinute: time.minuteNum,
    startTimePeriod: time.period,
    plannedWorkoutId:
      (opts.plannedWorkoutId ?? values.plannedWorkoutId.trim()) || undefined,
    workoutId: (opts.workoutId ?? values.workoutId.trim()) || undefined,
    routeId: (opts.routeId ?? values.routeId.trim()) || undefined,
    profileEmoji: opts.profileEmoji.trim() || undefined,
    coverPhotoUrl: opts.coverPhotoUrl.trim() || undefined,
    stravaMapUrl: values.stravaMapUrl.trim() || undefined,
    mapImageUrl: values.mapImageUrl.trim() || undefined,
    directionsText: values.directionsText.trim() || undefined,
  };
}

export function buildHostedInvitePatchBody(
  values: RunInstanceWizardValues,
  profileEmoji: string,
  coverPhotoUrl: string,
): Record<string, unknown> | { error: string } {
  if (!values.title.trim()) return { error: "Add a title." };
  if (!values.meetUpPoint.trim()) return { error: "Meet-up is required." };
  if (!values.date.trim()) return { error: "Pick a date." };
  const time = parseWizardStartTime(values);
  if (!time) return { error: "Add a valid start time." };

  const milesNum = parseFloat(values.totalMiles);
  const lat = values.meetUpLat.trim() ? Number(values.meetUpLat) : null;
  const lng = values.meetUpLng.trim() ? Number(values.meetUpLng) : null;

  return {
    title: values.title.trim(),
    date: values.date.trim(),
    meetUpPoint: values.meetUpPoint.trim(),
    meetUpStreetAddress: values.meetUpStreetAddress.trim() || values.meetUpPoint.trim(),
    meetUpCity: values.meetUpCity.trim(),
    meetUpState: values.meetUpState.trim() || undefined,
    meetUpZip: values.meetUpZip.trim() || undefined,
    meetUpPlaceId: values.meetUpPlaceId.trim() || null,
    meetUpLat: Number.isFinite(lat) ? lat : null,
    meetUpLng: Number.isFinite(lng) ? lng : null,
    description: values.description.trim() || null,
    workoutDescription: values.routeDescription.trim() || null,
    directionsText: values.directionsText.trim() || null,
    stravaMapUrl: values.stravaMapUrl.trim() || null,
    mapImageUrl: values.mapImageUrl.trim() || null,
    pace: values.pace.trim() || null,
    totalMiles: Number.isFinite(milesNum) && milesNum > 0 ? milesNum : null,
    startTimeHour: time.hourNum,
    startTimeMinute: time.minuteNum,
    startTimePeriod: time.period,
    profileEmoji: profileEmoji.trim() || null,
    coverPhotoUrl: coverPhotoUrl.trim() || null,
  };
}
