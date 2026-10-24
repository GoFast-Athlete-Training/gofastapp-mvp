import { formatCalendarDate } from '@/lib/calendar-date';
import { isCityRunPast } from '@/lib/city-run-clock';

export interface RunClub {
  slug: string;
  name: string;
  logoUrl: string | null;
  city: string | null;
}

export interface RunCrew {
  id: string;
  name: string;
  logo: string | null;
  handle: string;
}

export interface RunSeries {
  id: string;
  name: string | null;
  dayOfWeek: string;
  description: string | null;
  meetUpPoint: string | null;
  meetUpStreetAddress: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  citySlug: string | null;
}

export interface CityRunRsvp {
  id: string;
  status: string;
  role?: string | null;
  athleteId: string;
  Athlete?: {
    id: string;
    firstName: string;
    lastName: string;
    photoURL: string | null;
    gofastHandle?: string | null;
  };
}

export interface CityRunMessage {
  id: string;
  content: string;
  topic: string;
  createdAt: string;
  athleteId: string;
  Athlete?: {
    id: string;
    firstName: string;
    lastName: string;
    photoURL: string | null;
    gofastHandle?: string | null;
  };
}

export interface CityRunCheckin {
  id: string;
  runId: string;
  athleteId: string;
  checkedInAt: string;
  runPhotoUrl: string | null;
  runShouts: string | null;
  Athlete?: {
    id: string;
    firstName: string;
    lastName: string;
    photoURL: string | null;
  };
}

export interface CityRunWorkoutSegment {
  id: string;
  stepOrder: number;
  title: string;
  durationType: string;
  durationValue: number;
  repeatCount?: number | null;
  targets?: unknown;
  paceTargetEncodingVersion?: number | null;
}

export interface CityRunWorkoutSummary {
  id: string;
  title: string;
  workoutType: string | null;
  description: string | null;
  workoutNarrative?: string | null;
  scope?: string | null;
  segments?: CityRunWorkoutSegment[];
}

export interface CityRunDetails {
  id: string;
  slug?: string | null;
  title: string;
  citySlug?: string;
  metroBadge?: string | null;
  dayOfWeek: string | null;
  date: string;
  runSeriesId?: string | null;
  cityRunType?: string | null;
  athleteGeneratedId?: string | null;
  runSeries?: RunSeries | null;
  meetUpPoint: string;
  meetUpStreetAddress: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  meetUpLat: number | null;
  meetUpLng: number | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  timezone?: string | null;
  totalMiles: number | null;
  pace: string | null;
  description: string | null;
  registrationRequired?: boolean | null;
  registrationUrl?: string | null;
  stravaMapUrl: string | null;
  routePhotos?: string[] | null;
  runPhotos?: string[] | null;
  mapImageUrl?: string | null;
  profileEmoji?: string | null;
  coverPhotoUrl?: string | null;
  hostPhotoUrl?: string | null;
  routeNeighborhood?: string | null;
  runType?: string | null;
  workoutDescription?: string | null;
  directionsText?: string | null;
  routeId?: string | null;
  route?: {
    id: string;
    name: string;
    routeDescription?: string | null;
    stravaUrl?: string | null;
    stravaMapUrl?: string | null;
    mapImageUrl?: string | null;
  } | null;
  meetUpNote?: string | null;
  workoutId?: string | null;
  plannedWorkoutId?: string | null;
  plannedWorkout?: {
    id: string;
    title?: string | null;
    workoutType?: string | null;
    segments?: CityRunWorkoutSegment[];
  } | null;
  workout?: CityRunWorkoutSummary | null;
  runClub?: RunClub | null;
  clubAssociation?: {
    runClubId: string;
    nameSnapshot: string;
    logoUrlSnapshot: string | null;
  } | null;
  runStore?: {
    id: string;
    name: string;
    websiteUrl?: string | null;
    logoUrl?: string | null;
  } | null;
  runBrandId?: string | null;
  runBrandName?: string | null;
  runBrandLogoUrl?: string | null;
  runBrandWebsiteUrl?: string | null;
  runBrandInstagramHandle?: string | null;
  runBrand?: {
    id: string;
    name: string;
    websiteUrl?: string | null;
    instagramHandle?: string | null;
    logoUrl?: string | null;
  } | null;
  organizerType?: string | null;
  organizerName?: string | null;
  shakeoutClubName?: string | null;
  shakeoutSponsorName?: string | null;
  runCrew?: RunCrew | null;
  rsvps?: CityRunRsvp[];
  currentRSVP?: string | null;
  currentRSVPRole?: string | null;
}

/** Route prose (staff route description / attached route) — not a training prescribe. */
export function runHasRouteDescription(run: { workoutDescription?: string | null }): boolean {
  return Boolean(run.workoutDescription?.trim());
}

/**
 * Show the training prescribe card (segments, planned workout) — not host-a-run plumbing.
 * `workoutDescription` alone is route copy on the details card, not a workout block.
 */
export function runShouldShowWorkoutPrescribe(run: {
  cityRunType?: string | null;
  runClubId?: string | null;
  runCrewId?: string | null;
  plannedWorkoutId?: string | null;
  plannedWorkout?: { id?: string; title?: string | null; segments?: unknown[] } | null;
  workoutId?: string | null;
  workout?: CityRunWorkoutSummary | null;
}): boolean {
  const meetupOnly =
    run.cityRunType === 'INDIVIDUAL' || (!run.runClubId && !run.runCrewId);
  if (meetupOnly) {
    return Boolean(run.workoutId && (run.workout || run.plannedWorkoutId));
  }
  if (run.plannedWorkoutId || run.plannedWorkout?.segments?.length) return true;
  if (run.workout?.workoutNarrative?.trim()) return true;
  return Boolean(run.workoutId || run.workout);
}

/** @deprecated Prefer runShouldShowWorkoutPrescribe for UI; route text uses runHasRouteDescription. */
export function runHasWorkoutContent(run: {
  plannedWorkoutId?: string | null;
  plannedWorkout?: { id?: string; title?: string | null } | null;
  workoutId?: string | null;
  workout?: CityRunWorkoutSummary | null;
  workoutDescription?: string | null;
}): boolean {
  return runShouldShowWorkoutPrescribe(run) || runHasRouteDescription(run);
}

export interface PostRunRun {
  id: string;
  title: string;
  date: string;
  cityRunType?: string | null;
  runClub?: { name: string; logoUrl: string | null } | null;
}

export function formatRunTime(
  startTimeHour: number | null,
  startTimeMinute: number | null,
  startTimePeriod: string | null
): string | null {
  if (startTimeHour === null || startTimeMinute === null) return null;
  const min = String(startTimeMinute).padStart(2, '0');
  return `${startTimeHour}:${min} ${startTimePeriod || 'AM'}`;
}

export function formatRunDate(d: string, includeYear = true): string {
  return formatCalendarDate(d, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

export function isRunPast(
  date: string,
  clock?: {
    startTimeHour?: number | null;
    startTimeMinute?: number | null;
    startTimePeriod?: string | null;
    timezone?: string | null;
  }
): boolean {
  return isCityRunPast({
    date,
    startTimeHour: clock?.startTimeHour,
    startTimeMinute: clock?.startTimeMinute,
    startTimePeriod: clock?.startTimePeriod,
    timezone: clock?.timezone,
  });
}
