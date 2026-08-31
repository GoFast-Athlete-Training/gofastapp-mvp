export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { prisma } from "@/lib/prisma";
import { companyAdminCorsHeaders } from "@/lib/company-admin-cors";

export async function OPTIONS(request: Request) {
  return NextResponse.json({}, { headers: companyAdminCorsHeaders(request) });
}

/**
 * GET /api/company/users/[id]/gofast-with-me-readiness
 * Staff-safe GoFast With Me readiness projection for App Management.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const corsHeaders = companyAdminCorsHeaders(request);
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: corsHeaders },
      );
    }

    await adminAuth.verifyIdToken(authHeader.substring(7));

    const { id } = await params;
    const athlete = await prisma.athlete.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        gofastHandle: true,
        photoURL: true,
        gofast_with_me: {
          select: {
            id: true,
            gofastSlugSnapshot: true,
            creatorType: true,
            welcome: true,
            gofastWithMeBio: true,
            whatYoullSeeHere: true,
            gofastWithMePhotoUrl: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!athlete) {
      return NextResponse.json(
        { success: false, error: "Athlete not found" },
        { status: 404, headers: corsHeaders },
      );
    }

    const gwm = athlete.gofast_with_me;
    const hasProfileBasics = Boolean(
      gwm?.welcome?.trim() && gwm?.gofastWithMeBio?.trim() && gwm?.gofastWithMePhotoUrl?.trim(),
    );

    return NextResponse.json(
      {
        success: true,
        readiness: {
          athleteId: athlete.id,
          hasGoFastWithMe: Boolean(gwm),
          hasHandle: Boolean(athlete.gofastHandle),
          hasProfileBasics,
          creatorType: gwm?.creatorType ?? null,
          publicSlug: gwm?.gofastSlugSnapshot ?? null,
          updatedAt: gwm?.updatedAt?.toISOString() ?? null,
        },
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error("[gofast-with-me-readiness]", err);
    return NextResponse.json(
      { success: false, error: "Failed to load readiness" },
      { status: 500, headers: corsHeaders },
    );
  }
}
