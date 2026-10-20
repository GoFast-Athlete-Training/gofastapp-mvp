"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlanIngestScope } from "@/lib/training/plan-ingest-contract";
import { usePlanIngestPreviewCommit } from "@/lib/training/use-plan-ingest-preview-commit";

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
  /** Controlled expand (e.g. hub Replace → day page). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  open: openControlled,
  onOpenChange,
}: Props) {
  const [openInternal, setOpenInternal] = useState(defaultOpen);
  const isControlled = openControlled !== undefined;
  const open = isControlled ? openControlled : openInternal;

  const setOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof next === "function" ? next(open) : next;
      if (isControlled) onOpenChange?.(resolved);
      else setOpenInternal(resolved);
    },
    [isControlled, onOpenChange, open]
  );

  useEffect(() => {
    if (!isControlled && defaultOpen) setOpenInternal(true);
  }, [defaultOpen, isControlled]);

  const [sourceText, setSourceText] = useState("");

  const { preview, error, loading, committing, runPreview, runCommit, resetPreview } =
    usePlanIngestPreviewCommit({
      planId,
      scope,
      getToken,
      dateKey,
      weekNumber,
    });

  const onPreview = useCallback(() => {
    void runPreview(sourceText);
  }, [runPreview, sourceText]);

  const onCommit = useCallback(async () => {
    const ok = await runCommit();
    if (ok) {
      setSourceText("");
      resetPreview();
      setOpen(false);
      onCommitted?.();
    }
  }, [runCommit, onCommitted, resetPreview]);

  if (scope === "week") {
    return null;
  }

  const summary =
    preview && preview.scope !== "week" ? preview.summary : null;

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
          <textarea
            value={sourceText}
            onChange={(e) => {
              setSourceText(e.target.value);
              resetPreview();
            }}
            rows={scope === "plan" ? 8 : 4}
            placeholder={
              placeholder ??
              (scope === "plan"
                ? "Week 8\nMon easy 4\n...\nWeek 9\n..."
                : "Paste today's workout (reps, miles, pace cues)")
            }
            className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading || !sourceText.trim()}
              onClick={onPreview}
              className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {loading ? "Parsing…" : "Preview"}
            </button>
            {preview ? (
              <button
                type="button"
                disabled={committing}
                onClick={() => void onCommit()}
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
