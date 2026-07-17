export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { discoverClubSurfaces } from "@/lib/advertising-inventory/discover-club-surfaces";
import {
  unauthorizedInternal,
  verifyInternalApiKey,
} from "@/lib/server/verify-internal-api-key";

/**
 * GET /api/advertising-inventory/clubs
 * Service-auth club surfaces for advertiser destination picker.
 */
export async function GET(request: Request) {
  if (!verifyInternalApiKey(request)) return unauthorizedInternal();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? undefined;

  try {
    const surfaces = await discoverClubSurfaces(q);
    return NextResponse.json({ success: true, surfaces });
  } catch (error: unknown) {
    console.error("[advertising-inventory/clubs]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch club inventory" },
      { status: 500 }
    );
  }
}
