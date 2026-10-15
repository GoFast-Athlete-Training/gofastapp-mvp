import {
  loadEditableAthleteTree,
  reloadAthleteLinkTreeDetail,
} from "@/lib/athlete-link-tree/athlete-link-tree-service";
import { normalizeLinkEmoji } from "@/lib/athlete-link-tree/link-emoji";
import { isHydratedLinkKind } from "@/lib/athlete-link-tree/link-kinds";
import { normalizeLinkDestination } from "@/lib/athlete-link-tree/link-validation";
import { requireAthleteWithHandleForLinks } from "@/lib/content/require-athlete-link-tree";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ linkId: string }> };

async function loadLink(treeId: string, linkId: string) {
  return prisma.athlete_link_tree_links.findFirst({ where: { id: linkId, treeId } });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const { linkId } = await context.params;
  const loaded = await loadEditableAthleteTree(gate.athlete.id);
  if (!loaded.ok) {
    return NextResponse.json({ success: false, error: loaded.error }, { status: loaded.status });
  }
  const treeId = loaded.tree.id;
  const link = await loadLink(treeId, linkId);
  if (!link) {
    return NextResponse.json({ success: false, error: "Link not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    name?: string;
    publicLabel?: string | null;
    internalDescription?: string | null;
    description?: string | null;
    linkLogoUrl?: string | null;
    emoji?: string | null;
    url?: string | null;
  };

  const data: {
    name?: string;
    publicLabel?: string | null;
    internalDescription?: string | null;
    description?: string | null;
    linkLogoUrl?: string | null;
    emoji?: string | null;
    url?: string | null;
  } = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "name cannot be empty" }, { status: 400 });
    }
    data.name = name;
  }
  if (body.publicLabel !== undefined) data.publicLabel = body.publicLabel?.trim() || null;
  if (body.internalDescription !== undefined) {
    data.internalDescription = body.internalDescription?.trim() || null;
  }
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  const hydratedCard = isHydratedLinkKind(link.kind);

  if (!hydratedCard && body.linkLogoUrl !== undefined) {
    data.linkLogoUrl = body.linkLogoUrl?.trim() || null;
    if (data.linkLogoUrl) data.emoji = null;
  }
  if (!hydratedCard && body.emoji !== undefined) {
    const emoji = body.emoji === null ? null : normalizeLinkEmoji(body.emoji);
    if (body.emoji !== null && body.emoji.trim() && !emoji) {
      return NextResponse.json({ success: false, error: "Invalid emoji" }, { status: 400 });
    }
    data.emoji = emoji;
    if (emoji) data.linkLogoUrl = null;
  }

  if (!link.isSection && !hydratedCard && body.url !== undefined) {
    const dest = normalizeLinkDestination({ url: body.url, kind: link.kind });
    if (dest.error) {
      return NextResponse.json({ success: false, error: dest.error }, { status: 400 });
    }
    data.url = dest.url;
  }

  await prisma.athlete_link_tree_links.update({ where: { id: linkId }, data });

  const tree = await reloadAthleteLinkTreeDetail(gate.athlete.id);
  if (!tree) {
    return NextResponse.json({ success: false, error: "Link tree not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, tree });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const { linkId } = await context.params;
  const loaded = await loadEditableAthleteTree(gate.athlete.id);
  if (!loaded.ok) {
    return NextResponse.json({ success: false, error: loaded.error }, { status: loaded.status });
  }
  const link = await loadLink(loaded.tree.id, linkId);
  if (!link) {
    return NextResponse.json({ success: false, error: "Link not found" }, { status: 404 });
  }

  await prisma.athlete_link_tree_links.delete({ where: { id: linkId } });
  const tree = await reloadAthleteLinkTreeDetail(gate.athlete.id);
  if (!tree) {
    return NextResponse.json({ success: false, error: "Link tree not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, tree });
}
