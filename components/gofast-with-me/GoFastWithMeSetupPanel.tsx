'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, CheckCircle2, ExternalLink, Route } from 'lucide-react';
import api from '@/lib/api';
import type { ShareHubPlanStatus } from '@/lib/profile/share-creator-card-logic';

type PlanVisibility = 'DRAFT' | 'PUBLIC' | 'UNLISTED' | 'ARCHIVED';

function formatPlanDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isPlanLive(plan: ShareHubPlanStatus): boolean {
  if (!plan.isPublished) return false;
  const v = plan.publicVisibility;
  return v === 'PUBLIC' || v === 'UNLISTED';
}

export default function GoFastWithMeSetupPanel({ embedded = false }: { embedded?: boolean }) {
  const [status, setStatus] = useState<{ plan: ShareHubPlanStatus } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/me/share-hub-status');
      if (res.data?.status) {
        const next = res.data.status as { plan: ShareHubPlanStatus };
        setStatus(next);
        setDescription(next.plan.publicDescription ?? '');
      }
    } catch {
      setError('Could not load your active plan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const flashSuccess = (message: string) => {
    setSaveSuccess(message);
    setTimeout(() => setSaveSuccess(null), 2500);
  };

  const plan = status?.plan;
  const canPublish = !!plan?.hasActivePlan && !!plan?.hasSchedule;
  const live = plan ? isPlanLive(plan) : false;

  const handleMakePublic = async () => {
    if (!plan?.planId || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.post('/public-training-plans', {
        sourceTrainingPlanId: plan.planId,
        description: description.trim() || null,
        visibility: 'PUBLIC' satisfies PlanVisibility,
      });
      flashSuccess('Your plan is now public for followers.');
      await loadStatus();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not make plan public.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDescription = async () => {
    if (!plan?.publicSlug || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/public-training-plans/${encodeURIComponent(plan.publicSlug)}`, {
        description: description.trim() || null,
        visibility: plan.publicVisibility ?? 'PUBLIC',
      });
      flashSuccess('Description updated.');
      await loadStatus();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not update description.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublish = async () => {
    if (!plan?.publicSlug || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/public-training-plans/${encodeURIComponent(plan.publicSlug)}`, {
        description: description.trim() || null,
        visibility: 'DRAFT' satisfies PlanVisibility,
      });
      flashSuccess('Plan is no longer public.');
      await loadStatus();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not unpublish plan.');
    } finally {
      setSaving(false);
    }
  };

  const raceLine = [plan?.raceName, plan?.raceDistanceLabel].filter(Boolean).join(' · ');
  const durationLine =
    plan?.totalWeeks != null
      ? `${plan.totalWeeks} week${plan.totalWeeks === 1 ? '' : 's'}`
      : null;

  const descriptionDirty =
    live && description.trim() !== (plan?.publicDescription ?? '').trim();

  return (
    <section id={embedded ? undefined : 'workouts'} className={embedded ? 'space-y-6' : 'space-y-6'}>
      {!embedded ? (
        <div>
          <h2 className="text-lg font-bold text-gray-900">Training plan</h2>
          <p className="text-sm text-gray-600 mt-1">
            Your active training plan and public sharing settings.
          </p>
        </div>
      ) : null}

      {loading ? (
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

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-violet-100 p-2 text-violet-700">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-gray-900">{plan.planName ?? 'Active plan'}</h3>
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <MetaRow label="Plan ID" value={plan.planId} mono />
                  <MetaRow
                    label="Schedule"
                    value={plan.hasSchedule ? 'Generated' : 'Not generated yet'}
                  />
                  <MetaRow label="Start date" value={formatPlanDate(plan.startDate)} />
                  <MetaRow label="Duration" value={durationLine} />
                  <MetaRow label="Race" value={raceLine || 'No race linked'} />
                  <MetaRow label="Goal time" value={plan.goalRaceTime} />
                </dl>
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
                  <h3 className="text-sm font-semibold text-gray-900">Public sharing</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    {live
                      ? 'Your training week is visible to followers on your page and in your community.'
                      : 'Make your plan public so followers can see your training week.'}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    live ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'
                  }`}
                >
                  {live ? 'Public' : 'Not public'}
                </span>
              </div>

              {live ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                  Live for followers
                  {plan.publicPublishedAt ? (
                    <span className="text-emerald-700/80 text-xs">
                      · since {formatPlanDate(plan.publicPublishedAt)}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {plan.publicSlug && live ? (
                <div className="rounded-lg border border-violet-100 bg-white px-3 py-2 text-xs">
                  <p className="text-gray-500">Plan link</p>
                  <p className="mt-0.5 font-mono text-[11px] text-gray-900 break-all">{plan.publicSlug}</p>
                </div>
              ) : null}

              <div className="space-y-2">
                <label htmlFor="public-description" className="text-xs font-semibold text-gray-700">
                  Description for followers
                  {!live ? (
                    <span className="font-normal text-gray-500"> (optional)</span>
                  ) : null}
                </label>
                <textarea
                  id="public-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={live ? 3 : 2}
                  maxLength={4000}
                  className="w-full rounded-lg border border-gray-300 p-3 text-sm bg-white"
                  placeholder="Tell followers what this plan is about…"
                />
              </div>

              {!live ? (
                <>
                  <p className="text-xs text-gray-600">
                    Followers will see your training week on your page and in your community.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleMakePublic()}
                    disabled={saving}
                    className="w-full sm:w-auto rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {saving ? 'Publishing…' : 'Make this public'}
                  </button>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {descriptionDirty ? (
                    <button
                      type="button"
                      onClick={() => void handleUpdateDescription()}
                      disabled={saving}
                      className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save description'}
                    </button>
                  ) : null}
                  {plan.publicSlug ? (
                    <Link
                      href={`/plans/${encodeURIComponent(plan.publicSlug)}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-50"
                    >
                      Preview plan
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleUnpublish()}
                    disabled={saving}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {saving ? 'Updating…' : 'Unpublish'}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}

      {!embedded ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-2">
            <Route className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">My Runs (v2)</h3>
              <p className="text-xs text-gray-600 mt-1">
                Manual hosted runs are coming later — sharing your goal and plan is the primary GoFast With
                Me loop.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className={`mt-0.5 font-medium text-gray-900 ${mono ? 'font-mono text-[11px] break-all' : ''}`}>
        {value || '—'}
      </dd>
    </div>
  );
}
