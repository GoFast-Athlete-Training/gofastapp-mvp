'use client';

import Link from 'next/link';
import GoFastWithMeWeekStrip from '@/components/gofast-with-me/GoFastWithMeWeekStrip';
import GoFastWithMeSetupPanel from '@/components/gofast-with-me/GoFastWithMeSetupPanel';

type Props = {
  publicSlug: string;
  firstName: string | null;
  embedded?: boolean;
};

export default function GoFastWithMeWorkoutsPanel({
  publicSlug,
  firstName,
  embedded = false,
}: Props) {
  const hubPlanPath = `/container/${encodeURIComponent(publicSlug)}#plan-strip`;

  return (
    <section id="workouts" className={embedded ? 'space-y-4' : 'space-y-6'}>
      {!embedded ? (
        <div>
          <h2 className="text-lg font-bold text-gray-900">My Workouts</h2>
          <p className="text-sm text-gray-600 mt-1">
            Your creator view of the same active plan in My Training — share the week with followers
            when you&apos;re ready.
          </p>
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">My Workouts</h3>
          <p className="text-xs text-gray-600 mt-1">
            Plan week plus sharing controls — the training execution tools stay in My Training.
          </p>
        </div>
      )}

      <GoFastWithMeWeekStrip />

      <GoFastWithMeSetupPanel embedded sharingOnly firstName={firstName} />

      <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4 space-y-2">
        <p className="text-sm font-semibold text-gray-900">Where followers see it</p>
        <p className="text-xs text-gray-600 leading-relaxed">
          When your plan is public, your training week lives on your GoFast With Me hub — right after
          What I&apos;m training for. The full plan page is a deeper preview, not the main share surface.
        </p>
        <Link
          href={hubPlanPath}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-sm font-semibold text-orange-600 hover:underline"
        >
          Open hub training week →
        </Link>
      </div>
    </section>
  );
}
