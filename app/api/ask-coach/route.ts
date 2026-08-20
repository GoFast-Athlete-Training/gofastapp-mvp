export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAthleteFromBearer } from "@/lib/training/require-athlete";
import { askReikiCoach } from "@/lib/coach/reiki-coach";

/** POST /api/ask-coach — dumb one-shot Q&A stub (no athlete goal context yet). */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAthleteFromBearer(request);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const reply = await askReikiCoach({
      userMessage: message,
      context: {},
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
