"use client";

import { useCallback, useState } from "react";
import { athleteBearerFetchHeaders } from "@/lib/athlete-bearer-fetch-headers";
import type {
  PlanIngestPreviewResult,
  PlanIngestScope,
} from "@/lib/training/plan-ingest-contract";

type Props = {
  planId: string;
  scope: PlanIngestScope;
  getToken: () => Promise<string | null>;
  dateKey?: string;
  weekNumber?: number;
  title: string;
  description?: string;
  placeholder?: string;
  onCommitted?: () => void;
  defaultOpen?: boolean;
};

export default function PlanIngestPanel({
  planId,
  scope,
  getToken,
  dateKey,
  weekNumber,
  title,
  description,
  placeholder,
  onCommitted,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [sourceText, setSourceText] = useState("");
  const [preview, setPreview] = useState<PlanIngestPreviewResult | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);

  const runPreview = useCallback(async () => {
    setError(null);
    setPreview(null);
    setSummary(null);
    const token = await getToken();
    if (!token) {
      setError("Sign in to continue");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/training/plan/ingest/preview", {
        method: "POST",
        headers: {
          ...athleteBearerFetchHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId,
          scope,
          sourceText,
          dateKey,
          weekNumber,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        preview?: PlanIngestPreviewResult;
      };
      if (!res.ok) {
        setError(data.error ?? "Preview failed");
        return;
      }
      if (data.preview) {
        setPreview(data.preview);
        setSummary(data.preview.summary);
      }
    } catch {
      setError("Preview failed");
    } finally {
      setLoading(false);
    }
  }, [getToken, planId, scope, sourceText, dateKey, weekNumber]);

  const runCommit = useCallback(async () => {
    if (!preview) return;
    setError(null);
    const token = await getToken();
    if (!token) {
      setError("Sign in to continue");
      return;
    }
    setCommitting(true);
    try {
      const res = await fetch("/api/training/plan/ingest/commit", {
        method: "POST",
        headers: {
          ...athleteBearerFetchHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId, preview }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save");
        return;
      }
      setSourceText("");
      setPreview(null);
      setSummary(null);
      setOpen(false);
      onCommitted?.();
    } catch {
      setError("Could not save");
    } finally {
      setCommitting(false);
    }
  }, [getToken, planId, preview, onCommitted]);

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/50 px-4 py-3 text-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left font-semibold text-sky-950"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <span className="text-xs font-normal text-sky-800">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-3">
          {description ? <p className="text-sky-900/90">{description}</p> : null}
          {scope === "week" ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-medium text-sky-900 hover:bg-sky-50">
                Upload CSV
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void file.text().then((text) => {
                      setSourceText(text);
                      setPreview(null);
                      setSummary(null);
                      setError(null);
                    });
                    e.target.value = "";
                  }}
                />
              </label>
              <span className="text-xs text-sky-800/80">
                Date, Workout, Type, Mileage, Pace — or paste day lines below
              </span>
            </div>
          ) : null}
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            rows={scope === "plan" ? 8 : scope === "week" ? 6 : 4}
            placeholder={
              placeholder ??
              (scope === "week"
                ? "Mon easy 5\nWed tempo 6\nSat long 14"
                : scope === "plan"
                  ? "Week 8\nMon easy 4\n...\nWeek 9\n..."
                  : "Paste today's workout (reps, miles, pace cues)")
            }
            className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading || !sourceText.trim()}
              onClick={() => void runPreview()}
              className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {loading ? "Parsing…" : "Preview"}
            </button>
            {preview ? (
              <button
                type="button"
                disabled={committing}
                onClick={() => void runCommit()}
                className="rounded-lg border border-sky-600 bg-white px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50"
              >
                {committing ? "Saving…" : "Confirm & apply"}
              </button>
            ) : null}
          </div>
          {summary ? (
            <p className="rounded-lg border border-sky-100 bg-white px-3 py-2 text-gray-800">
              {summary}
            </p>
          ) : null}
          {error ? <p className="text-red-700">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
