import { prisma } from "@/lib/prisma";
import {
  dateToYmd,
  duplicateRunForward,
  getStartOfTodayUTC,
} from "@/lib/advance-club-instances";
import {
  isYmdInWeek,
  weekWindowContaining,
  ymdForDayInWeek,
  type WeekWindow,
} from "@/lib/runmanage/calendar-week";
import { dateKeyToUtcStartOfDay } from "@/lib/calendar-date";

export type PrepareWeekResult = {
  seriesId: string;
  targetDateYmd: string;
  outcome: "created" | "found_existing" | "skipped_no_prior" | "skipped_no_slot" | "error";
  runId?: string;
  error?: string;
};

function dayRangeUtc(ymd: string): { start: Date; end: Date } {
  const start = dateKeyToUtcStartOfDay(ymd);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function findSeriesRunOnYmd(runSeriesId: string, ymd: string) {
  const { start, end } = dayRangeUtc(ymd);
  return prisma.city_runs.findFirst({
    where: {
      runSeriesId,
      date: { gte: start, lt: end },
    },
    select: { id: true },
  });
}

async function latestPriorRunForSeries(runSeriesId: string, beforeYmd: string) {
  const before = dateKeyToUtcStartOfDay(beforeYmd);
  return prisma.city_runs.findFirst({
    where: {
      runSeriesId,
      date: { lt: before },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      date: true,
      published: true,
      workflowStatus: true,
      runSeriesId: true,
      runClubId: true,
      citySlug: true,
      regionSlug: true,
      slug: true,
      dayOfWeek: true,
      timezone: true,
      meetUpPoint: true,
      meetUpPlaceId: true,
      meetUpLat: true,
      meetUpLng: true,
      meetUpStreetAddress: true,
      meetUpCity: true,
      meetUpState: true,
      meetUpZip: true,
      endPoint: true,
      endStreetAddress: true,
      endCity: true,
      endState: true,
      totalMiles: true,
      pace: true,
      stravaMapUrl: true,
      stravaEventUrl: true,
      stravaText: true,
      webUrl: true,
      webText: true,
      igPostText: true,
      igPostGraphic: true,
      description: true,
      postRunActivity: true,
      routePhotos: true,
      mapImageUrl: true,
      staffNotes: true,
      startTimeHour: true,
      startTimeMinute: true,
      startTimePeriod: true,
      routeNeighborhood: true,
      runType: true,
      workoutDescription: true,
      directionsText: true,
      routeId: true,
      plannedWorkoutId: true,
      cityRunType: true,
      staffGeneratedId: true,
    },
  });
}

export async function prepareWeekForRegionCity(opts: {
  regionSlug: string;
  citySlug: string;
  staffGeneratedId?: string | null;
  weekOffset?: number;
}): Promise<{ window: WeekWindow; results: PrepareWeekResult[] }> {
  const regionSlug = opts.regionSlug.trim();
  const citySlug = opts.citySlug.trim();
  if (!regionSlug || !citySlug) {
    throw new Error("region and city are required");
  }

  const window = weekWindowContaining(new Date(), opts.weekOffset ?? 0);
  const startOfToday = getStartOfTodayUTC();

  const city = await prisma.cities.findFirst({
    where: {
      slug: citySlug,
      region: { slug: regionSlug },
    },
    select: { id: true, slug: true },
  });
  if (!city) {
    throw new Error("City not found for that region");
  }

  const seriesRows = await prisma.run_series.findMany({
    where: {
      OR: [{ citySlug: city.slug }, { cityId: city.id }],
    },
    select: {
      id: true,
      dayOfWeek: true,
      runClubId: true,
    },
  });

  const results: PrepareWeekResult[] = [];

  for (const series of seriesRows) {
    const targetYmd = ymdForDayInWeek(series.dayOfWeek, window);
    if (!targetYmd || !isYmdInWeek(targetYmd, window)) {
      results.push({
        seriesId: series.id,
        targetDateYmd: targetYmd ?? "",
        outcome: "skipped_no_slot",
      });
      continue;
    }

    if (new Date(`${targetYmd}T12:00:00.000Z`) < startOfToday) {
      results.push({
        seriesId: series.id,
        targetDateYmd: targetYmd,
        outcome: "skipped_no_slot",
      });
      continue;
    }

    try {
      const existing = await findSeriesRunOnYmd(series.id, targetYmd);
      if (existing) {
        results.push({
          seriesId: series.id,
          targetDateYmd: targetYmd,
          outcome: "found_existing",
          runId: existing.id,
        });
        continue;
      }

      const prior = await latestPriorRunForSeries(series.id, window.startYmd);
      if (!prior) {
        results.push({
          seriesId: series.id,
          targetDateYmd: targetYmd,
          outcome: "skipped_no_prior",
        });
        continue;
      }

      const created = await duplicateRunForward(prior, targetYmd, opts.staffGeneratedId, false);
      results.push({
        seriesId: series.id,
        targetDateYmd: targetYmd,
        outcome: "created",
        runId: created.id,
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      results.push({
        seriesId: series.id,
        targetDateYmd: targetYmd,
        outcome: "error",
        error: err?.message || "Prepare failed",
      });
    }
  }

  return { window, results };
}

export function summarizePrepareWeek(results: PrepareWeekResult[]) {
  return {
    created: results.filter((r) => r.outcome === "created").length,
    existing: results.filter((r) => r.outcome === "found_existing").length,
    noPrior: results.filter((r) => r.outcome === "skipped_no_prior").length,
    errors: results.filter((r) => r.outcome === "error").length,
  };
}
