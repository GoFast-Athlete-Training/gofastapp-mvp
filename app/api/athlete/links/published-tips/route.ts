import { requireAthleteWithHandleForLinks } from "@/lib/content/require-athlete-link-tree";
import { listPublishedAthleteTips } from "@/lib/gofast-with-me/athlete-tips";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const tips = await listPublishedAthleteTips(gate.athlete.id, 50);
  return NextResponse.json({
    success: true,
    tips: tips.map((t) => ({
      id: t.id,
      title: t.title,
      publishedAt: t.publishedAt,
    })),
  });
}
