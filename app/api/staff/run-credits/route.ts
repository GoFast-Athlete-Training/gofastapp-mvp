import { NextRequest, NextResponse } from "next/server";
import { RunWorkflowStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireInternalRaceHubSecret } from "@/lib/race-hub-internal-company";

export const dynamic = "force-dynamic";

/**
 * GET /api/staff/run-credits
 * Returns credited run counts per staff (staffGeneratedId).
 * Used by GoFastCompany commissions API when run data lives in this app (proxied setup).
 * Credit = workflowStatus SUBMITTED or APPROVED. Counts all such runs (no run-club filter).
 *
 * Auth: GOFAST_INTERNAL_RACE_HUB_SECRET via Bearer or x-gofast-internal-secret header.
 *
 * Query: staffIds (optional) — comma-separated list of company_staff ids to restrict to.
 * Response: { runCreditsByStaffId: { [staffId]: number } }
 */
export async function GET(request: NextRequest) {
  try {
    const authError = requireInternalRaceHubSecret(request);
    if (authError) return authError;
    const { searchParams } = new URL(request.url);
    const staffIdsParam = searchParams.get("staffIds");
    const staffIds =
      staffIdsParam?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;

    const where = {
      staffGeneratedId:
        staffIds && staffIds.length > 0
          ? ({ in: staffIds } as { in: string[] })
          : { not: null },
      workflowStatus: { in: [RunWorkflowStatus.SUBMITTED, RunWorkflowStatus.APPROVED] },
    };

    const counts = await prisma.city_runs.groupBy({
      by: ["staffGeneratedId"],
      where,
      _count: { id: true },
    });

    const runCreditsByStaffId: Record<string, number> = {};
    for (const row of counts) {
      if (row.staffGeneratedId != null) {
        runCreditsByStaffId[row.staffGeneratedId] = row._count.id;
      }
    }

    return NextResponse.json({
      success: true,
      runCreditsByStaffId,
    });
  } catch (error: unknown) {
    console.error("Staff run-credits GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch run credits",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
