export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

/** Tutorials are not loaded from Company. The studio uses its local fallback. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug?.trim()) {
    return NextResponse.json({ success: false, error: "slug is required" }, { status: 400 });
  }

  return NextResponse.json({ success: false, error: "Tutorial not found" }, { status: 404 });
}
