'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Loader2, Pencil, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import type { ShareHubPlanStatus } from '@/lib/profile/share-creator-card-logic';
import {
  buildPlanSummaryParts,
  canPublishPlan,
  formatPlanDate,
  hubPlanStripPath,
  isPlanPublic,
  publicPlanPagePath,
} from '@/lib/gofast-with-me/plan-sharing-utils';
import {
  normalizePlanTitleInput,
  planTitleFallback,
} from '@/lib/gofast-with-me/plan-title-utils';

type PlanVisibility = 'DRAFT' | 'PUBLIC' | 'ARCHIVED';

type Props = {
  plan: ShareHubPlanStatus | null;
  landingSlug: string;
  firstName?: string | null;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh: () => Promise<void>;
};

export default function GoFastWithMeSetupPanel({
  plan,
  landingSlug,
  firstName = null,
  loading = false,
  refreshing = false,
  onRefresh,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [planTitle, setPlanTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [publishReviewOpen, setPublishReviewOpen] = useState(false);
  const [reviewTitle, setReviewTitle] = useState('');
  const [editingReviewTitle, setEditingReviewTitle] = useState(false);

  useEffect(() => {
    if (!plan) return;
    setDescription(plan.publicDescription ?? '');
    setPlanTitle(plan.planName?.trim() || planTitleFallback(firstName));
  }, [plan?.planId, plan?.publicDescription, plan?.planName, firstName]);

  const flashSuccess = (message: string) => {
    setSaveSuccess(message);
    setTimeout(() => setSaveSuccess(null), 2500);
  };

  const publishable = canPublishPlan(plan);
  const isPublic = plan ? isPlanPublic(plan) : false;
  const busy = saving || drafting;
  const hasBeenPublishedBefore = Boolean(plan?.publicSlug);
  const summaryParts = buildPlanSummaryParts(plan);

  const titleDirty =
    !!plan && planTitle.trim() !== (plan.planName ?? '').trim();
  const descriptionDirty =
    !!plan && description.trim() !== (plan.publicDescription ?? '').trim();
  const hasUnsavedEdits = titleDirty || (isPublic && descriptionDirty);

  const draftDescription = async (): Promise<string | null> => {
    if (!plan?.planId) return null;
    setDrafting(true);
    setError(null);
    try {
      const res = await api.post('/public-training-plans/draft-description', {
        trainingPlanId: plan.planId,
      });
      if (res.data?.description && typeof res.data.description === 'string') {
        const text = res.data.description.trim();
        if (text) {
          setDescription(text);
          return text;
        }
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not draft description.');
    } finally {
      setDrafting(false);
    }
    return null;
  };

  const savePlanTitleNow = async (value: string): Promise<boolean> => {
    if (!plan?.planId) return false;
    const normalized = normalizePlanTitleInput(value, firstName);
    setSaving(true);
    setError(null);
    try {
      if (isPlanPublic(plan) && plan.publicSlug) {
        await api.patch(`/public-training-plans/${encodeURIComponent(plan.publicSlug)}`, {
          name: normalized,
          visibility: 'PUBLIC' satisfies PlanVisibility,
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
      setError(e.response?.data?.error || 'Could not save plan title.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveDescriptionNow = async (value: string): Promise<boolean> => {
    if (!plan?.publicSlug || !isPlanPublic(plan)) return false;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/public-training-plans/${encodeURIComponent(plan.publicSlug)}`, {
        description: value.trim() || null,
        visibility: 'PUBLIC' satisfies PlanVisibility,
      });
      return true;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not save description.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const publishPlan = async (title: string, intro: string) => {
    if (!plan?.planId || busy) return false;
    setSaving(true);
    setError(null);
    try {
      const normalizedTitle = normalizePlanTitleInput(title, firstName);
      if (normalizedTitle !== (plan.planName ?? '').trim()) {
        await api.patch(`/training-plan/${encodeURIComponent(plan.planId)}`, {
          name: normalizedTitle,
        });
        setPlanTitle(normalizedTitle);
      }
      await api.post('/public-training-plans', {
        sourceTrainingPlanId: plan.planId,
        description: intro.trim() || null,
        visibility: 'PUBLIC' satisfies PlanVisibility,
      });
      setPublishReviewOpen(false);
      flashSuccess('Your plan is public for followers.');
      await onRefresh();
      return true;
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not make plan public.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const persistVisibility = async (nextPublic: boolean) => {
    if (!plan?.planId || busy) return;
    if (nextPublic) {
      if (!hasBeenPublishedBefore) {
        setReviewTitle(planTitle);
        setEditingReviewTitle(false);
        setPublishReviewOpen(true);
        if (!description.trim()) {
          void draftDescription();
        }
        return;
      }
      setSaving(true);
      setError(null);
      try {
        let desc = description.trim();
        if (!desc) {
          const drafted = await draftDescription();
          desc = drafted?.trim() ?? '';
        }
        await api.post('/public-training-plans', {
          sourceTrainingPlanId: plan.planId,
          description: desc || null,
          visibility: 'PUBLIC' satisfies PlanVisibility,
        });
        flashSuccess('Your plan is public for followers.');
        await onRefresh();
      } catch (err: unknown) {
        const e = err as { response?: { data?: { error?: string } } };
        setError(e.response?.data?.error || 'Could not make plan public.');
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
        visibility: 'DRAFT' satisfies PlanVisibility,
      });
      setPublishReviewOpen(false);
      flashSuccess('Your plan is private.');
      await onRefresh();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not make plan private.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!plan || busy || !hasUnsavedEdits) return;
    let ok = true;
    if (titleDirty) {
      ok = await savePlanTitleNow(planTitle);
    }
    if (ok && isPublic && descriptionDirty) {
      ok = await saveDescriptionNow(description);
    }
    if (ok) {
      flashSuccess('Plan sharing saved.');
      await onRefresh();
    }
  };

  const handleRegenerate = async () => {
    if (busy || !plan?.planId) return;
    const drafted = await draftDescription();
    if (!drafted?.trim()) return;
    if (isPublic) {
      const ok = await saveDescriptionNow(drafted);
      if (ok) {
        flashSuccess('Draft refreshed — edit anything you want changed.');
        await onRefresh();
      }
    } else {
      flashSuccess('Draft refreshed — it will publish with your plan.');
    }
  };

  const handleConfirmPublish = async () => {
    let intro = description.trim();
    if (!intro) {
      const drafted = await draftDescription();
      intro = drafted?.trim() ?? '';
    }
    await publishPlan(reviewTitle, intro);
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Loading plan sharing…</p>;
  }

  if (!plan?.hasActivePlan) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
        <p className="text-sm text-gray-700">No active training plan yet.</p>
        <Link
          href="/training-setup"
          className="inline-flex rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
        >
          Build a plan
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {saveSuccess ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          {saveSuccess}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Plan sharing</h3>
            <p className="text-xs text-gray-600 mt-1">
              Make sure your plan title and follower intro read well before you publish.
            </p>
            {summaryParts.length > 0 ? (
              <p className="text-xs text-gray-500 mt-2">{summaryParts.join(' · ')}</p>
            ) : null}
            {!plan.hasSchedule ? (
              <p className="text-xs text-amber-700 mt-2">Schedule not generated yet.</p>
            ) : null}
          </div>
          {refreshing ? (
            <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
              Updating…
            </span>
          ) : null}
        </div>

        {!plan.hasSchedule ? (
          <Link
            href={plan.planId ? `/training-setup/${plan.planId}` : '/training-setup'}
            className="inline-flex rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100"
          >
            Finish generating schedule
          </Link>
        ) : null}

        {publishable ? (
          <>
            <VisibilityToggle
              isPublic={isPublic}
              disabled={busy}
              onChange={(nextPublic) => void persistVisibility(nextPublic)}
            />

            <div className="space-y-2">
              <label htmlFor="plan-title" className="text-xs font-semibold text-gray-700">
                Plan title
              </label>
              <input
                id="plan-title"
                type="text"
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
                maxLength={120}
                disabled={busy}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white disabled:opacity-60"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="public-description" className="text-xs font-semibold text-gray-700">
                Intro for followers
              </label>
              <textarea
                id="public-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={4000}
                disabled={drafting}
                className="w-full rounded-lg border border-stone-300 p-3 text-sm bg-white disabled:opacity-60"
                placeholder="We can draft this from your plan when you go public — edit anything you want changed."
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleRegenerate()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-stone-50 disabled:opacity-50"
                >
                  {drafting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-sky-600" aria-hidden />
                  )}
                  Regenerate draft
                </button>
                {hasUnsavedEdits ? (
                  <button
                    type="button"
                    onClick={() => void handleSaveEdits()}
                    disabled={busy}
                    className="inline-flex rounded-lg bg-stone-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-stone-900 disabled:opacity-50"
                  >
                    Save changes
                  </button>
                ) : null}
              </div>
            </div>

            {publishReviewOpen && !isPublic ? (
              <PublishReviewPanel
                reviewTitle={reviewTitle}
                editingTitle={editingReviewTitle}
                description={description}
                summaryParts={summaryParts}
                busy={busy}
                drafting={drafting}
                onReviewTitleChange={setReviewTitle}
                onToggleEditTitle={() => setEditingReviewTitle((v) => !v)}
                onDescriptionChange={setDescription}
                onCancel={() => setPublishReviewOpen(false)}
                onConfirm={() => void handleConfirmPublish()}
              />
            ) : null}

            {isPublic ? (
              <>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                  Live for followers
                  {plan.publicPublishedAt ? (
                    <span className="text-emerald-700/80 text-xs">
                      · since {formatPlanDate(plan.publicPublishedAt)}
                    </span>
                  ) : null}
                </div>

                <PublicDisclosure summaryParts={summaryParts} />

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={hubPlanStripPath(landingSlug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                  >
                    See how your plan looks to others
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  {plan.publicSlug ? (
                    <Link
                      href={publicPlanPagePath(plan.publicSlug)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:underline"
                    >
                      Preview full plan page
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function PublicDisclosure({ summaryParts }: { summaryParts: string[] }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-2.5 text-xs text-gray-600 space-y-1">
      <p className="font-semibold text-gray-800">Followers also see from your plan</p>
      <ul className="list-disc pl-4 space-y-0.5">
        {summaryParts.length > 0 ? <li>{summaryParts.join(' · ')}</li> : null}
        <li>Your full training week — workout types, dates, and planned distances</li>
        <li>Your name and public profile on the plan page</li>
      </ul>
    </div>
  );
}

function PublishReviewPanel({
  reviewTitle,
  editingTitle,
  description,
  summaryParts,
  busy,
  drafting,
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
  drafting: boolean;
  onReviewTitleChange: (value: string) => void;
  onToggleEditTitle: () => void;
  onDescriptionChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-900">Review what followers will see</h4>
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
          {editingTitle ? 'Use this title' : 'Want to change the title?'}
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-700">Intro for followers</label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={4}
          maxLength={4000}
          disabled={drafting}
          className="w-full rounded-lg border border-stone-300 p-3 text-sm bg-white disabled:opacity-60"
          placeholder="We draft this from your plan — edit anything you want changed."
        />
        {drafting ? (
          <p className="text-[11px] text-gray-500">Drafting from your plan…</p>
        ) : null}
      </div>

      <PublicDisclosure summaryParts={summaryParts} />

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

function VisibilityToggle({
  isPublic,
  disabled,
  onChange,
}: {
  isPublic: boolean;
  disabled: boolean;
  onChange: (nextPublic: boolean) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-stone-300 bg-white p-0.5"
      role="group"
      aria-label="Plan visibility"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
          !isPublic
            ? 'bg-stone-800 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        aria-pressed={!isPublic}
      >
        Private
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(true)}
        className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
          isPublic
            ? 'bg-sky-600 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        aria-pressed={isPublic}
      >
        Public
      </button>
    </div>
  );
}
