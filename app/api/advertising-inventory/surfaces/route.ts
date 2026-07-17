export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { discoverClubSurfaces } from "@/lib/advertising-inventory/discover-club-surfaces";
import { discoverProfileContainerSurfaces } from "@/lib/advertising-inventory/discover-profile-containers";
import type { AdvertisingSurfaceType } from "@/lib/advertising-inventory-types";
import {
  unauthorizedInternal,
  verifyInternalApiKey,
} from "@/lib/server/verify-internal-api-key";

/**
 * GET /api/advertising-inventory/surfaces
 * Combined approved-fields inventory for advertiser platform proxy.
 *
 * Query:
 * - q: search
 * - surfaceType: CLUB_PAGE | PROFILE_CONTAINER (optional filter)
 */
export async function GET(request: Request) {
  if (!verifyInternalApiKey(request)) return unauthorizedInternal();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? undefined;
  const surfaceType = searchParams.get("surfaceType")?.trim() as AdvertisingSurfaceType | undefined;

  try {
    const [clubs, profiles] = await Promise.all([
      !surfaceType || surfaceType === "CLUB_PAGE" ? discoverClubSurfaces(q) : Promise.resolve([]),
      !surfaceType || surfaceType === "PROFILE_CONTAINER"
        ? discoverProfileContainerSurfaces(q)
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      success: true,
      surfaces: [...profiles, ...clubs],
    });
  } catch (error: unknown) {
    console.error("[advertising-inventory/surfaces]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch advertising inventory" },
      { status: 500 }
    );
  }
}
