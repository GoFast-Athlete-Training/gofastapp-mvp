export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { draftPublicPlanDescriptionForPlan } from "@/lib/training/draft-public-plan-description";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/public-training-plans/draft-description
 * Auth athlete — load active plan + schedule, return OpenAI (or fallback) draft blurb.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    let trainingPlanId =
      typeof body?.trainingPlanId === "string" ? body.trainingPlanId.trim() : "";

    if (!trainingPlanId) {
      const active = await prisma.training_plans.findFirst({
        where: { athleteId: auth.athlete.id, lifecycleStatus: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      if (!active) {
        return NextResponse.json({ error: "No active training plan" }, { status: 404 });
      }
      trainingPlanId = active.id;
    }

    const result = await draftPublicPlanDescriptionForPlan({
      trainingPlanId,
      athleteId: auth.athlete.id,
    });

    return NextResponse.json({
      success: true,
      description: result.description,
      source: result.source,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to draft description";
    const status = message.includes("not found") ? 404 : 400;
    console.error("[public-training-plans/draft-description POST]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
