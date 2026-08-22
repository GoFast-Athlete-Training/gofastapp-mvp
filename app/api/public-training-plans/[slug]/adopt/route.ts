export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { adoptPublishedPlanBySlug } from "@/lib/training/public-plan-service";

type Ctx = { params: Promise<{ slug: string }> };

/** POST /api/public-training-plans/[slug]/adopt — copy published plan for the same race */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { slug } = await context.params;
    const body = await request.json().catch(() => ({}));

    const athleteRaceId =
      typeof body.athleteRaceId === "string" ? body.athleteRaceId.trim() : "";
    const startRaw = body.startDate;
    const goalTime = typeof body.goalTime === "string" ? body.goalTime.trim() : "";
    const fiveKPace =
      typeof body.fiveKPace === "string" ? body.fiveKPace.trim() || null : null;
    const weeklyMileage =
      body.weeklyMileage !== undefined && body.weeklyMileage !== null && body.weeklyMileage !== ""
        ? Number(body.weeklyMileage)
        : undefined;
    const replaceActivePlan = body.replaceActivePlan === true;

    if (!athleteRaceId) {
      return NextResponse.json({ error: "athleteRaceId is required" }, { status: 400 });
    }
    if (!startRaw) {
      return NextResponse.json({ error: "startDate is required" }, { status: 400 });
    }
    if (!goalTime) {
      return NextResponse.json({ error: "goalTime is required" }, { status: 400 });
    }

    const startDate = new Date(startRaw);
    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Invalid startDate" }, { status: 400 });
    }

    const result = await adoptPublishedPlanBySlug({
      slug,
      athleteId: auth.athlete.id,
      athleteRaceId,
      startDate,
      goalTime,
      fiveKPace,
      weeklyMileage: Number.isFinite(weeklyMileage!) ? weeklyMileage : undefined,
      replaceActivePlan,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to adopt plan";
    let status = 400;
    if (message.includes("not found") || message.includes("not adoptable")) {
      status = 404;
    } else if (message.includes("active training plan")) {
      status = 409;
    } else if (message.includes("My Races")) {
      status = 404;
    }
    console.error("[public-training-plans/[slug]/adopt POST]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
