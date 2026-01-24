import { NextRequest, NextResponse } from "next/server";
import { fetchAndSaveRunClub } from "@/lib/runclub-sync";

export const dynamic = "force-dynamic";

/**
 * POST /api/runclub/pull-and-save
 * 
 * Pulls RunClub data from GoFastCompany API and saves it to gofastapp-mvp database
 * This allows us to display RunClub logos/names without cross-repo queries
 * 
 * Body: { slug: string } - RunClub slug to pull
 * 
 * Note: This endpoint is mainly for manual/admin use.
 * RunClub data is automatically synced when runs are created (dual save pattern).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug } = body;

    if (!slug || !slug.trim()) {
      return NextResponse.json(
        { success: false, error: "slug is required" },
        { status: 400 }
      );
    }

    const savedRunClub = await fetchAndSaveRunClub(slug);

    if (!savedRunClub) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch RunClub from GoFastCompany or RunClub not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      runClub: savedRunClub,
    });
  } catch (error: any) {
    console.error("❌ RUNCLUB PULL-AND-SAVE: Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to pull and save RunClub",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

