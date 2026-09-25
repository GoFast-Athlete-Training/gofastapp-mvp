import type { city_runs, run_clubs } from "@prisma/client";

export function generateCityRunId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

export function utcTo12h(d: Date): { hour: number; minute: number; period: string } {
  const h24 = d.getUTCHours();
  const m = d.getUTCMinutes();
  const period = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return { hour: h12, minute: m, period };
}

export function citySlugFromRegistry(city: string | null | undefined, slug: string | null): string {
  const fromCity = city?.trim().toLowerCase().replace(/\s+/g, "-");
  if (fromCity) return fromCity.slice(0, 64);
  const fromSlug = slug?.split("-")[0]?.trim().toLowerCase();
  if (fromSlug) return fromSlug.slice(0, 64);
  return "unknown";
}

type RunWithClub = city_runs & {
  runClub?: Pick<run_clubs, "id" | "name" | "slug"> | null;
  city_run_rsvps?: { athleteId: string; status: string }[];
};

export function serializeHubShakeout(run: RunWithClub, viewerAthleteId?: string) {
  const rsvps = run.city_run_rsvps ?? [];
  return {
    id: run.id,
    title: run.title,
    date: run.date.toISOString(),
    meetUpPoint: run.meetUpPoint,
    meetUpLat: run.meetUpLat,
    meetUpLng: run.meetUpLng,
    totalMiles: run.totalMiles,
    pace: run.pace,
    description: run.description,
    postRunActivity: run.postRunActivity,
    startTimeHour: run.startTimeHour,
    startTimeMinute: run.startTimeMinute,
    startTimePeriod: run.startTimePeriod,
    workflowStatus: run.workflowStatus,
    published: run.published,
    staffGeneratedId: run.staffGeneratedId,
    shakeoutDedupeKey: run.shakeoutDedupeKey,
    gorunPath: `/gorun/${run.id}`,
    runClub: run.runClub ?? null,
    rsvpCount: rsvps.filter((rv) => rv.status === "going").length,
    myRsvp: viewerAthleteId
      ? (rsvps.find((rv) => rv.athleteId === viewerAthleteId) ?? null)
      : null,
  };
}
