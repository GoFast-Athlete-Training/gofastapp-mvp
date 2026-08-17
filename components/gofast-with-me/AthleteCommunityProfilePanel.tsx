'use client';

import Link from 'next/link';
import type { AthleteCommunityPayload } from '@/lib/gofast-with-me/container-hub-service';
import GoFastWithMeTrainingForCard from '@/components/gofast-with-me/GoFastWithMeTrainingForCard';
import GoFastWithMePlanStripSection from '@/components/gofast-with-me/GoFastWithMePlanStripSection';
import AthleteTipsSection from '@/components/gofast-with-me/AthleteTipsSection';
import GoFastWithMeFollowersSection from '@/components/gofast-with-me/GoFastWithMeFollowersSection';
import { athletePublicLandingUrl } from '@/lib/gofast-with-me/athlete-community-routes';

type Props = {
  community: AthleteCommunityPayload;
  handle: string;
  firstName: string;
  displayAsOwner: boolean;
  hasTrainingFor: boolean;
  variant?: 'rail' | 'sheet';
  onClose?: () => void;
};

/** Training-for, plan strip, tips, and people — opened from header profile click-in. */
export default function AthleteCommunityProfilePanel({
  community,
  handle,
  firstName,
  displayAsOwner,
  hasTrainingFor,
  variant = 'rail',
  onClose,
}: Props) {
  const shellClass =
    variant === 'sheet'
      ? 'rounded-t-2xl border border-gray-200 bg-white shadow-xl max-h-[85vh] overflow-y-auto'
      : 'space-y-6';

  return (
    <div className={shellClass}>
      {variant === 'sheet' ? (
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <h2 className="text-sm font-bold text-gray-900">About {firstName}</h2>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-orange-600 hover:underline"
            >
              Done
            </button>
          ) : null}
        </div>
      ) : null}

      <div className={variant === 'sheet' ? 'space-y-6 p-4' : 'space-y-6'}>
        <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
          <p className="text-xs text-gray-600">
            Full intro, welcome, and achievements live on the public page.
          </p>
          <a
            href={athletePublicLandingUrl(handle)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex text-xs font-semibold text-orange-600 hover:underline"
          >
            View public page →
          </a>
        </div>

        {hasTrainingFor ? (
          <GoFastWithMeTrainingForCard
            trainingSummary={community.trainingFor.trainingSummary}
            primaryChasingGoal={community.trainingFor.primaryChasingGoal}
          />
        ) : null}

        {community.publishedPlan ? (
          <GoFastWithMePlanStripSection
            publishedPlan={community.publishedPlan}
            hostFirstName={firstName}
            isHost={displayAsOwner}
          />
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900">Join me</h2>
            <p className="text-sm text-gray-600 mt-2">
              {displayAsOwner
                ? 'Publish your plan in Runs & Training so followers can train with you here.'
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
          </div>
        )}

        <AthleteTipsSection
          tips={community.tips}
          hostFirstName={firstName}
          isOwner={displayAsOwner}
          instagramUsername={community.host.instagramUsername}
        />

        <GoFastWithMeFollowersSection
          hub={{
            ...community,
            isHost: displayAsOwner,
          }}
          handle={handle}
          variant="hub"
        />
      </div>
    </div>
  );
}
