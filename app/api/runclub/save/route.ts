import { NextRequest, NextResponse } from "next/server";
import { checkRunClubExists, saveRunClub } from "@/lib/save-runclub";

export const dynamic = "force-dynamic";

/**
 * POST /api/runclub/save
 * 
 * Save RunClub data to gofastapp-mvp database
 * Called BEFORE creating a run to ensure RunClub exists
 * 
 * Body: { 
 *   slug: string,      // Generated slug (used for lookup)
 *   name: string,      // RunClub name
 *   logoUrl?: string,  // Logo URL (or use 'logo' field)
 *   logo?: string,     // Logo field (AcqRunClub uses 'logo')
 *   city?: string      // City name
 * }
 * 
 * NOTE: `id` is NOT accepted - Prisma generates UUID automatically via @default(uuid())
 * 
 * Returns: { 
 *   success: true, 
 *   runClub: {...},
 *   alreadyExists: boolean,  // true if RunClub was already in DB
 *   message: "RunClub ready - ready to accept run"
 * }
 * 
 * Smart behavior:
 * - Checks if RunClub already exists first
 * - If exists: returns existing (no DB write)
 * - If doesn't exist: saves it
 * - If exists but data changed: updates it
 * 
 * This is step 1 of modular flow:
 * 1. Save RunClub → get confirmation ✅
 * 2. Then create run with runClubSlug
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // id is ignored - Prisma generates UUID automatically
    const { slug, name, logoUrl, logo, city } = body;

    // Validate required fields
    if (!slug || !slug.trim()) {
      return NextResponse.json(
        { success: false, error: "slug is required" },
        { status: 400 }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "name is required" },
        { status: 400 }
      );
    }

    // Check if RunClub already exists
    const existing = await checkRunClubExists(slug.trim());
    const alreadyExists = !!existing;

    // Save RunClub data (smart: only saves/updates if needed)
    const savedRunClub = await saveRunClub({
      slug: slug.trim(),
      name: name.trim(),
      logoUrl: logoUrl || logo || null,
      city: city || null,
    });

    if (!savedRunClub) {
      return NextResponse.json(
        { success: false, error: "Failed to save RunClub" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      runClub: savedRunClub,
      alreadyExists,
      message: alreadyExists 
        ? "RunClub already exists - ready to accept run"
        : "RunClub saved successfully - ready to accept run",
    });
  } catch (error: any) {
    console.error("❌ RUNCLUB SAVE: Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save RunClub",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

