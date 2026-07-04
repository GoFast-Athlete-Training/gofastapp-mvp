import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/verify-cron-secret";
import { advanceClubInstances } from "@/lib/advance-club-instances";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/advance-club-run-instances
 * Monday 3:00 AM UTC — advance latest prior city_runs +7 days per linked series lane.
 * Product-owned; no Firebase or Company proxy.
 */
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  const startedAt = Date.now();
  console.log("[cron/advance-club-run-instances] start");

  try {
    const seriesRows = await prisma.run_series.findMany({
      where: { runClubId: { not: null } },
      select: { runClubId: true },
      distinct: ["runClubId"],
    });

    const clubIds = seriesRows
      .map((row) => row.runClubId?.trim())
      .filter((id): id is string => Boolean(id));

    console.log("[cron/advance-club-run-instances] clubs_with_series", {
      clubCount: clubIds.length,
    });

    const clubResults: Array<{
      runClubId: string;
      created: number;
      found: number;
      skipped: number;
      errorCount: number;
    }> = [];

    let totalCreated = 0;
    let totalFound = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const runClubId of clubIds) {
      try {
        const results = await advanceClubInstances({ runClubId });
        let created = 0;
        let found = 0;
        let skipped = 0;
        let errorCount = 0;

        for (const row of results) {
          if (row.outcome === "created") created++;
          else if (row.outcome === "found_existing") found++;
          else if (row.outcome === "skipped_no_prior") skipped++;
          else if (row.outcome === "error") errorCount++;
        }

        clubResults.push({
          runClubId,
          created,
          found,
          skipped,
          errorCount,
        });

        totalCreated += created;
        totalFound += found;
        totalSkipped += skipped;
        totalErrors += errorCount;

        if (created > 0 || errorCount > 0) {
          console.log("[cron/advance-club-run-instances] club_result", {
            runClubId,
            created,
            found,
            skipped,
            errorCount,
          });
        }
      } catch (error: unknown) {
        totalErrors += 1;
        const message = error instanceof Error ? error.message : "Unknown error";
        clubResults.push({
          runClubId,
          created: 0,
          found: 0,
          skipped: 0,
          errorCount: 1,
        });
        console.error("[cron/advance-club-run-instances] club_failed", {
          runClubId,
          error: message,
        });
      }
    }

    const elapsedMs = Date.now() - startedAt;
    console.log("[cron/advance-club-run-instances] complete", {
      clubCount: clubIds.length,
      totalCreated,
      totalFound,
      totalSkipped,
      totalErrors,
      elapsedMs,
    });

    return NextResponse.json({
      ok: totalErrors === 0,
      message: `Advanced ${totalCreated} run(s) across ${clubIds.length} club(s)`,
      totals: {
        clubs: clubIds.length,
        created: totalCreated,
        found: totalFound,
        skipped: totalSkipped,
        errors: totalErrors,
      },
      clubResults,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[cron/advance-club-run-instances] fatal", { error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
