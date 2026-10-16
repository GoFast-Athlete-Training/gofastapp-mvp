import { listAthleteHostedRunInvites } from "@/lib/city-run/list-athlete-hosted-invites";
import { requireAthleteWithHandleForLinks } from "@/lib/content/require-athlete-link-tree";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** GET — upcoming hosted city runs for link-tree checkboxes */
export async function GET(request: NextRequest) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const hostedRuns = await listAthleteHostedRunInvites(gate.athlete.id, {
    limit: 50,
  });
  return NextResponse.json({ success: true, hostedRuns, invites: hostedRuns });
}
