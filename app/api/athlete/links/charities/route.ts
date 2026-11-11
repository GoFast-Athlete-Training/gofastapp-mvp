import { normalizeCauseWebsiteUrl } from "@/lib/athlete-causes/cause-url";
import { requireAthleteWithHandleForLinks } from "@/lib/content/require-athlete-link-tree";
import { prodCharityPublicSelect } from "@/lib/prod-charity-snap";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CATALOG_LIST_CAP = 200;

export type AthleteLinkCharitySearchHit = {
  charityId: string;
  charityName: string;
  charityUrl: string;
  charityLogo: string | null;
  /** When this athlete already saved the charity as a cause (same normalized URL). */
  athleteCauseId: string | null;
  /** @deprecated legacy race-registry hits — not returned for catalog search */
  raceRegistryId?: string;
  raceName?: string;
};

function isPublicCharityUrl(url: string | null | undefined): url is string {
  const raw = url?.trim();
  return Boolean(raw && /^https?:\/\//i.test(raw));
}

/** GET — list prod charity catalog; optional `q` filters by name (case-insensitive). */
export async function GET(request: NextRequest) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  try {
    const rows = await prisma.charities.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
      select: prodCharityPublicSelect,
      orderBy: { name: "asc" },
      take: CATALOG_LIST_CAP,
    });

    const savedCauses = await prisma.athlete_causes.findMany({
      where: { athleteId: gate.athlete.id },
      select: { id: true, websiteUrl: true },
    });
    const causeIdByUrl = new Map(savedCauses.map((c) => [c.websiteUrl, c.id]));

    const charities: AthleteLinkCharitySearchHit[] = [];
    for (const row of rows) {
      if (!isPublicCharityUrl(row.charityWebsiteUrl)) continue;
      const normalized = normalizeCauseWebsiteUrl(row.charityWebsiteUrl);
      if (!normalized) continue;
      charities.push({
        charityId: row.id,
        charityName: row.name.trim(),
        charityUrl: normalized,
        charityLogo: row.charityLogo?.trim() || null,
        athleteCauseId: causeIdByUrl.get(normalized) ?? null,
      });
    }

    return NextResponse.json({ success: true, charities });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Charity catalog lookup failed";
    console.error("GET /api/athlete/links/charities", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
