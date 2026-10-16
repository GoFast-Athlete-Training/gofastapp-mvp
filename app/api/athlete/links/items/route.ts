import {
  loadEditableAthleteTree,
  reloadAthleteLinkTreeDetail,
} from "@/lib/athlete-link-tree/athlete-link-tree-service";
import { isHydratedLinkKind, parseLinkKindInput } from "@/lib/athlete-link-tree/link-kinds";
import { assertSingleRacesCard, normalizeLinkDestination } from "@/lib/athlete-link-tree/link-validation";
import { athleteRacePublicCardUrl } from "@/lib/athlete-race-public-card-url";
import { cityRunPublicCardUrl } from "@/lib/city-run-public-card-url";
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
    athleteRaceId?: string;
    cityRunId?: string;
    sectionId?: string;
    parentSectionId?: string;
  };

  const parentSectionRaw =
    body.parentSectionId?.trim() || body.sectionId?.trim() || null;

  const athleteRaceIdInput = body.athleteRaceId?.trim();
  const cityRunIdInput = body.cityRunId?.trim();
  let parsedKind = parseLinkKindInput(body.kind);
  if (athleteRaceIdInput) {
    parsedKind = AthleteLinkTreeLinkKind.ATHLETE_RACE;
  } else if (cityRunIdInput) {
    parsedKind = AthleteLinkTreeLinkKind.CITY_RUN;
  }
  if (!parsedKind) {
    return NextResponse.json({ success: false, error: "Invalid link kind" }, { status: 400 });
  }

  let name = body.name?.trim();
  if (
    !name &&
    parsedKind !== AthleteLinkTreeLinkKind.ATHLETE_RACE &&
    parsedKind !== AthleteLinkTreeLinkKind.CITY_RUN
  ) {
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
  let athleteRaceId: string | null = null;
  let cityRunId: string | null = null;
  let athleteRaceLogoUrl: string | null = null;

  if (parsedKind === AthleteLinkTreeLinkKind.ATHLETE_RACE) {
    if (!athleteRaceIdInput) {
      return NextResponse.json({ success: false, error: "athleteRaceId is required" }, { status: 400 });
    }
    const claim = await prisma.athlete_races.findFirst({
      where: { id: athleteRaceIdInput, athleteId: gate.athlete.id },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        race_registry: { select: { logoUrl: true } },
      },
    });
    if (!claim) {
      return NextResponse.json({ success: false, error: "Race not found on your profile" }, { status: 404 });
    }
    const raceSlug = claim.slug?.trim();
    if (!raceSlug) {
      return NextResponse.json(
        { success: false, error: "This race has no public slug yet — try again after it syncs" },
        { status: 400 },
      );
    }
    const duplicate = await prisma.athlete_link_tree_links.findFirst({
      where: { treeId, athleteRaceId: claim.id },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ success: false, error: "That race is already on your link page" }, { status: 400 });
    }
    athleteRaceId = claim.id;
    athleteRaceLogoUrl =
      claim.logoUrl?.trim() || claim.race_registry?.logoUrl?.trim() || null;
    name = claim.name;
    url = athleteRacePublicCardUrl(raceSlug, gate.handle);
  } else if (parsedKind === AthleteLinkTreeLinkKind.CITY_RUN) {
    if (!cityRunIdInput) {
      return NextResponse.json({ success: false, error: "cityRunId is required" }, { status: 400 });
    }
    const run = await prisma.city_runs.findFirst({
      where: { id: cityRunIdInput, athleteGeneratedId: gate.athlete.id, published: true },
      select: { id: true, title: true, slug: true, citySlug: true },
    });
    if (!run) {
      return NextResponse.json({ success: false, error: "Run not found on your profile" }, { status: 404 });
    }
    const duplicate = await prisma.athlete_link_tree_links.findFirst({
      where: { treeId, cityRunId: run.id },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ success: false, error: "That run is already on your link page" }, { status: 400 });
    }
    cityRunId = run.id;
    name = run.title;
    const publicKey = run.slug?.trim() || run.id;
    url = cityRunPublicCardUrl(publicKey, run.citySlug, run.id);
  } else if (!isSection) {
    const dest = normalizeLinkDestination({ url: body.url, kind: parsedKind });
    if (dest.error) {
      return NextResponse.json({ success: false, error: dest.error }, { status: 400 });
    }
    url = dest.url;
  }

  const linkName = name?.trim();
  if (!linkName) {
    return NextResponse.json({ success: false, error: "name is required" }, { status: 400 });
  }

  let parentSectionId: string | null = null;
  if (isSection) {
    if (parentSectionRaw) {
      return NextResponse.json(
        { success: false, error: "Section headings cannot belong to another section" },
        { status: 400 },
      );
    }
  } else if (parentSectionRaw) {
    const sectionRow = await prisma.athlete_link_tree_links.findFirst({
      where: { id: parentSectionRaw, treeId, isSection: true },
      select: { id: true },
    });
    if (!sectionRow) {
      return NextResponse.json({ success: false, error: "Section not found on this page" }, { status: 400 });
    }
    parentSectionId = sectionRow.id;
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
      name: linkName,
      kind: parsedKind,
      athleteRaceId,
      cityRunId,
      isSection,
      publicLabel: isSection ? null : body.publicLabel?.trim() || linkName,
      internalDescription: isSection ? null : body.internalDescription?.trim() || null,
      description: isSection ? null : body.description?.trim() || null,
      linkLogoUrl:
        parsedKind === AthleteLinkTreeLinkKind.ATHLETE_RACE ? athleteRaceLogoUrl : null,
      emoji: isSection || isHydratedLinkKind(parsedKind) ? null : body.emoji?.trim() || null,
      url,
      sortOrder,
      parentSectionId,
    },
  });

  const tree = await reloadAthleteLinkTreeDetail(gate.athlete.id);
  if (!tree) {
    return NextResponse.json({ success: false, error: "Link tree not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, linkId: created.id, tree }, { status: 201 });
}
