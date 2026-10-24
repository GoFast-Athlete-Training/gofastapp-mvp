export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { upsertProdRunStoreSnap } from "@/lib/prod-run-store-snap";
import { verifyInternalApiKey } from "@/lib/internal-api-auth";

/** POST /api/internal/run-stores/snap-sync — machine lane from Sponsor Manage. */
export async function POST(request: NextRequest) {
  const authError = verifyInternalApiKey(request);
  if (authError) return authError;

  let body: { store?: Parameters<typeof upsertProdRunStoreSnap>[0] };
  try {
    body = (await request.json()) as { store?: Parameters<typeof upsertProdRunStoreSnap>[0] };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.store) {
    return NextResponse.json({ success: false, error: "store payload is required" }, { status: 400 });
  }

  const result = await upsertProdRunStoreSnap(body.store);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, store: result.store });
}
