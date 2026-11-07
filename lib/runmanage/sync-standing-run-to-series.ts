import { prisma } from "@/lib/prisma";

function stripTitleDateSuffix(title: string): string {
  return title.replace(/\s*\(\d{1,2}\/\d{1,2}\)\s*$/, "").trim();
}

export type StandingRunForSeriesSync = {
  runSeriesId: string | null;
  title: string;
  description: string | null;
  dayOfWeek: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  meetUpPoint: string | null;
  meetUpStreetAddress: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  meetUpPlaceId: string | null;
  meetUpLat: number | null;
  meetUpLng: number | null;
  citySlug: string | null;
};

/**
 * After a full city_run save, write standing fields onto run_series (not route/workout/publish).
 */
export async function syncStandingRunFieldsToSeries(
  run: StandingRunForSeriesSync
): Promise<void> {
  const seriesId = run.runSeriesId?.trim();
  if (!seriesId) return;

  const name = stripTitleDateSuffix(run.title?.trim() || "");
  await prisma.run_series.update({
    where: { id: seriesId },
    data: {
      name: name || undefined,
      description: run.description?.trim() || null,
      dayOfWeek: run.dayOfWeek?.trim().toUpperCase() || undefined,
      startTimeHour: run.startTimeHour,
      startTimeMinute: run.startTimeMinute,
      startTimePeriod: run.startTimePeriod?.trim() || null,
      meetUpPoint: run.meetUpPoint?.trim() || null,
      meetUpStreetAddress: run.meetUpStreetAddress?.trim() || null,
      meetUpCity: run.meetUpCity?.trim() || null,
      meetUpState: run.meetUpState?.trim() || null,
      meetUpPlaceId: run.meetUpPlaceId?.trim() || null,
      meetUpLat: run.meetUpLat,
      meetUpLng: run.meetUpLng,
      citySlug: run.citySlug?.trim() || null,
      updatedAt: new Date(),
    },
  });
}
