'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Calendar, CheckCircle2, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import type { ShareHubPlanStatus } from '@/lib/profile/share-creator-card-logic';

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

function planDisplayTitle(plan: ShareHubPlanStatus): string {
  if (plan.raceName?.trim()) {
    return `Training plan for ${plan.raceName.trim()}`;
  }
  return plan.planName?.trim() || 'Active plan';
}

export default function GoFastWithMeSetupPanel({ embedded = false }: { embedded?: boolean }) {
  const [status, setStatus] = useState<{ plan: ShareHubPlanStatus } | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descriptionRef = useRef(description);

  descriptionRef.current = description;

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
      }
    } catch {
      if (!soft) setError('Could not load your active plan.');
    } finally {
      if (soft) setRefreshing(false);
      else setInitialLoading(false);
    }
  }, []);

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

  const persistVisibility = async (nextPublic: boolean) => {
    if (!plan?.planId || busy) return;
    setSaving(true);
    setError(null);
    try {
      if (nextPublic) {
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
      } else if (plan.publicSlug) {
        await api.patch(`/public-training-plans/${encodeURIComponent(plan.publicSlug)}`, {
          description: description.trim() || null,
          visibility: 'DRAFT' satisfies PlanVisibility,
        });
        flashSuccess('Your plan is private.');
      }
      await loadStatus(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(
        e.response?.data?.error ||
          (nextPublic ? 'Could not make plan public.' : 'Could not make plan private.')
      );
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
  ].filter(Boolean);

  return (
    <section id={embedded ? undefined : 'workouts'} className={embedded ? 'space-y-6' : 'space-y-6'}>
      {!embedded ? (
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

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-stone-100 p-2 text-stone-700">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-gray-900">{planDisplayTitle(plan)}</h3>
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

          {canPublish ? (
            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Sharing</h3>
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

      {!embedded ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">My Runs (v2)</h3>
            <p className="text-xs text-gray-600 mt-1">
              Manual hosted runs are coming later — sharing your goal and plan is the primary GoFast With
              Me loop.
            </p>
          </div>
        </div>
      ) : null}
    </section>
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
