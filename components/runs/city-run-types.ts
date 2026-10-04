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
  athleteId: string;
  Athlete?: {
    id: string;
    firstName: string;
    lastName: string;
    photoURL: string | null;
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

/** One container or partner on a run, resolved server-side by the association canon. */
export interface CityRunAffiliationEntity {
  id: string | null;
  kind: string;
  label: string;
  name: string | null;
  subtitle: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  href: string | null;
}

export interface CityRunAffiliations {
  cityRunType: string;
  container: CityRunAffiliationEntity | null;
  partners: (CityRunAffiliationEntity & { slot: 'lead' | 'extra' })[];
}

export interface CityRunDetails {
  id: string;
  slug?: string | null;
  title: string;
  citySlug?: string;
  dayOfWeek: string | null;
  date: string;
  runSeriesId?: string | null;
  cityRunType?: string | null;
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
  stravaMapUrl: string | null;
  routePhotos?: string[] | null;
  mapImageUrl?: string | null;
  routeNeighborhood?: string | null;
  runType?: string | null;
  workoutDescription?: string | null;
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
  runStore?: {
    id: string;
    name: string;
    websiteUrl?: string | null;
    logoUrl?: string | null;
  } | null;
  runBrand?: {
    id: string;
    name: string;
    websiteUrl?: string | null;
    logoUrl?: string | null;
  } | null;
  runCrew?: RunCrew | null;
  raceRegistryId?: string | null;
  specialEventId?: string | null;
  affiliations?: CityRunAffiliations | null;
  rsvps?: CityRunRsvp[];
  currentRSVP?: string | null;
  currentRSVPRole?: string | null;
}

export function runHasWorkoutContent(run: {
  plannedWorkoutId?: string | null;
  plannedWorkout?: { id?: string; title?: string | null } | null;
  workoutId?: string | null;
  workout?: CityRunWorkoutSummary | null;
  workoutDescription?: string | null;
}): boolean {
  return (
    Boolean(run.plannedWorkoutId || run.plannedWorkout) ||
    Boolean(run.workoutId || run.workout) ||
    Boolean(run.workout?.workoutNarrative?.trim()) ||
    Boolean(run.workoutDescription?.trim())
  );
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
