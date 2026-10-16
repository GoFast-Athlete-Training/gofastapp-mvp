import { applyAiRunDataToWizardValues } from "@/lib/runmanage/apply-ai-run-data";
import { emptyWizardValues } from "@/components/runmanage/runInstanceWizard/shared";
import { parseScratchRunCsv } from "@/lib/runmanage/scratch-intake-csv";
import { DEFAULT_PACE_OPTION, PACE_OPTIONS } from "@/lib/runTypes";

/** Fields athlete city-run create can prefill from paste or CSV. */
export type CityRunIntakePatch = {
  title?: string;
  date?: string;
  startHour?: string;
  startMinute?: string;
  startPeriod?: "AM" | "PM";
  meetUpPoint?: string;
  meetUpCity?: string;
  totalMiles?: string;
  pace?: string;
  stravaMapUrl?: string;
  routeNeighborhood?: string;
  description?: string;
};

function normalizePaceFromAi(raw: string | null | undefined): string | undefined {
  const p = raw?.trim();
  if (!p) return undefined;
  if (p.toLowerCase().includes("all paces")) return "Various";
  const match = PACE_OPTIONS.find((o) => o.toLowerCase() === p.toLowerCase());
  return match ?? (p.includes(":") ? p : undefined);
}

export function patchFromAiRunData(runData: Record<string, unknown>): CityRunIntakePatch {
  const base = emptyWizardValues();
  const merged = applyAiRunDataToWizardValues(base, runData as Parameters<
    typeof applyAiRunDataToWizardValues
  >[1]);

  const routeNote =
    merged.routeDescription?.trim() ||
    (typeof runData.routeNeighborhood === "string" ? runData.routeNeighborhood.trim() : "") ||
    undefined;

  return {
    title: merged.title.trim() || undefined,
    date: merged.date.trim() || undefined,
    startHour: merged.startTimeHour.trim() || undefined,
    startMinute: merged.startTimeMinute.trim() || undefined,
    startPeriod:
      merged.startTimePeriod === "PM" || merged.startTimePeriod === "AM"
        ? merged.startTimePeriod
        : undefined,
    meetUpPoint: merged.meetUpPoint.trim() || undefined,
    meetUpCity: merged.meetUpCity.trim() || undefined,
    totalMiles: merged.totalMiles.trim() || undefined,
    pace: normalizePaceFromAi(merged.pace),
    stravaMapUrl: merged.stravaMapUrl.trim() || undefined,
    routeNeighborhood: routeNote,
    description: merged.description.trim() || undefined,
  };
}

export function patchFromScratchCsv(text: string): { ok: true; patch: CityRunIntakePatch } | { ok: false; error: string } {
  const result = parseScratchRunCsv(text);
  if (!result.ok) return result;

  const p = result.patch;
  return {
    ok: true,
    patch: {
      title: p.title?.trim() || undefined,
      date: p.date?.trim() || undefined,
      startHour: p.startTimeHour?.trim() || undefined,
      startMinute: p.startTimeMinute?.trim() || undefined,
      startPeriod:
        p.startTimePeriod === "PM" || p.startTimePeriod === "AM" ? p.startTimePeriod : undefined,
      meetUpPoint: p.meetUpPoint?.trim() || undefined,
      meetUpCity: p.meetUpCity?.trim() || undefined,
      totalMiles: p.totalMiles?.trim() || undefined,
      pace: normalizePaceFromAi(p.pace),
      stravaMapUrl: p.stravaMapUrl?.trim() || undefined,
      routeNeighborhood: p.routeDescription?.trim() || undefined,
      description: p.description?.trim() || undefined,
    },
  };
}

export function applyIntakePatch(
  patch: CityRunIntakePatch,
  setters: {
    setTitle?: (v: string) => void;
    setDate?: (v: string) => void;
    setStartHour?: (v: string) => void;
    setStartMinute?: (v: string) => void;
    setStartPeriod?: (v: "AM" | "PM") => void;
    setMeetUpPoint?: (v: string) => void;
    setMeetUpCity?: (v: string) => void;
    setTotalMiles?: (v: string) => void;
    setPace?: (v: string) => void;
    setStravaMapUrl?: (v: string) => void;
    setRouteNeighborhood?: (v: string) => void;
    setDescription?: (v: string) => void;
  }
): void {
  if (patch.title && setters.setTitle) setters.setTitle(patch.title);
  if (patch.date && setters.setDate) setters.setDate(patch.date);
  if (patch.startHour && setters.setStartHour) setters.setStartHour(patch.startHour);
  if (patch.startMinute && setters.setStartMinute) setters.setStartMinute(patch.startMinute);
  if (patch.startPeriod && setters.setStartPeriod) setters.setStartPeriod(patch.startPeriod);
  if (patch.meetUpPoint && setters.setMeetUpPoint) setters.setMeetUpPoint(patch.meetUpPoint);
  if (patch.meetUpCity && setters.setMeetUpCity) setters.setMeetUpCity(patch.meetUpCity);
  if (patch.totalMiles && setters.setTotalMiles) setters.setTotalMiles(patch.totalMiles);
  if (patch.pace && setters.setPace) setters.setPace(patch.pace);
  else if (patch.pace === undefined && setters.setPace) {
    /* no-op */
  }
  if (patch.stravaMapUrl && setters.setStravaMapUrl) setters.setStravaMapUrl(patch.stravaMapUrl);
  if (patch.routeNeighborhood && setters.setRouteNeighborhood) {
    setters.setRouteNeighborhood(patch.routeNeighborhood);
  }
  if (patch.description && setters.setDescription) setters.setDescription(patch.description);
}

/** Default pace when athlete leaves field empty on submit. */
export const CITY_RUN_DEFAULT_PACE = DEFAULT_PACE_OPTION;
