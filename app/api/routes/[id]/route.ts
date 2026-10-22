import { NextRequest, NextResponse } from "next/server";
import {
  loadPublicRouteBySegment,
  normalizeRoutePhotoUrls,
} from "@/lib/city-run/resolve-route-segment";

export const dynamic = "force-dynamic";

/**
 * GET /api/routes/[id]
 * Public read of a single route (segment = routes.id today; slug when added).
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

    const route = await loadPublicRouteBySegment(id.trim());
    if (!route) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      route: {
        ...route,
        routePhotos: normalizeRoutePhotoUrls(route.routePhotos),
      },
    });
  } catch (error: unknown) {
    console.error("GET /api/routes/[id]:", error);
    const message = error instanceof Error ? error.message : "Failed to load route";
    return NextResponse.json(
      { success: false, error: "Failed to load route", details: message },
      { status: 500 }
    );
  }
}
