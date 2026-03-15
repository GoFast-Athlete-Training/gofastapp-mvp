import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/race-trainer
 * List all active race trainer groups, optionally filtered by ?raceId=
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const raceId = searchParams.get("raceId");

    const groups = await prisma.race_trainer_groups.findMany({
      where: {
        isActive: true,
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
        _count: {
          select: { race_trainer_members: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, groups });
  } catch (error: any) {
    console.error("❌ RACE-TRAINER GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch trainer groups", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/race-trainer
 * Create a new race trainer group for a specific race.
 * Body: { raceId, name, description?, city?, state?, companyRaceId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { raceId, name, description, city, state, companyRaceId } = body;

    if (!raceId || !name?.trim()) {
      return NextResponse.json(
        { success: false, error: "raceId and name are required" },
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

    // Generate handle from name + random suffix
    const baseHandle = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const handle = `${baseHandle}-${Math.random().toString(36).slice(2, 6)}`;
    const joinCode = Math.random().toString(36).slice(2, 8).toUpperCase();

    const group = await prisma.race_trainer_groups.create({
      data: {
        raceId,
        companyRaceId: companyRaceId || null,
        name: name.trim(),
        handle,
        joinCode,
        description: description?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
      },
      include: {
        race_registry: {
          select: { id: true, name: true, raceDate: true, city: true, state: true },
        },
      },
    });

    return NextResponse.json({ success: true, group }, { status: 201 });
  } catch (error: any) {
    console.error("❌ RACE-TRAINER POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create trainer group", details: error?.message },
      { status: 500 }
    );
  }
}
