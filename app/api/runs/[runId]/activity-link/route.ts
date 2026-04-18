export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";
import { resolveCityRunIdBySegment } from "@/lib/city-run-resolve-segment";

function utcCalendarDaysApart(a: Date, b: Date): number {
  const ua = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const ub = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((ua - ub) / 86400000);
}

/**
 * GET /api/runs/[runId]/activity-link
 * Current athlete's link between this city run and a synced activity (if any).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const segment = ((await params).runId || "").trim();
    if (!segment) return NextResponse.json({ error: "Missing run id" }, { status: 400 });
    const resolvedId = await resolveCityRunIdBySegment(segment);
    if (!resolvedId) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const link = await prisma.city_run_activity_links.findUnique({
      where: {
        cityRunId_athleteId: {
          cityRunId: resolvedId,
          athleteId: auth.athlete.id,
        },
      },
      include: {
        athlete_activities: {
          select: {
            id: true,
            activityName: true,
            activityType: true,
            startTime: true,
            distance: true,
          },
        },
      },
    });

    return NextResponse.json({
      link: link
        ? {
            id: link.id,
            cityRunId: link.cityRunId,
            activityId: link.activityId,
            linkedManually: link.linkedManually,
            createdAt: link.createdAt.toISOString(),
            activity: link.athlete_activities
              ? {
                  ...link.athlete_activities,
                  startTime: link.athlete_activities.startTime?.toISOString() ?? null,
                }
              : null,
          }
        : null,
    });
  } catch (err) {
    console.error("GET /activity-link:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/runs/[runId]/activity-link
 * Body: { activityId?: string | null } — null clears the activity on an existing link.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const segment = ((await params).runId || "").trim();
    if (!segment) return NextResponse.json({ error: "Missing run id" }, { status: 400 });
    const resolvedId = await resolveCityRunIdBySegment(segment);
    if (!resolvedId) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const run = await prisma.city_runs.findUnique({ where: { id: resolvedId } });
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as {
      activityId?: string | null;
    };

    const requestedActivityId =
      body.activityId === undefined ? undefined : body.activityId?.trim() || null;

    if (requestedActivityId) {
      const activity = await prisma.athlete_activities.findFirst({
        where: { id: requestedActivityId, athleteId: auth.athlete.id },
      });
      if (!activity) {
        return NextResponse.json({ error: "Activity not found" }, { status: 404 });
      }
      if (!activity.startTime) {
        return NextResponse.json(
          { error: "Activity has no start time; cannot verify date" },
          { status: 400 }
        );
      }
      const apart = utcCalendarDaysApart(run.date, activity.startTime);
      if (apart > 1) {
        return NextResponse.json(
          { error: "Activity must be within one calendar day (UTC) of the run" },
          { status: 400 }
        );
      }
    }

    const createActivityId =
      requestedActivityId === undefined ? null : requestedActivityId;

    const link = await prisma.city_run_activity_links.upsert({
      where: {
        cityRunId_athleteId: {
          cityRunId: resolvedId,
          athleteId: auth.athlete.id,
        },
      },
      create: {
        cityRunId: resolvedId,
        athleteId: auth.athlete.id,
        activityId: createActivityId,
        linkedManually: true,
      },
      update: {
        ...(requestedActivityId !== undefined ? { activityId: requestedActivityId } : {}),
        linkedManually: true,
      },
      include: {
        athlete_activities: {
          select: {
            id: true,
            activityName: true,
            activityType: true,
            startTime: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      link: {
        id: link.id,
        cityRunId: link.cityRunId,
        activityId: link.activityId,
        activity: link.athlete_activities
          ? {
              ...link.athlete_activities,
              startTime: link.athlete_activities.startTime?.toISOString() ?? null,
            }
          : null,
      },
    });
  } catch (err) {
    console.error("POST /activity-link:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
