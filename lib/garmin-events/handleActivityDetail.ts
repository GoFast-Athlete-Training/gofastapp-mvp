/**
 * Handle ACTIVITY_DETAIL webhook events
 * Hydrates athlete_activities.detailData for lap/sample-based evaluation.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { getAthleteByGarminUserId } from "../domain-garmin";
import { activityExists } from "./dedupe";
import { normalizeActivityFields } from "./normalizeActivityFields";
import { RUNNING_ACTIVITY_TYPES } from "../training/activity-type-sets";
import { parseDetailData } from "../training/detail-data-parser";
import { convertLapsToDerived } from "../training/lap-converter";
import { writeLapsToWorkout } from "../training/lap-data-to-workout";

export interface ActivityDetail {
  activityId?: string | number;
  summaryId?: string | number;
  summary?: { activityId?: string | number; userId?: string; [key: string]: unknown };
  userId?: string;
  [key: string]: unknown;
}

export function activityIdCandidates(detail: ActivityDetail): string[] {
  const summaryId =
    typeof detail.summaryId === "string" && detail.summaryId.endsWith("-detail")
      ? detail.summaryId.slice(0, -"detail".length - 1)
      : detail.summaryId;
  return Array.from(
    new Set(
      [detail.activityId, detail.summary?.activityId, summaryId]
        .filter((id) => id !== undefined && id !== null && String(id).length > 0)
        .map(String)
    )
  );
}

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

function isRunningActivityType(activityType: string | null | undefined): boolean {
  if (!activityType) return true;
  return RUNNING_ACTIVITY_TYPES.has(activityType.toUpperCase());
}

function ingestionStatusForActivityType(activityType: string | null | undefined): string {
  return isRunningActivityType(activityType) ? "RECEIVED" : "INELIGIBLE";
}

async function resolveAthleteForDetailFallback(
  garminUserId: string | undefined
): Promise<{ athleteId: string; athleteSource: "userId" | "summaryLookup" } | null> {
  if (garminUserId) {
    const athlete = await getAthleteByGarminUserId(garminUserId);
    if (athlete) {
      return { athleteId: athlete.id, athleteSource: "userId" };
    }
    return null;
  }

  const recentSummaries = await prisma.athlete_activities.findMany({
    where: {
      source: "garmin",
      summaryData: { not: Prisma.DbNull },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { summaryData: true },
  });

  for (const row of recentSummaries) {
    const summary = row.summaryData as Record<string, unknown> | null;
    const summaryUserId = summary?.userId;
    if (summaryUserId === undefined || summaryUserId === null) continue;

    const athlete = await getAthleteByGarminUserId(String(summaryUserId));
    if (athlete) {
      return { athleteId: athlete.id, athleteSource: "summaryLookup" };
    }
  }

  return null;
}

async function runDetailHydrationPipeline(rowId: string, detailData: object): Promise<void> {
  try {
    const parsed = parseDetailData(detailData);
    const derived = convertLapsToDerived(parsed.laps, parsed.samples);
    await writeLapsToWorkout(rowId, derived);
  } catch (lapErr) {
    console.warn("lap pipeline (detailData → workout):", lapErr);
  }

  try {
    await prisma.workouts.updateMany({
      where: { matchedActivityId: rowId },
      data: {
        completedActivityDetailJson: detailData,
      },
    });
  } catch (detailSnapErr) {
    console.warn("workout detail snapshot:", detailSnapErr);
  }
}

/**
 * Process activity detail webhook
 */
export async function handleActivityDetail(
  activityDetails: ActivityDetail[],
  userId?: string
): Promise<{ processed: number; skipped: number; errors: number }> {
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const detail of activityDetails) {
    try {
      const ids = activityIdCandidates(detail);
      if (ids.length === 0) {
        console.warn("⚠️ No activityId found in activity detail", {
          userId: userId || detail.userId || detail.summary?.userId || "(none)",
          detailKeys:
            detail && typeof detail === "object" ? Object.keys(detail) : [],
        });
        skipped++;
        continue;
      }

      const garminUserId = userId || detail.userId || detail.summary?.userId;
      const athlete = garminUserId ? await getAthleteByGarminUserId(garminUserId) : null;

      if (garminUserId && !athlete) {
        console.warn(`⚠️ Athlete not found for Garmin userId: ${garminUserId}`);
      }

      console.log("📩 Processing activity detail", {
        activityIds: ids,
        userId: garminUserId ?? "(none)",
      });

      const updateResult = await prisma.athlete_activities.updateMany({
        where: {
          ...(athlete ? { athleteId: athlete.id } : {}),
          sourceActivityId: { in: ids },
        },
        data: {
          detailData: detail as object,
          hydratedAt: new Date(),
        },
      });

      if (updateResult.count > 0) {
        console.log("✅ Saved activity detail", {
          activityIds: ids,
          userId: garminUserId ?? "(none)",
          updateCount: updateResult.count,
        });
        const row = await prisma.athlete_activities.findFirst({
          where: {
            ...(athlete ? { athleteId: athlete.id } : {}),
            sourceActivityId: { in: ids },
          },
        });
        if (row) {
          await runDetailHydrationPipeline(row.id, detail as object);
        }
        processed++;
      } else {
        const sourceActivityId = ids[0];
        const resolvedAthlete = await resolveAthleteForDetailFallback(
          garminUserId ? String(garminUserId) : undefined
        );

        if (!resolvedAthlete) {
          console.warn("⚠️ Detail fallback skipped: no athlete resolved", {
            activityIds: ids,
            sourceActivityId,
            garminUserId: garminUserId ?? "(none)",
            athleteSource: garminUserId ? "userId" : "summaryLookup",
          });
          skipped++;
          continue;
        }

        if (await activityExists(sourceActivityId)) {
          console.warn("⚠️ Detail fallback skipped: activity already exists", {
            activityIds: ids,
            sourceActivityId,
            athleteId: resolvedAthlete.athleteId,
          });
          skipped++;
          continue;
        }

        const summary =
          detail.summary && typeof detail.summary === "object" ? detail.summary : null;
        const norm = normalizeActivityFields(summary ?? detail);
        const activityType =
          typeof summary?.activityType === "string"
            ? summary.activityType
            : typeof detail.activityType === "string"
              ? detail.activityType
              : undefined;
        const activityName =
          typeof summary?.activityName === "string"
            ? summary.activityName
            : typeof detail.activityName === "string"
              ? detail.activityName
              : undefined;
        const now = new Date();

        const created = await prisma.athlete_activities.create({
          data: {
            id: generateId(),
            athleteId: resolvedAthlete.athleteId,
            sourceActivityId,
            source: "garmin",
            ingestionStatus: ingestionStatusForActivityType(activityType),
            activityType,
            activityName,
            startTime: norm.startTime,
            duration: norm.duration,
            distance: norm.distance,
            calories: norm.calories,
            averageSpeed: norm.averageSpeed,
            averageHeartRate: norm.averageHeartRate,
            maxHeartRate: norm.maxHeartRate,
            elevationGain: norm.elevationGain,
            averagePower: norm.averagePower,
            steps: norm.steps,
            summaryData: summary ? (summary as object) : Prisma.DbNull,
            detailData: detail as object,
            hydratedAt: now,
            updatedAt: now,
          },
        });

        console.log("✅ Created activity from detail fallback", {
          activityIds: ids,
          sourceActivityId,
          athleteId: resolvedAthlete.athleteId,
          athleteSource: resolvedAthlete.athleteSource,
          garminUserId: garminUserId ?? "(none)",
          ingestionStatus: created.ingestionStatus,
        });

        await runDetailHydrationPipeline(created.id, detail as object);
        processed++;
      }
    } catch (error: any) {
      errors++;
      console.error(`❌ Error processing activity detail:`, error);
    }
  }

  return { processed, skipped, errors };
}
