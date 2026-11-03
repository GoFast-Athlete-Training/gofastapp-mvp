import { TrainingPlanLifecycle } from "@prisma/client";
import { sendAppNotification } from "@/lib/app-notifications/send";
import { prisma } from "@/lib/prisma";
import { raceCalendarDaysFromTodayUtc } from "@/lib/race-calendar-phase";
import { myRacePageHref } from "@/lib/races/athlete-race-signup-display";
import { addDaysUtc, utcDateOnly } from "@/lib/training/plan-utils";

const POST_RACE_CATCHUP_DAYS = 21;
const NEXT_PLAN_MIN_DAYS_PAST = 7;
const NEXT_PLAN_MAX_DAYS_PAST = 21;

function trimGoalTime(goalTime: string | null | undefined): string | null {
  const t = goalTime?.trim();
  return t ? t : null;
}

export async function athleteHasNextRaceEngagement(
  athleteId: string,
  finishedRaceDate: Date
): Promise<boolean> {
  const laterRaces = await prisma.athlete_races.findMany({
    where: {
      athleteId,
      raceDate: { gt: finishedRaceDate },
    },
    select: {
      goalTime: true,
      training_plans: {
        where: { lifecycleStatus: TrainingPlanLifecycle.ACTIVE },
        select: { id: true },
        take: 1,
      },
    },
    take: 20,
  });
  for (const row of laterRaces) {
    if (trimGoalTime(row.goalTime)) return true;
    if (row.training_plans.length > 0) return true;
  }
  return false;
}

/** Fire PR congrats push once per result row (Garmin promote or manual save). */
export async function maybeSendPrCongratsPush(params: {
  athleteId: string;
  resultId: string;
  prAchieved: boolean;
  alreadyNotifiedAt: Date | null | undefined;
  athleteRaceId: string | null | undefined;
  raceRegistryId: string;
  raceName: string;
  officialFinishTime: string | null;
  notifyEnabled?: boolean;
}): Promise<{ pushesSent: number }> {
  if (!params.prAchieved) return { pushesSent: 0 };
  if (params.alreadyNotifiedAt) return { pushesSent: 0 };
  if (params.notifyEnabled === false) return { pushesSent: 0 };

  const athleteRaceId = params.athleteRaceId?.trim();
  if (!athleteRaceId) return { pushesSent: 0 };

  const athleteRace = await prisma.athlete_races.findFirst({
    where: { id: athleteRaceId, athleteId: params.athleteId },
    select: { slug: true, notifyEnabled: true },
  });
  if (!athleteRace || !athleteRace.notifyEnabled) return { pushesSent: 0 };

  const deeplink = myRacePageHref(athleteRace.slug, params.raceRegistryId);
  const pushResult = await sendAppNotification({
    athleteId: params.athleteId,
    templateKey: "race.prCongrats",
    objectType: "athlete_race",
    objectId: athleteRaceId,
    deeplink,
    payload: {
      raceRegistryId: params.raceRegistryId,
      athleteRaceId,
      screen: "myrace",
    },
    facts: {
      raceName: params.raceName,
      finishTime: params.officialFinishTime ?? undefined,
    },
  });

  if (pushResult.pushesSent > 0) {
    await prisma.athlete_race_results.update({
      where: { id: params.resultId },
      data: { prCongratsNotifiedAt: new Date() },
    });
  }

  return pushResult;
}

export type PostRaceNotificationStats = {
  prCatchupCandidates: number;
  prPushesSent: number;
  nextPlanCandidates: number;
  nextPlanPushesSent: number;
};

/** Day-7 next plan nudge + PR catch-up for recent unnotified PRs (same cron as pre-race reminders). */
export async function processPostRaceNotifications(
  now = new Date()
): Promise<PostRaceNotificationStats> {
  const stats: PostRaceNotificationStats = {
    prCatchupCandidates: 0,
    prPushesSent: 0,
    nextPlanCandidates: 0,
    nextPlanPushesSent: 0,
  };

  const catchupSince = addDaysUtc(utcDateOnly(now), -POST_RACE_CATCHUP_DAYS);

  const prCatchupRows = await prisma.athlete_race_results.findMany({
    where: {
      prAchieved: true,
      prCongratsNotifiedAt: null,
      finishTimeSeconds: { not: null },
      updatedAt: { gte: catchupSince },
    },
    select: {
      id: true,
      athleteId: true,
      raceRegistryId: true,
      officialFinishTime: true,
      athleteRaceId: true,
      athlete_race: {
        select: { id: true, name: true, slug: true, notifyEnabled: true },
      },
    },
    take: 200,
  });

  for (const row of prCatchupRows) {
    stats.prCatchupCandidates += 1;
    const ar = row.athlete_race;
    const athleteRaceId = row.athleteRaceId ?? ar?.id ?? null;
    const out = await maybeSendPrCongratsPush({
      athleteId: row.athleteId,
      resultId: row.id,
      prAchieved: true,
      alreadyNotifiedAt: null,
      athleteRaceId,
      raceRegistryId: row.raceRegistryId,
      raceName: ar?.name ?? "Your race",
      officialFinishTime: row.officialFinishTime,
      notifyEnabled: ar?.notifyEnabled,
    });
    stats.prPushesSent += out.pushesSent;
  }

  const today = utcDateOnly(now);
  const raceDateOldest = addDaysUtc(today, -NEXT_PLAN_MAX_DAYS_PAST);
  const raceDateNewest = addDaysUtc(today, -NEXT_PLAN_MIN_DAYS_PAST);

  const nextPlanRows = await prisma.athlete_races.findMany({
    where: {
      notifyEnabled: true,
      nextPlanReadyNotifiedAt: null,
      raceDate: { gte: raceDateOldest, lte: raceDateNewest },
    },
    select: {
      id: true,
      athleteId: true,
      name: true,
      slug: true,
      raceDate: true,
      raceRegistryId: true,
    },
    take: 500,
  });

  for (const ar of nextPlanRows) {
    const diff = raceCalendarDaysFromTodayUtc(ar.raceDate.toISOString());
    if (diff === null) continue;
    const daysPast = -diff;
    if (daysPast < NEXT_PLAN_MIN_DAYS_PAST || daysPast > NEXT_PLAN_MAX_DAYS_PAST) continue;

    if (await athleteHasNextRaceEngagement(ar.athleteId, ar.raceDate)) continue;

    stats.nextPlanCandidates += 1;
    const deeplink = "/races";
    const pushResult = await sendAppNotification({
      athleteId: ar.athleteId,
      templateKey: "race.nextPlanReady",
      objectType: "athlete_race",
      objectId: ar.id,
      deeplink,
      payload: {
        raceRegistryId: ar.raceRegistryId,
        athleteRaceId: ar.id,
        screen: "find_race",
      },
      facts: { raceName: ar.name },
    });

    if (pushResult.pushesSent > 0) {
      stats.nextPlanPushesSent += pushResult.pushesSent;
      await prisma.athlete_races.update({
        where: { id: ar.id },
        data: { nextPlanReadyNotifiedAt: today },
      });
    }
  }

  return stats;
}
