import type { RunInstanceWizardValues } from "@/components/runmanage/runInstanceWizard/shared";
import { normalizeRunType } from "@/lib/runTypes";

type AiRunData = {
  title?: string | null;
  date?: string | null;
  startTimeHour?: string | number | null;
  startTimeMinute?: string | number | null;
  startTimePeriod?: string | null;
  meetUpPoint?: string | null;
  meetUpCity?: string | null;
  routeNeighborhood?: string | null;
  runType?: string | null;
  workoutDescription?: string | null;
  totalMiles?: string | number | null;
  pace?: string | null;
  postRunActivity?: string | null;
  stravaMapUrl?: string | null;
  description?: string | null;
};

export function applyAiRunDataToWizardValues(
  values: RunInstanceWizardValues,
  runData: AiRunData
): RunInstanceWizardValues {
  const isTrack = (runData.runType ?? "").toLowerCase() === "track";
  return {
    ...values,
    title: runData.title?.trim() || values.title,
    date: runData.date?.trim() || values.date,
    startTimeHour:
      runData.startTimeHour != null ? String(runData.startTimeHour) : values.startTimeHour,
    startTimeMinute:
      runData.startTimeMinute != null ? String(runData.startTimeMinute) : values.startTimeMinute,
    startTimePeriod: runData.startTimePeriod?.trim() || values.startTimePeriod,
    meetUpPoint: runData.meetUpPoint?.trim() || values.meetUpPoint,
    meetUpCity: runData.meetUpCity?.trim() || values.meetUpCity,
    routeNeighborhood: runData.routeNeighborhood?.trim() || values.routeNeighborhood,
    runType: runData.runType ? normalizeRunType(runData.runType) || runData.runType : values.runType,
    trackWorkoutDescription: isTrack
      ? runData.workoutDescription?.trim() || values.trackWorkoutDescription
      : values.trackWorkoutDescription,
    routeDescription: !isTrack
      ? runData.workoutDescription?.trim() || values.routeDescription
      : values.routeDescription,
    totalMiles:
      runData.totalMiles != null ? String(runData.totalMiles) : values.totalMiles,
    pace: runData.pace?.trim() || values.pace,
    postRunActivity: runData.postRunActivity?.trim() || values.postRunActivity,
    stravaMapUrl: runData.stravaMapUrl?.trim() || values.stravaMapUrl,
    description: runData.description?.trim() || values.description,
  };
}
