'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { AthleteCommunityPayload } from '@/lib/gofast-with-me/container-hub-service';
import GoFastWithMeTrainingForCard from '@/components/gofast-with-me/GoFastWithMeTrainingForCard';
import GoFastWithMePlanStripSection from '@/components/gofast-with-me/GoFastWithMePlanStripSection';

type StubId = 'goalRace' | 'training';

type Props = {
  community: AthleteCommunityPayload;
  firstName: string;
  displayAsOwner: boolean;
  hasTrainingFor: boolean;
};

function StubRow({
  title,
  summary,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{summary}</p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {expanded ? <div className="border-t border-gray-100 px-4 py-4">{children}</div> : null}
    </div>
  );
}

/** Goal Race + Training — durable chrome above the feed, not stream cards. */
export default function AthleteCommunityDurableChrome({
  community,
  firstName,
  displayAsOwner,
  hasTrainingFor,
}: Props) {
  const [expanded, setExpanded] = useState<StubId | null>(null);

  const goalSummary =
    community.trainingFor.trainingSummary?.raceName ??
    community.trainingFor.primaryChasingGoal?.raceName ??
    community.trainingFor.primaryChasingGoal?.name ??
    (hasTrainingFor ? 'Training goal' : 'Not set yet');

  const trainingSummary = community.publishedPlan
    ? community.publishedPlan.name
    : displayAsOwner
      ? 'Publish your plan in studio'
      : `${firstName} hasn't shared a plan yet`;

  return (
    <section className="space-y-2" aria-label="Training context">
      <StubRow
        title="My Goal Race"
        summary={goalSummary}
        expanded={expanded === 'goalRace'}
        onToggle={() => setExpanded((prev) => (prev === 'goalRace' ? null : 'goalRace'))}
      >
        {hasTrainingFor ? (
          <GoFastWithMeTrainingForCard
            trainingSummary={community.trainingFor.trainingSummary}
            primaryChasingGoal={community.trainingFor.primaryChasingGoal}
          />
        ) : (
          <p className="text-sm text-gray-500">
            {displayAsOwner
              ? 'Set a race goal or active plan — it hydrates here for followers.'
              : `${firstName} hasn't shared a goal race yet.`}
          </p>
        )}
      </StubRow>

      <StubRow
        title="My Training"
        summary={trainingSummary}
        expanded={expanded === 'training'}
        onToggle={() => setExpanded((prev) => (prev === 'training' ? null : 'training'))}
      >
        {community.publishedPlan ? (
          <GoFastWithMePlanStripSection
            publishedPlan={community.publishedPlan}
            hostFirstName={firstName}
            isHost={displayAsOwner}
          />
        ) : (
          <p className="text-sm text-gray-500">
            {displayAsOwner
              ? 'Publish your plan in Training so followers can train week-by-week with you.'
              : `${firstName} hasn't shared a public plan yet.`}
          </p>
        )}
      </StubRow>
    </section>
  );
}
