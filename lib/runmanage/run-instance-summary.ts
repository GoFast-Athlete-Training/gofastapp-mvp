/** Minimal run instance shape for staff toolbar / lifecycle (prod city_runs). */
export type RunInstanceSummary = {
  id: string;
  title: string;
  date: string;
  published: boolean;
  workflowStatus: string;
  runSeriesId: string | null;
  meetUpPoint?: string | null;
  meetUpCity?: string | null;
  meetUpState?: string | null;
  startTimeHour?: number | null;
  startTimeMinute?: number | null;
  startTimePeriod?: string | null;
  totalMiles?: number | null;
  stravaMapUrl?: string | null;
  mapImageUrl?: string | null;
  routePhotos?: string[] | null;
  directionsText?: string | null;
  routeNeighborhood?: string | null;
  runType?: string | null;
  description?: string | null;
  workoutDescription?: string | null;
  rsvpCount?: number;
};
