import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { buildPlanDayBrief } from "@/lib/training/plan-day-brief-service";
import { commitPlanIngest } from "@/lib/training/plan-ingest-commit";

export const dynamic = "force-dynamic";

/** POST — propose today's call (optional note). */
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
  const dateKey = typeof body.dateKey === "string" ? body.dateKey.trim() : "";
  const note = typeof body.note === "string" ? body.note : undefined;

  if (!planId || !dateKey) {
    return NextResponse.json({ error: "planId and dateKey are required" }, { status: 400 });
  }

  const result = await buildPlanDayBrief({
    athleteId: auth.athlete.id,
    planId,
    dateKey,
    note,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ success: true, brief: result.brief });
}

/** PATCH — accept proposed ingest from a prior brief. */
export async function PATCH(request: NextRequest) {
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
  const preview = body.preview;

  if (!planId || !preview || typeof preview !== "object") {
    return NextResponse.json({ error: "planId and preview are required" }, { status: 400 });
  }

  const commit = await commitPlanIngest({
    athleteId: auth.athlete.id,
    planId,
    preview: preview as import("@/lib/training/plan-ingest-contract").PlanIngestPreviewResult,
  });

  if (!commit.ok) {
    return NextResponse.json({ error: commit.error }, { status: 422 });
  }

  return NextResponse.json({ success: true, ...commit.result });
}
