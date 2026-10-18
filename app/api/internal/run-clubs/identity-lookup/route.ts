export const dynamic = "force-dynamic";

import { verifyInternalApiKey } from "@/lib/internal-api-auth";
import { findProdClubIdentityMatch } from "@/lib/run-clubs/club-identity";
import { NextRequest, NextResponse } from "next/server";

/** POST /api/internal/run-clubs/identity-lookup */
export async function POST(request: NextRequest) {
  const authError = verifyInternalApiKey(request);
  if (authError) return authError;

  let body: { name?: string; city?: string; reference?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const city = body.city?.trim() ?? "";
  const reference = body.reference?.trim() ?? "";

  if (!name || !city || !reference) {
    return NextResponse.json(
      { success: false, error: "name, city, and reference are required" },
      { status: 400 },
    );
  }

  const match = await findProdClubIdentityMatch({ name, city, reference });

  return NextResponse.json({ success: true, match });
}
