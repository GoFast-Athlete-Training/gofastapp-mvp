import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/runclub/pull-and-save
 * 
 * Pulls RunClub data from GoFastCompany API and saves it to gofastapp-mvp database
 * This allows us to display RunClub logos/names without cross-repo queries
 * 
 * Body: { slug: string } - RunClub slug to pull
 * 
 * Strategy:
 * 1. Fetch RunClub from GoFastCompany API by slug
 * 2. Upsert into gofastapp-mvp run_clubs table
 * 3. Return the saved RunClub data
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

    // Get GoFastCompany API URL from environment
    const gofastCompanyApiUrl = process.env.GOFAST_COMPANY_API_URL || process.env.NEXT_PUBLIC_GOFAST_COMPANY_API_URL;
    
    if (!gofastCompanyApiUrl) {
      return NextResponse.json(
        { success: false, error: "GOFAST_COMPANY_API_URL not configured" },
        { status: 500 }
      );
    }

    // Fetch AcqRunClub from GoFastCompany API (canonical model)
    // Note: After consolidation, this will be /api/runclub/by-slug/[slug]
    // For now, using runclub-public endpoint which will be updated
    const apiUrl = `${gofastCompanyApiUrl}/api/runclub-public/by-slug/${slug}`;
    
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // TODO: Add auth header if needed
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { success: false, error: "RunClub not found in GoFastCompany" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, error: "Failed to fetch RunClub from GoFastCompany" },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    if (!data.success || !data.runClub) {
      return NextResponse.json(
        { success: false, error: "Invalid response from GoFastCompany API" },
        { status: 500 }
      );
    }

    const runClub = data.runClub;

    // Upsert into gofastapp-mvp database
    // Only pull minimal fields needed for card/run display (name, logo, city)
    // All rich data stays in GoFastCompany for SEO/public pages
    const savedRunClub = await prisma.run_clubs.upsert({
      where: { slug },
      update: {
        name: runClub.name,
        logoUrl: runClub.logoUrl || runClub.logo || null, // Handle both logoUrl and logo fields
        city: runClub.city || null,
        syncedAt: new Date(),
      },
      create: {
        slug: runClub.slug,
        name: runClub.name,
        logoUrl: runClub.logoUrl || runClub.logo || null, // Handle both logoUrl and logo fields
        city: runClub.city || null,
        syncedAt: new Date(),
      },
    });

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

