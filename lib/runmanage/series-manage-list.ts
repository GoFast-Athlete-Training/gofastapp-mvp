import { prisma } from "@/lib/prisma";
import { compareSeriesByWeekdayTime } from "@/lib/runmanage/sort-series-by-weekday";

export type SeriesManageRow = {
  id: string;
  slug: string | null;
  name: string | null;
  description: string | null;
  dayOfWeek: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  meetUpPoint: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  citySlug: string | null;
  cityName: string | null;
  runClubId: string | null;
  clubName: string | null;
  runCount: number;
};

const seriesInclude = {
  runClub: { select: { name: true } },
  cities: { select: { name: true } },
  _count: { select: { city_runs: true } },
} as const;

type SeriesQueryRow = {
  id: string;
  slug: string | null;
  name: string | null;
  description: string | null;
  dayOfWeek: string;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  meetUpPoint: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  citySlug: string | null;
  runClubId: string | null;
  runClub: { name: string } | null;
  cities: { name: string } | null;
  _count: { city_runs: number };
};

function mapSeriesRow(row: SeriesQueryRow): SeriesManageRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    dayOfWeek: row.dayOfWeek,
    startTimeHour: row.startTimeHour,
    startTimeMinute: row.startTimeMinute,
    startTimePeriod: row.startTimePeriod,
    meetUpPoint: row.meetUpPoint,
    meetUpCity: row.meetUpCity,
    meetUpState: row.meetUpState,
    citySlug: row.citySlug,
    cityName: row.cities?.name ?? null,
    runClubId: row.runClubId,
    clubName: row.runClub?.name ?? null,
    runCount: row._count.city_runs,
  };
}

export async function listRunSeriesForManage(opts: {
  regionSlug: string;
  citySlug?: string | null;
  runClubId?: string | null;
}): Promise<SeriesManageRow[]> {
  const regionSlug = opts.regionSlug.trim();
  const citySlug = opts.citySlug?.trim() || "";
  if (!regionSlug) {
    return [];
  }

  const cities = await prisma.cities.findMany({
    where: {
      region: { slug: regionSlug },
      ...(citySlug ? { slug: citySlug } : {}),
    },
    select: { id: true, slug: true },
  });
  if (cities.length === 0) {
    return [];
  }

  const rows = await prisma.run_series.findMany({
    where: {
      OR: [
        { citySlug: { in: cities.map((city) => city.slug) } },
        { cityId: { in: cities.map((city) => city.id) } },
      ],
      ...(opts.runClubId?.trim() ? { runClubId: opts.runClubId.trim() } : {}),
    },
    include: seriesInclude,
  });

  const mapped = rows.map((row) => mapSeriesRow(row));
  mapped.sort(compareSeriesByWeekdayTime);
  return mapped;
}

/** Load all series for one club — no region/city scope bar required. */
export async function listRunSeriesForClub(runClubId: string): Promise<SeriesManageRow[]> {
  const id = runClubId.trim();
  if (!id) return [];

  const rows = await prisma.run_series.findMany({
    where: { runClubId: id },
    include: seriesInclude,
  });

  const mapped = rows.map((row) => mapSeriesRow(row));

  mapped.sort(compareSeriesByWeekdayTime);
  return mapped;
}
