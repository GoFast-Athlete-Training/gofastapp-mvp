import {
  loadEditableAthleteTree,
  reloadAthleteLinkTreeDetail,
} from "@/lib/athlete-link-tree/athlete-link-tree-service";
import { isHydratedLinkKind, parseLinkKindInput } from "@/lib/athlete-link-tree/link-kinds";
import { assertSingleRacesCard, normalizeLinkDestination } from "@/lib/athlete-link-tree/link-validation";
import { AthleteLinkTreeLinkKind } from "@prisma/client";
import { requireAthleteWithHandleForLinks } from "@/lib/content/require-athlete-link-tree";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** POST — add link or section */
export async function POST(request: NextRequest) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const loaded = await loadEditableAthleteTree(gate.athlete.id);
  if (!loaded.ok) {
    return NextResponse.json({ success: false, error: loaded.error }, { status: loaded.status });
  }
  const treeId = loaded.tree.id;

  const body = (await request.json()) as {
    name?: string;
    isSection?: boolean;
    kind?: string;
    publicLabel?: string | null;
    internalDescription?: string | null;
    description?: string | null;
    emoji?: string | null;
    url?: string | null;
    insertAfterId?: string;
  };

  const parsedKind = parseLinkKindInput(body.kind);
  if (!parsedKind) {
    return NextResponse.json({ success: false, error: "Invalid link kind" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ success: false, error: "name is required" }, { status: 400 });
  }

  const isSection = body.isSection === true;
  if (isSection && isHydratedLinkKind(parsedKind)) {
    return NextResponse.json(
      { success: false, error: "GoFast cards cannot be section rows" },
      { status: 400 },
    );
  }

  if (parsedKind === AthleteLinkTreeLinkKind.RACES) {
    const racesGate = await assertSingleRacesCard(treeId);
    if (!racesGate.ok) {
      return NextResponse.json({ success: false, error: racesGate.error }, { status: 400 });
    }
  }

  let url: string | null = null;

  if (!isSection) {
    const dest = normalizeLinkDestination({ url: body.url, kind: parsedKind });
    if (dest.error) {
      return NextResponse.json({ success: false, error: dest.error }, { status: 400 });
    }
    url = dest.url;
  }

  let sortOrder: number;
  const insertAfterId = body.insertAfterId?.trim();
  if (insertAfterId) {
    const anchor = await prisma.athlete_link_tree_links.findFirst({
      where: { id: insertAfterId, treeId },
      select: { sortOrder: true },
    });
    if (!anchor) {
      return NextResponse.json(
        { success: false, error: "insertAfterId link not found in this tree" },
        { status: 400 },
      );
    }
    sortOrder = anchor.sortOrder + 1;
    await prisma.$transaction([
      prisma.athlete_link_tree_links.updateMany({
        where: { treeId, sortOrder: { gte: sortOrder } },
        data: { sortOrder: { increment: 1 } },
      }),
    ]);
  } else {
    const maxSort = await prisma.athlete_link_tree_links.aggregate({
      where: { treeId },
      _max: { sortOrder: true },
    });
    sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
  }

  const created = await prisma.athlete_link_tree_links.create({
    data: {
      treeId,
      name,
      kind: parsedKind,
      isSection,
      publicLabel: isSection ? null : body.publicLabel?.trim() || name,
      internalDescription: isSection ? null : body.internalDescription?.trim() || null,
      description: isSection ? null : body.description?.trim() || null,
      linkLogoUrl: null,
      emoji: isSection || isHydratedLinkKind(parsedKind) ? null : body.emoji?.trim() || null,
      url,
      sortOrder,
    },
  });

  const tree = await reloadAthleteLinkTreeDetail(gate.athlete.id);
  if (!tree) {
    return NextResponse.json({ success: false, error: "Link tree not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, linkId: created.id, tree }, { status: 201 });
}
