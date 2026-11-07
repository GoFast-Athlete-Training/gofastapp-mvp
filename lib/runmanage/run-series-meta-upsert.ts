import { prisma } from "@/lib/prisma";
import { buildSeriesSlug } from "@/lib/seriesSlug";
import { toCanonicalDayOfWeek } from "@/lib/utils/dayOfWeekConverter";
import {
  findOrCreateCityBySlug,
  resolveCityFieldsFromMeetUp,
} from "@/lib/resolve-city";

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

function slugifyForSeries(str: string): string {
  return (
    str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "series"
  );
}

async function generateUniqueSeriesSlug(base: string): Promise<string> {
  let slug = slugifyForSeries(base);
  let n = 1;
  while (await prisma.run_series.findFirst({ where: { slug } })) {
    slug = `${slugifyForSeries(base)}-${n}`;
    n++;
  }
  return slug;
}

function defaultSeriesName(input: {
  clubName: string;
  canonicalDay: string;
  runType: string | null;
  startTimePeriod: string | null | undefined;
}): string {
  const dayLabel = input.canonicalDay.charAt(0) + input.canonicalDay.slice(1).toLowerCase();
  if (input.runType === "track") {
    const period = (input.startTimePeriod || "PM").trim().toUpperCase();
    const trackLabel = period === "AM" ? "Track Morning" : "Track Night";
    return `${input.clubName} ${dayLabel} ${trackLabel}`;
  }
  return `${input.clubName} ${dayLabel} Run`;
}

export type RunSeriesMetaInput = {
  runClubId: string;
  dayOfWeek: string;
  name?: string | null;
  description?: string | null;
  citySlug?: string | null;
  meetUpPoint?: string | null;
  meetUpStreetAddress?: string | null;
  meetUpCity?: string | null;
  meetUpState?: string | null;
  meetUpPlaceId?: string | null;
  meetUpLat?: number | null;
  meetUpLng?: number | null;
  startTimeHour?: number | null;
  startTimeMinute?: number | null;
  startTimePeriod?: string | null;
  runType?: string | null;
  totalMiles?: number | null;
  routeNeighborhood?: string | null;
  workoutDescription?: string | null;
  postRunActivity?: string | null;
};

export async function upsertRunSeriesMetaOnly(
  input: RunSeriesMetaInput & { seriesId?: string | null }
) {
  const runClubId = input.runClubId?.trim();
  if (!runClubId) {
    throw new Error("runClubId is required");
  }
  if (!input.dayOfWeek?.trim()) {
    throw new Error("dayOfWeek is required");
  }

  const runClub = await prisma.run_clubs.findUnique({
    where: { id: runClubId },
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      allRunsDescription: true,
    },
  });
  if (!runClub) {
    throw new Error("Run club not found");
  }

  const canonicalDay =
    toCanonicalDayOfWeek(input.dayOfWeek) ?? input.dayOfWeek.trim().toUpperCase();

  const allowedRunTypes = new Set(["track", "trail", "neighborhood", "park"]);
  const seriesRunType =
    input.runType != null && allowedRunTypes.has(String(input.runType).trim().toLowerCase())
      ? String(input.runType).trim().toLowerCase()
      : null;

  const baseName =
    input.name?.trim() ||
    defaultSeriesName({
      clubName: runClub.name,
      canonicalDay,
      runType: seriesRunType,
      startTimePeriod: input.startTimePeriod,
    });

  const seriesDescription =
    input.description === undefined
      ? runClub.allRunsDescription
      : input.description?.trim() || null;

  const meetUpCityTrim = input.meetUpCity?.trim() || null;
  const meetUpStateTrim = input.meetUpState?.trim() || null;
  const citySlugTrim = input.citySlug?.trim().toLowerCase() || null;
  let seriesCitySlug = citySlugTrim;
  let seriesCityId: string | null = null;
  if (citySlugTrim) {
    const bySlug = await findOrCreateCityBySlug(citySlugTrim, meetUpCityTrim);
    if (bySlug) {
      seriesCityId = bySlug.cityId;
      seriesCitySlug = bySlug.citySlug;
    }
  } else if (meetUpCityTrim) {
    const fields = await resolveCityFieldsFromMeetUp({
      meetUpCity: meetUpCityTrim,
      meetUpState: meetUpStateTrim,
    });
    seriesCityId = fields.cityId;
    seriesCitySlug = fields.citySlug;
  }

  const setupData = {
    dayOfWeek: canonicalDay,
    runClubId: runClub.id,
    name: baseName,
    description: seriesDescription,
    runType: seriesRunType,
    totalMiles:
      input.totalMiles != null && Number.isFinite(input.totalMiles) ? input.totalMiles : null,
    routeNeighborhood: input.routeNeighborhood?.trim() || null,
    workoutDescription: input.workoutDescription?.trim() || null,
    postRunActivity: input.postRunActivity?.trim() || null,
    citySlug: seriesCitySlug,
    cityId: seriesCityId,
    meetUpPoint: input.meetUpPoint?.trim() || null,
    meetUpStreetAddress: input.meetUpStreetAddress?.trim() || null,
    meetUpCity: meetUpCityTrim,
    meetUpState: meetUpStateTrim,
    meetUpPlaceId: input.meetUpPlaceId?.trim() || null,
    meetUpLat: input.meetUpLat ?? null,
    meetUpLng: input.meetUpLng ?? null,
    startTimeHour: input.startTimeHour ?? null,
    startTimeMinute: input.startTimeMinute ?? null,
    startTimePeriod: input.startTimePeriod?.trim() || null,
    updatedAt: new Date(),
  };

  const seriesIdTrim = input.seriesId?.trim() || null;
  let setup = seriesIdTrim
    ? await prisma.run_series.findUnique({ where: { id: seriesIdTrim } })
    : await prisma.run_series.findFirst({
        where: {
          runClubId: runClub.id,
          dayOfWeek: canonicalDay,
          ...(input.startTimeHour != null && input.startTimeMinute != null
            ? {
                startTimeHour: input.startTimeHour,
                startTimeMinute: input.startTimeMinute,
              }
            : {}),
        },
      });

  if (setup) {
    setup = await prisma.run_series.update({
      where: { id: setup.id },
      data: setupData,
    });
  } else {
    const slugHint = buildSeriesSlug(
      runClub.slug || runClub.id,
      canonicalDay,
      seriesCitySlug || meetUpCityTrim || runClub.city
    );
    const slug = await generateUniqueSeriesSlug(slugHint);
    setup = await prisma.run_series.create({
      data: {
        id: seriesIdTrim || generateId(),
        ...setupData,
        slug,
        workflowStatus: "DEVELOP",
      },
    });
  }

  return setup;
}

export async function updateRunSeriesMetaOnly(seriesId: string, input: Partial<RunSeriesMetaInput>) {
  const existing = await prisma.run_series.findUnique({ where: { id: seriesId } });
  if (!existing) {
    throw new Error("Run series not found");
  }

  const runClubId = input.runClubId?.trim() || existing.runClubId;
  if (!runClubId) {
    throw new Error("runClubId is required");
  }

  return upsertRunSeriesMetaOnly({
    seriesId,
    runClubId,
    dayOfWeek: input.dayOfWeek?.trim() || existing.dayOfWeek,
    name: input.name !== undefined ? input.name : existing.name,
    description: input.description !== undefined ? input.description : existing.description,
    citySlug: input.citySlug !== undefined ? input.citySlug : existing.citySlug,
    meetUpPoint: input.meetUpPoint !== undefined ? input.meetUpPoint : existing.meetUpPoint,
    meetUpStreetAddress:
      input.meetUpStreetAddress !== undefined
        ? input.meetUpStreetAddress
        : existing.meetUpStreetAddress,
    meetUpCity: input.meetUpCity !== undefined ? input.meetUpCity : existing.meetUpCity,
    meetUpState: input.meetUpState !== undefined ? input.meetUpState : existing.meetUpState,
    meetUpPlaceId:
      input.meetUpPlaceId !== undefined ? input.meetUpPlaceId : existing.meetUpPlaceId,
    meetUpLat: input.meetUpLat !== undefined ? input.meetUpLat : existing.meetUpLat,
    meetUpLng: input.meetUpLng !== undefined ? input.meetUpLng : existing.meetUpLng,
    startTimeHour:
      input.startTimeHour !== undefined ? input.startTimeHour : existing.startTimeHour,
    startTimeMinute:
      input.startTimeMinute !== undefined ? input.startTimeMinute : existing.startTimeMinute,
    startTimePeriod:
      input.startTimePeriod !== undefined ? input.startTimePeriod : existing.startTimePeriod,
    runType: input.runType !== undefined ? input.runType : existing.runType,
    totalMiles: input.totalMiles !== undefined ? input.totalMiles : existing.totalMiles,
    routeNeighborhood:
      input.routeNeighborhood !== undefined
        ? input.routeNeighborhood
        : existing.routeNeighborhood,
    workoutDescription:
      input.workoutDescription !== undefined
        ? input.workoutDescription
        : existing.workoutDescription,
    postRunActivity:
      input.postRunActivity !== undefined ? input.postRunActivity : existing.postRunActivity,
  });
}
