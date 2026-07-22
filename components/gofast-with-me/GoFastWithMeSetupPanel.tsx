'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, ExternalLink, Route } from 'lucide-react';
import api from '@/lib/api';
import type { ShareHubStatus } from '@/lib/profile/share-creator-card-logic';

type PlanVisibility = 'DRAFT' | 'PUBLIC' | 'UNLISTED' | 'ARCHIVED';

export default function GoFastWithMeSetupPanel() {
  const [status, setStatus] = useState<ShareHubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<PlanVisibility>('PUBLIC');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/me/share-hub-status');
      if (res.data?.status) {
        const next = res.data.status as ShareHubStatus;
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

  const raceLine = [plan?.raceName, plan?.raceDistanceLabel].filter(Boolean).join(' · ');
  const goalLine = plan?.goalRaceTime ? `Goal: ${plan.goalRaceTime}` : null;

  return (
    <section id="configure" className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">GoFastWithMe Add My Plan</h2>
        <p className="text-sm text-gray-600 mt-1">
          Your active training plan hydrates from your Athlete ID. Publish it so followers can preview
          your build on your public page and container.
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
                  <MetaRow label="Race" value={raceLine || 'No race linked'} />
                  <MetaRow label="Goal" value={goalLine || '—'} />
                  <MetaRow
                    label="Public slug"
                    value={plan.publicSlug ?? 'Not published yet'}
                    mono={!!plan.publicSlug}
                  />
                  <MetaRow
                    label="Visibility"
                    value={plan.publicVisibility ?? 'DRAFT'}
                  />
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
              <h3 className="text-sm font-semibold text-gray-900">Public sharing</h3>
              <p className="text-xs text-gray-600">
                Control how your active plan appears on your public landing and member container.
              </p>

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
                  <option value="PUBLIC">Public — discoverable</option>
                  <option value="UNLISTED">Unlisted — link only</option>
                  <option value="DRAFT">Draft — hidden</option>
                </select>
              </div>

              <div className="flex flex-wrap gap-2">
                {plan.isPublished ? (
                  <button
                    type="button"
                    onClick={() => void handleUpdatePublished()}
                    disabled={saving}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save sharing settings'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handlePublish()}
                    disabled={saving}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {saving ? 'Publishing…' : 'Publish plan'}
                  </button>
                )}
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
