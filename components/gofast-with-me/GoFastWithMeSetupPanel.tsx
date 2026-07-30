'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Calendar, CheckCircle2, ExternalLink, Loader2, Pencil, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import type { ShareHubPlanStatus } from '@/lib/profile/share-creator-card-logic';
import {
  normalizePlanTitleInput,
  planTitleFallback,
} from '@/lib/gofast-with-me/plan-title-utils';

type PlanVisibility = 'DRAFT' | 'PUBLIC' | 'ARCHIVED';

function formatPlanDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isPlanPublic(plan: ShareHubPlanStatus): boolean {
  return plan.isPublished && plan.publicVisibility === 'PUBLIC';
}

export default function GoFastWithMeSetupPanel({
  embedded = false,
  sharingOnly = false,
  firstName = null,
}: {
  embedded?: boolean;
  sharingOnly?: boolean;
  firstName?: string | null;
}) {
  const [status, setStatus] = useState<{ plan: ShareHubPlanStatus } | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [planTitle, setPlanTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [publishReviewOpen, setPublishReviewOpen] = useState(false);
  const [reviewTitle, setReviewTitle] = useState('');
  const [editingReviewTitle, setEditingReviewTitle] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descriptionRef = useRef(description);
  const planTitleRef = useRef(planTitle);

  descriptionRef.current = description;
  planTitleRef.current = planTitle;

  const loadStatus = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else {
      setInitialLoading(true);
      setError(null);
    }
    try {
      const res = await api.get('/me/share-hub-status');
      if (res.data?.status) {
        const next = res.data.status as { plan: ShareHubPlanStatus };
        setStatus(next);
        setDescription(next.plan.publicDescription ?? '');
        setPlanTitle(next.plan.planName?.trim() || planTitleFallback(firstName));
      }
    } catch {
      if (!soft) setError('Could not load your active plan.');
    } finally {
      if (soft) setRefreshing(false);
      else setInitialLoading(false);
    }
  }, [firstName]);

  useEffect(() => {
    void loadStatus(false);
  }, [loadStatus]);

  const flashSuccess = (message: string) => {
    setSaveSuccess(message);
    setTimeout(() => setSaveSuccess(null), 2500);
  };

  const plan = status?.plan;
  const canPublish = !!plan?.hasActivePlan && !!plan?.hasSchedule;
  const isPublic = plan ? isPlanPublic(plan) : false;
  const busy = saving || drafting;
  const hasBeenPublishedBefore = Boolean(plan?.publicSlug);

  const draftDescription = useCallback(async (): Promise<string | null> => {
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
  }, [plan?.planId]);

  const savePlanTitleNow = useCallback(
    async (value: string): Promise<boolean> => {
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
    },
    [plan, firstName]
  );

  const saveDescriptionNow = useCallback(
    async (value: string) => {
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
    },
    [plan]
  );

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
      await loadStatus(true);
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
        await loadStatus(true);
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
      await loadStatus(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not make plan private.');
    } finally {
      setSaving(false);
    }
  };

  const persistDescription = useCallback(
    async (value: string) => {
      if (!plan?.publicSlug || !isPlanPublic(plan) || saving) return;
      await saveDescriptionNow(value);
    },
    [plan, saveDescriptionNow, saving]
  );

  useEffect(() => {
    if (!isPublic || !plan?.publicSlug) return;
    const saved = (plan.publicDescription ?? '').trim();
    if (description.trim() === saved) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void persistDescription(descriptionRef.current);
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [description, isPublic, plan?.publicDescription, plan?.publicSlug, persistDescription]);

  useEffect(() => {
    if (!isPublic || !plan?.planId || publishReviewOpen) return;
    const saved = (plan.planName ?? '').trim();
    if (planTitle.trim() === saved) return;

    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    titleDebounceRef.current = setTimeout(() => {
      titleDebounceRef.current = null;
      void savePlanTitleNow(planTitleRef.current);
    }, 800);

    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    };
  }, [
    planTitle,
    isPublic,
    plan?.planId,
    plan?.planName,
    publishReviewOpen,
    savePlanTitleNow,
  ]);

  const handleRegenerate = async () => {
    if (busy || !plan?.planId) return;
    const drafted = await draftDescription();
    if (!drafted?.trim()) return;
    const ok = await saveDescriptionNow(drafted);
    if (ok) {
      flashSuccess('Draft refreshed — edit anything you want changed.');
      await loadStatus(true);
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

  const raceLine = [plan?.raceName, plan?.raceDistanceLabel].filter(Boolean).join(' · ');
  const durationLine =
    plan?.totalWeeks != null
      ? `${plan.totalWeeks} week${plan.totalWeeks === 1 ? '' : 's'}`
      : null;

  const summaryParts = [
    durationLine,
    plan?.startDate ? `starts ${formatPlanDate(plan.startDate)}` : null,
    raceLine || null,
    plan?.goalRaceTime ? `goal ${plan.goalRaceTime}` : null,
  ].filter((part): part is string => Boolean(part));

  const showStandaloneHeader = !embedded && !sharingOnly;
  const showPlanSummary = !sharingOnly;

  return (
    <section id={embedded ? undefined : 'workouts-sharing'} className="space-y-6">
      {showStandaloneHeader ? (
        <div>
          <h2 className="text-lg font-bold text-gray-900">Training plan</h2>
          <p className="text-sm text-gray-600 mt-1">
            Your active training plan and sharing settings.
          </p>
        </div>
      ) : null}

      {initialLoading ? (
        <p className="text-sm text-gray-500">Loading active plan…</p>
      ) : error && !plan?.hasActivePlan ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !plan?.hasActivePlan ? (
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
          <p className="text-sm text-gray-700">No active training plan yet.</p>
          <Link
            href="/training-setup"
            className="inline-flex rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Build a plan
          </Link>
        </div>
      ) : (
        <>
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

          {showPlanSummary ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-stone-100 p-2 text-stone-700">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">{planTitle}</h3>
                  {summaryParts.length > 0 ? (
                    <p className="mt-1.5 text-sm text-gray-600">{summaryParts.join(' · ')}</p>
                  ) : null}
                  {!plan.hasSchedule ? (
                    <p className="mt-1 text-xs text-amber-700">Schedule not generated yet</p>
                  ) : null}
                </div>
              </div>

              {!plan.hasSchedule ? (
                <Link
                  href={plan.planId ? `/training-setup/${plan.planId}` : '/training-setup'}
                  className="inline-flex rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 hover:bg-sky-100"
                >
                  Finish generating schedule
                </Link>
              ) : null}
            </div>
          ) : null}

          {canPublish ? (
            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Plan sharing</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {isPublic
                      ? 'Followers see your training week on your hub and in your community.'
                      : 'Your plan is private — only you can see it.'}
                  </p>
                </div>
                {refreshing ? (
                  <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                    Updating…
                  </span>
                ) : null}
              </div>

              <VisibilityToggle
                isPublic={isPublic}
                disabled={busy}
                onChange={(nextPublic) => void persistVisibility(nextPublic)}
              />

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

                  <div className="space-y-2">
                    <label htmlFor="plan-title" className="text-xs font-semibold text-gray-700">
                      Plan title
                    </label>
                    <p className="text-xs text-gray-600">
                      Shown on your public plan page and hub. This is the same name as in My Training.
                    </p>
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
                    <p className="text-xs text-gray-600 leading-relaxed">
                      This short blurb appears under your plan title on your public plan page. Race,
                      distance, weeks, and goal already show from your plan — use this to add voice or
                      context in your own words.
                    </p>
                    <textarea
                      id="public-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      maxLength={4000}
                      disabled={drafting}
                      className="w-full rounded-lg border border-stone-300 p-3 text-sm bg-white disabled:opacity-60"
                      placeholder="We draft this from your plan when you go public — edit anything you want changed."
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
                      {saving ? (
                        <p className="text-[11px] text-gray-500">Saving…</p>
                      ) : drafting ? (
                        <p className="text-[11px] text-gray-500">Drafting from your plan…</p>
                      ) : null}
                    </div>
                  </div>

                  <PublicDisclosure summaryParts={summaryParts} />

                  {plan.publicSlug ? (
                    <Link
                      href={`/plans/${encodeURIComponent(plan.publicSlug)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700 hover:underline"
                    >
                      Preview plan page
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function PublicDisclosure({ summaryParts }: { summaryParts: string[] }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white/80 px-3 py-2.5 text-xs text-gray-600 space-y-1">
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
