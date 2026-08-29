export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { promoteAthleteCatalogueToStaff } from "@/lib/training/promote-athlete-catalogue";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, ctx: RouteCtx) {
  const authErr = await assertStaffBearerAuth(_request);
  if (authErr) return authErr;

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
  }

  try {
    const item = await promoteAthleteCatalogueToStaff(id.trim());
    return NextResponse.json({ success: true, item });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    if (msg === "ALREADY_STAFF") {
      return NextResponse.json(
        { success: false, error: "Workout is already in the staff catalogue" },
        { status: 400 }
      );
    }
    if (msg === "DUPLICATE_STAFF_NAME") {
      return NextResponse.json(
        {
          success: false,
          error: "A staff catalogue workout with this name and type already exists",
        },
        { status: 409 }
      );
    }
    console.error("POST /api/training/catalogue/[id]/promote-from-athlete", e);
    return NextResponse.json(
      { success: false, error: "Server error", details: msg },
      { status: 500 }
    );
  }
}
