import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/race-trainer
 * List open/active training cohorts, optionally filtered by ?raceId=
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const raceId = searchParams.get("raceId");

    const cohorts = await prisma.training_cohorts.findMany({
      where: {
        status: { in: ["OPEN", "ACTIVE"] },
        ...(raceId ? { raceId } : {}),
      },
      include: {
        race_registry: {
          select: {
            id: true,
            name: true,
            raceDate: true,
            city: true,
            state: true,
            slug: true,
          },
        },
        hostAthlete: {
          select: {
            id: true,
            firstName: true,
            gofastHandle: true,
          },
        },
        _count: {
          select: { memberships: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const groups = cohorts.map((c) => ({
      id: c.id,
      raceId: c.raceId,
      companyRaceId: c.companyRaceId,
      hostAthleteId: c.hostAthleteId,
      name: c.cohortName,
      handle: c.handle,
      description: c.description,
      logo: c.logo,
      joinCode: c.joinCode,
      city: c.city,
      state: c.state,
      isActive: c.status === "OPEN" || c.status === "ACTIVE",
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      race_registry: c.race_registry,
      _count: { race_trainer_members: c._count.memberships },
    }));

    return NextResponse.json({ success: true, groups });
  } catch (error: unknown) {
    console.error("❌ RACE-TRAINER GET:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch trainer groups";
    return NextResponse.json(
      { success: false, error: "Failed to fetch trainer groups", details: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/race-trainer
 * Create a training cohort for a race.
 * Body: { raceId, presetId, name, description?, city?, state?, companyRaceId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { raceId, presetId, name, description, city, state, companyRaceId } = body;

    if (!raceId || !presetId || !name?.trim()) {
      return NextResponse.json(
        { success: false, error: "raceId, presetId, and name are required" },
        { status: 400 }
      );
    }

    const race = await prisma.race_registry.findUnique({ where: { id: raceId } });
    if (!race) {
      return NextResponse.json(
        { success: false, error: "Race not found in registry" },
        { status: 404 }
      );
    }

    const preset = await prisma.training_plan_preset.findUnique({ where: { id: presetId } });
    if (!preset) {
      return NextResponse.json(
        { success: false, error: "Training preset not found" },
        { status: 404 }
      );
    }

    const baseHandle = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const handle = `${baseHandle}-${Math.random().toString(36).slice(2, 6)}`;
    const joinCode = Math.random().toString(36).slice(2, 8).toUpperCase();

    const cohort = await prisma.training_cohorts.create({
      data: {
        raceId,
        presetId,
        companyRaceId: companyRaceId || null,
        cohortName: name.trim(),
        handle,
        joinCode,
        description: description?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        status: "DRAFT",
      },
      include: {
        race_registry: {
          select: { id: true, name: true, raceDate: true, city: true, state: true },
        },
      },
    });

    const group = {
      id: cohort.id,
      raceId: cohort.raceId,
      companyRaceId: cohort.companyRaceId,
      name: cohort.cohortName,
      handle: cohort.handle,
      description: cohort.description,
      city: cohort.city,
      state: cohort.state,
      isActive: false,
      race_registry: cohort.race_registry,
    };

    return NextResponse.json({ success: true, group }, { status: 201 });
  } catch (error: unknown) {
    console.error("❌ RACE-TRAINER POST:", error);
    const message = error instanceof Error ? error.message : "Failed to create trainer group";
    return NextResponse.json(
      { success: false, error: "Failed to create trainer group", details: message },
      { status: 500 }
    );
  }
}
