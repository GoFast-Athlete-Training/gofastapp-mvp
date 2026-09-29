/**
 * Company-side series stats for list/dashboard APIs.
 *
 * Identity contract:
 * - acq_run_clubs.id === Product run_clubs.id (companypush)
 * - acq_run_series.id === Product run_series.id after companypush (seriesId on push)
 * - acq_run_series.slug remains stable upsert key; syncedToProd tracks publish state locally
 */
import { sortSeriesByWeekday } from "@/lib/acqRunSeriesDisplay";
import { prisma } from "@/lib/prisma";

export type AcqSeriesSummary = {
  id: string;
  slug: string;
  name: string | null;
  dayOfWeek: string;
  syncedToProd: boolean;
  workflowStatus: string;
  runType: string | null;
  hasWorkoutDescription: boolean;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  meetUpPoint: string | null;
  meetUpCity: string | null;
  citySlug: string | null;
  meetUpState: string | null;
  description: string | null;
  routeNeighborhood: string | null;
};

export type ClubSeriesStats = {
  seriesCount: number;
  syncedSeriesCount: number;
  series: AcqSeriesSummary[];
};

const emptyStats = (): ClubSeriesStats => ({
  seriesCount: 0,
  syncedSeriesCount: 0,
  series: [],
});

/** Load acq_run_series counts/details for many clubs in one query. */
export async function loadClubSeriesStatsByClubIds(
  clubIds: string[]
): Promise<Map<string, ClubSeriesStats>> {
  const map = new Map<string, ClubSeriesStats>();
  if (clubIds.length === 0) return map;

  for (const id of clubIds) {
    map.set(id, emptyStats());
  }

  const rows = await prisma.acq_run_series.findMany({
    where: { acqRunClubId: { in: clubIds } },
    orderBy: [{ acqRunClubId: "asc" }, { dayOfWeek: "asc" }, { slug: "asc" }],
    select: {
      id: true,
      acqRunClubId: true,
      slug: true,
      name: true,
      dayOfWeek: true,
      syncedToProd: true,
      workflowStatus: true,
      runType: true,
      workoutDescription: true,
      startTimeHour: true,
      startTimeMinute: true,
      startTimePeriod: true,
      meetUpPoint: true,
      meetUpCity: true,
      citySlug: true,
      meetUpState: true,
      description: true,
      routeNeighborhood: true,
    },
  });

  for (const row of rows) {
    const stats = map.get(row.acqRunClubId) ?? emptyStats();
    stats.series.push({
      id: row.id,
      slug: row.slug,
      name: row.name,
      dayOfWeek: row.dayOfWeek,
      syncedToProd: row.syncedToProd,
      workflowStatus: row.workflowStatus,
      runType: row.runType,
      hasWorkoutDescription: Boolean(row.workoutDescription?.trim()),
      startTimeHour: row.startTimeHour,
      startTimeMinute: row.startTimeMinute,
      startTimePeriod: row.startTimePeriod,
      meetUpPoint: row.meetUpPoint,
      meetUpCity: row.meetUpCity,
      citySlug: row.citySlug,
      meetUpState: row.meetUpState,
      description: row.description,
      routeNeighborhood: row.routeNeighborhood,
    });
    stats.seriesCount = stats.series.length;
    stats.syncedSeriesCount = stats.series.filter((s) => s.syncedToProd).length;
    stats.series = sortSeriesByWeekday(stats.series);
    map.set(row.acqRunClubId, stats);
  }

  return map;
}

export async function loadClubSeriesStats(clubId: string): Promise<ClubSeriesStats> {
  const map = await loadClubSeriesStatsByClubIds([clubId]);
  return map.get(clubId) ?? emptyStats();
}
