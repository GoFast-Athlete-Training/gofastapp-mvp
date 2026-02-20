import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchAndSaveRunClub } from "@/lib/runclub-sync";

export const dynamic = "force-dynamic";

/**
 * POST /api/runclub/pull-and-save-all
 *
 * Bulk sync RunClubs from GoFastCompany into gofastapp-mvp.
 * - If `slugs` is provided, sync only those slugs.
 * - Otherwise sync all slugs currently present in local run_clubs.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const requestedSlugs = Array.isArray(body?.slugs)
      ? body.slugs.filter((s: unknown) => typeof s === "string" && s.trim()).map((s: string) => s.trim())
      : [];

    let slugs: string[] = requestedSlugs;
    if (slugs.length === 0) {
      const rows = await prisma.run_clubs.findMany({
        select: { slug: true },
      });
      slugs = rows.map((r) => r.slug).filter(Boolean);
    }

    if (slugs.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        synced: 0,
        notFound: 0,
        failed: 0,
        message: "No run club slugs to sync",
      });
    }

    let synced = 0;
    let notFound = 0;
    let failed = 0;
    const errors: Array<{ slug: string; error: string }> = [];

    for (const slug of slugs) {
      try {
        const saved = await fetchAndSaveRunClub(slug);
        if (saved) {
          synced += 1;
        } else {
          notFound += 1;
        }
      } catch (error: any) {
        failed += 1;
        errors.push({ slug, error: error?.message || "Unknown error" });
      }
    }

    return NextResponse.json({
      success: true,
      total: slugs.length,
      synced,
      notFound,
      failed,
      errors,
    });
  } catch (error: any) {
    console.error("❌ RUNCLUB PULL-AND-SAVE-ALL: Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to sync all run clubs",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

