import {
  createAthleteLinkTree,
  findAthleteLinkTreeByAthleteId,
  toAthleteLinkTreeDetail,
} from "@/lib/athlete-link-tree/athlete-link-tree-service";
import { athleteLinksPublicUrl } from "@/lib/content/athlete-links-public-url";
import type { AthleteLinkTreeDetail } from "@/lib/content/athlete-link-tree-types";
import { requireAthleteWithHandleForLinks } from "@/lib/content/require-athlete-link-tree";
import { rewriteCityRunLinkTreeUrls } from "@/lib/athlete-link-tree/rewrite-city-run-link-urls";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** GET — load athlete link tree (create on first visit) */
export async function GET(request: NextRequest) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  let tree = await findAthleteLinkTreeByAthleteId(gate.athlete.id);

  if (!tree) {
    const slugClash = await prisma.athlete_link_trees.findUnique({
      where: { slug: gate.slug },
      select: { athleteId: true },
    });
    if (slugClash && slugClash.athleteId !== gate.athlete.id) {
      return NextResponse.json(
        {
          success: false,
          error: "That public link is already taken — choose a different GoFast handle",
        },
        { status: 409 },
      );
    }

    tree = await createAthleteLinkTree({
      athleteId: gate.athlete.id,
      slug: gate.slug,
      name: gate.displayName,
      publicLabel: gate.displayName,
    });
  }

  const gwm = await prisma.gofast_with_me.findFirst({
    where: { athleteId: gate.athlete.id },
    select: { gofastSlugSnapshot: true },
  });
  const publicSlug =
    gwm?.gofastSlugSnapshot?.trim() || gate.handle.trim();

  await rewriteCityRunLinkTreeUrls(gate.athlete.id);
  const refreshed = await findAthleteLinkTreeByAthleteId(gate.athlete.id);
  const detail: AthleteLinkTreeDetail = toAthleteLinkTreeDetail(refreshed ?? tree);

  return NextResponse.json({
    success: true,
    tree: detail,
    handle: gate.handle,
    displayName: gate.displayName,
    publicSlug,
    shareUrl: athleteLinksPublicUrl(gate.handle),
  });
}

/** PATCH — tree metadata */
export async function PATCH(request: NextRequest) {
  const gate = await requireAthleteWithHandleForLinks(request);
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.error }, { status: gate.status });
  }

  const existing = await findAthleteLinkTreeByAthleteId(gate.athlete.id);
  if (!existing) {
    return NextResponse.json({ success: false, error: "Link tree not found" }, { status: 404 });
  }

  const body = await request.json();
  const data: {
    name?: string;
    logoUrl?: string | null;
    internalDescription?: string | null;
    publicLabel?: string | null;
    publicDescription?: string | null;
  } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ success: false, error: "name cannot be empty" }, { status: 400 });
    }
    data.name = name;
  }
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl?.trim() || null;
  if (body.internalDescription !== undefined) {
    data.internalDescription = body.internalDescription?.trim() || null;
  }
  if (body.publicLabel !== undefined) data.publicLabel = body.publicLabel?.trim() || null;
  if (body.publicDescription !== undefined) {
    data.publicDescription = body.publicDescription?.trim() || null;
  }

  if (Object.keys(data).length > 0) {
    await prisma.athlete_link_trees.update({ where: { id: existing.id }, data });
  }

  const tree = await findAthleteLinkTreeByAthleteId(gate.athlete.id);
  if (!tree) {
    return NextResponse.json({ success: false, error: "Link tree not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, tree: toAthleteLinkTreeDetail(tree) });
}
