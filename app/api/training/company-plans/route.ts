export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma, TrainingPlanLifecycle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { workoutAdherenceByPlanIds } from "@/lib/training/company-plan-adherence";
import { ymdFromDate } from "@/lib/training/plan-utils";

const PAGE_DEFAULT = 50;
const PAGE_MAX = 100;

const LIFECYCLES = new Set<string>(Object.values(TrainingPlanLifecycle));

const planSelect = {
  id: true,
  name: true,
  athleteId: true,
  presetId: true,
  startDate: true,
  startDay: true,
  totalWeeks: true,
  lifecycleStatus: true,
  coachReviewStatus: true,
  goalRaceTime: true,
  updatedAt: true,
  Athlete: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      gofastHandle: true,
      city: true,
      state: true,
    },
  },
  race_registry: {
    select: { id: true, name: true, raceDate: true },
  },
  athlete_race: {
    select: {
      id: true,
      name: true,
      goalTime: true,
      raceDay: true,
      athlete_race_result: {
        select: {
          officialFinishTime: true,
          goalAchieved: true,
        },
      },
    },
  },
} satisfies Prisma.training_plansSelect;

function parseTake(raw: string | null): number | NextResponse {
  if (!raw?.trim()) return PAGE_DEFAULT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > PAGE_MAX) {
    return NextResponse.json(
      { success: false, error: `take must be an integer from 1 to ${PAGE_MAX}` },
      { status: 400 },
    );
  }
  return n;
}

export async function GET(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { searchParams } = new URL(request.url);
  const athleteId = searchParams.get("athleteId")?.trim() || undefined;
  const cursor = searchParams.get("cursor")?.trim() || undefined;
  const q = searchParams.get("q")?.trim().slice(0, 80) || undefined;
  const lifecycleRaw = searchParams.get("lifecycleStatus")?.trim() || undefined;

  if (lifecycleRaw && !LIFECYCLES.has(lifecycleRaw)) {
    return NextResponse.json(
      { success: false, error: "lifecycleStatus must be ACTIVE, PARKED, or ARCHIVED" },
      { status: 400 },
    );
  }

  const takeParsed = parseTake(searchParams.get("take"));
  if (takeParsed instanceof NextResponse) return takeParsed;
  const take = takeParsed;

  const where: Prisma.training_plansWhereInput = {};
  if (athleteId) where.athleteId = athleteId;
  if (lifecycleRaw) where.lifecycleStatus = lifecycleRaw as TrainingPlanLifecycle;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { Athlete: { firstName: { contains: q, mode: "insensitive" } } },
      { Athlete: { lastName: { contains: q, mode: "insensitive" } } },
      { Athlete: { email: { contains: q, mode: "insensitive" } } },
      { Athlete: { gofastHandle: { contains: q, mode: "insensitive" } } },
    ];
  }

  let plans;
  try {
    plans = await prisma.training_plans.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: planSelect,
    });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: unknown }).code) : "";
    if (code === "P2025") {
      return NextResponse.json({ success: false, error: "Invalid cursor" }, { status: 400 });
    }
    console.error("GET /api/training/company-plans", e);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }

  const hasMore = plans.length > take;
  const page = hasMore ? plans.slice(0, take) : plans;
  const adherence = await workoutAdherenceByPlanIds(page.map((p) => p.id));

  const rows = page.map((p) => {
    const counts = adherence.get(p.id) ?? { planned: 0, completed: 0 };
    return {
      ...p,
      startDate: ymdFromDate(p.startDate),
      race_registry: p.race_registry
        ? {
            ...p.race_registry,
            raceDate: ymdFromDate(p.race_registry.raceDate),
          }
        : null,
      adherence: counts,
      _count: { planned_workouts: counts.planned },
    };
  });

  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

  return NextResponse.json({ success: true, plans: rows, nextCursor });
}
