"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import IntakeModePicker, { type IntakeMode } from "@/components/runmanage/intake/IntakeModePicker";
import runmanageApi from "@/lib/runmanage/api-client";
import { applyAiRunDataToWizardValues } from "@/lib/runmanage/apply-ai-run-data";
import {
  parseScratchRunCsv,
  scratchRunCsvTemplate,
} from "@/lib/runmanage/scratch-intake-csv";
import type { RunInstanceWizardValues } from "./shared";

type Props = {
  values: RunInstanceWizardValues;
  onApply: (next: RunInstanceWizardValues) => void;
  onError: (msg: string | null) => void;
  mode: IntakeMode | null;
  onModeChange: (mode: IntakeMode | null) => void;
  onIntakeApplied?: () => void;
};

export default function RunManageScratchIntakeStep({
  values,
  onApply,
  onError,
  mode,
  onModeChange,
  onIntakeApplied,
}: Props) {
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [csvApplied, setCsvApplied] = useState(false);

  const handlePasteParse = async () => {
    const text = pasteText.trim();
    if (!text) {
      onError("Paste some run details first.");
      return;
    }
    setParsing(true);
    onError(null);
    try {
      const res = await runmanageApi.post("/api/runs/ai-generate", {
        stravaText: text,
        igPostText: text,
      });
      if (!res.data?.success || !res.data?.runData) {
        throw new Error(res.data?.error || "Parse failed");
      }
      onApply(applyAiRunDataToWizardValues(values, res.data.runData));
      onIntakeApplied?.();
      onError(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      onError(err.response?.data?.error || err.message || "Could not parse pasted text.");
    } finally {
      setParsing(false);
    }
  };

  const handleCsvFile = async (file: File) => {
    onError(null);
    const text = await file.text();
    const result = parseScratchRunCsv(text);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    onApply({ ...values, ...result.patch });
    setCsvApplied(true);
    onIntakeApplied?.();
    onError(null);
  };

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white px-4 py-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">How do you want to start?</h3>
        <p className="mt-1 text-xs text-gray-600">
          Manual keeps fields empty. AI parse and CSV pre-fill the steps below — you can still edit
          everything.
        </p>
      </div>

      <IntakeModePicker
        mode={mode}
        onChange={(m) => {
          onModeChange(m);
          setCsvApplied(false);
        }}
      />

      {mode === "paste" ? (
        <div className="space-y-3">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={8}
            placeholder="Paste an IG caption, Strava event blurb, or email…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={parsing || !pasteText.trim()}
            onClick={() => void handlePasteParse()}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
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
              a.download = "run-create-template.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-sky-700 hover:underline"
          >
            <Download className="h-4 w-4" />
            Download template
          </button>
          <label className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-4 text-center text-sm text-gray-600 hover:border-sky-400">
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
            <p className="text-sm text-emerald-700">CSV row applied — continue to Host.</p>
          ) : null}
        </div>
      ) : null}

      {mode === "manual" ? (
        <p className="text-sm text-gray-600">Continue to pick who is hosting this run.</p>
      ) : null}
    </div>
  );
}
