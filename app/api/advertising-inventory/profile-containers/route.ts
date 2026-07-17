export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { discoverProfileContainerSurfaces } from "@/lib/advertising-inventory/discover-profile-containers";
import {
  unauthorizedInternal,
  verifyInternalApiKey,
} from "@/lib/server/verify-internal-api-key";

/**
 * GET /api/advertising-inventory/profile-containers
 * Service-auth profile container surfaces (athlete opt-in = published container).
 */
export async function GET(request: Request) {
  if (!verifyInternalApiKey(request)) return unauthorizedInternal();

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? undefined;

  try {
    const surfaces = await discoverProfileContainerSurfaces(q);
    return NextResponse.json({ success: true, surfaces });
  } catch (error: unknown) {
    console.error("[advertising-inventory/profile-containers]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch profile container inventory" },
      { status: 500 }
    );
  }
}
