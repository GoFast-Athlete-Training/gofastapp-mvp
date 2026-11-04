import { calendarDateKeyFromDateInput } from "@/lib/city-run/city-run-zoned-format";

type PriorRun = {
  date: Date;
  runDay: string | null;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  meetUpPoint: string;
  meetUpStreetAddress: string | null;
  meetUpCity: string | null;
  meetUpState: string | null;
  meetUpZip: string | null;
  meetUpPlaceId: string | null;
  meetUpLat: number | null;
  meetUpLng: number | null;
};

function priorDateKey(run: PriorRun): string {
  return run.runDay?.trim() || run.date.toISOString().split("T")[0];
}

/** When core facts change, clear the matching staff validation stamp. */
export function mergeValidationResets(
  prior: PriorRun,
  updateData: Record<string, unknown>
): void {
  const runDayFromBody =
    typeof updateData.runDay === "string" && updateData.runDay.trim()
      ? updateData.runDay.trim()
      : updateData.date != null && updateData.date !== ""
        ? calendarDateKeyFromDateInput(String(updateData.date))
        : null;

  if (runDayFromBody && runDayFromBody !== priorDateKey(prior)) {
    updateData.dateValidate = false;
  }

  const timeChanged =
    (updateData.startTimeHour !== undefined &&
      updateData.startTimeHour !== prior.startTimeHour) ||
    (updateData.startTimeMinute !== undefined &&
      updateData.startTimeMinute !== prior.startTimeMinute) ||
    (updateData.startTimePeriod !== undefined &&
      updateData.startTimePeriod !== prior.startTimePeriod);

  if (timeChanged) {
    updateData.timeValidate = false;
  }

  const meetupChanged =
    (updateData.meetUpPoint !== undefined &&
      String(updateData.meetUpPoint).trim() !== prior.meetUpPoint.trim()) ||
    (updateData.meetUpStreetAddress !== undefined &&
      (updateData.meetUpStreetAddress ?? null) !== prior.meetUpStreetAddress) ||
    (updateData.meetUpCity !== undefined &&
      (updateData.meetUpCity ?? null) !== prior.meetUpCity) ||
    (updateData.meetUpState !== undefined &&
      (updateData.meetUpState ?? null) !== prior.meetUpState) ||
    (updateData.meetUpZip !== undefined &&
      (updateData.meetUpZip ?? null) !== prior.meetUpZip) ||
    (updateData.meetUpPlaceId !== undefined &&
      (updateData.meetUpPlaceId ?? null) !== prior.meetUpPlaceId) ||
    (updateData.meetUpLat !== undefined &&
      (updateData.meetUpLat ?? null) !== prior.meetUpLat) ||
    (updateData.meetUpLng !== undefined &&
      (updateData.meetUpLng ?? null) !== prior.meetUpLng);

  if (meetupChanged) {
    updateData.meetupValidate = false;
  }
}
