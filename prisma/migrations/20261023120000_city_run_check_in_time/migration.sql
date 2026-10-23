-- Optional shakeout check-in wall clock (group departure remains startTime* / startsAt).
ALTER TABLE "city_runs" ADD COLUMN "checkInTimeHour" INTEGER;
ALTER TABLE "city_runs" ADD COLUMN "checkInTimeMinute" INTEGER;
ALTER TABLE "city_runs" ADD COLUMN "checkInTimePeriod" TEXT;
