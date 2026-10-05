export const dynamic = "force-dynamic";

import { verifyInternalApiKey } from "@/lib/internal-api-auth";
import { cascadeDeleteProdBrand } from "@/lib/prod-brand-cascade-delete";
import { NextRequest, NextResponse } from "next/server";

/** POST — machine lane: clear city run brand stamps and delete prod brands row. */
export async function POST(request: NextRequest) {
  const authError = verifyInternalApiKey(request);
  if (authError) return authError;

  let body: { brandId?: string };
  try {
    body = (await request.json()) as { brandId?: string };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const brandId = body.brandId?.trim();
  if (!brandId) {
    return NextResponse.json({ success: false, error: "brandId is required" }, { status: 400 });
  }

  const result = await cascadeDeleteProdBrand(brandId);
  return NextResponse.json({ success: true, ...result });
}
