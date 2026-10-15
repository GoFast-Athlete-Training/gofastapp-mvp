import { parseMyCheers, type AthleteRaceCheerEntry } from "@/lib/athlete-race-cheers";
import { getPublicRacePageUrl } from "@/lib/public-race-url";
import prisma from "@/lib/prisma";

export type PublicAthleteRaceCardPayload = {
  athleteRaceId: string;
  raceName: string;
  raceDate: string;
  distanceLabel: string | null;
  goalTime: string | null;
  tagline: string | null;
  catalogUrl: string | null;
  athleteDisplayName: string;
  handle: string;
  raceSlug: string;
  cheers: AthleteRaceCheerEntry[];
};

function formatRaceDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function loadPublicAthleteRaceCard(
  handleRaw: string,
  raceSlugRaw: string,
): Promise<PublicAthleteRaceCardPayload | null> {
  const handle = handleRaw.trim().replace(/^@+/, "").toLowerCase();
  const raceSlug = raceSlugRaw.trim().toLowerCase();
  if (!handle || !raceSlug) return null;

  const athlete = await prisma.athlete.findFirst({
    where: { gofastHandle: { equals: handle, mode: "insensitive" } },
    select: { id: true, firstName: true, lastName: true, gofastHandle: true },
  });
  if (!athlete) return null;

  const claim = await prisma.athlete_races.findFirst({
    where: {
      athleteId: athlete.id,
      slug: { equals: raceSlug, mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      raceDate: true,
      distanceLabel: true,
      goalTime: true,
      slug: true,
      myCheers: true,
      race_registry: {
        select: { summaryPhrase: true, slug: true },
      },
    },
  });
  if (!claim) return null;

  const slug = claim.slug?.trim() || claim.race_registry?.slug?.trim() || raceSlug;
  const displayName =
    [athlete.firstName?.trim(), athlete.lastName?.trim()].filter(Boolean).join(" ") ||
    athlete.gofastHandle?.trim() ||
    handle;

  return {
    athleteRaceId: claim.id,
    raceName: claim.name,
    raceDate: formatRaceDate(claim.raceDate),
    distanceLabel: claim.distanceLabel?.trim() || null,
    goalTime: claim.goalTime?.trim() || null,
    tagline: claim.race_registry?.summaryPhrase?.trim() || null,
    catalogUrl: getPublicRacePageUrl(slug),
    athleteDisplayName: displayName,
    handle: athlete.gofastHandle?.trim().toLowerCase() || handle,
    raceSlug: slug,
    cheers: parseMyCheers(claim.myCheers),
  };
}
