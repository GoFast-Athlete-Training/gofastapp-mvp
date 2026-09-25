export const dynamic = "force-dynamic";

import { verifyInternalApiKey } from "@/lib/internal-api-auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const seriesSelect = {
  id: true,
  slug: true,
  name: true,
  dayOfWeek: true,
  description: true,
  seriesRunRawText: true,
  workflowStatus: true,
  citySlug: true,
  startTimeHour: true,
  startTimeMinute: true,
  startTimePeriod: true,
  meetUpPoint: true,
  meetUpStreetAddress: true,
  meetUpCity: true,
  meetUpState: true,
  meetUpPlaceId: true,
  meetUpLat: true,
  meetUpLng: true,
  runType: true,
  totalMiles: true,
  routeNeighborhood: true,
  workoutDescription: true,
  postRunActivity: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * GET /api/internal/run-clubs/[id]/club-manage-export
 * Machine lane — full prod club + series for gf-clubmanage import.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const authError = verifyInternalApiKey(request);
  if (authError) return authError;

  const { id } = await context.params;

  const runClub = await prisma.run_clubs.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      citySlug: true,
      state: true,
      neighborhood: true,
      description: true,
      allRunsDescription: true,
      runUrl: true,
      logoUrl: true,
      websiteUrl: true,
      instagramUrl: true,
      stravaUrl: true,
      createdAt: true,
      updatedAt: true,
      runSeries: {
        select: seriesSelect,
        orderBy: { dayOfWeek: "asc" },
      },
    },
  });

  if (!runClub) {
    return NextResponse.json({ success: false, error: "Run club not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    runClub: {
      ...runClub,
      runSeries: runClub.runSeries ?? [],
    },
  });
}
