export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";
import {
  analyzeRaceResult,
  createRaceResult,
  getRaceResultByGoalId,
  listRaceResultsByRegistry,
  saveRaceResultExtended,
} from "@/lib/race-result-service";

export async function GET(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { athlete } = auth;
  const goalId = request.nextUrl.searchParams.get("goalId");
  const raceRegistryId = request.nextUrl.searchParams.get("raceRegistryId");
  try {
    if (goalId?.trim()) {
      const result = await getRaceResultByGoalId(athlete.id, goalId.trim());
      let analysis = null;
      if (result?.goalId) {
        const g = await prisma.athleteGoal.findFirst({
          where: { id: result.goalId, athleteId: athlete.id },
          include: { race_registry: { select: { name: true } } },
        });
        if (g) {
          analysis = analyzeRaceResult(
            result,
            g,
            g.race_registry?.name ?? "Your race"
          );
        }
      }
      return NextResponse.json({ result, analysis });
    }
    if (raceRegistryId?.trim()) {
      const results = await listRaceResultsByRegistry(athlete.id, raceRegistryId.trim());
      return NextResponse.json({ results });
    }
    return NextResponse.json({ error: "goalId or raceRegistryId is required" }, { status: 400 });
  } catch (err) {
    console.error("GET /api/race-results:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { athlete } = auth;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raceRegistryId =
    typeof body.raceRegistryId === "string" && body.raceRegistryId.trim()
      ? body.raceRegistryId.trim()
      : null;
  const goalId =
    typeof body.goalId === "string" && body.goalId.trim() ? body.goalId.trim() : null;

  try {
    // LogRaceResultSheet & training day: full payload with raceRegistryId
    if (raceRegistryId) {
      const out = await saveRaceResultExtended(athlete.id, {
        raceRegistryId,
        goalId,
        signupId: typeof body.signupId === "string" ? body.signupId : null,
        officialFinishTime:
          typeof body.officialFinishTime === "string" ? body.officialFinishTime : null,
        chipTime: typeof body.chipTime === "string" ? body.chipTime : null,
        gunTime: typeof body.gunTime === "string" ? body.gunTime : null,
        garminActivityId:
          typeof body.garminActivityId === "string" ? body.garminActivityId : null,
        notes: typeof body.notes === "string" ? body.notes : null,
        overallPlace:
          typeof body.overallPlace === "number" && Number.isFinite(body.overallPlace)
            ? body.overallPlace
            : null,
        ageGroupPlace:
          typeof body.ageGroupPlace === "number" && Number.isFinite(body.ageGroupPlace)
            ? body.ageGroupPlace
            : null,
        howFeltRating: typeof body.howFeltRating === "number" ? body.howFeltRating : null,
        reflection: typeof body.reflection === "string" ? body.reflection : null,
      });
      return NextResponse.json({
        result: out.result,
        analysis: out.analysis,
        raceName: out.raceName,
      });
    }

    // Simple modal: goal + time only
    if (goalId) {
      const officialFinishTime =
        typeof body.officialFinishTime === "string" ? body.officialFinishTime : "";
      const out = await createRaceResult(athlete.id, {
        goalId,
        officialFinishTime,
        howFeltRating: typeof body.howFeltRating === "number" ? body.howFeltRating : null,
        notes: typeof body.notes === "string" ? body.notes : null,
        reflection: typeof body.reflection === "string" ? body.reflection : null,
      });
      return NextResponse.json({
        result: out.result,
        analysis: out.analysis,
        raceName: out.raceName,
      });
    }

    return NextResponse.json({ error: "raceRegistryId or goalId is required" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    if (
      msg.includes("not found") ||
      msg.includes("Link this goal") ||
      msg.includes("does not match")
    ) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("POST /api/race-results:", err);
    return NextResponse.json({ error: "Server error", details: msg }, { status: 500 });
  }
}
