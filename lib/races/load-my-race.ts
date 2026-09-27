import { getAthleteRaceForAthlete } from "@/lib/athlete-races-service";
import { myRacePlannerHref } from "@/lib/races/athlete-race-signup-display";
import { buildRaceDayBuilderHref } from "@/lib/training/race-day-builder-href";
import { ymdFromDate } from "@/lib/training/plan-utils";

export type MyRacePoint = {
  athleteRaceId: string;
  raceRegistryId: string;
  name: string;
  raceDate: string;
  distanceLabel: string | null;
  distanceMeters: number | null;
  logoUrl: string | null;
  locationLabel: string | null;
  startTimeLabel: string | null;
  slug: string | null;
  goalTime: string | null;
  goalRacePaceSecPerMile: number | null;
  plannerHref: string;
  raceHubHref: string;
  raceDayBuilderHref: string | null;
};

export async function loadMyRace(params: {
  athleteId: string;
  athleteRaceId: string;
  planId?: string | null;
  raceDateKey?: string | null;
  raceDayBuilderBack?: string | null;
  goalTime?: string | null;
  goalRacePaceSecPerMile?: number | null;
}): Promise<MyRacePoint | null> {
  const row = await getAthleteRaceForAthlete(params.athleteId, params.athleteRaceId);
  if (!row) return null;

  const reg = row.race_registry;
  const raceRegistryId = row.raceRegistryId;
  const slug = row.slug ?? reg?.slug ?? null;
  const logoUrl =
    (row.logoUrl?.trim() && (row.logoUrl.startsWith("http") || row.logoUrl.startsWith("/"))
      ? row.logoUrl.trim()
      : null) ??
    (reg?.logoUrl?.trim() && (reg.logoUrl.startsWith("http") || reg.logoUrl.startsWith("/"))
      ? reg.logoUrl.trim()
      : null);

  const city = row.city?.trim() || "";
  const state = row.state?.trim() || "";
  const locationLabel = [city, state].filter(Boolean).join(", ") || null;
  const startTimeLabel = reg?.startTime?.trim() || null;

  const raceDateKey =
    params.raceDateKey?.trim() ||
    ymdFromDate(row.raceDate);

  let raceDayBuilderHref: string | null = null;
  if (params.planId?.trim() && raceDateKey) {
    const back =
      params.raceDayBuilderBack?.trim() || `/training/day/${raceDateKey}`;
    raceDayBuilderHref = buildRaceDayBuilderHref({
      planId: params.planId.trim(),
      dateKey: raceDateKey,
      back,
    });
  }

  return {
    athleteRaceId: row.id,
    raceRegistryId,
    name: row.name?.trim() || "Your race",
    raceDate: raceDateKey,
    distanceLabel: row.distanceLabel ?? reg?.distanceLabel ?? null,
    distanceMeters: row.distanceMeters ?? reg?.distanceMeters ?? null,
    logoUrl,
    locationLabel,
    startTimeLabel,
    slug,
    goalTime: params.goalTime?.trim() || null,
    goalRacePaceSecPerMile:
      params.goalRacePaceSecPerMile != null && params.goalRacePaceSecPerMile > 0
        ? params.goalRacePaceSecPerMile
        : null,
    plannerHref: myRacePlannerHref(slug, raceRegistryId),
    raceHubHref: `/race-hub/${raceRegistryId}`,
    raceDayBuilderHref,
  };
}

/** Client-safe shape from API (dates already serialized). */
export type MyRacePointJson = MyRacePoint;
