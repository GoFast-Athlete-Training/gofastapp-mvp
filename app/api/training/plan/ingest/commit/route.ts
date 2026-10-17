import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { commitPlanIngest } from "@/lib/training/plan-ingest-commit";
import type { PlanIngestPreviewResult } from "@/lib/training/plan-ingest-contract";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  const preview = body.preview as PlanIngestPreviewResult | undefined;

  if (!planId || !preview || typeof preview !== "object" || !preview.scope) {
    return NextResponse.json({ error: "planId and preview are required" }, { status: 400 });
  }

  const result = await commitPlanIngest({
    athleteId: auth.athlete.id,
    planId,
    preview,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ success: true, ...result.result });
}
