export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { PublicTrainingPlanVisibility } from "@prisma/client";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  listAuthorPublicPlans,
  listDiscoverablePublicPlans,
  mapPublicPlanApiResponse,
  promoteTrainingPlanPublic,
} from "@/lib/training/public-plan-service";

/** GET /api/public-training-plans — discover public plans or author's own when ?mine=1 */
export async function GET(request: NextRequest) {
  try {
    const mine = request.nextUrl.searchParams.get("mine") === "1";
    if (mine) {
      const auth = await requireAthleteFromBearer(request);
      if ("error" in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
      }
      const plans = await listAuthorPublicPlans(auth.athlete.id);
      return NextResponse.json({ success: true, plans });
    }

    const limitRaw = request.nextUrl.searchParams.get("limit");
    const limit = limitRaw ? Math.min(50, Math.max(1, Number(limitRaw))) : 24;
    const rows = await listDiscoverablePublicPlans(limit);
    const plans = rows.map(mapPublicPlanApiResponse);
    return NextResponse.json({ success: true, plans });
  } catch (err) {
    console.error("[public-training-plans GET]", err);
    return NextResponse.json({ error: "Failed to load plans" }, { status: 500 });
  }
}

/** POST /api/public-training-plans — promote an owned generated plan public */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { sourceTrainingPlanId, description, visibility } = body;

    if (!sourceTrainingPlanId || typeof sourceTrainingPlanId !== "string") {
      return NextResponse.json(
        { error: "sourceTrainingPlanId is required" },
        { status: 400 }
      );
    }

    const vis =
      visibility && Object.values(PublicTrainingPlanVisibility).includes(visibility)
        ? visibility
        : PublicTrainingPlanVisibility.PUBLIC;

    const plan = await promoteTrainingPlanPublic({
      trainingPlanId: sourceTrainingPlanId,
      athleteId: auth.athlete.id,
      visibility: vis,
      description: typeof description === "string" ? description : null,
    });

    return NextResponse.json({ success: true, plan: mapPublicPlanApiResponse(plan) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to publish plan";
    const status = message.includes("not found") ? 404 : 400;
    console.error("[public-training-plans POST]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
