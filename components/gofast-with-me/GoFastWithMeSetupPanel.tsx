'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, ExternalLink, Route } from 'lucide-react';
import api from '@/lib/api';
import type { ShareHubPlanStatus } from '@/lib/profile/share-creator-card-logic';

type PlanVisibility = 'DRAFT' | 'PUBLIC' | 'UNLISTED' | 'ARCHIVED';

const VISIBILITY_LABELS: Record<PlanVisibility, string> = {
  DRAFT: 'Draft — hidden',
  PUBLIC: 'Public — discoverable',
  UNLISTED: 'Unlisted — link only',
  ARCHIVED: 'Archived',
};

function formatPlanDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function visibilityBadgeClass(visibility: PlanVisibility | null | undefined): string {
  switch (visibility) {
    case 'PUBLIC':
      return 'bg-emerald-100 text-emerald-800';
    case 'UNLISTED':
      return 'bg-sky-100 text-sky-800';
    case 'ARCHIVED':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-amber-100 text-amber-900';
  }
}

function primaryActionLabel(
  isPublished: boolean,
  visibility: PlanVisibility,
  saving: boolean
): string {
  if (saving) return 'Saving…';
  if (!isPublished) return 'Publish plan';
  if (visibility === 'DRAFT' || visibility === 'ARCHIVED') return 'Hide plan';
  return 'Save sharing settings';
}

export default function GoFastWithMeSetupPanel() {
  const [status, setStatus] = useState<{ plan: ShareHubPlanStatus } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<PlanVisibility>('DRAFT');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/me/share-hub-status');
      if (res.data?.status) {
        const next = res.data.status as { plan: ShareHubPlanStatus };
        setStatus(next);
        setDescription(next.plan.publicDescription ?? '');
        setVisibility(next.plan.publicVisibility ?? 'DRAFT');
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

  const plan = status?.plan;
  const canPublish = !!plan?.hasActivePlan && !!plan?.hasSchedule;
  const currentVisibility = plan?.publicVisibility ?? 'DRAFT';

  const handlePublish = async () => {
    if (!plan?.planId || saving) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      await api.post('/public-training-plans', {
        sourceTrainingPlanId: plan.planId,
        description: description.trim() || null,
        visibility,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      await loadStatus();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not publish plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePublished = async () => {
    if (!plan?.publicSlug || saving) return;
    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      await api.patch(`/public-training-plans/${encodeURIComponent(plan.publicSlug)}`, {
        description: description.trim() || null,
        visibility,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      await loadStatus();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not update plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (plan?.isPublished) {
      void handleUpdatePublished();
    } else {
      void handlePublish();
    }
  };

  const raceLine = [plan?.raceName, plan?.raceDistanceLabel].filter(Boolean).join(' · ');
  const durationLine =
    plan?.totalWeeks != null
      ? `${plan.totalWeeks} week${plan.totalWeeks === 1 ? '' : 's'}`
      : null;

  return (
    <section id="workouts" className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">My Workouts</h2>
        <p className="text-sm text-gray-600 mt-1">
          Your active training plan and public sharing settings — plan basics first, visibility below.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading active plan…</p>
      ) : error ? (
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
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Plan sharing settings saved.
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
                    Control how your active plan appears on your public landing and member container.
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${visibilityBadgeClass(currentVisibility)}`}
                >
                  {currentVisibility}
                </span>
              </div>

              {plan.publicSlug ? (
                <div className="rounded-lg border border-violet-100 bg-white px-3 py-2 text-xs">
                  <p className="text-gray-500">Public slug</p>
                  <p className="mt-0.5 font-mono text-[11px] text-gray-900 break-all">{plan.publicSlug}</p>
                  {plan.publicPublishedAt ? (
                    <p className="mt-1 text-gray-500">
                      Published {formatPlanDate(plan.publicPublishedAt)}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2">
                <label htmlFor="public-description" className="text-xs font-semibold text-gray-700">
                  Public description
                </label>
                <textarea
                  id="public-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  className="w-full rounded-lg border border-gray-300 p-3 text-sm bg-white"
                  placeholder="Tell followers what this plan is about…"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="public-visibility" className="text-xs font-semibold text-gray-700">
                  Visibility
                </label>
                <select
                  id="public-visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as PlanVisibility)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="PUBLIC">{VISIBILITY_LABELS.PUBLIC}</option>
                  <option value="UNLISTED">{VISIBILITY_LABELS.UNLISTED}</option>
                  <option value="DRAFT">{VISIBILITY_LABELS.DRAFT}</option>
                  {currentVisibility === 'ARCHIVED' ? (
                    <option value="ARCHIVED">{VISIBILITY_LABELS.ARCHIVED}</option>
                  ) : null}
                </select>
                <p className="text-[11px] text-gray-500">
                  Public plans are discoverable. Unlisted plans work via direct link only. Draft keeps
                  the plan hidden.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {primaryActionLabel(!!plan.isPublished, visibility, saving)}
                </button>
                {plan.publicSlug ? (
                  <Link
                    href={`/plans/${encodeURIComponent(plan.publicSlug)}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-50"
                  >
                    Preview plan
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-2">
          <Route className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Hosted runs (optional)</h3>
            <p className="text-xs text-gray-600 mt-1">
              Show a run you are hosting on your public page. Not required for MVP1 studio setup.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/host-a-run"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
              >
                Host a public run
              </Link>
              <Link
                href="/build-a-run"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
              >
                Build a run
              </Link>
            </div>
          </div>
        </div>
      </div>
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
