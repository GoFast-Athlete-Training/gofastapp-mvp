'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { AthleteCommunityPayload } from '@/lib/gofast-with-me/container-hub-service';
import ContainerHubRunsSection from '@/components/gofast-with-me/ContainerHubRunsSection';

type Props = {
  community: AthleteCommunityPayload;
  firstName: string;
  displayAsOwner: boolean;
};

/** Hosted runs stub — below the feed stream. */
export default function AthleteCommunityHubStubs({
  community,
  firstName,
  displayAsOwner,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const runsSummary =
    community.upcomingRuns.length === 0
      ? 'No upcoming hosted runs'
      : community.upcomingRuns.length === 1
        ? community.upcomingRuns[0]!.title
        : `${community.upcomingRuns.length} upcoming runs`;

  return (
    <section className="space-y-2" aria-label="Hosted runs">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-1">
        More
      </p>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition"
          aria-expanded={expanded}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">My Runs</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{runsSummary}</p>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {expanded ? (
          <div className="border-t border-gray-100 px-4 py-4">
            <ContainerHubRunsSection
              runs={community.upcomingRuns}
              hostFirstName={firstName}
              isHost={displayAsOwner}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
