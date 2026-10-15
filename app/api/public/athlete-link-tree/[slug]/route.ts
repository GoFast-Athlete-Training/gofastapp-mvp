import { toAthleteLinkTreeDetail } from "@/lib/athlete-link-tree/athlete-link-tree-service";
import { toPublicAthleteLinkTreePayload } from "@/lib/athlete-link-tree/public-payload";
import { isValidAthleteLinkTreeSlug } from "@/lib/content/athlete-link-tree-slug";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

/** GET — public gofastlinks athlete page by slug (prod mirror, no auth). */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { slug: raw } = await context.params;
    const slug = raw.trim().toLowerCase();
    if (!isValidAthleteLinkTreeSlug(slug)) {
      return NextResponse.json({ success: false, error: "Link tree not found" }, { status: 404 });
    }

    const row = await prisma.athlete_link_trees.findUnique({
      where: { slug },
      include: {
        links: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        },
      },
    });

    if (!row) {
      return NextResponse.json({ success: false, error: "Link tree not found" }, { status: 404 });
    }

    const athlete = await prisma.athlete.findUnique({
      where: { id: row.athleteId },
      select: { firstName: true, lastName: true, photoURL: true },
    });

    const detail = toAthleteLinkTreeDetail(row);
    const tree = await toPublicAthleteLinkTreePayload(detail, row.athleteId, athlete);
    return NextResponse.json({
      success: true,
      tree,
    });
  } catch (err) {
    console.error("public athlete-link-tree slug:", err);
    return NextResponse.json({ success: false, error: "Failed to load linktree" }, { status: 500 });
  }
}
