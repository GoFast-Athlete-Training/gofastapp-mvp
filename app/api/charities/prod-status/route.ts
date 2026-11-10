export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getProdCharitySnapsByIds } from "@/lib/prod-charity-snap";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

/**
 * GET /api/charities/prod-status?ids=id1,id2,...
 * Staff batch: which charity ids exist on the prod catalog (max 50).
 */
export async function GET(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const raw = new URL(request.url).searchParams.get("ids")?.trim() ?? "";
  const ids = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  try {
    const result = await getProdCharitySnapsByIds(ids);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: "Batch lookup failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, charities: result.charities });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Prod charities table is missing — run prisma migrate deploy on gofastapp-mvp production.",
        },
        { status: 503 },
      );
    }
    const message = e instanceof Error ? e.message : "Batch lookup failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
