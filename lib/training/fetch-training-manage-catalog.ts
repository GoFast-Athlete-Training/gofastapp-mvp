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

function bearerHeaders(authorization: string | null | undefined): HeadersInit | null {
  const auth = authorization?.trim();
  if (!auth) return null;
  return {
    Authorization: auth.startsWith("Bearer ") ? auth : `Bearer ${auth}`,
    Accept: "application/json",
  };
}

export async function fetchTrainingManageCatalogPresets(
  authorization: string | null | undefined,
): Promise<TrainingManageCatalogPreset[] | null> {
  const base = trainingManageBaseUrl();
  const headers = bearerHeaders(authorization);
  if (!base || !headers) return null;

  try {
    const res = await fetch(`${base}/api/training/plan-preset/catalog`, {
      headers,
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
  authorization: string | null | undefined,
): Promise<TrainingManageTemplatePreset | null> {
  const base = trainingManageBaseUrl();
  const headers = bearerHeaders(authorization);
  if (!base || !headers) return null;

  try {
    const res = await fetch(
      `${base}/api/training/plan-preset/${encodeURIComponent(presetId)}/template`,
      { headers, cache: "no-store" },
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
