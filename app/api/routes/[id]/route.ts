import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/routes/[id]
 * Public read of a single route (for hydration / display).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const route = await prisma.routes.findUnique({
      where: { id: id.trim() },
      select: {
        id: true,
        name: true,
        stravaUrl: true,
        distanceMiles: true,
        stravaMapUrl: true,
        mapImageUrl: true,
        routePhotos: true,
        routeNeighborhood: true,
        runType: true,
        gofastCity: true,
      },
    });

    if (!route) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, route });
  } catch (error: any) {
    console.error("GET /api/routes/[id]:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load route", details: error?.message },
      { status: 500 }
    );
  }
}
