export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertStaffBearerAuth } from "@/lib/training/training-engine-auth";
import { serializePlanPresetForApi } from "@/lib/training/quality-percent";
import { parseTargetDistanceLabelFromBody } from "@/lib/training/preset-distance-match";

function slugifyPresetTitle(title: string): string {
  const s = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "preset";
}

function isDow1to7(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 7;
}

const presetInclude = {
  longRunConfig: {
    include: {
      positions: {
        orderBy: { cyclePosition: "asc" as const },
        include: {
          workout_catalogue: {
            select: { id: true, name: true, workoutType: true, slug: true },
          },
        },
      },
    },
  },
  intervalsConfig: {
    include: {
      positions: {
        orderBy: { cyclePosition: "asc" as const },
        include: {
          workout_catalogue: {
            select: { id: true, name: true, workoutType: true, slug: true },
          },
        },
      },
    },
  },
  tempoConfig: {
    include: {
      positions: {
        orderBy: { cyclePosition: "asc" as const },
        include: {
          workout_catalogue: {
            select: { id: true, name: true, workoutType: true, slug: true },
          },
        },
      },
    },
  },
} as const;

export async function GET(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  const presets = await prisma.training_plan_preset.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      longRunConfig: { select: { id: true, name: true, description: true } },
      intervalsConfig: { select: { id: true, name: true, description: true } },
      tempoConfig: { select: { id: true, name: true, description: true } },
    },
  });
  return NextResponse.json({
    success: true,
    presets: presets.map(serializePlanPresetForApi),
  });
}

export async function POST(request: NextRequest) {
  const authErr = await assertStaffBearerAuth(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const { slug: slugBody, title, description, publicDescription } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { success: false, error: "title is required" },
        { status: 400 }
      );
    }

    const slugRaw =
      typeof slugBody === "string" && slugBody.trim()
        ? slugBody.trim().toLowerCase()
        : slugifyPresetTitle(title);
    const slug = slugRaw.replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "") || slugifyPresetTitle(title);

    const existing = await prisma.training_plan_preset.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "A preset with this slug already exists" },
        { status: 409 }
      );
    }

    const needPositive = (v: unknown): number | null => {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
      return null;
    };
    const peakMiles = needPositive(body.peakMiles);
    const baseMiles = needPositive(body.baseMiles);
    const taperMiles = needPositive(body.taperMiles);
    const minWeeklyMiles = needPositive(body.minWeeklyMiles);
    if (peakMiles == null || baseMiles == null || taperMiles == null || minWeeklyMiles == null) {
      return NextResponse.json(
        {
          success: false,
          error:
            "minWeeklyMiles, baseMiles, peakMiles, and taperMiles are required and must be positive numbers",
        },
        { status: 400 }
      );
    }

    const cycleRaw = body.cycleLen;
    const cycleLen =
      typeof cycleRaw === "number" && Number.isFinite(cycleRaw) ? Math.round(cycleRaw) : null;
    if (cycleLen == null || cycleLen < 1 || cycleLen > 8) {
      return NextResponse.json(
        {
          success: false,
          error:
            "cycleLen (long-run cycle: weeks per rotation block, 1 long run per week) is required and must be an integer from 1 to 8",
        },
        { status: 400 }
      );
    }

    let maxWeeklyMiles: number | null = null;
    if ("maxWeeklyMiles" in body) {
      if (body.maxWeeklyMiles === null || body.maxWeeklyMiles === "") {
        maxWeeklyMiles = null;
      } else if (typeof body.maxWeeklyMiles === "number" && Number.isFinite(body.maxWeeklyMiles)) {
        maxWeeklyMiles = Math.max(1, Math.round(body.maxWeeklyMiles));
      } else {
        return NextResponse.json(
          { success: false, error: "maxWeeklyMiles must be a positive number, null, or omitted" },
          { status: 400 }
        );
      }
    }

    async function resolveConfigId(
      key: "longRunConfigId" | "intervalsConfigId" | "tempoConfigId",
      find: (id: string) => Promise<{ id: string } | null>
    ): Promise<string | null | undefined> {
      if (!(key in body)) return undefined;
      const r = (body as Record<string, unknown>)[key];
      if (r === null || r === "") return null;
      if (typeof r !== "string") {
        throw new Error(`${key} must be a string, null, or empty`);
      }
      const row = await find(r);
      if (!row) {
        throw new Error(`${key} is not a valid config`);
      }
      return r;
    }

    const tD = body.tempoIdealDow;
    const iD = body.intervalIdealDow;
    const lD = body.longRunDefaultDow;
    const tNum = typeof tD === "number" && isDow1to7(tD) ? tD : null;
    const iNum = typeof iD === "number" && isDow1to7(iD) ? iD : null;
    const lNum = typeof lD === "number" && isDow1to7(lD) ? lD : null;
    if (tNum == null || iNum == null || lNum == null) {
      return NextResponse.json(
        {
          success: false,
          error: "tempoIdealDow, intervalIdealDow, and longRunDefaultDow are required (1–7)",
        },
        { status: 400 }
      );
    }

    let longRunConfigId: string | null | undefined;
    let intervalsConfigId: string | null | undefined;
    let tempoConfigId: string | null | undefined;
    try {
      longRunConfigId = await resolveConfigId("longRunConfigId", (id) =>
        prisma.long_run_config.findUnique({ where: { id } })
      );
      intervalsConfigId = await resolveConfigId("intervalsConfigId", (id) =>
        prisma.intervals_config.findUnique({ where: { id } })
      );
      tempoConfigId = await resolveConfigId("tempoConfigId", (id) => prisma.tempo_config.findUnique({ where: { id } }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Invalid config id";
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    const tdl = parseTargetDistanceLabelFromBody(body as Record<string, unknown>);
    if (!tdl.ok) {
      return NextResponse.json({ success: false, error: tdl.error }, { status: 400 });
    }

    const preset = await prisma.training_plan_preset.create({
      data: {
        slug,
        title: String(title).trim(),
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
        publicDescription:
          typeof publicDescription === "string" && publicDescription.trim()
            ? publicDescription.trim()
            : null,
        ...(tdl.value !== undefined ? { targetDistanceLabel: tdl.value } : {}),
        cycleLen,
        minWeeklyMiles,
        maxWeeklyMiles: maxWeeklyMiles ?? null,
        baseMiles,
        peakMiles,
        taperMiles,
        tempoIdealDow: tNum,
        intervalIdealDow: iNum,
        longRunDefaultDow: lNum,
        ...(longRunConfigId !== undefined
          ? longRunConfigId
            ? { longRunConfig: { connect: { id: longRunConfigId } } }
            : {}
          : {}),
        ...(intervalsConfigId !== undefined
          ? intervalsConfigId
            ? { intervalsConfig: { connect: { id: intervalsConfigId } } }
            : {}
          : {}),
        ...(tempoConfigId !== undefined
          ? tempoConfigId
            ? { tempoConfig: { connect: { id: tempoConfigId } } }
            : {}
          : {}),
      },
      include: presetInclude,
    });

    return NextResponse.json(
      { success: true, preset: serializePlanPresetForApi(preset) },
      { status: 201 }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Server error";
    console.error("POST /api/training/plan-preset", e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
