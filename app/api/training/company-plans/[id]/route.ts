export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { ymdFromDate } from "@/lib/training/plan-utils";
import { CoachReviewStatus } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id } = await params;

  const plan = await prisma.training_plans.findUnique({
    where: { id },
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
        select: {
          id: true,
          name: true,
          raceDate: true,
          distanceMeters: true,
          distanceLabel: true,
        },
      },
      athlete_goal: {
        select: {
          id: true,
          goalTime: true,
          goalRacePace: true,
          distance: true,
        },
      },
      training_plan_preset: {
        include: {
          volumeConstraints: true,
          workoutConfig: true,
        },
      },
      _count: { select: { planned_workouts: true } },
    },
  });

  if (!plan) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const serialized = {
    ...plan,
    startDate: ymdFromDate(plan.startDate),
    race_registry: plan.race_registry
      ? {
          ...plan.race_registry,
          raceDate: ymdFromDate(plan.race_registry.raceDate),
        }
      : null,
  };

  return NextResponse.json({ success: true, plan: serialized });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const { id } = await params;

  try {
    const body = await request.json();
    const existing = await prisma.training_plans.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = { updatedAt: new Date() };

    if ("presetId" in body) {
      const raw = body.presetId;
      if (raw === null || raw === "") {
        data.presetId = null;
      } else {
        const pid = String(raw).trim();
        const preset = await prisma.training_plan_preset.findUnique({
          where: { id: pid },
          select: { id: true },
        });
        if (!preset) {
          return NextResponse.json({ success: false, error: "presetId not found" }, { status: 400 });
        }
        data.presetId = pid;
      }
    }

    if (body.coachReviewStatus === "PUBLISHED" || body.coachReviewStatus === "DRAFT") {
      data.coachReviewStatus = body.coachReviewStatus as CoachReviewStatus;
      if (body.coachReviewStatus === "PUBLISHED") {
        data.publishedAt = new Date();
        if (typeof body.publishedBy === "string" && body.publishedBy.trim()) {
          data.publishedBy = body.publishedBy.trim();
        }
      } else {
        data.publishedAt = null;
        data.publishedBy = null;
      }
    } else if (typeof body.publishedBy === "string" && "coachReviewStatus" in body === false) {
      data.publishedBy = body.publishedBy.trim() || null;
    }

    const plan = await prisma.training_plans.update({
      where: { id },
      data: data as object,
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
          select: {
            id: true,
            name: true,
            raceDate: true,
            distanceMeters: true,
            distanceLabel: true,
          },
        },
        athlete_goal: {
          select: {
            id: true,
            goalTime: true,
            goalRacePace: true,
            distance: true,
          },
        },
        training_plan_preset: {
          select: { id: true, slug: true, title: true },
        },
        _count: { select: { planned_workouts: true } },
      },
    });

    const serialized = {
      ...plan,
      startDate: ymdFromDate(plan.startDate),
      race_registry: plan.race_registry
        ? {
            ...plan.race_registry,
            raceDate: ymdFromDate(plan.race_registry.raceDate),
          }
        : null,
    };

    return NextResponse.json({ success: true, plan: serialized });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("PATCH /api/training/company-plans/[id]", e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
