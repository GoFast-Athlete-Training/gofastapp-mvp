export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { upsertProdCharitySnap } from "@/lib/prod-charity-snap";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

function prismaCatalogErrorResponse(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2021" || e.code === "P2022") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Prod charities table is missing — run prisma migrate deploy on gofastapp-mvp production.",
        },
        { status: 503 },
      );
    }
  }
  const message = e instanceof Error ? e.message : "Charity catalog write failed";
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

/**
 * POST /api/charities/snap-sync
 * Human lane: staff Bearer + x-gofast-staff-id writes prod charity row (same id as Race Manage).
 */
export async function POST(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  let body: { charity?: Parameters<typeof upsertProdCharitySnap>[0] };
  try {
    body = (await request.json()) as { charity?: Parameters<typeof upsertProdCharitySnap>[0] };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.charity) {
    return NextResponse.json({ success: false, error: "charity payload is required" }, { status: 400 });
  }

  try {
    const result = await upsertProdCharitySnap(body.charity);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, charity: result.charity });
  } catch (e) {
    return prismaCatalogErrorResponse(e);
  }
}
