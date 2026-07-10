export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PublicTrainingPlanVisibility } from "@prisma/client";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  mapPublicPlanApiResponse,
  promoteTrainingPlanPublic,
} from "@/lib/training/public-plan-service";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/training-plan/[id]/promote-public — promote owned plan to athlete-public */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const visibility =
      body.visibility &&
      Object.values(PublicTrainingPlanVisibility).includes(body.visibility)
        ? body.visibility
        : PublicTrainingPlanVisibility.PUBLIC;

    const plan = await promoteTrainingPlanPublic({
      trainingPlanId: id,
      athleteId: auth.athlete.id,
      visibility,
      description: typeof body.description === "string" ? body.description : null,
      regenerateSlug: body.regenerateSlug === true,
    });

    return NextResponse.json({ success: true, plan: mapPublicPlanApiResponse(plan) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to publish plan";
    const status = message.includes("not found") ? 404 : 400;
    console.error("[training-plan/[id]/promote-public POST]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
