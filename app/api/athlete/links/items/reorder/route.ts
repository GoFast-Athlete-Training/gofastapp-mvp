import {
  loadEditableAthleteTree,
  reloadAthleteLinkTreeDetail,
} from "@/lib/athlete-link-tree/athlete-link-tree-service";
import { requireAthleteWithHandleForLinks } from "@/lib/content/require-athlete-link-tree";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

  const body = (await request.json()) as { linkId?: string; direction?: number };
  const linkId = body.linkId?.trim();
  const direction = body.direction;
  if (!linkId || (direction !== -1 && direction !== 1)) {
    return NextResponse.json(
      { success: false, error: "linkId and direction (-1 or 1) are required" },
      { status: 400 },
    );
  }

  const links = await prisma.athlete_link_tree_links.findMany({
    where: { treeId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, sortOrder: true },
  });

  const index = links.findIndex((l) => l.id === linkId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= links.length) {
    return NextResponse.json(
      { success: false, error: "Cannot move link in that direction" },
      { status: 400 },
    );
  }

  const current = links[index];
  const neighbor = links[targetIndex];

  await prisma.$transaction([
    prisma.athlete_link_tree_links.update({
      where: { id: current.id },
      data: { sortOrder: neighbor.sortOrder },
    }),
    prisma.athlete_link_tree_links.update({
      where: { id: neighbor.id },
      data: { sortOrder: current.sortOrder },
    }),
  ]);

  const tree = await reloadAthleteLinkTreeDetail(gate.athlete.id);
  if (!tree) {
    return NextResponse.json({ success: false, error: "Link tree not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, tree });
}
