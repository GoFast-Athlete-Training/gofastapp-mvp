import type { AthleteLinkTreeLink } from "@/lib/content/athlete-link-tree-types";
import type { PublicAthleteLinkTreePayload } from "@/lib/athlete-link-tree/public-payload";
import { isHydratedLinkKind } from "@/lib/athlete-link-tree/link-kinds";
import { getPublicRacePageUrl } from "@/lib/public-race-url";
import prisma from "@/lib/prisma";
import { AthleteLinkTreeLinkKind } from "@prisma/client";

type PublicLink = PublicAthleteLinkTreePayload["links"][number];

function formatDateOnly(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function raceSubtitle(race: {
  raceDate: Date;
  distanceLabel: string | null;
}): string | null {
  const line = [formatDateOnly(race.raceDate), race.distanceLabel?.trim()].filter(Boolean).join(" · ");
  return line || null;
}

function toPublicCustomLink(link: AthleteLinkTreeLink & { kind: AthleteLinkTreeLinkKind }): PublicLink {
  return {
    id: link.id,
    name: link.name,
    publicLabel: link.publicLabel,
    isSection: link.isSection,
    description: link.description,
    linkLogoUrl: link.linkLogoUrl,
    emoji: link.emoji,
    url: link.url,
    targetSlug: null,
    sortOrder: link.sortOrder,
  };
}

async function expandRacesCard(
  link: AthleteLinkTreeLink & { kind: AthleteLinkTreeLinkKind },
  athleteId: string,
): Promise<PublicLink[]> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const rows = await prisma.athlete_races.findMany({
    where: {
      athleteId,
      raceDate: { gte: startOfToday },
    },
    orderBy: { raceDate: "asc" },
    take: 12,
    select: {
      id: true,
      name: true,
      raceDate: true,
      distanceLabel: true,
      slug: true,
      logoUrl: true,
    },
  });

  const withUrls = rows
    .map((race) => ({
      race,
      href: getPublicRacePageUrl(race.slug),
    }))
    .filter((entry): entry is { race: (typeof rows)[number]; href: string } => Boolean(entry.href));

  if (withUrls.length === 0) {
    return [];
  }

  const sectionTitle = link.publicLabel?.trim() || link.name.trim() || "Races";
  const baseOrder = link.sortOrder;

  const section: PublicLink = {
    id: `${link.id}-section`,
    name: sectionTitle,
    publicLabel: null,
    isSection: true,
    description: null,
    linkLogoUrl: null,
    emoji: null,
    url: null,
    targetSlug: null,
    sortOrder: baseOrder,
  };

  const raceLinks: PublicLink[] = withUrls.map(({ race, href }, index) => ({
    id: `${link.id}-race-${race.id}`,
    name: race.name,
    publicLabel: null,
    isSection: false,
    description: raceSubtitle(race),
    linkLogoUrl: race.logoUrl?.trim() || null,
    emoji: race.logoUrl?.trim() ? null : "🏁",
    url: href,
    targetSlug: null,
    sortOrder: baseOrder + index + 1,
  }));

  return [section, ...raceLinks];
}

/** Flatten stored rows into public buttons (hydrated cards expand in place). */
export async function expandAthleteLinkTreeLinksForPublic(input: {
  athleteId: string;
  links: Array<AthleteLinkTreeLink & { kind: AthleteLinkTreeLinkKind }>;
}): Promise<PublicLink[]> {
  const sorted = input.links.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const out: PublicLink[] = [];

  for (const link of sorted) {
    if (link.kind === AthleteLinkTreeLinkKind.RACES && !link.isSection) {
      const expanded = await expandRacesCard(link, input.athleteId);
      out.push(...expanded);
      continue;
    }
    if (isHydratedLinkKind(link.kind) && !link.isSection) {
      continue;
    }
    out.push(toPublicCustomLink(link));
  }

  return out;
}
