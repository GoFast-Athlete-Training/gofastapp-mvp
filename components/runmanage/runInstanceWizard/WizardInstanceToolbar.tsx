"use client";

import { ExternalLink, Eye, Loader2, Send } from "lucide-react";
import SaveStatusPill, {
  type AutoSaveStatus,
} from "@/components/runclub/edit/SaveStatusPill";
import {
  instanceStaffState,
  instanceStaffStateBadgeClasses,
  instanceStaffStateLabel,
} from "@/lib/runClubBoardHelpers";
import type { RunInstanceSummary } from "@/lib/runInstanceSummary";

type Props = {
  autoSaveStatus: AutoSaveStatus;
  run: Pick<RunInstanceSummary, "published" | "workflowStatus"> | null;
  isFounder?: boolean;
  onSubmitForReview?: () => void;
  submitting?: boolean;
  onTogglePublished?: () => void;
  togglingPublished?: boolean;
  onSaveAndPreview: () => void;
  saving?: boolean;
  saveLabel?: string;
  previewPublicUrl?: string | null;
};

function lifecycleFromRun(
  run: Pick<RunInstanceSummary, "published" | "workflowStatus"> | null
): "no_built" | "built" | "submitted" | "live" {
  if (!run) return "no_built";
  if (run.published) return "live";
  if (run.workflowStatus === "SUBMITTED") return "submitted";
  return "built";
}

export default function WizardInstanceToolbar({
  autoSaveStatus,
  run,
  isFounder = false,
  onSubmitForReview,
  submitting = false,
  onTogglePublished,
  togglingPublished = false,
  onSaveAndPreview,
  saving = false,
  saveLabel = "Preview public page",
  previewPublicUrl,
}: Props) {
  const lifecycle = lifecycleFromRun(run);
  const canSubmit = !isFounder && lifecycle === "built" && onSubmitForReview;
  const canPublish = isFounder && lifecycle !== "live" && onTogglePublished;

  return (
    <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
      <p className="text-[10px] text-gray-500">
        Gray = not started · Yellow = in progress · Green = done
      </p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Instance
        </span>
        <SaveStatusPill status={autoSaveStatus} />
      </div>

      {run ? (
        <span
          className={`inline-flex w-full justify-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${instanceStaffStateBadgeClasses(lifecycle)}`}
        >
          {instanceStaffStateLabel(lifecycle)}
        </span>
      ) : null}

      {canSubmit ? (
        <button
          type="button"
          disabled={submitting}
          onClick={onSubmitForReview}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Submit for review
        </button>
      ) : null}

      {canPublish ? (
        <button
          type="button"
          disabled={togglingPublished}
          onClick={onTogglePublished}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {togglingPublished ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
          Publish live
        </button>
      ) : null}

      {previewPublicUrl ? (
        <a
          href={previewPublicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          <ExternalLink className="h-4 w-4" />
          Preview public page
        </a>
      ) : (
        <button
          type="button"
          onClick={onSaveAndPreview}
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          {saveLabel}
        </button>
      )}

      <p className="text-[11px] leading-snug text-gray-500">
        Edits auto-save once built. Submit sends to founder review without going live.
      </p>
    </div>
  );
}

// Re-export for type compatibility — instanceStaffState used internally via lifecycleFromRun
export { instanceStaffState };
