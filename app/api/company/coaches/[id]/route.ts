export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { prisma } from "@/lib/prisma";
import { formatCompanyCoach } from "@/lib/format-company-coach";
import { companyAdminCorsHeaders } from "@/lib/company-admin-cors";

export async function OPTIONS(request: Request) {
  return NextResponse.json({}, { headers: companyAdminCorsHeaders(request) });
}

/**
 * GET /api/company/coaches/[id]
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const corsHeaders = companyAdminCorsHeaders(request);
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing coach id" },
        { status: 400, headers: corsHeaders },
      );
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: corsHeaders },
      );
    }

    try {
      await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid token";
      console.error("❌ COMPANY COACH GET: Token verification failed:", message);
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 401, headers: corsHeaders },
      );
    }

    const coach = await prisma.coach.findUnique({
      where: { id },
      select: {
        id: true,
        firebaseId: true,
        email: true,
        firstName: true,
        lastName: true,
        photoURL: true,
        city: true,
        state: true,
        specialty: true,
        isActive: true,
      },
    });

    if (!coach) {
      return NextResponse.json(
        { success: false, error: "Coach not found" },
        { status: 404, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      { success: true, coach: formatCompanyCoach(coach) },
      { headers: corsHeaders },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("❌ COMPANY COACH GET: Error:", err);
    return NextResponse.json(
      { success: false, error: "Server error", details: message },
      { status: 500, headers: corsHeaders },
    );
  }
}
