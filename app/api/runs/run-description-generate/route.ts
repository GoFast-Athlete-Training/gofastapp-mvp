export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertRunManageAuth } from "@/lib/runmanage/require-run-manage-auth";
import { generatePublicRunDescription } from "@/lib/runmanage/run-public-description-generate";

export async function POST(request: NextRequest) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = body.mode === "from_core" ? "from_core" : "smooth";
  const cityRunType =
    typeof body.cityRunType === "string" ? body.cityRunType.trim() : null;

  const result = await generatePublicRunDescription({
    mode,
    cityRunType,
    clubName: typeof body.clubName === "string" ? body.clubName : null,
    title: typeof body.title === "string" ? body.title : null,
    existingDescription:
      typeof body.existingDescription === "string"
        ? body.existingDescription
        : typeof body.description === "string"
          ? body.description
          : null,
    meetUpPoint: typeof body.meetUpPoint === "string" ? body.meetUpPoint : null,
    totalMiles:
      body.totalMiles != null && body.totalMiles !== "" ? String(body.totalMiles) : null,
    pace: typeof body.pace === "string" ? body.pace : null,
    dateYmd: typeof body.dateYmd === "string" ? body.dateYmd : null,
    postRunActivity: typeof body.postRunActivity === "string" ? body.postRunActivity : null,
    runType: typeof body.runType === "string" ? body.runType : null,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, description: result.description });
}
