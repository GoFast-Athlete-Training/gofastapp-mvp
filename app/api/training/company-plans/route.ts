export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { ymdFromDate } from "@/lib/training/plan-utils";

export async function GET(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const athleteId = searchParams.get("athleteId")?.trim() || undefined;

  const plans = await prisma.training_plans.findMany({
    where: athleteId ? { athleteId } : {},
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      Athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          gofastHandle: true,
        },
      },
      race_registry: {
        select: { id: true, name: true, raceDate: true },
      },
      training_plan_preset: {
        select: { id: true, slug: true, title: true },
      },
      _count: { select: { planned_workouts: true } },
    },
  });

  const rows = plans.map((p) => ({
    ...p,
    startDate: ymdFromDate(p.startDate),
    race_registry: p.race_registry
      ? {
          ...p.race_registry,
          raceDate: ymdFromDate(p.race_registry.raceDate),
        }
      : null,
  }));

  return NextResponse.json({ success: true, plans: rows });
}
