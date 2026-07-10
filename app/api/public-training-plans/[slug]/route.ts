export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  getPublicPlanBySlug,
  mapPublicPlanApiResponse,
  updatePublicTrainingPlanBySlug,
} from "@/lib/training/public-plan-service";
import { PublicTrainingPlanVisibility } from "@prisma/client";

type Ctx = { params: Promise<{ slug: string }> };

/** GET /api/public-training-plans/[slug] — public detail (unlisted allowed with slug) */
export async function GET(request: NextRequest, context: Ctx) {
  try {
    const { slug } = await context.params;
    const auth = await requireAthleteFromBearer(request);
    const athleteId = !("error" in auth) ? auth.athlete.id : undefined;

    const plan = await getPublicPlanBySlug(slug, {
      allowUnlisted: true,
      authorAthleteId: athleteId,
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, plan: mapPublicPlanApiResponse(plan) });
  } catch (err) {
    console.error("[public-training-plans/[slug] GET]", err);
    return NextResponse.json({ error: "Failed to load plan" }, { status: 500 });
  }
}

/** PATCH /api/public-training-plans/[slug] — author updates published plan metadata */
export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { slug } = await context.params;
    const body = await request.json();
    const visibility =
      body.visibility &&
      Object.values(PublicTrainingPlanVisibility).includes(body.visibility)
        ? body.visibility
        : undefined;

    const plan = await updatePublicTrainingPlanBySlug(slug, auth.athlete.id, {
      description: body.description !== undefined ? body.description : undefined,
      visibility,
      name: typeof body.name === "string" ? body.name : undefined,
      regenerateSlug: body.regenerateSlug === true,
    });

    return NextResponse.json({ success: true, plan: mapPublicPlanApiResponse(plan) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update plan";
    const status = message.includes("not found") ? 404 : 400;
    console.error("[public-training-plans/[slug] PATCH]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
