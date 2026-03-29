export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { planGeneratePostHandler } from "@/lib/training/post-plan-generate";

/**
 * POST /api/training/plan/generate
 * Body: { trainingPlanId, weeklyMileageTarget?, minWeeklyMiles? }
 */
export async function POST(request: NextRequest) {
  return planGeneratePostHandler(request);
}
