'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Calendar, CheckCircle2, ExternalLink } from 'lucide-react';
import api from '@/lib/api';
import type { ShareHubPlanStatus } from '@/lib/profile/share-creator-card-logic';

type PlanVisibility = 'DRAFT' | 'PUBLIC' | 'ARCHIVED';

const DESCRIPTION_PROMPTS = [
  'What race are you training for?',
  "What's your goal for this block?",
  'What should followers know about your approach?',
];

function formatPlanDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isPlanPublic(plan: ShareHubPlanStatus): boolean {
  return plan.isPublished && plan.publicVisibility === 'PUBLIC';
}

export default function GoFastWithMeSetupPanel({ embedded = false }: { embedded?: boolean }) {
  const [status, setStatus] = useState<{ plan: ShareHubPlanStatus } | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
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

  const persistVisibility = async (nextPublic: boolean) => {
    if (!plan?.planId || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (nextPublic) {
        await api.post('/public-training-plans', {
          sourceTrainingPlanId: plan.planId,
          description: description.trim() || null,
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
      setSaving(true);
      setError(null);
      try {
        await api.patch(`/public-training-plans/${encodeURIComponent(plan.publicSlug)}`, {
          description: value.trim() || null,
          visibility: 'PUBLIC' satisfies PlanVisibility,
        });
      } catch (err: unknown) {
        const e = err as { response?: { data?: { error?: string } } };
        setError(e.response?.data?.error || 'Could not save description.');
      } finally {
        setSaving(false);
      }
    },
    [plan, saving]
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
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <p className="text-sm text-gray-700">No active training plan yet.</p>
          <Link
            href="/training-setup"
            className="inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
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

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-violet-100 p-2 text-violet-700">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-gray-900">{plan.planName ?? 'Active plan'}</h3>
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
                className="inline-flex rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100"
              >
                Finish generating schedule
              </Link>
            ) : null}
          </div>

          {canPublish ? (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Sharing</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {isPublic
                      ? 'Followers see your training week on your page and in your community.'
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
                disabled={saving}
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

                  {plan.publicSlug ? (
                    <div className="rounded-lg border border-violet-100 bg-white px-3 py-2 text-xs">
                      <p className="text-gray-500">Plan link</p>
                      <p className="mt-0.5 font-mono text-[11px] text-gray-900 break-all">
                        {plan.publicSlug}
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label htmlFor="public-description" className="text-xs font-semibold text-gray-700">
                      Description for followers
                    </label>
                    <p className="text-xs text-gray-500">
                      A short blurb on your public plan page — race, goal, or what you&apos;re chasing.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {DESCRIPTION_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => setDescription(prompt)}
                          className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-[11px] font-medium text-violet-800 hover:bg-violet-50"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                    <textarea
                      id="public-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      maxLength={4000}
                      className="w-full rounded-lg border border-gray-300 p-3 text-sm bg-white"
                      placeholder="Tell followers what this plan is about…"
                    />
                    {saving ? (
                      <p className="text-[11px] text-gray-500">Saving…</p>
                    ) : null}
                  </div>

                  {plan.publicSlug ? (
                    <Link
                      href={`/plans/${encodeURIComponent(plan.publicSlug)}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-50"
                    >
                      Preview plan
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
      className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5"
      role="group"
      aria-label="Plan visibility"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
          !isPublic
            ? 'bg-gray-900 text-white shadow-sm'
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
            ? 'bg-violet-600 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        aria-pressed={isPublic}
      >
        Public
      </button>
    </div>
  );
}
