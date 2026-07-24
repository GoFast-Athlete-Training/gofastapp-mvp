'use client';

import { CheckCircle2, Globe } from 'lucide-react';
import { STUDIO_CENTRAL_LABEL, type StudioSection } from '@/components/gofast-with-me/studio-sections';

export type DashboardMetrics = {
  followerCount: number | null;
  landingComplete: boolean;
  publishReady: boolean;
  planPublished: boolean | null;
  planName: string | null;
  liveUrl: string;
};

type Props = {
  metrics: DashboardMetrics;
  visitorHeadline: string;
  onOpenWorkspace: (section: StudioSection) => void;
};

export default function GoFastWithMeDashboardHome({
  metrics,
  visitorHeadline,
  onOpenWorkspace,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{STUDIO_CENTRAL_LABEL}</h2>
        <p className="text-sm text-gray-600 mt-1">
          Health metrics for your public presence — use the sidebar to open a workspace.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HealthCard
          label="Total followers"
          value={
            metrics.followerCount != null
              ? String(metrics.followerCount)
              : '—'
          }
          status={
            metrics.followerCount != null && metrics.followerCount > 0
              ? 'ok'
              : 'neutral'
          }
          hint="People GoFast with you"
        />
        <HealthCard
          label="Landing page"
          value={metrics.landingComplete ? 'Complete' : 'Incomplete'}
          status={metrics.landingComplete ? 'ok' : 'warn'}
          hint={
            metrics.landingComplete
              ? 'Public door is ready'
              : 'Finish welcome, bio, photo'
          }
        />
        <HealthCard
          label="Public page"
          value={metrics.publishReady ? 'Live draft' : 'Not started'}
          status={metrics.publishReady ? 'ok' : 'neutral'}
          hint="Runner landing surface"
        />
        <HealthCard
          label="Training plan"
          value={
            metrics.planPublished === true
              ? 'Published'
              : metrics.planPublished === false
                ? 'Not published'
                : '—'
          }
          status={metrics.planPublished ? 'ok' : 'neutral'}
          hint={metrics.planName ?? 'Active plan sharing'}
        />
      </div>

      {!metrics.landingComplete ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-3">
          <span>
            <strong>Health check:</strong> Complete My Page first — welcome, bio, what visitors
            will see, and a run image.
          </span>
          <button
            type="button"
            onClick={() => onOpenWorkspace('page')}
            className="shrink-0 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
          >
            Open My Page
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Globe className="h-4 w-4 text-orange-600 shrink-0" />
          <span>
            Public headline: <strong>{visitorHeadline}</strong>
          </span>
        </div>
        <a
          href={metrics.liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-orange-600 hover:text-orange-700"
        >
          View live page →
        </a>
      </div>
    </div>
  );
}

function HealthCard({
  label,
  value,
  status,
  hint,
}: {
  label: string;
  value: string;
  status: 'ok' | 'warn' | 'neutral';
  hint: string;
}) {
  const statusStyles = {
    ok: 'border-emerald-200 bg-emerald-50/50',
    warn: 'border-amber-200 bg-amber-50/50',
    neutral: 'border-gray-200 bg-white',
  };

  return (
    <div className={`rounded-xl border p-4 ${statusStyles[status]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        {status === 'ok' ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
        ) : null}
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
      <p className="mt-1 text-xs text-gray-600">{hint}</p>
    </div>
  );
}
