import { requireAthleteWithHandleForLinks } from "@/lib/content/require-athlete-link-tree";
import { listPublishedTrainingReflections } from "@/lib/gofast-with-me/training-reflections";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const reflections = await listPublishedTrainingReflections(gate.athlete.id, 50);
  return NextResponse.json({
    success: true,
    reflections: reflections.map((p) => ({
      id: p.id,
      caption: p.caption,
      publishedAt: p.publishedAt,
      activityName: p.activity?.activityName ?? null,
    })),
  });
}
