"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import IntakeModePicker, { type IntakeMode } from "@/components/runmanage/intake/IntakeModePicker";
import api from "@/lib/api";
import {
  applyIntakePatch,
  patchFromAiRunData,
  patchFromScratchCsv,
  type CityRunIntakePatch,
} from "@/lib/city-run/apply-intake-patch";
import {
  mergeIntakePatches,
  parseRunInvitePasteText,
} from "@/lib/city-run/parse-run-invite-paste";
import { scratchRunCsvTemplate } from "@/lib/runmanage/scratch-intake-csv";

type Props = {
  onApply: (patch: CityRunIntakePatch) => void;
  onError: (msg: string | null) => void;
  mode: IntakeMode | null;
  onModeChange: (mode: IntakeMode | null) => void;
  /** After paste/CSV applied — show core fields hint */
  onIntakeApplied?: () => void;
};

export default function CityRunIntake({
  onApply,
  onError,
  mode,
  onModeChange,
  onIntakeApplied,
}: Props) {
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [csvApplied, setCsvApplied] = useState(false);

  const dispatchPatch = (patch: CityRunIntakePatch) => {
    onApply(patch);
    onIntakeApplied?.();
    onError(null);
  };

  const handlePasteParse = async () => {
    const text = pasteText.trim();
    if (!text) {
      onError("Paste some run details first.");
      return;
    }
    setParsing(true);
    onError(null);
    const localPatch = parseRunInvitePasteText(text);
    let applied = false;
    try {
      const res = await api.post("/runs/ai-generate", {
        stravaText: text,
        igPostText: text,
      });
      if (res.data?.success && res.data?.runData) {
        dispatchPatch(
          mergeIntakePatches(localPatch, patchFromAiRunData(res.data.runData as Record<string, unknown>))
        );
        applied = true;
      }
    } catch {
      /* fall back to local parse when signed out or API unavailable */
    } finally {
      setParsing(false);
    }

    if (applied) return;

    const merged = mergeIntakePatches(localPatch);
    if (Object.keys(merged).length === 0) {
      onError("Could not read date, time, or meetup from that paste — try manual fields.");
      return;
    }
    dispatchPatch(merged);
  };

  const handleCsvFile = async (file: File) => {
    onError(null);
    const text = await file.text();
    const result = patchFromScratchCsv(text);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    dispatchPatch(result.patch);
    setCsvApplied(true);
  };

  return (
    <div className="space-y-4 rounded-xl border border-orange-100 bg-orange-50/40 px-4 py-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">How do you want to start?</h3>
        <p className="mt-1 text-xs text-gray-600">
          Paste a caption, upload a CSV row, or fill the form yourself. After AI or CSV, confirm
          meetup from Google search — paste does not set the map pin.
        </p>
      </div>

      <IntakeModePicker
        mode={mode}
        onChange={(m) => {
          onModeChange(m);
          setCsvApplied(false);
        }}
        descriptions={{
          manual: "Empty fields — type meetup, time, miles, and pace.",
          paste: "Paste IG, Strava, or email text — we pre-fill title, when, where, and miles.",
          csv: "One row from the template — good for repeating weekly runs.",
        }}
      />

      {mode === "paste" ? (
        <div className="space-y-3">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            placeholder="Paste an IG caption, Strava event blurb, or email…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
          />
          <button
            type="button"
            disabled={parsing || !pasteText.trim()}
            onClick={() => void handlePasteParse()}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Parse into fields
          </button>
        </div>
      ) : null}

      {mode === "csv" ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([scratchRunCsvTemplate()], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "run-invite-template.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-orange-800 hover:underline"
          >
            <Download className="h-4 w-4" />
            Download template
          </button>
          <label className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 bg-white p-4 text-center text-sm text-gray-600 hover:border-orange-400">
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleCsvFile(f);
                e.target.value = "";
              }}
            />
          </label>
          {csvApplied ? (
            <p className="text-sm text-emerald-800">CSV applied — review fields below.</p>
          ) : null}
        </div>
      ) : null}

      {mode === "manual" ? (
        <p className="text-sm text-gray-600">Fill meetup details below. Add a route after the invite is saved.</p>
      ) : null}
    </div>
  );
}

/** Helper for parent forms: wire patch into local setters. */
export { applyIntakePatch };
