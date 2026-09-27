export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  parseRacePlanFromPaste,
  RacePlanParseError,
} from "@/lib/races/race-plan-builder";

/** POST — parse pasted race plan document into planJson. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const sourceText = typeof body.sourceText === "string" ? body.sourceText : "";
    const planJson = parseRacePlanFromPaste(sourceText);
    return NextResponse.json({ planJson });
  } catch (e: unknown) {
    const msg =
      e instanceof RacePlanParseError ? e.message : e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
