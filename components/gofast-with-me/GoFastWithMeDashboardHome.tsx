'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, DollarSign, Route, Users } from 'lucide-react';
import api from '@/lib/api';
import type { ContainerHubPayload } from '@/lib/gofast-with-me/container-hub-service';
import { STUDIO_COMMUNITY_LABEL } from '@/components/gofast-with-me/studio-sections';

export type DashboardMetrics = {
  followerCount: number | null;
  invitePath: string;
};

type Props = {
  athleteId: string;
  metrics: DashboardMetrics;
  visitorHeadline: string;
  onOpenMembers?: () => void;
  onOpenWorkouts?: () => void;
};

export default function GoFastWithMeDashboardHome({
  athleteId,
  metrics,
  visitorHeadline,
  onOpenMembers,
  onOpenWorkouts,
}: Props) {
  const [nextRun, setNextRun] = useState<ContainerHubPayload['upcomingRuns'][number] | null>(null);
  const [runsLoading, setRunsLoading] = useState(true);

  const memberCount = metrics.followerCount ?? 0;

  const loadNextRun = useCallback(async () => {
    setRunsLoading(true);
    try {
      const res = await api.get(`/athlete/${athleteId}/container/hub`);
      if (res.data?.success && res.data.hub) {
        const hub = res.data.hub as ContainerHubPayload;
        setNextRun(hub.upcomingRuns?.[0] ?? null);
      }
    } catch {
      setNextRun(null);
    } finally {
      setRunsLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    void loadNextRun();
  }, [loadNextRun]);

  return (
    <div className="space-y-4 max-w-3xl pb-8">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{STUDIO_COMMUNITY_LABEL}</h2>
        <p className="text-sm text-gray-600 mt-0.5">
          Your community home — roster and next hosted run. Share from the header.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Headline: <strong className="text-gray-700">{visitorHeadline}</strong>
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2 text-orange-700">
              <Users className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Members</p>
              <p className="text-xs text-gray-600 mt-0.5">
                {memberCount === 0
                  ? 'No followers yet.'
                  : memberCount === 1
                    ? '1 follower'
                    : `${memberCount} followers`}
              </p>
            </div>
          </div>
          {onOpenMembers ? (
            <button
              type="button"
              onClick={onOpenMembers}
              className="text-sm font-semibold text-orange-600 hover:text-orange-700"
            >
              See all →
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <DollarSign className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Sponsors</p>
              <p className="text-xs text-gray-600 mt-0.5">Brand deals and payout history.</p>
            </div>
          </div>
          <Link
            href="/gofast-with-others?view=payouts"
            className="text-sm font-semibold text-orange-600 hover:text-orange-700"
          >
            Earnings →
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-100 p-2 text-violet-700">
              <Route className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Next hosted run</p>
              <p className="text-xs text-gray-600 mt-0.5">Your next upcoming join-me GoRun.</p>
            </div>
          </div>
          {onOpenWorkouts ? (
            <button
              type="button"
              onClick={onOpenWorkouts}
              className="text-sm font-semibold text-orange-600 hover:text-orange-700"
            >
              Runs →
            </button>
          ) : null}
        </div>

        {runsLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : nextRun ? (
          <Link
            href={nextRun.gorunPath.startsWith('/') ? nextRun.gorunPath : `/${nextRun.gorunPath}`}
            className="block rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm hover:border-orange-300 transition"
          >
            <span className="font-medium text-gray-900">{nextRun.title}</span>
            <span className="flex items-center gap-1.5 text-gray-500 mt-1">
              <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {new Date(nextRun.date).toLocaleString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
              {nextRun.meetUpPoint ? ` · ${nextRun.meetUpPoint}` : ''}
            </span>
          </Link>
        ) : (
          <p className="text-sm text-gray-600 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
            No upcoming hosted run. Pick a plan day in Runs to invite followers.
          </p>
        )}
      </section>
    </div>
  );
}
