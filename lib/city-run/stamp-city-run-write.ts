import {
  computeCityRunStartsAt,
  type CityRunStartsAtInput,
} from '@/lib/city-run/city-run-starts-at-setter';
import { cityRunStorageDateFromCalendarKey } from '@/lib/city-run/city-run-zoned-format';

type ExistingCityRunClock = {
  date: Date;
  startTimeHour: number | null;
  startTimeMinute: number | null;
  startTimePeriod: string | null;
  timezone: string | null;
  citySlug: string;
};

const CLOCK_PATCH_KEYS = [
  'calendarDateKey',
  'date',
  'startTimeHour',
  'startTimeMinute',
  'startTimePeriod',
  'timezone',
] as const;

function mergedClockInput(
  updateData: Record<string, unknown>,
  existing: ExistingCityRunClock
): CityRunStartsAtInput {
  return {
    calendarDateKey: updateData.calendarDateKey as string | null | undefined,
    date: (updateData.date as Date | undefined) ?? existing.date,
    startTimeHour:
      updateData.startTimeHour !== undefined
        ? (updateData.startTimeHour as number | null)
        : existing.startTimeHour,
    startTimeMinute:
      updateData.startTimeMinute !== undefined
        ? (updateData.startTimeMinute as number | null)
        : existing.startTimeMinute,
    startTimePeriod:
      updateData.startTimePeriod !== undefined
        ? (updateData.startTimePeriod as string | null)
        : existing.startTimePeriod,
    timezone:
      updateData.timezone !== undefined
        ? (updateData.timezone as string | null)
        : existing.timezone,
    citySlug: existing.citySlug,
  };
}

/** Always stamp on create — caller passes full clock fields on the write payload. */
export function stampCityRunStartsAtOnCreateData(data: Record<string, unknown>): void {
  const stamped = computeCityRunStartsAt({
    calendarDateKey: data.calendarDateKey as string | null | undefined,
    date: data.date as Date | undefined,
    startTimeHour: data.startTimeHour as number | null | undefined,
    startTimeMinute: data.startTimeMinute as number | null | undefined,
    startTimePeriod: data.startTimePeriod as string | null | undefined,
    timezone: data.timezone as string | null | undefined,
    citySlug: (data.citySlug as string | null | undefined) ?? null,
  });
  data.timezone = stamped.timezone;
  data.startsAt = stamped.startsAt;
  data.date = cityRunStorageDateFromCalendarKey(
    stamped.calendarDateKey,
    stamped.timezone
  );
}

/** Recompute when any clock field changes on PATCH. */
export function maybeStampCityRunStartsAtOnUpdate(
  updateData: Record<string, unknown>,
  existing: ExistingCityRunClock
): void {
  const touched = CLOCK_PATCH_KEYS.some((key) => key in updateData);
  if (!touched) return;

  const stamped = computeCityRunStartsAt(mergedClockInput(updateData, existing));
  updateData.timezone = stamped.timezone;
  updateData.startsAt = stamped.startsAt;
  updateData.date = cityRunStorageDateFromCalendarKey(
    stamped.calendarDateKey,
    stamped.timezone
  );
}
