import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/runs/by-runclub/[slug]
 * 
 * Get CityRuns associated with a RunClub by slug
 * CityRun is a universal run system - this endpoint filters by RunClub association
 * Returns upcoming CityRuns only (startDate >= today)
 * 
 * Returns: {
 *   success: true,
 *   runs: [...]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "slug is required" },
        { status: 400 }
      );
    }

    // Find run club by slug
    const runClub = await prisma.run_clubs.findUnique({
      where: { slug: slug.trim() },
      select: { id: true, slug: true },
    });

    if (!runClub) {
      return NextResponse.json(
        { success: false, error: "Run club not found" },
        { status: 404 }
      );
    }

    // Get upcoming runs for this run club
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const runs = await prisma.city_runs.findMany({
      where: {
        runClubId: runClub.id,
        startDate: { gte: today },
      },
      include: {
        runClub: {
          select: {
            id: true,
            slug: true,
            name: true,
            logoUrl: true,
          },
        },
      },
      orderBy: {
        startDate: "asc",
      },
      take: 20, // Limit to 20 upcoming runs
    });

    // Transform to public-safe format (include slug for share URLs)
    const publicRuns = runs.map((run) => ({
      id: run.id,
      slug: run.slug ?? null,
      title: run.title,
      date: run.date.toISOString(),
      startDate: run.startDate.toISOString(),
      startTimeHour: run.startTimeHour,
      startTimeMinute: run.startTimeMinute,
      startTimePeriod: run.startTimePeriod,
      meetUpPoint: run.meetUpPoint,
      meetUpAddress: run.meetUpAddress,
      meetUpStreetAddress: run.meetUpStreetAddress,
      meetUpCity: run.meetUpCity,
      meetUpState: run.meetUpState,
      totalMiles: run.totalMiles,
      pace: run.pace,
      description: run.description,
      citySlug: run.citySlug,
      runClub: run.runClub
        ? {
            id: run.runClub.id,
            slug: run.runClub.slug,
            name: run.runClub.name,
            logoUrl: run.runClub.logoUrl,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      runs: publicRuns,
    });
  } catch (error: any) {
    console.error("Error fetching CityRuns by RunClub:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch CityRuns",
        details: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
