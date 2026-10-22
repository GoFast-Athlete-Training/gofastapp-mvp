import prisma from "@/lib/prisma";
import { buildJoinRunSignupUrl } from "@/lib/host-run-rsvp";
import {
  cityRunPublicCardUrl,
  companyRunLinkSliceUrl,
} from "@/lib/city-run-public-card-url";
import { buildCityRunShareText } from "@/lib/city-run/build-run-share-text";
import { getCityRunRsvpCounts, type CityRunRsvpCounts } from "@/lib/city-run/rsvp-counts";
import type { CityRunExecutionStatus } from "@prisma/client";
import { cityRunTogetherPath } from "@/lib/city-run/run-nav-paths";

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
  cityRunExecutionStatus: CityRunExecutionStatus;
  executedAt: string | null;
  canceledAt: string | null;
  shareText: string;
  rsvpCounts: CityRunRsvpCounts;
  plannedWorkoutId: string | null;
  workoutId: string | null;
};

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_CONTENT_PUBLIC_BASE_DOMAIN ||
    "https://gofastapp.com"
  ).replace(/\/$/, "");
}

function gorunPathForRun(run: { id: string; slug: string | null }): string {
  return cityRunTogetherPath(run.slug?.trim() || run.id);
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
  cityRunType: true,
  cityRunExecutionStatus: true,
  executedAt: true,
  canceledAt: true,
  plannedWorkoutId: true,
  workoutId: true,
  description: true,
  workout: { select: { planId: true, title: true } },
  plannedWorkout: { select: { planId: true, title: true, workoutType: true } },
  planned_workouts: { select: { planId: true } },
  route: { select: { routeDescription: true } },
  runClub: { select: { name: true } },
} as const;

type InviteRow = Awaited<
  ReturnType<
    typeof prisma.city_runs.findMany<{ select: typeof inviteSelect }>
  >
>[number];

async function mapInviteRow(
  run: InviteRow,
  startOfToday: Date,
  rsvpCounts: CityRunRsvpCounts,
): Promise<AthleteHostedRunInvite> {
  const gorunPath = gorunPathForRun(run);
  const base = appBaseUrl();
  const publicKey = run.slug?.trim() || run.id;
  const routeDescription =
    run.route?.routeDescription?.trim() || null;
  const shareText = buildCityRunShareText({
    runTitle: run.title,
    routeDescription,
    cityRunType: run.cityRunType,
    runClubName: run.runClub?.name ?? null,
  });
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
    shareUrl: companyRunLinkSliceUrl(publicKey),
    joinSignupUrl: buildJoinRunSignupUrl(run.slug, base),
    publicCardUrl: cityRunPublicCardUrl(publicKey, run.citySlug, run.id),
    isUpcoming: run.date >= startOfToday && run.cityRunExecutionStatus === "PLANNED",
    cityRunExecutionStatus: run.cityRunExecutionStatus,
    executedAt: run.executedAt?.toISOString() ?? null,
    canceledAt: run.canceledAt?.toISOString() ?? null,
    shareText,
    rsvpCounts,
    plannedWorkoutId: run.plannedWorkoutId,
    workoutId: run.workoutId,
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
    const rsvpCounts = await getCityRunRsvpCounts(run.id);
    out.push(await mapInviteRow(run, startOfToday, rsvpCounts));
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
  profileEmoji: string | null;
  coverPhotoUrl: string | null;
  workoutDescription: string | null;
  route: HostedRunInviteRouteSnap | null;
  plannedWorkoutType: string | null;
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
      routeNeighborhood: true,
      routeId: true,
      stravaMapUrl: true,
      mapImageUrl: true,
      profileEmoji: true,
      coverPhotoUrl: true,
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
  if (!run) return null;
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const rsvpCounts = await getCityRunRsvpCounts(run.id);
  return {
    ...(await mapInviteRow(run as InviteRow, startOfToday, rsvpCounts)),
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
    profileEmoji: run.profileEmoji,
    coverPhotoUrl: run.coverPhotoUrl,
    workoutDescription: run.workoutDescription,
    route: run.route,
    plannedWorkoutType: run.plannedWorkout?.workoutType ?? null,
  };
}
