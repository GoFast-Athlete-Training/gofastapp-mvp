import prisma from "@/lib/prisma";
import { buildJoinRunSignupUrl } from "@/lib/host-run-rsvp";
import { isCreatedInviteCityRun } from "@/lib/city-run/is-created-invite-city-run";
import { cityRunPublicCardUrl } from "@/lib/city-run-public-card-url";

export type AthleteHostedRunInvite = {
  id: string;
  title: string;
  slug: string | null;
  citySlug: string;
  date: string;
  createdAt: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  totalMiles: number | null;
  pace: string | null;
  gorunPath: string;
  shareUrl: string;
  joinSignupUrl: string | null;
  publicCardUrl: string;
  isUpcoming: boolean;
};

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_CONTENT_PUBLIC_BASE_DOMAIN ||
    "https://gofastapp.com"
  ).replace(/\/$/, "");
}

function gorunPathForRun(run: { id: string; slug: string | null }): string {
  return `/gorun/${run.slug?.trim() || run.id}`;
}

const inviteSelect = {
  id: true,
  title: true,
  slug: true,
  citySlug: true,
  date: true,
  createdAt: true,
  startTimeHour: true,
  startTimeMinute: true,
  startTimePeriod: true,
  totalMiles: true,
  pace: true,
  plannedWorkoutId: true,
  workout: { select: { planId: true } },
  planned_workouts: { select: { planId: true } },
} as const;

type InviteRow = Awaited<
  ReturnType<
    typeof prisma.city_runs.findMany<{ select: typeof inviteSelect }>
  >
>[number];

function mapInviteRow(run: InviteRow, startOfToday: Date): AthleteHostedRunInvite {
  const gorunPath = gorunPathForRun(run);
  const base = appBaseUrl();
  const publicKey = run.slug?.trim() || run.id;
  return {
    id: run.id,
    title: run.title?.trim() || "Run invite",
    slug: run.slug,
    citySlug: run.citySlug,
    date: run.date.toISOString(),
    createdAt: run.createdAt.toISOString(),
    startTimeHour: run.startTimeHour,
    startTimeMinute: run.startTimeMinute,
    startTimePeriod: run.startTimePeriod,
    totalMiles: run.totalMiles,
    pace: run.pace,
    gorunPath,
    shareUrl: `${base}${gorunPath}`,
    joinSignupUrl: buildJoinRunSignupUrl(run.slug, base),
    publicCardUrl: cityRunPublicCardUrl(publicKey, run.citySlug, run.id),
    isUpcoming: run.date >= startOfToday,
  };
}

/** Recent athlete-hosted run invites (newest first) — for share / reopen on Build a Run. */
export async function listAthleteHostedRunInvites(
  athleteId: string,
  options?: { limit?: number },
): Promise<AthleteHostedRunInvite[]> {
  const limit = Math.min(Math.max(options?.limit ?? 12, 1), 50);
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const batchSize = Math.min(limit * 4, 200);
  const rows = await prisma.city_runs.findMany({
    where: {
      athleteGeneratedId: athleteId,
      cityRunType: "INDIVIDUAL",
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: batchSize,
    select: inviteSelect,
  });

  const out: AthleteHostedRunInvite[] = [];
  for (const run of rows) {
    if (!isCreatedInviteCityRun(run)) continue;
    out.push(mapInviteRow(run, startOfToday));
    if (out.length >= limit) break;
  }
  return out;
}

/** Single invite for host edit — null if not found or not a created invite. */
export type HostedRunInviteRouteSnap = {
  id: string;
  name: string;
  mapImageUrl: string | null;
  stravaMapUrl: string | null;
  routeNeighborhood: string | null;
};

export async function getAthleteHostedRunInviteForHost(
  athleteId: string,
  cityRunId: string,
): Promise<(AthleteHostedRunInvite & {
  meetUpPoint: string;
  meetUpStreetAddress: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  meetUpZip: string | null;
  meetUpPlaceId: string | null;
  meetUpLat: number | null;
  meetUpLng: number | null;
  meetUpNote: string | null;
  description: string | null;
  routeNeighborhood: string | null;
  routeId: string | null;
  stravaMapUrl: string | null;
  mapImageUrl: string | null;
  workoutDescription: string | null;
  route: HostedRunInviteRouteSnap | null;
}) | null> {
  const run = await prisma.city_runs.findFirst({
    where: {
      id: cityRunId,
      athleteGeneratedId: athleteId,
      cityRunType: "INDIVIDUAL",
    },
    select: {
      ...inviteSelect,
      meetUpPoint: true,
      meetUpStreetAddress: true,
      meetUpCity: true,
      meetUpState: true,
      meetUpZip: true,
      meetUpPlaceId: true,
      meetUpLat: true,
      meetUpLng: true,
      meetUpNote: true,
      description: true,
      routeNeighborhood: true,
      routeId: true,
      stravaMapUrl: true,
      mapImageUrl: true,
      workoutDescription: true,
      route: {
        select: {
          id: true,
          name: true,
          mapImageUrl: true,
          stravaMapUrl: true,
          routeNeighborhood: true,
        },
      },
    },
  });
  if (!run || !isCreatedInviteCityRun(run)) return null;
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  return {
    ...mapInviteRow(run, startOfToday),
    meetUpPoint: run.meetUpPoint,
    meetUpStreetAddress: run.meetUpStreetAddress,
    meetUpCity: run.meetUpCity,
    meetUpState: run.meetUpState,
    meetUpZip: run.meetUpZip,
    meetUpPlaceId: run.meetUpPlaceId,
    meetUpLat: run.meetUpLat,
    meetUpLng: run.meetUpLng,
    meetUpNote: run.meetUpNote,
    description: run.description,
    routeNeighborhood: run.routeNeighborhood,
    routeId: run.routeId,
    stravaMapUrl: run.stravaMapUrl,
    mapImageUrl: run.mapImageUrl,
    workoutDescription: run.workoutDescription,
    route: run.route,
  };
}
