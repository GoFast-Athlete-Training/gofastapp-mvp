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
  runClubId: string | null;
  clubName: string | null;
  runCount: number;
};

export async function listRunSeriesForManage(opts: {
  regionSlug: string;
  citySlug: string;
  runClubId?: string | null;
}): Promise<SeriesManageRow[]> {
  const regionSlug = opts.regionSlug.trim();
  const citySlug = opts.citySlug.trim();
  if (!regionSlug || !citySlug) {
    return [];
  }

  const city = await prisma.cities.findFirst({
    where: {
      slug: citySlug,
      region: { slug: regionSlug },
    },
    select: { id: true, slug: true },
  });
  if (!city) {
    return [];
  }

  const rows = await prisma.run_series.findMany({
    where: {
      OR: [{ citySlug: city.slug }, { cityId: city.id }],
      ...(opts.runClubId?.trim() ? { runClubId: opts.runClubId.trim() } : {}),
    },
    include: {
      runClub: { select: { name: true } },
      _count: { select: { city_runs: true } },
    },
  });

  const mapped: SeriesManageRow[] = rows.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    description: s.description,
    dayOfWeek: s.dayOfWeek,
    startTimeHour: s.startTimeHour,
    startTimeMinute: s.startTimeMinute,
    startTimePeriod: s.startTimePeriod,
    meetUpPoint: s.meetUpPoint,
    meetUpCity: s.meetUpCity,
    meetUpState: s.meetUpState,
    citySlug: s.citySlug,
    runClubId: s.runClubId,
    clubName: s.runClub?.name ?? null,
    runCount: s._count.city_runs,
  }));

  mapped.sort(compareSeriesByWeekdayTime);
  return mapped;
}
