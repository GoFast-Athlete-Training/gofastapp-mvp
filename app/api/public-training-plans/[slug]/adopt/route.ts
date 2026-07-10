export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ slug: string }> };

/** POST /api/public-training-plans/[slug]/adopt — deferred in public plan groundwork pass */
export async function POST(_request: Request, _context: Ctx) {
  return NextResponse.json(
    { error: "Plan adoption is not available yet. Start from the public plan preview in GoFast." },
    { status: 501 }
  );
}
