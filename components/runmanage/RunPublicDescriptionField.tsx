"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import runmanageApi from "@/lib/runmanage/api-client";
import type { RunInstanceWizardValues } from "@/components/runmanage/runInstanceWizard/shared";
import { isTrackRun } from "@/lib/runTypes";

type Props = {
  values: RunInstanceWizardValues;
  onDescriptionChange: (next: string) => void;
  cityRunType?: string | null;
  clubName?: string | null;
  onError?: (msg: string | null) => void;
  compact?: boolean;
};

export default function RunPublicDescriptionField({
  values,
  onDescriptionChange,
  cityRunType,
  clubName,
  onError,
  compact = false,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const isTrack = isTrackRun(values.runType);

  const runGenerate = async (mode: "smooth" | "from_core") => {
    setGenerating(true);
    onError?.(null);
    try {
      const res = await runmanageApi.post("/api/runs/run-description-generate", {
        mode,
        cityRunType,
        clubName,
        title: values.title.trim() || undefined,
        existingDescription: values.description.trim() || undefined,
        meetUpPoint: values.meetUpPoint.trim() || undefined,
        totalMiles: values.totalMiles.trim() || undefined,
        pace: values.pace.trim() || undefined,
        dateYmd: values.date.trim() || undefined,
        postRunActivity: values.postRunActivity.trim() || undefined,
        runType: values.runType.trim() || undefined,
        routeNeighborhood: values.routeNeighborhood.trim() || undefined,
        workoutDescription: isTrack ? values.trackWorkoutDescription.trim() || undefined : undefined,
        workoutTitle: isTrack ? values.attachedWorkoutTitle.trim() || undefined : undefined,
        routeDescription: !isTrack ? values.routeDescription.trim() || undefined : undefined,
      });
      if (res.data?.success && res.data.description) {
        onDescriptionChange(String(res.data.description).trim());
      } else {
        throw new Error(res.data?.error || "Could not generate description.");
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      onError?.(err.response?.data?.error || err.message || "Generate failed.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="run-public-description" className="text-sm font-medium text-gray-700">
          Public description
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={generating}
            onClick={() => void runGenerate("smooth")}
            className="text-xs font-medium text-gray-600 underline hover:text-gray-900 disabled:opacity-50"
          >
            Smooth with AI
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={() => void runGenerate("from_core")}
            className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Add core details and generate
          </button>
        </div>
      </div>
      <textarea
        id="run-public-description"
        rows={compact ? 2 : 3}
        value={values.description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder={
          isTrack
            ? "Intro line (club, day, meet-up), then one line per warmup/interval/cooldown…"
            : "Factual third-person blurb: club, meet-up, route or pace…"
        }
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
