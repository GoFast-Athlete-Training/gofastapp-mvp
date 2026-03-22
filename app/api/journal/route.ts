export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { getAthleteByFirebaseId } from "@/lib/domain-athlete";
import { prisma } from "@/lib/prisma";

async function athleteFromAuth(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.substring(7));
    const athlete = await getAthleteByFirebaseId(decoded.uid);
    if (!athlete) {
      return { error: NextResponse.json({ error: "Athlete not found" }, { status: 404 }) };
    }
    return { athlete };
  } catch {
    return { error: NextResponse.json({ error: "Invalid token" }, { status: 401 }) };
  }
}

/** GET /api/journal — list journal entries for authenticated athlete (newest first) */
export async function GET(request: NextRequest) {
  try {
    const { athlete, error } = await athleteFromAuth(request.headers.get("authorization"));
    if (error) return error;

    const entries = await prisma.run_journal_entries.findMany({
      where: { athleteId: athlete!.id },
      orderBy: { date: "desc" },
      take: 200,
    });

    return NextResponse.json({ entries });
  } catch (err: unknown) {
    console.error("GET /api/journal:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}

/** POST /api/journal — create entry { text, date? ISO string } */
export async function POST(request: NextRequest) {
  try {
    const { athlete, error } = await athleteFromAuth(request.headers.get("authorization"));
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    let entryDate = new Date();
    if (body.date != null && body.date !== "") {
      const d = new Date(body.date);
      if (!Number.isNaN(d.getTime())) {
        entryDate = d;
      }
    }

    const entry = await prisma.run_journal_entries.create({
      data: {
        athleteId: athlete!.id,
        date: entryDate,
        text,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ entry });
  } catch (err: unknown) {
    console.error("POST /api/journal:", err);
    return NextResponse.json(
      { error: "Server error", details: err instanceof Error ? err.message : "Unknown" },
      { status: 500 }
    );
  }
}
