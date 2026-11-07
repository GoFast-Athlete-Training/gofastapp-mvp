import { requireAthleteWithHandleForLinks } from "@/lib/content/require-athlete-link-tree";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export type AthleteLinkCharitySearchHit = {
  raceRegistryId: string;
  raceName: string;
  charityName: string;
  charityUrl: string;
  charityLogo: string | null;
  /** When this athlete already saved the snap as a cause */
  athleteCauseId: string | null;
};

/** GET — search race_registry rows with a charity name + URL (any race, not athlete-scoped). */
export async function GET(request: NextRequest) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ success: true, charities: [] satisfies AthleteLinkCharitySearchHit[] });
  }

  const rows = await prisma.race_registry.findMany({
    where: {
      charityName: { contains: q, mode: "insensitive" },
      charityUrl: { not: null },
    },
    select: {
      id: true,
      name: true,
      charityName: true,
      charityUrl: true,
      charityLogo: true,
    },
    take: 60,
    orderBy: [{ name: "asc" }],
  });

  const seen = new Set<string>();
  const charities: AthleteLinkCharitySearchHit[] = [];

  for (const r of rows) {
    const rawName = r.charityName?.trim();
    const rawUrl = r.charityUrl?.trim();
    if (!rawName || !rawUrl) continue;
    if (!/^https?:\/\//i.test(rawUrl)) continue;

    const dedupeKey = `${rawName.toLowerCase()}|${rawUrl.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    charities.push({
      raceRegistryId: r.id,
      raceName: r.name.trim(),
      charityName: rawName,
      charityUrl: rawUrl,
      charityLogo: r.charityLogo?.trim() || null,
      athleteCauseId: null,
    });
    if (charities.length >= 30) break;
  }

  if (charities.length > 0) {
    const regIds = charities.map((c) => c.raceRegistryId);
    const saved = await prisma.athlete_causes.findMany({
      where: { athleteId: gate.athlete.id, raceRegistryId: { in: regIds } },
      select: { id: true, raceRegistryId: true },
    });
    const idByReg = new Map(saved.map((s) => [s.raceRegistryId, s.id]));
    for (const c of charities) {
      c.athleteCauseId = idByReg.get(c.raceRegistryId) ?? null;
    }
  }

  return NextResponse.json({ success: true, charities });
}
