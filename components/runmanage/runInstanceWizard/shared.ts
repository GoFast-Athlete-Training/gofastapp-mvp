import type { RunInstanceContext, RunSeriesContext } from "@/lib/runInstanceContent";
import type { GroupWorkoutSegment } from "@/lib/group-workout-segment-editor";

export type WizardStep =
  | "intake"
  | "host"
  | "sources"
  | "core"
  | "description"
  | "route"
  | "workout";

export type CoreEditKey =
  | "title"
  | "datetime"
  | "meetup"
  | "finish"
  | "milesPace"
  | "postRun"
  | "venue"
  | "dayOfWeek"
  | null;

export const WIZARD_STEP_ORDER: WizardStep[] = ["sources", "core", "description", "route", "workout"];

/** Create-from-scratch: intake → host → open core → sources → description → route (always) → workout */
export const CREATE_SCRATCH_WIZARD_STEP_ORDER: WizardStep[] = [
  "intake",
  "host",
  "core",
  "sources",
  "description",
  "route",
  "workout",
];

export function wizardStepOrderForVariant(
  variant: RunInstanceWizardContext["variant"]
): WizardStep[] {
  return variant === "create-scratch" ? CREATE_SCRATCH_WIZARD_STEP_ORDER : WIZARD_STEP_ORDER;
}

export const WIZARD_STEPS: { id: WizardStep; title: string; description: string }[] = [
  {
    id: "intake",
    title: "Intake",
    description: "Manual entry, AI paste, or CSV",
  },
  {
    id: "host",
    title: "Host",
    description: "Who is hosting this run",
  },
  {
    id: "sources",
    title: "Source info",
    description: "Strava event, web listing, IG post for this run",
  },
  { id: "core", title: "Core details", description: "Confirm date, meet-up, miles, pace" },
  {
    id: "description",
    title: "Description",
    description: "Draft public copy — regenerate after route is firm",
  },
  { id: "route", title: "Route", description: "Map, directions, route description" },
  {
    id: "workout",
    title: "Workout",
    description: "Optional structured session — intervals, tempo, hills",
  },
];

export type RunInstanceWizardValues = {
  title: string;
  dayOfWeek: string;
  date: string;
  startTimeHour: string;
  startTimeMinute: string;
  startTimePeriod: string;
  meetUpPoint: string;
  meetUpStreetAddress: string;
  meetUpCity: string;
  meetUpState: string;
  meetUpZip: string;
  meetUpPlaceId: string;
  meetUpLat: string;
  meetUpLng: string;
  endPointSameAsStart: boolean;
  endPoint: string;
  endStreetAddress: string;
  endCity: string;
  endState: string;
  routeNeighborhood: string;
  /** Pasted route directions — persisted on city_runs, copies forward on series advance. */
  directionsText: string;
  runType: string;
  /** Route description persisted as workoutDescription on save. */
  routeDescription: string;
  totalMiles: string;
  pace: string;
  stravaMapUrl: string;
  mapImageUrl: string;
  routePhotos: string[];
  description: string;
  postRunActivity: string;
  staffNotes: string;
  stravaEventUrl: string;
  stravaText: string;
  /** Optional AI description sources — not shown on public page. */
  webUrl: string;
  webText: string;
  igPostText: string;
  /** Track workout text (track runs only). */
  trackWorkoutDescription: string;
  /** Linked Product planned workout id (optional scheduled-run prescription). */
  plannedWorkoutId: string;
  /** @deprecated join-my-workout only — scheduled runs use plannedWorkoutId */
  workoutId: string;
  /** Display title for attached workout. */
  attachedWorkoutTitle: string;
};

export type SeriesBaseline = {
  meetUpPoint: string;
  meetUpStreetAddress: string;
  meetUpCity: string;
  meetUpState: string;
  startTimeHour: string;
  startTimeMinute: string;
  startTimePeriod: string;
  totalMiles: string;
  postRunActivity: string;
  runType: string;
};

export type RunInstanceWizardContext = {
  variant: "edit" | "create-scratch" | "create-series";
  /** Product city_runs.id — required to attach planned workout on edit. */
  cityRunId?: string | null;
  isSeriesInstance?: boolean;
  dayOfWeek?: string | null;
  clubName?: string | null;
  clubId?: string | null;
  seriesContext?: RunSeriesContext | null;
  seriesBaseline?: SeriesBaseline | null;
  /** When set, date must match this weekday (series seed). */
  requireSeriesDay?: string | null;
  defaultTitle?: string | null;
  /** Hydrate structured workout editor on edit. */
  plannedWorkoutSegments?: GroupWorkoutSegment[] | null;
  plannedWorkoutTitle?: string | null;
  plannedWorkoutType?: string | null;
};

export function formatInstanceDateLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatStartTimeLabel(hour: string, minute: string, period: string): string {
  if (!hour.trim()) return "—";
  const min = minute.trim() ? minute.padStart(2, "0") : "00";
  return `${hour}:${min} ${period || "AM"}`;
}

export function fieldChanged(current: string, baseline: string | undefined): boolean {
  return current.trim() !== (baseline ?? "").trim();
}

export function buildInstanceContextFromValues(
  values: RunInstanceWizardValues
): RunInstanceContext {
  return {
    dateYmd: values.date.trim() || null,
    meetUpPoint: values.meetUpPoint.trim() || null,
    endPoint: values.endPointSameAsStart ? null : values.endPoint.trim() || null,
    totalMiles: values.totalMiles.trim() || null,
    pace: values.pace.trim() || null,
    postRunActivity: values.postRunActivity.trim() || null,
    routeNotes: values.routeDescription.trim() || null,
    routeNeighborhood: values.routeNeighborhood.trim() || null,
    directionsText: values.directionsText.trim() || null,
    mapImageUrl: values.mapImageUrl.trim() || null,
    stravaEventUrl: values.stravaEventUrl.trim() || null,
    stravaText: values.stravaText.trim() || null,
    existingDescription: values.description.trim() || null,
  };
}

export type { RunClubPublicSources } from "./RunClubPublicSourcesCard";

export function emptyWizardValues(defaultDate?: string): RunInstanceWizardValues {
  return {
    title: "",
    dayOfWeek: "",
    date: defaultDate ?? new Date().toISOString().slice(0, 10),
    startTimeHour: "",
    startTimeMinute: "",
    startTimePeriod: "AM",
    meetUpPoint: "",
    meetUpStreetAddress: "",
    meetUpCity: "",
    meetUpState: "",
    meetUpZip: "",
    meetUpPlaceId: "",
    meetUpLat: "",
    meetUpLng: "",
    endPointSameAsStart: true,
    endPoint: "",
    endStreetAddress: "",
    endCity: "",
    endState: "",
    routeNeighborhood: "",
    directionsText: "",
    runType: "",
    routeDescription: "",
    totalMiles: "",
    pace: "",
    stravaMapUrl: "",
    mapImageUrl: "",
    routePhotos: [],
    description: "",
    postRunActivity: "",
    staffNotes: "",
    stravaEventUrl: "",
    stravaText: "",
    webUrl: "",
    webText: "",
    igPostText: "",
    trackWorkoutDescription: "",
    plannedWorkoutId: "",
    workoutId: "",
    attachedWorkoutTitle: "",
  };
}
