import prisma from "@/lib/prisma";
import { buildJoinRunSignupUrl } from "@/lib/host-run-rsvp";

export type AthleteHostedRunInvite = {
  id: string;
  title: string;
  slug: string | null;
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

/** Recent athlete-hosted run invites (newest first) — for share / reopen on Build a Run. */
export async function listAthleteHostedRunInvites(
  athleteId: string,
  options?: { limit?: number },
): Promise<AthleteHostedRunInvite[]> {
  const limit = Math.min(Math.max(options?.limit ?? 12, 1), 50);
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const base = appBaseUrl();

  const rows = await prisma.city_runs.findMany({
    where: {
      athleteGeneratedId: athleteId,
      cityRunType: "INDIVIDUAL",
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      date: true,
      createdAt: true,
      startTimeHour: true,
      startTimeMinute: true,
      startTimePeriod: true,
      totalMiles: true,
      pace: true,
    },
  });

  return rows.map((run) => {
    const gorunPath = gorunPathForRun(run);
    return {
      id: run.id,
      title: run.title?.trim() || "Run invite",
      slug: run.slug,
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
      isUpcoming: run.date >= startOfToday,
    };
  });
}
