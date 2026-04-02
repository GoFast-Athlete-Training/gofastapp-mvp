export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { prisma } from "@/lib/prisma";
import { askReikiCoach } from "@/lib/coach/reiki-coach";

/** POST /api/ask-coach — { message: string } */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { athlete } = auth;

    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const activeGoal = await prisma.athleteGoal.findFirst({
      where: { athleteId: athlete.id, status: "ACTIVE" },
      orderBy: { targetByDate: "asc" },
      include: {
        race_registry: {
          select: {
            name: true,
            raceDate: true,
            city: true,
            state: true,
            distanceMiles: true,
            raceType: true,
          },
        },
      },
    });

    let goalSummary: string | null = null;
    if (activeGoal) {
      const bits: string[] = [];
      bits.push(`Distance: ${activeGoal.distance}`);
      if (activeGoal.goalTime) bits.push(`Goal time: ${activeGoal.goalTime}`);
      if (activeGoal.targetByDate) {
        bits.push(`Target by: ${activeGoal.targetByDate.toISOString().slice(0, 10)}`);
      }
      if (activeGoal.race_registry) {
        const r = activeGoal.race_registry;
        bits.push(
          `Race: ${r.name}${r.raceDate ? ` on ${r.raceDate.toISOString().slice(0, 10)}` : ""}${r.city ? ` (${r.city}${r.state ? `, ${r.state}` : ""})` : ""}${r.distanceMiles != null ? ` — ${r.distanceMiles} mi` : ""}`
        );
      }
      goalSummary = bits.join(". ");
    }

    const reply = await askReikiCoach({
      userMessage: message,
      context: {
        fiveKPace: athlete.fiveKPace,
        goalSummary,
      },
    });

    return NextResponse.json({ reply });
  } catch (err: unknown) {
    console.error("POST /api/ask-coach:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("OPENAI_API_KEY")) {
      return NextResponse.json(
        { error: "Coach is temporarily unavailable", details: msg },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Failed to get coach response", details: msg }, { status: 500 });
  }
}
