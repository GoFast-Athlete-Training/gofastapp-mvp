import { NextRequest, NextResponse } from "next/server";
import { findLocalRunClubBySlug } from "@/lib/runclub-sync";

export const dynamic = "force-dynamic";

/**
 * POST /api/runclub/pull-and-save
 * Returns the local run club for a slug. Does not fetch Company.
 *
 * Body: { slug: string }
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

    const savedRunClub = await findLocalRunClubBySlug(slug);

    if (!savedRunClub) {
      return NextResponse.json(
        { success: false, error: "Run club not found" },
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

