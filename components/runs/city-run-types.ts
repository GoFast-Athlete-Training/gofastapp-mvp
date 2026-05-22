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
  gofastCity: string | null;
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

export interface CityRunDetails {
  id: string;
  slug?: string | null;
  title: string;
  gofastCity?: string;
  dayOfWeek: string | null;
  date: string;
  runSeriesId?: string | null;
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
  runClub?: RunClub | null;
  runCrew?: RunCrew | null;
  rsvps?: CityRunRsvp[];
  currentRSVP?: string | null;
}

export interface PostRunRun {
  id: string;
  title: string;
  date: string;
  meetUpPoint: string;
  meetUpCity: string | null;
  meetUpStreetAddress: string | null;
  totalMiles: number | null;
  pace: string | null;
  stravaMapUrl: string | null;
  routePhotos?: string[] | null;
  mapImageUrl?: string | null;
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
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

export function isRunPast(date: string): boolean {
  const runPlus4h = new Date(new Date(date).getTime() + 4 * 60 * 60 * 1000);
  return runPlus4h < new Date();
}
