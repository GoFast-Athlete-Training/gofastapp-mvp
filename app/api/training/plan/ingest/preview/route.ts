import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { previewPlanIngest } from "@/lib/training/plan-ingest-parse-service";
import type { PlanIngestScope } from "@/lib/training/plan-ingest-contract";

export const dynamic = "force-dynamic";

function parseScope(raw: unknown): PlanIngestScope | null {
  if (raw === "workout" || raw === "week" || raw === "plan") return raw;
  return null;
}

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
  const scope = parseScope(body.scope);
  const sourceText = typeof body.sourceText === "string" ? body.sourceText : "";
  const dateKey = typeof body.dateKey === "string" ? body.dateKey : undefined;
  const weekNumber =
    typeof body.weekNumber === "number" && Number.isFinite(body.weekNumber)
      ? Math.floor(body.weekNumber)
      : undefined;

  if (!planId || !scope) {
    return NextResponse.json({ error: "planId and scope are required" }, { status: 400 });
  }

  const result = await previewPlanIngest({
    athleteId: auth.athlete.id,
    planId,
    scope,
    sourceText,
    dateKey,
    weekNumber,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ success: true, preview: result.preview });
}
