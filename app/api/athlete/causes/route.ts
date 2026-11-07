import {
  listAthleteCauses,
  upsertAthleteCauseFromRaceRegistry,
  upsertAthleteCauseManual,
} from "@/lib/athlete-causes/athlete-cause-service";
import { requireAthleteWithHandleForLinks } from "@/lib/content/require-athlete-link-tree";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function serialize(c: Awaited<ReturnType<typeof listAthleteCauses>>[number]) {
  return {
    id: c.id,
    name: c.name,
    websiteUrl: c.websiteUrl,
    logoUrl: c.logoUrl,
    note: c.note,
    raceRegistryId: c.raceRegistryId,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

/** GET — list my causes */
export async function GET(request: NextRequest) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const rows = await listAthleteCauses(gate.athlete.id);
  return NextResponse.json({ success: true, causes: rows.map(serialize) });
}

/** POST — create manual or from raceRegistryId */
export async function POST(request: NextRequest) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const raceRegistryId =
    typeof body.raceRegistryId === "string" ? body.raceRegistryId.trim() : "";

  try {
    if (raceRegistryId) {
      const { row, created } = await upsertAthleteCauseFromRaceRegistry({
        athleteId: gate.athlete.id,
        raceRegistryId,
      });
      return NextResponse.json(
        { success: true, cause: serialize(row), created },
        { status: created ? 201 : 200 },
      );
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const websiteUrl =
      typeof body.websiteUrl === "string" ? body.websiteUrl.trim() : "";
    const logoUrl = typeof body.logoUrl === "string" ? body.logoUrl.trim() : null;
    const note = typeof body.note === "string" ? body.note.trim() : null;

    const { row, created } = await upsertAthleteCauseManual({
      athleteId: gate.athlete.id,
      name,
      websiteUrlRaw: websiteUrl,
      logoUrl: logoUrl || null,
      note: note || null,
    });
    return NextResponse.json(
      { success: true, cause: serialize(row), created },
      { status: created ? 201 : 200 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
