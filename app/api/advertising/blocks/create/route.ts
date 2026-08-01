export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

/** @deprecated Block creation retired — use Company /api/sponsorship/checkout + webhook finalize-paid */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      retired: true,
      error: "Use Company sponsorship checkout orchestration instead of Brand block create.",
    },
    { status: 410 },
  );
}
