'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { AthleteCommunityPayload } from '@/lib/gofast-with-me/container-hub-service';
import GoFastWithMePlanStripSection from '@/components/gofast-with-me/GoFastWithMePlanStripSection';

type Props = {
  community: AthleteCommunityPayload;
  firstName: string;
  displayAsOwner: boolean;
  previewFollower: boolean;
};

function shouldShowPlanStrip(
  plan: AthleteCommunityPayload['publishedPlan'],
  opts: { isOwner: boolean; previewFollower: boolean }
): boolean {
  if (!plan) return false;
  if (plan.isPublic !== false) return true;
  return opts.isOwner && !opts.previewFollower;
}

function planWeekProgress(
  startIso: string,
  totalWeeks: number
): { week: number; total: number } | null {
  if (!totalWeeks || totalWeeks <= 0) return null;
  const start = new Date(startIso);
  const now = new Date();
  const weeksIn = Math.floor((now.getTime() - start.getTime()) / (7 * 86_400_000));
  const week = Math.max(1, Math.min(totalWeeks, weeksIn + 1));
  return { week, total: totalWeeks };
}

export default function AthleteCommunityMyTrainingSection({
  community,
  firstName,
  displayAsOwner,
  previewFollower,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const planStrip = community.publishedPlan;
  const summary = community.trainingFor.trainingSummary;
  const showPlanStrip = shouldShowPlanStrip(planStrip, {
    isOwner: community.isOwner,
    previewFollower,
  });
  const hasTrainingSummary = Boolean(summary);

  const planSummary = planStrip
    ? planStrip.name
    : displayAsOwner
      ? 'Publish your plan in studio'
      : `${firstName} hasn't shared a plan yet`;

  const initialPlanWeek =
    summary?.startDate && summary.totalWeeks
      ? planWeekProgress(summary.startDate, summary.totalWeeks)?.week ?? 1
      : 1;

  return (
    <section className="h-full rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-gray-900">My Training</h2>
        <p className="mt-1 text-sm text-gray-500">{planSummary}</p>
      </div>

      {showPlanStrip && planStrip && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition hover:border-orange-200 hover:bg-orange-50/40"
        >
          <p className="text-sm font-semibold text-gray-900">See my training</p>
          <p className="mt-1 text-xs text-gray-500">
            Week {initialPlanWeek} of {planStrip.totalWeeks} · See more ↓
          </p>
        </button>
      ) : null}

      {expanded && showPlanStrip && planStrip ? (
        <div className="mt-4 space-y-3">
          <GoFastWithMePlanStripSection
            publishedPlan={planStrip}
            hostFirstName={firstName}
            isHost={displayAsOwner}
          />
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs font-semibold text-orange-700 hover:underline"
          >
            Show less ↑
          </button>
        </div>
      ) : null}

      {!showPlanStrip || !planStrip ? (
        <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-600">
            {displayAsOwner
              ? 'Publish your plan in Runs & Training so followers can train week-by-week with you.'
              : `${firstName} hasn't shared a public plan yet.`}
          </p>
          {displayAsOwner ? (
            <Link
              href="/gofast-with-others"
              className="mt-3 inline-flex text-sm font-semibold text-orange-600 hover:underline"
            >
              Open Runs &amp; Training →
            </Link>
          ) : null}
          {displayAsOwner && hasTrainingSummary ? (
            <p className="mt-3 text-xs leading-5 text-gray-500">
              Goal race above comes from your active plan. This section appears after you publish
              the plan for followers.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
