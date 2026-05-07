export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import {
  normalizeRacePhotoUrls,
  updateRaceResultById,
  updateRaceResultReflection,
} from "@/lib/race-result-service";

type RouteContext = { params: Promise<{ id: string }> };

function pickOptionalString(
  body: Record<string, unknown>,
  key: string
): string | null | undefined {
  if (!(key in body)) return undefined;
  const v = body[key];
  if (v === null) return null;
  if (typeof v === "string") return v;
  return undefined;
}

function pickOptionalNumber(
  body: Record<string, unknown>,
  key: string
): number | null | undefined {
  if (!(key in body)) return undefined;
  const v = body[key];
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

/** PUT — update reflection-only fields, or full race result (time + activity link) when present. */
export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAthleteFromBearer(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { athlete } = auth;
  const { id: resultId } = await context.params;
  if (!resultId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hasRaceFields =
    "officialFinishTime" in body ||
    "chipTime" in body ||
    "gunTime" in body ||
    "garminActivityId" in body ||
    "signupId" in body ||
    "goalId" in body ||
    "overallPlace" in body ||
    "ageGroupPlace" in body;

  try {
    if (hasRaceFields) {
      const out = await updateRaceResultById(athlete.id, resultId, {
        signupId: pickOptionalString(body, "signupId"),
        goalId: pickOptionalString(body, "goalId"),
        officialFinishTime: pickOptionalString(body, "officialFinishTime"),
        chipTime: pickOptionalString(body, "chipTime"),
        gunTime: pickOptionalString(body, "gunTime"),
        garminActivityId: pickOptionalString(body, "garminActivityId"),
        notes: pickOptionalString(body, "notes"),
        overallPlace: pickOptionalNumber(body, "overallPlace"),
        ageGroupPlace: pickOptionalNumber(body, "ageGroupPlace"),
        howFeltRating: pickOptionalNumber(body, "howFeltRating"),
        reflection: pickOptionalString(body, "reflection"),
        racePhotoUrls: normalizeRacePhotoUrls(body.racePhotoUrls),
      });
      return NextResponse.json({
        result: out.result,
        analysis: out.analysis,
        raceName: out.raceName,
      });
    }

    const result = await updateRaceResultReflection(athlete.id, resultId, {
      reflection:
        typeof body.reflection === "string" || body.reflection === null
          ? (body.reflection as string | null)
          : undefined,
      notes: typeof body.notes === "string" || body.notes === null ? (body.notes as string | null) : undefined,
      howFeltRating:
        typeof body.howFeltRating === "number" || body.howFeltRating === null
          ? (body.howFeltRating as number | null)
          : undefined,
      racePhotoUrls: normalizeRacePhotoUrls(body.racePhotoUrls),
    });
    return NextResponse.json({ result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    if (msg === "Result not found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    const client400 =
      msg.includes("not found") ||
      msg.includes("does not match") ||
      msg.includes("Invalid race time") ||
      msg.includes("Enter a finish time") ||
      msg.includes("finish time instead") ||
      msg.includes("Activity not found") ||
      msg.includes("does not belong") ||
      msg.includes("no duration");
    if (client400) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("PUT /api/race-results/[id]:", err);
    return NextResponse.json({ error: "Server error", details: msg }, { status: 500 });
  }
}
