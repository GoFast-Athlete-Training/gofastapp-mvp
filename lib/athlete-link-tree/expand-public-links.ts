import type { AthleteLinkTreeLink } from "@/lib/content/athlete-link-tree-types";
import type { PublicAthleteLinkTreePayload } from "@/lib/athlete-link-tree/public-payload";
import { isHydratedLinkKind } from "@/lib/athlete-link-tree/link-kinds";
import { isUpcomingAthleteRace } from "@/lib/athlete-races-service";
import prisma from "@/lib/prisma";
import { AthleteLinkTreeLinkKind } from "@prisma/client";

type PublicLink = PublicAthleteLinkTreePayload["links"][number];

type AthleteRacePublicSnap = {
  raceDate: Date;
  logoUrl: string | null;
  distanceLabel: string | null;
};

function toPublicCustomLink(
  link: AthleteLinkTreeLink,
  raceSnapsByLinkId: Map<string, AthleteRacePublicSnap>,
): PublicLink {
  const raceSnap = raceSnapsByLinkId.get(link.id);
  const storedLogo = link.linkLogoUrl?.trim() || null;
  const linkLogoUrl = storedLogo || raceSnap?.logoUrl?.trim() || null;

  let description = link.description?.trim() || null;
  if (!description && raceSnap?.distanceLabel?.trim()) {
    description = raceSnap.distanceLabel.trim();
  }

  return {
    id: link.id,
    name: link.name,
    publicLabel: link.publicLabel,
    isSection: link.isSection,
    description,
    linkLogoUrl,
    emoji: link.emoji,
    url: link.url,
    targetSlug: null,
    sortOrder: link.sortOrder,
  };
}

function sortLinks(links: AthleteLinkTreeLink[]): AthleteLinkTreeLink[] {
  return links.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

async function loadRaceSnapsByLinkId(
  links: AthleteLinkTreeLink[],
): Promise<Map<string, AthleteRacePublicSnap>> {
  const raceIds = links
    .filter((l) => l.kind === AthleteLinkTreeLinkKind.ATHLETE_RACE && l.athleteRaceId)
    .map((l) => l.athleteRaceId as string);
  if (raceIds.length === 0) return new Map();

  const rows = await prisma.athlete_races.findMany({
    where: { id: { in: raceIds } },
    select: {
      id: true,
      raceDate: true,
      logoUrl: true,
      distanceLabel: true,
      race_registry: { select: { logoUrl: true } },
    },
  });
  const byRaceId = new Map(
    rows.map((r) => [
      r.id,
      {
        raceDate: r.raceDate,
        logoUrl: r.logoUrl?.trim() || r.race_registry?.logoUrl?.trim() || null,
        distanceLabel: r.distanceLabel,
      },
    ]),
  );

  const out = new Map<string, AthleteRacePublicSnap>();
  for (const link of links) {
    if (link.athleteRaceId && byRaceId.has(link.athleteRaceId)) {
      out.set(link.id, byRaceId.get(link.athleteRaceId)!);
    }
  }
  return out;
}

function shouldEmitLink(
  link: AthleteLinkTreeLink,
  raceSnapsByLinkId: Map<string, AthleteRacePublicSnap>,
): boolean {
  if (isHydratedLinkKind(link.kind) && !link.isSection) {
    return false;
  }
  if (link.kind === AthleteLinkTreeLinkKind.ATHLETE_RACE) {
    const snap = raceSnapsByLinkId.get(link.id);
    if (snap && !isUpcomingAthleteRace(snap.raceDate)) {
      return false;
    }
  }
  return true;
}

/** Flatten stored rows into public buttons (parentSectionId groups children under sections). */
export async function expandAthleteLinkTreeLinksForPublic(input: {
  athleteId: string;
  links: Array<AthleteLinkTreeLink & { kind: AthleteLinkTreeLinkKind }>;
}): Promise<PublicLink[]> {
  const raceSnapsByLinkId = await loadRaceSnapsByLinkId(input.links);
  const all = sortLinks(input.links);

  const topLevel = all.filter((l) => !l.parentSectionId);
  const childrenBySection = new Map<string, AthleteLinkTreeLink[]>();
  for (const link of all) {
    if (!link.parentSectionId) continue;
    const bucket = childrenBySection.get(link.parentSectionId) ?? [];
    bucket.push(link);
    childrenBySection.set(link.parentSectionId, bucket);
  }

  const out: PublicLink[] = [];
  let order = 0;

  for (const link of topLevel) {
    if (!shouldEmitLink(link, raceSnapsByLinkId)) continue;

    const publicLink = toPublicCustomLink(link, raceSnapsByLinkId);
    publicLink.sortOrder = order++;
    out.push(publicLink);

    if (link.isSection) {
      const children = sortLinks(childrenBySection.get(link.id) ?? []);
      for (const child of children) {
        if (!shouldEmitLink(child, raceSnapsByLinkId)) continue;
        const childPublic = toPublicCustomLink(child, raceSnapsByLinkId);
        childPublic.sortOrder = order++;
        out.push(childPublic);
      }
    }
  }

  return out;
}
