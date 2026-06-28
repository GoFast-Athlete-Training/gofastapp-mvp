export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { serializePlanPersona } from "@/lib/training/plan-entity-serialize";
import { findPersonaBySlug, upsertPersonaBySlug } from "@/lib/training/plan-persona-goal";
import { normalizeSlug } from "@/lib/training/plan-entity-slugs";
import type { AthletePersonaCapability, AthletePersonaDedication } from "@prisma/client";

export async function GET(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const slug = request.nextUrl.searchParams.get("slug");
  if (slug?.trim()) {
    const row = await findPersonaBySlug(slug);
    if (!row) {
      return NextResponse.json({ success: true, persona: null, matched: false });
    }
    return NextResponse.json({
      success: true,
      persona: serializePlanPersona(row),
      matched: true,
    });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase();
  const personas = await prisma.training_plan_persona.findMany({
    orderBy: { updatedAt: "desc" },
    take: q ? 50 : 200,
    ...(q
      ? {
          where: {
            OR: [
              { slug: { contains: q } },
              { title: { contains: q, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  });

  return NextResponse.json({
    success: true,
    personas: personas.map(serializePlanPersona),
  });
}

export async function POST(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ success: false, error: "title is required" }, { status: 400 });
    }

    const capability =
      typeof body.capability === "string"
        ? (body.capability.trim().toUpperCase() as AthletePersonaCapability)
        : null;
    const dedication =
      typeof body.dedication === "string"
        ? (body.dedication.trim().toUpperCase() as AthletePersonaDedication)
        : null;

    const slugOverride = typeof body.slug === "string" ? normalizeSlug(body.slug) : "";

    const row = await upsertPersonaBySlug({
      slug: slugOverride || undefined,
      personaSlug: typeof body.personaSlug === "string" ? body.personaSlug : undefined,
      title,
      capability,
      dedication,
      personaGoalLabel:
        typeof body.personaGoalLabel === "string" ? body.personaGoalLabel : null,
      intentSummary: typeof body.intentSummary === "string" ? body.intentSummary : null,
      workoutFrequencyCap:
        typeof body.workoutFrequencyCap === "number" ? body.workoutFrequencyCap : null,
    });

    return NextResponse.json(
      { success: true, persona: serializePlanPersona(row) },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
