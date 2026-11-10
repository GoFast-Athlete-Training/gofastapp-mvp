export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getProdCharitySnapById } from "@/lib/prod-charity-snap";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

function prismaCatalogErrorResponse(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2021" || e.code === "P2022") {
      return NextResponse.json(
        {
          success: false,
          exists: false,
          error:
            "Prod charities table is missing — run prisma migrate deploy on gofastapp-mvp production.",
        },
        { status: 503 },
      );
    }
  }
  const message = e instanceof Error ? e.message : "Charity catalog read failed";
  return NextResponse.json({ success: false, exists: false, error: message }, { status: 500 });
}

/**
 * GET /api/charities/[id]
 * Staff lane: check whether the prod charity catalog row exists (same id as Race Manage).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const { id } = await params;
  try {
    const result = await getProdCharitySnapById(id);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, exists: false, error: result.error },
        { status: result.status },
      );
    }

    if (!result.exists) {
      return NextResponse.json({ success: true, exists: false, charity: null });
    }

    return NextResponse.json({ success: true, exists: true, charity: result.charity });
  } catch (e) {
    return prismaCatalogErrorResponse(e);
  }
}
