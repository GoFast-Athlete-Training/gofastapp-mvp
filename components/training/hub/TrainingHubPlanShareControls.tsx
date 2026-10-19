"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Pencil } from "lucide-react";
import api from "@/lib/api";
import type { ShareHubPlanStatus } from "@/lib/profile/share-creator-card-logic";
import {
  buildPlanSummaryParts,
  canPublishPlan,
  formatPlanDate,
  hubPlanStripPath,
  isPlanPublic,
  publicPlanPagePath,
} from "@/lib/gofast-with-me/plan-sharing-utils";
import {
  normalizePlanTitleInput,
  planTitleFallback,
} from "@/lib/gofast-with-me/plan-title-utils";
import { PlanVisibilityToggle } from "@/components/training/hub/PlanVisibilityToggle";

type PlanVisibility = "DRAFT" | "PUBLIC" | "ARCHIVED";

type Props = {
  plan: ShareHubPlanStatus;
  landingSlug: string;
  firstName?: string | null;
  onRefresh: () => Promise<void>;
  /** When true, only render the details form (inside Edit My Plan). */
  detailsOnly?: boolean;
  /** When true, only render visibility toggle (on meta card). */
  visibilityOnly?: boolean;
};

export function TrainingHubPlanShareControls({
  plan,
  landingSlug,
  firstName = null,
  onRefresh,
  detailsOnly = false,
  visibilityOnly = false,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [planTitle, setPlanTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [publishReviewOpen, setPublishReviewOpen] = useState(false);
  const [reviewTitle, setReviewTitle] = useState("");
  const [editingReviewTitle, setEditingReviewTitle] = useState(false);

  useEffect(() => {
    setDescription(plan.publicDescription ?? "");
    setPlanTitle(plan.planName?.trim() || planTitleFallback(firstName));
  }, [plan.planId, plan.publicDescription, plan.planName, firstName]);

  const isPublic = isPlanPublic(plan);
  const busy = saving;
  const publishable = canPublishPlan(plan);
  const hasBeenPublishedBefore = Boolean(plan.publicSlug);
  const summaryParts = buildPlanSummaryParts(plan);

  const titleDirty = planTitle.trim() !== (plan.planName ?? "").trim();
  const descriptionDirty = description.trim() !== (plan.publicDescription ?? "").trim();
  const hasUnsavedEdits = titleDirty || (isPublic && descriptionDirty);

  const flashSuccess = (message: string) => {
    setSaveSuccess(message);
    setTimeout(() => setSaveSuccess(null), 2500);
  };

  const savePlanTitleNow = async (value: string): Promise<boolean> => {
    if (!plan.planId) return false;
    const normalized = normalizePlanTitleInput(value, firstName);
    setSaving(true);
    setError(null);
    try {
      if (isPlanPublic(plan) && plan.publicSlug) {
        await api.patch(`/public-training-plans/${encodeURIComponent(plan.publicSlug)}`, {
          name: normalized,
          visibility: "PUBLIC" satisfies PlanVisibility,
        });
      } else {
        await api.patch(`/training-plan/${encodeURIComponent(plan.planId)}`, {
          name: normalized,
        });
      }
      setPlanTitle(normalized);
      return true;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || "Could not save plan title.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveDescriptionNow = async (value: string): Promise<boolean> => {
    if (!plan.publicSlug || !isPlanPublic(plan)) return false;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/public-training-plans/${encodeURIComponent(plan.publicSlug)}`, {
        description: value.trim() || null,
        visibility: "PUBLIC" satisfies PlanVisibility,
      });
      return true;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || "Could not save description.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const publishPlan = async (title: string, intro: string) => {
    if (!plan.planId || busy) return;
    setSaving(true);
    setError(null);
    try {
      const normalizedTitle = normalizePlanTitleInput(title, firstName);
      if (normalizedTitle !== (plan.planName ?? "").trim()) {
        await api.patch(`/training-plan/${encodeURIComponent(plan.planId)}`, {
          name: normalizedTitle,
        });
        setPlanTitle(normalizedTitle);
      }
      await api.post("/public-training-plans", {
        sourceTrainingPlanId: plan.planId,
        description: intro.trim() || null,
        visibility: "PUBLIC" satisfies PlanVisibility,
      });
      setPublishReviewOpen(false);
      flashSuccess("Your plan is public.");
      await onRefresh();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || "Could not make plan public.");
    } finally {
      setSaving(false);
    }
  };

  const persistVisibility = async (nextPublic: boolean) => {
    if (!plan.planId || busy) return;
    if (nextPublic) {
      if (!hasBeenPublishedBefore) {
        if (visibilityOnly) {
          void publishPlan(planTitle, description.trim());
          return;
        }
        setReviewTitle(planTitle);
        setEditingReviewTitle(false);
        setPublishReviewOpen(true);
        return;
      }
      setSaving(true);
      setError(null);
      try {
        await api.post("/public-training-plans", {
          sourceTrainingPlanId: plan.planId,
          description: description.trim() || null,
          visibility: "PUBLIC" satisfies PlanVisibility,
        });
        flashSuccess("Your plan is public.");
        await onRefresh();
      } catch (err: unknown) {
        const e = err as { response?: { data?: { error?: string } } };
        setError(e.response?.data?.error || "Could not make plan public.");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!plan.publicSlug) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/public-training-plans/${encodeURIComponent(plan.publicSlug)}`, {
        description: description.trim() || null,
        visibility: "DRAFT" satisfies PlanVisibility,
      });
      setPublishReviewOpen(false);
      flashSuccess("Your plan is private.");
      await onRefresh();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || "Could not make plan private.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdits = async () => {
    if (busy || !hasUnsavedEdits) return;
    let ok = true;
    if (titleDirty) {
      ok = await savePlanTitleNow(planTitle);
    }
    if (ok && isPublic && descriptionDirty) {
      ok = await saveDescriptionNow(description);
    }
    if (ok) {
      flashSuccess("Plan details saved.");
      await onRefresh();
    }
  };

  if (visibilityOnly) {
    if (!publishable) return null;
    return (
      <div className="flex flex-col items-end gap-1">
        <PlanVisibilityToggle
          isPublic={isPublic}
          disabled={busy}
          onChange={(next) => void persistVisibility(next)}
        />
        {saveSuccess ? (
          <p className="max-w-[14rem] text-right text-xs text-emerald-800">{saveSuccess}</p>
        ) : null}
        {error ? (
          <p className="max-w-[14rem] text-right text-xs text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const detailsForm = (
    <div className="space-y-4">
      {saveSuccess ? (
        <p className="text-sm text-emerald-800">{saveSuccess}</p>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="space-y-2">
        <label htmlFor="hub-plan-title" className="text-xs font-semibold text-gray-700">
          Plan title
        </label>
        <input
          id="hub-plan-title"
          type="text"
          value={planTitle}
          onChange={(e) => setPlanTitle(e.target.value)}
          maxLength={120}
          disabled={busy}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white disabled:opacity-60"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="hub-plan-description" className="text-xs font-semibold text-gray-700">
          Describe your plan
        </label>
        <p className="text-xs text-gray-600">
          Write this for yourself to stay aligned on your goals. If you publish, people in a similar
          training cycle can see what you&apos;re building toward.
        </p>
        <textarea
          id="hub-plan-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={4000}
          className="w-full rounded-lg border border-stone-300 p-3 text-sm bg-white disabled:opacity-60"
          placeholder="Optional — e.g. building toward a sub-3 marathon on 45 mpw."
        />
        {hasUnsavedEdits ? (
          <button
            type="button"
            onClick={() => void handleSaveEdits()}
            disabled={busy}
            className="inline-flex rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-900 disabled:opacity-50"
          >
            Save
          </button>
        ) : null}
      </div>
    </div>
  );

  if (detailsOnly) {
    return (
      <>
        {detailsForm}
        {publishReviewOpen && !isPublic ? (
          <PublishReviewPanel
            reviewTitle={reviewTitle}
            editingTitle={editingReviewTitle}
            description={description}
            summaryParts={summaryParts}
            busy={busy}
            onReviewTitleChange={setReviewTitle}
            onToggleEditTitle={() => setEditingReviewTitle((v) => !v)}
            onDescriptionChange={setDescription}
            onCancel={() => setPublishReviewOpen(false)}
            onConfirm={() => void publishPlan(reviewTitle, description.trim())}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="space-y-3">
      {publishable ? (
        <PlanVisibilityToggle
          isPublic={isPublic}
          disabled={busy}
          onChange={(next) => void persistVisibility(next)}
        />
      ) : null}
      {detailsForm}
      {isPublic && landingSlug.trim() ? (
        <Link
          href={hubPlanStripPath(landingSlug)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:underline"
        >
          See how your plan looks to others
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      ) : null}
      {isPublic && plan.publicSlug ? (
        <Link
          href={publicPlanPagePath(plan.publicSlug)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:underline"
        >
          Preview full plan page
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      ) : null}
      {publishReviewOpen && !isPublic ? (
        <PublishReviewPanel
          reviewTitle={reviewTitle}
          editingTitle={editingReviewTitle}
          description={description}
          summaryParts={summaryParts}
          busy={busy}
          onReviewTitleChange={setReviewTitle}
          onToggleEditTitle={() => setEditingReviewTitle((v) => !v)}
          onDescriptionChange={setDescription}
          onCancel={() => setPublishReviewOpen(false)}
          onConfirm={() => void publishPlan(reviewTitle, description.trim())}
        />
      ) : null}
    </div>
  );
}

function PublishReviewPanel({
  reviewTitle,
  editingTitle,
  description,
  summaryParts,
  busy,
  onReviewTitleChange,
  onToggleEditTitle,
  onDescriptionChange,
  onCancel,
  onConfirm,
}: {
  reviewTitle: string;
  editingTitle: boolean;
  description: string;
  summaryParts: string[];
  busy: boolean;
  onReviewTitleChange: (value: string) => void;
  onToggleEditTitle: () => void;
  onDescriptionChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 space-y-4 mt-3">
      <div>
        <h4 className="text-sm font-semibold text-gray-900">Review before you publish</h4>
        <p className="text-xs text-gray-600 mt-1">
          Your training week becomes visible on your hub when you publish.
        </p>
      </div>
      <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Plan title</p>
        {editingTitle ? (
          <input
            type="text"
            value={reviewTitle}
            onChange={(e) => onReviewTitleChange(e.target.value)}
            maxLength={120}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
            autoFocus
          />
        ) : (
          <p className="text-sm font-semibold text-gray-900">{reviewTitle}</p>
        )}
        <button
          type="button"
          onClick={onToggleEditTitle}
          className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
        >
          <Pencil className="h-3 w-3" aria-hidden />
          {editingTitle ? "Use this title" : "Change title"}
        </button>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-700">Describe your plan</label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={4}
          maxLength={4000}
          className="w-full rounded-lg border border-stone-300 p-3 text-sm bg-white"
          placeholder="Optional — what you're building toward."
        />
      </div>
      {summaryParts.length > 0 ? (
        <p className="text-xs text-gray-600">{summaryParts.join(" · ")}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="inline-flex rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          Publish plan
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="inline-flex rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-stone-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
