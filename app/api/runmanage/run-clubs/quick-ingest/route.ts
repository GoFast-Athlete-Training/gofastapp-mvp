export const dynamic = "force-dynamic";

import { orchestrateQuickClubIngest } from "@/lib/run-clubs/quick-ingest-orchestrate";
import {
  assertRunManageAuth,
  staffGeneratedIdFromAuth,
} from "@/lib/runmanage/require-run-manage-auth";
import { NextRequest, NextResponse } from "next/server";

/** POST /api/runmanage/run-clubs/quick-ingest — CityRun editor minimal club create. */
export async function POST(request: NextRequest) {
  const auth = await assertRunManageAuth(request);
  if (auth instanceof NextResponse) return auth;

  const staffId = staffGeneratedIdFromAuth(auth);
  if (!staffId) {
    return NextResponse.json({ success: false, error: "Staff id required" }, { status: 401 });
  }

  const companyId = process.env.GOFAST_GO_FAST_COMPANY_ID?.trim();
  if (!companyId) {
    return NextResponse.json(
      { success: false, error: "GOFAST_GO_FAST_COMPANY_ID is not configured" },
      { status: 503 },
    );
  }

  let body: { name?: string; city?: string; reference?: string; state?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const city = body.city?.trim() ?? "";
  const reference = body.reference?.trim() ?? "";

  if (!name || !city || !reference) {
    return NextResponse.json(
      { success: false, error: "name, city, and reference are required" },
      { status: 400 },
    );
  }

  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const outcome = await orchestrateQuickClubIngest(
    {
      name,
      city,
      reference,
      state: body.state,
      companyId,
      companyName: "GoFast",
    },
    { authorization, staffId },
  );

  if (!outcome.ok) {
    return NextResponse.json({ success: false, error: outcome.error }, { status: outcome.status });
  }

  return NextResponse.json({
    success: true,
    clubId: outcome.result.clubId,
    name: outcome.result.name,
    city: outcome.result.city,
    created: outcome.result.created,
    club: {
      id: outcome.result.clubId,
      name: outcome.result.name,
      city: outcome.result.city,
    },
  });
}
