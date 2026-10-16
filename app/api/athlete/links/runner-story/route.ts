import { requireAthleteWithHandleForLinks } from "@/lib/content/require-athlete-link-tree";
import { getGoFastWithMeForAthlete } from "@/lib/gofast-with-me/gofast-with-me-service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const gwm = await getGoFastWithMeForAthlete(gate.athlete.id);
  const story = gwm?.runnerStory?.trim() || null;
  const preview = story ? (story.length > 280 ? `${story.slice(0, 280)}…` : story) : null;

  return NextResponse.json({
    success: true,
    hasStory: Boolean(story),
    preview,
  });
}
