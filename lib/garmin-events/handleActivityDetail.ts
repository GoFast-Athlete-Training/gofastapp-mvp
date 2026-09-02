/**
 * Handle ACTIVITY_DETAIL webhook events
 * Hydrates athlete_activities.detailData for lap/sample-based evaluation.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { getAthleteByGarminUserId } from "../domain-garmin";
import { activityExists } from "./dedupe";
import { normalizeActivityFields } from "./normalizeActivityFields";
import { isCyclingActivityType, RUNNING_ACTIVITY_TYPES } from "../training/activity-type-sets";
import { parseMatchedActivityToSegmentExecution } from "../training/activity-to-segment-execution";
import { runPostAnalyzeMatchFollowups } from "../training/apply-activity-to-workout";
import { requiresDetailForTargetAnalysis } from "../training/structured-workout-types";
import { tryMatchActivityToCityRun } from "../cta-triggers/try-match-activity-to-city-run";
import { tryMatchActivityToTrainingWorkout } from "../training/match-activity-to-workout";
import { tryMatchActivityToBikeWorkout } from "../training/match-activity-to-bike-workout";
import { promoteUnmatchedRunningActivityToWorkout } from "../training/promote-activity-to-workout";
import { extractActivityRouteFromDetail } from "../training/activity-route-from-detail";
import { isGenericGarminActivityName } from "./generic-activity-names";

function safeStartTime(value: Date | null | undefined): Date | undefined {
  if (value == null) return undefined;
  if (Number.isNaN(value.getTime())) return undefined;
  return value;
}

function logDetailPrismaError(
  error: unknown,
  context: { activityIds: string[]; garminUserId?: string | number }
): void {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("❌ Error processing activity detail:", {
      code: error.code,
      meta: error.meta,
      message: error.message,
      activityIds: context.activityIds,
      garminUserId: context.garminUserId ?? "(none)",
    });
    return;
  }
  console.error("❌ Error processing activity detail:", {
    message: error instanceof Error ? error.message : String(error),
    activityIds: context.activityIds,
    garminUserId: context.garminUserId ?? "(none)",
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function findActivityRowForDetailIds(
  ids: string[],
  athleteId?: string
): Promise<{ id: string; activityType: string | null } | null> {
  const row = await prisma.athlete_activities.findFirst({
    where: {
      ...(athleteId ? { athleteId } : {}),
      sourceActivityId: { in: ids },
    },
    select: { id: true, activityType: true },
  });
  if (row) return row;

  if (!athleteId) return null;

  return prisma.athlete_activities.findFirst({
    where: { sourceActivityId: { in: ids } },
    select: { id: true, activityType: true },
  });
}

/** Update detail columns on an existing row; retry without athlete scope if needed. */
async function persistDetailOnExistingRows(
  ids: string[],
  detail: object,
  athleteId?: string
): Promise<{ id: string; activityType: string | null } | null> {
  let updateResult = await prisma.athlete_activities.updateMany({
    where: {
      ...(athleteId ? { athleteId } : {}),
      sourceActivityId: { in: ids },
    },
    data: detailPersistData(detail),
  });

  if (updateResult.count === 0 && athleteId) {
    updateResult = await prisma.athlete_activities.updateMany({
      where: { sourceActivityId: { in: ids } },
      data: detailPersistData(detail),
    });
  }

  if (updateResult.count === 0) {
    return findActivityRowForDetailIds(ids, athleteId);
  }

  return findActivityRowForDetailIds(ids, athleteId);
}

async function runAfterDetailPersisted(
  row: { id: string; activityType: string | null },
  detail: object
): Promise<void> {
  await runPostIngestActivityMatching({
    activityId: row.id,
    activityType: row.activityType,
  });
  await runDetailHydrationPipeline(row.id, detail);
}

function detailPersistData(detail: object) {
  const route = extractActivityRouteFromDetail(detail);
  return {
    detailData: detail,
    hydratedAt: new Date(),
    startLatitude: route.startLatitude,
    startLongitude: route.startLongitude,
    endLatitude: route.endLatitude,
    endLongitude: route.endLongitude,
    summaryPolyline: route.summaryPolyline,
  };
}

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
    await prisma.workouts.updateMany({
      where: { garminDetailActivityId: rowId },
      data: {
        completedActivityDetailJson: detailData,
      },
    });
  } catch (detailSnapErr) {
    console.warn("workout detail snapshot:", detailSnapErr);
  }

  try {
    const workout = await prisma.workouts.findFirst({
      where: { garminDetailActivityId: rowId },
      select: { id: true, segmentExecutionStatus: true, workoutType: true },
    });
    if (workout) {
      const wasAligned = workout.segmentExecutionStatus === "ALIGNED";
      const result = await parseMatchedActivityToSegmentExecution(rowId);
      if (
        result.ok &&
        result.status === "ALIGNED" &&
        !wasAligned &&
        requiresDetailForTargetAnalysis(workout.workoutType)
      ) {
        await runPostAnalyzeMatchFollowups(rowId);
      }
    }
  } catch (lapErr) {
    console.warn("activity-to-segment pipeline:", lapErr);
  }
}

/** Same training/bike match + promote pipeline as activity summary ingest. */
async function runPostIngestActivityMatching(params: {
  activityId: string;
  activityType: string | null | undefined;
}): Promise<void> {
  try {
    if (isCyclingActivityType(params.activityType)) {
      await tryMatchActivityToBikeWorkout(params.activityId);
      return;
    }

    const matchResult = await tryMatchActivityToTrainingWorkout(params.activityId);
    const ingestRow = await prisma.athlete_activities.findUnique({
      where: { id: params.activityId },
      select: { ingestionStatus: true },
    });
    if (!matchResult.matched && ingestRow?.ingestionStatus === "UNMATCHED") {
      await promoteUnmatchedRunningActivityToWorkout(params.activityId);
    }
  } catch (matchErr) {
    console.warn("runPostIngestActivityMatching:", matchErr);
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
    let ids: string[] = [];
    try {
      ids = activityIdCandidates(detail);
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
        data: detailPersistData(detail as object),
      });

      if (updateResult.count > 0) {
        console.log("✅ Saved activity detail", {
          activityIds: ids,
          userId: garminUserId ?? "(none)",
          updateCount: updateResult.count,
        });
        const row = await findActivityRowForDetailIds(ids, athlete?.id);
        if (row) {
          await runAfterDetailPersisted(row, detail as object);
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
          const existingRow = await persistDetailOnExistingRows(
            ids,
            detail as object,
            resolvedAthlete.athleteId
          );
          if (existingRow) {
            console.log("✅ Hydrated existing activity from detail fallback", {
              activityIds: ids,
              sourceActivityId,
              athleteId: resolvedAthlete.athleteId,
              rowId: existingRow.id,
            });
            await runAfterDetailPersisted(existingRow, detail as object);
            processed++;
          } else {
            console.warn("⚠️ Detail fallback: activity exists but detail not written", {
              activityIds: ids,
              sourceActivityId,
              athleteId: resolvedAthlete.athleteId,
            });
            skipped++;
          }
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

        if (isGenericGarminActivityName(activityName)) {
          console.warn("⚠️ Detail fallback skipped: generic Garmin sample activity", {
            activityIds: ids,
            sourceActivityId,
            activityName,
          });
          skipped++;
          continue;
        }

        const now = new Date();
        const startTime = safeStartTime(norm.startTime);

        try {
          const created = await prisma.athlete_activities.create({
            data: {
              id: generateId(),
              athleteId: resolvedAthlete.athleteId,
              sourceActivityId,
              source: "garmin",
              ingestionStatus: ingestionStatusForActivityType(activityType),
              activityType,
              activityName,
              startTime,
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
              ...detailPersistData(detail as object),
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
          await runPostIngestActivityMatching({
            activityId: created.id,
            activityType,
          });
          await tryMatchActivityToCityRun(created.id).catch((cityRunErr) => {
            console.warn("tryMatchActivityToCityRun (detail fallback):", cityRunErr);
          });
          processed++;
        } catch (createErr) {
          if (!isUniqueConstraintError(createErr)) {
            throw createErr;
          }
          const existingRow = await persistDetailOnExistingRows(
            ids,
            detail as object,
            resolvedAthlete.athleteId
          );
          if (!existingRow) {
            throw createErr;
          }
          console.log("✅ Detail fallback create raced summary row — hydrated existing", {
            activityIds: ids,
            sourceActivityId,
            rowId: existingRow.id,
          });
          await runAfterDetailPersisted(existingRow, detail as object);
          await tryMatchActivityToCityRun(existingRow.id).catch((cityRunErr) => {
            console.warn("tryMatchActivityToCityRun (detail fallback):", cityRunErr);
          });
          processed++;
        }
      }
    } catch (error: unknown) {
      errors++;
      logDetailPrismaError(error, {
        activityIds: ids,
        garminUserId: userId || detail.userId || detail.summary?.userId,
      });
    }
  }

  return { processed, skipped, errors };
}
