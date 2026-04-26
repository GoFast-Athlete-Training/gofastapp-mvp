"use client";

export type BikeStepDraft = {
  title: string;
  intensity: string;
  durationMinutes: string;
  powerWattsLow: string;
  powerWattsHigh: string;
  /** Display-only % FTP low; cleared when user edits W low directly */
  powerPctLow: string;
  powerPctHigh: string;
};

export function emptyBikeStep(overrides: Partial<BikeStepDraft> = {}): BikeStepDraft {
  return {
    title: "Interval",
    intensity: "ACTIVE",
    durationMinutes: "10",
    powerWattsLow: "200",
    powerWattsHigh: "230",
    powerPctLow: "",
    powerPctHigh: "",
    ...overrides,
  };
}

export function defaultNewBikeSteps(): BikeStepDraft[] {
  return [
    {
      title: "Warmup",
      intensity: "WARMUP",
      durationMinutes: "10",
      powerWattsLow: "120",
      powerWattsHigh: "150",
      powerPctLow: "",
      powerPctHigh: "",
    },
    emptyBikeStep(),
    {
      title: "Cooldown",
      intensity: "COOLDOWN",
      durationMinutes: "10",
      powerWattsLow: "100",
      powerWattsHigh: "130",
      powerPctLow: "",
      powerPctHigh: "",
    },
  ];
}

function wattsToPctString(watts: number, ftp: number): string {
  if (ftp <= 0) return "";
  return String(Math.round((watts / ftp) * 100));
}

/** Hydrate drafts from saved workout steps (for edit page). */
export function bikeStepsFromApi(
  apiSteps: {
    title: string;
    intensity: string;
    durationSeconds: number | null;
    powerWattsLow: number | null;
    powerWattsHigh: number | null;
  }[],
  ftpWatts: number | null | undefined
): BikeStepDraft[] {
  const ftp = ftpWatts && ftpWatts > 0 ? ftpWatts : null;
  return apiSteps.map((s) => {
    const low = s.powerWattsLow ?? 0;
    const high = s.powerWattsHigh ?? low;
    const sec = s.durationSeconds ?? 0;
    const min = sec > 0 ? String(sec / 60) : "";
    return {
      title: s.title,
      intensity: s.intensity,
      durationMinutes: min,
      powerWattsLow: low ? String(low) : "",
      powerWattsHigh: high ? String(high) : "",
      powerPctLow: ftp && low ? wattsToPctString(low, ftp) : "",
      powerPctHigh: ftp && high ? wattsToPctString(high, ftp) : "",
    };
  });
}

export type BikeStepApiPayload = {
  stepOrder: number;
  title: string;
  intensity: string;
  durationType: string;
  durationSeconds: number;
  powerWattsLow: number;
  powerWattsHigh: number;
};

export function buildBikeStepsApiPayload(steps: BikeStepDraft[]): BikeStepApiPayload[] {
  return steps.map((s, idx) => {
    const min = parseFloat(s.durationMinutes);
    if (!Number.isFinite(min) || min <= 0) {
      throw new Error(`Step ${idx + 1}: duration must be a positive number (minutes)`);
    }
    const low = parseInt(s.powerWattsLow, 10);
    const high = parseInt(s.powerWattsHigh, 10);
    if (!Number.isFinite(low) || !Number.isFinite(high)) {
      throw new Error(`Step ${idx + 1}: power must be watts (integers)`);
    }
    return {
      stepOrder: idx + 1,
      title: s.title.trim() || `Step ${idx + 1}`,
      intensity: s.intensity.trim() || "ACTIVE",
      durationType: "TIME",
      durationSeconds: Math.round(min * 60),
      powerWattsLow: low,
      powerWattsHigh: high,
    };
  });
}

const ZONE_HINTS = [
  { label: "Z2", range: "56–75% FTP" },
  { label: "Z3", range: "76–90% FTP" },
  { label: "Z4", range: "91–105% FTP" },
  { label: "Z5", range: "106–120% FTP" },
];

type BikeStepEditorProps = {
  steps: BikeStepDraft[];
  onChangeSteps: (next: BikeStepDraft[]) => void;
  ftpWatts: number | null | undefined;
};

export function BikeStepEditor({ steps, onChangeSteps, ftpWatts }: BikeStepEditorProps) {
  const ftp = ftpWatts != null && ftpWatts > 0 ? ftpWatts : null;

  function updateStep(i: number, patch: Partial<BikeStepDraft>) {
    onChangeSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }

  function addStep() {
    onChangeSteps([...steps, emptyBikeStep()]);
  }

  function removeStep(i: number) {
    if (steps.length <= 1) return;
    onChangeSteps(steps.filter((_, j) => j !== i));
  }

  function onPctLowChange(i: number, raw: string) {
    if (!ftp) {
      updateStep(i, { powerPctLow: raw });
      return;
    }
    const pct = parseFloat(raw);
    if (raw.trim() === "" || !Number.isFinite(pct)) {
      updateStep(i, { powerPctLow: raw, powerWattsLow: "" });
      return;
    }
    const w = Math.round((pct / 100) * ftp);
    updateStep(i, { powerPctLow: raw, powerWattsLow: String(w) });
  }

  function onPctHighChange(i: number, raw: string) {
    if (!ftp) {
      updateStep(i, { powerPctHigh: raw });
      return;
    }
    const pct = parseFloat(raw);
    if (raw.trim() === "" || !Number.isFinite(pct)) {
      updateStep(i, { powerPctHigh: raw, powerWattsHigh: "" });
      return;
    }
    const w = Math.round((pct / 100) * ftp);
    updateStep(i, { powerPctHigh: raw, powerWattsHigh: String(w) });
  }

  function onWattsLowChange(i: number, raw: string) {
    updateStep(i, { powerWattsLow: raw, powerPctLow: "" });
  }

  function onWattsHighChange(i: number, raw: string) {
    updateStep(i, { powerWattsHigh: raw, powerPctHigh: "" });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">Steps (time + power)</p>
          {ftp ? (
            <p className="text-xs text-gray-500 mt-0.5">Using your FTP: {ftp} W</p>
          ) : (
            <p className="text-xs text-amber-700 mt-0.5">
              Set FTP on your athlete profile to use % FTP helpers.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={addStep}
          className="text-sm font-medium text-orange-600 hover:text-orange-700"
        >
          Add step
        </button>
      </div>

      <p className="text-xs text-gray-500">
        Zone hints: {ZONE_HINTS.map((z) => `${z.label} ${z.range}`).join(" · ")}
      </p>

      {steps.map((s, i) => (
        <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2 bg-gray-50/80">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[120px]">
              <label className="text-xs text-gray-500">Title</label>
              <input
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={s.title}
                onChange={(e) => updateStep(i, { title: e.target.value })}
              />
            </div>
            <div className="w-28">
              <label className="text-xs text-gray-500">Intensity</label>
              <input
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={s.intensity}
                onChange={(e) => updateStep(i, { intensity: e.target.value })}
              />
            </div>
            <div className="w-24">
              <label className="text-xs text-gray-500">Minutes</label>
              <input
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={s.durationMinutes}
                onChange={(e) => updateStep(i, { durationMinutes: e.target.value })}
              />
            </div>
            <div className="w-24">
              <label className="text-xs text-gray-500">W low</label>
              <input
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={s.powerWattsLow}
                onChange={(e) => onWattsLowChange(i, e.target.value)}
              />
            </div>
            <div className="w-24">
              <label className="text-xs text-gray-500">W high</label>
              <input
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                value={s.powerWattsHigh}
                onChange={(e) => onWattsHighChange(i, e.target.value)}
              />
            </div>
            {ftp ? (
              <>
                <div className="w-20">
                  <label className="text-xs text-gray-500">% low</label>
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    inputMode="decimal"
                    value={s.powerPctLow}
                    onChange={(e) => onPctLowChange(i, e.target.value)}
                  />
                </div>
                <div className="w-20">
                  <label className="text-xs text-gray-500">% high</label>
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    inputMode="decimal"
                    value={s.powerPctHigh}
                    onChange={(e) => onPctHighChange(i, e.target.value)}
                  />
                </div>
              </>
            ) : null}
            {steps.length > 1 ? (
              <button
                type="button"
                onClick={() => removeStep(i)}
                className="text-xs text-red-600 hover:underline pb-1"
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
