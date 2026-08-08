export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";
import {
  ATHLETE_POINTS_REDEEM_HINT,
  computeAthletePoints,
} from "@/lib/athlete-points-config";

const CITY_RUN_TYPES = ["CLUB", "INDIVIDUAL", "RUN_CREW"] as const;

/** GET /api/me/points — personal lifetime points (derived from RSVPs + check-ins) */
export async function GET(request: Request) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { athlete } = auth;

  try {
    const cityRunScope = {
      city_runs: { cityRunType: { in: [...CITY_RUN_TYPES] } },
    };

    const [rsvpGoingCount, checkinCount] = await Promise.all([
      prisma.city_run_rsvps.count({
        where: {
          athleteId: athlete.id,
          status: "going",
          ...cityRunScope,
        },
      }),
      prisma.city_run_checkins.count({
        where: {
          athleteId: athlete.id,
          ...cityRunScope,
        },
      }),
    ]);

    const { total, breakdown, weights } = computeAthletePoints({
      rsvpGoingCount,
      checkinCount,
    });

    return NextResponse.json({
      total,
      breakdown,
      weights,
      redeemHint: ATHLETE_POINTS_REDEEM_HINT,
    });
  } catch (err: unknown) {
    console.error("GET /api/me/points:", err);
    return NextResponse.json(
      {
        error: "Server error",
        details: err instanceof Error ? err.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
