import { internalApiHeaders } from "@/lib/internal-api-auth";

export type TrainingManageCatalogPreset = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  publicDescription: string | null;
  targetDistanceLabel: string | null;
  minWeeklyMiles: number;
  maxWeeklyMiles: number | null;
  tempoIdealDow?: number;
  intervalIdealDow?: number;
  longRunDefaultDow?: number;
  baseLongRunPoolMiles?: number | null;
};

export type TrainingManageTemplatePreset = {
  id: string;
  slug: string;
  title: string;
  targetDistanceLabel: string | null;
  tempoIdealDow: number;
  intervalIdealDow: number;
  longRunDefaultDow: number;
};

function trainingManageBaseUrl(): string | null {
  const base =
    process.env.GOFAST_TRAINING_MANAGE_URL?.trim() ||
    process.env.NEXT_PUBLIC_GOFAST_TRAINING_MANAGE_URL?.trim();
  return base ? base.replace(/\/$/, "") : null;
}

export async function fetchTrainingManageCatalogPresets(): Promise<
  TrainingManageCatalogPreset[] | null
> {
  const base = trainingManageBaseUrl();
  if (!base) return null;

  try {
    const res = await fetch(`${base}/api/internal/plan-preset`, {
      headers: internalApiHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success?: boolean;
      presets?: TrainingManageCatalogPreset[];
    };
    if (!json.success || !Array.isArray(json.presets)) return null;
    return json.presets.map((p) => {
      const snap = (p as { snapPeakLongRunMiles?: number | null }).snapPeakLongRunMiles;
      return {
        ...p,
        baseLongRunPoolMiles:
          snap != null && Number.isFinite(snap) ? Math.round(snap * 4 * 10) / 10 : null,
      };
    });
  } catch (e) {
    console.warn("[fetchTrainingManageCatalogPresets]", e);
    return null;
  }
}

export async function fetchTrainingManageTemplatePreset(
  presetId: string,
): Promise<TrainingManageTemplatePreset | null> {
  const base = trainingManageBaseUrl();
  if (!base) return null;

  try {
    const res = await fetch(
      `${base}/api/internal/plan-preset/${encodeURIComponent(presetId)}/template`,
      { headers: internalApiHeaders(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success?: boolean;
      preset?: TrainingManageTemplatePreset;
    };
    if (!json.success || !json.preset) return null;
    return json.preset;
  } catch (e) {
    console.warn("[fetchTrainingManageTemplatePreset]", e);
    return null;
  }
}
