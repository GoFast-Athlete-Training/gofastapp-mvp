export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  serializeStaffPlanPreset,
  staffPlanPresetInclude,
} from "@/lib/training/preset-staff-serialize";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Staff GET — full preset list for Training Manage (prod SOT). */
export async function GET(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const rows = await prisma.training_plan_preset.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      targetDistanceLabel: true,
      buildPreset: { select: { name: true, peakLongRunMiles: true, maxWeeklyMiles: true } },
      taperPreset: { select: { name: true } },
      raceWeekPreset: { select: { title: true } },
    },
  });

  return NextResponse.json({
    success: true,
    presets: rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      description: r.description,
      targetDistanceLabel: r.targetDistanceLabel,
      snapPeakLongRunMiles: r.buildPreset?.peakLongRunMiles ?? null,
      snapPeakWeeklyMiles: r.buildPreset?.maxWeeklyMiles ?? null,
      buildPreset: r.buildPreset,
      taperPreset: r.taperPreset,
      raceWeekPreset: r.raceWeekPreset,
    })),
  });
}

/** Staff POST — minimal prod preset for the Training Manage wizard. */
export async function POST(request: NextRequest) {
  const authError = await assertStaffBearerAuth(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => ({}))) as { title?: string };
  const title = body.title?.trim() || "Untitled";
  const baseSlug = slugify(title);
  let slug = baseSlug || `preset-${Date.now()}`;
  let n = 0;
  while (await prisma.training_plan_preset.findUnique({ where: { slug } })) {
    n += 1;
    slug = `${baseSlug || "preset"}-${n}`;
  }

  const preset = await prisma.training_plan_preset.create({
    data: {
      slug,
      title,
      description: "",
    },
    include: staffPlanPresetInclude,
  });

  return NextResponse.json({ success: true, preset: serializeStaffPlanPreset(preset) });
}
