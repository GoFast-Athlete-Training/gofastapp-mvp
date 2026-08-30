'use client';

import { useMemo } from 'react';
import type { AthleteCommunityPayload } from '@/lib/gofast-with-me/container-hub-service';
import { buildRunningSectionItems } from '@/lib/gofast-with-me/athlete-community-running-section';
import {
  formatTrainingDistance,
  formatTrainingDuration,
} from '@/lib/gofast-with-me/community-feed';

type Props = {
  community: AthleteCommunityPayload;
  firstName: string;
  displayAsOwner: boolean;
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function workoutHeadline(activity: {
  matchedWorkout: { title: string; publicTitle: string | null } | null;
  activityName: string | null;
}): string {
  if (activity.matchedWorkout?.title) return activity.matchedWorkout.title;
  const name = activity.activityName?.trim();
  if (name) return name.replace(/_/g, ' ');
  return 'Run';
}

function thoughtText(
  activity: {
    matchedWorkout: { reflection: string | null; publicTitle: string | null } | null;
  },
  post: { caption: string | null } | null
): string | null {
  const reflection = activity.matchedWorkout?.reflection?.trim();
  if (reflection) return reflection;
  const caption = post?.caption?.trim();
  if (caption) return caption;
  const publicTitle = activity.matchedWorkout?.publicTitle?.trim();
  if (publicTitle) return publicTitle;
  return null;
}

function photoUrl(
  activity: { matchedWorkout: { workoutPhotoUrl: string | null } | null },
  post: { photoUrl: string | null } | null
): string | null {
  return activity.matchedWorkout?.workoutPhotoUrl ?? post?.photoUrl ?? null;
}

export default function AthleteCommunityMyRunningSection({
  community,
  firstName,
  displayAsOwner,
}: Props) {
  const items = useMemo(
    () =>
      buildRunningSectionItems({
        recentActivities: community.recentActivities ?? [],
        activityPosts: community.activityPosts ?? [],
      }),
    [community]
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">My Running</h2>
        <p className="mt-1 text-sm text-gray-500">
          Recent runs from {firstName}.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-600">
            {displayAsOwner
              ? 'Your recent runs will show here for followers.'
              : `${firstName} hasn't shared recent runs yet.`}
          </p>
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-min gap-4">
            {items.map((item) => {
              const { activity, post } = item;
              const distance = formatTrainingDistance(activity.distanceMiles);
              const duration = formatTrainingDuration(activity.durationSeconds);
              const stats = [distance, duration].filter(Boolean).join(' · ');
              const headline = workoutHeadline(activity);
              const thought = thoughtText(activity, post);
              const imageUrl = photoUrl(activity, post);
              const accent =
                activity.matchedWorkout?.workoutType === 'tempo'
                  ? 'border-orange-200 bg-orange-50/40'
                  : 'border-emerald-200 bg-emerald-50/30';

              return (
                <article
                  key={item.id}
                  className={`w-80 shrink-0 overflow-hidden rounded-2xl border shadow-sm ${accent}`}
                >
                  {activity.summaryPolyline ? (
                    <div className="h-32 bg-neutral-100" aria-hidden />
                  ) : null}
                  <div className="bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                      {activity.matchedWorkout ? 'Workout' : 'Run'}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-gray-900">{headline}</h3>
                    {activity.matchedWorkout?.planName ? (
                      <p className="mt-1 text-xs text-gray-500">{activity.matchedWorkout.planName}</p>
                    ) : null}
                    {stats ? <p className="mt-2 text-sm text-gray-700">{stats}</p> : null}
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt=""
                        className="mt-3 h-36 w-full rounded-xl object-cover"
                      />
                    ) : null}
                    {thought ? (
                      <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                        {thought}
                      </p>
                    ) : null}
                    {activity.startTime ? (
                      <p className="mt-2 text-xs text-gray-400">{formatWhen(activity.startTime)}</p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
