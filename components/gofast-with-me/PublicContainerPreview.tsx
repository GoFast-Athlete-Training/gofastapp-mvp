'use client';

import Link from 'next/link';
import type { AthleteCommunityPayload } from '@/lib/gofast-with-me/container-hub-service';
import {
  athleteMyPlanPath,
  athletePublicLandingUrl,
} from '@/lib/gofast-with-me/athlete-community-routes';
import { runnerPublicSegmentUrl } from '@/lib/gofast-with-me/runner-public-url';

type Props = {
  community: AthleteCommunityPayload;
  handle: string;
  firstName: string;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRaceDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PublicContainerPreview({ community, handle, firstName }: Props) {
  const nextRun = community.upcomingRuns?.[0] ?? null;
  const reflectionsUrl = runnerPublicSegmentUrl(handle, 'reflections');
  const runsUrl = runnerPublicSegmentUrl(handle, 'runs');
  const planUrl = athleteMyPlanPath(handle);

  const goal = community.nextRace ?? community.trainingFor.primaryChasingGoal;
  const goalName =
    community.nextRace?.name ??
    community.trainingFor.primaryChasingGoal?.raceName ??
    community.trainingFor.trainingSummary?.raceName ??
    null;
  const goalDate =
    community.nextRace?.raceDate ??
    community.trainingFor.primaryChasingGoal?.raceDate ??
    community.trainingFor.trainingSummary?.raceDate ??
    null;

  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      {community.hostBio ? (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Bio</h2>
          <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {community.hostBio}
          </p>
        </section>
      ) : null}

      {goalName ? (
        <section className="rounded-2xl border border-orange-200 bg-orange-50/60 p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-orange-800">
            Next race goal
          </h2>
          <p className="mt-2 text-lg font-bold text-gray-900">{goalName}</p>
          {goalDate ? (
            <p className="mt-1 text-sm text-gray-600">{formatRaceDate(goalDate)}</p>
          ) : null}
          {goal && 'goalTime' in goal && goal.goalTime ? (
            <p className="mt-1 text-sm font-semibold text-gray-800">Goal: {goal.goalTime}</p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          My next workout
        </h2>
        {community.nextWorkout ? (
          <>
            <p className="mt-2 text-base font-bold text-gray-900">{community.nextWorkout.title}</p>
            <p className="mt-1 text-sm text-gray-600">
              {community.nextWorkout.workoutType}
              {community.nextWorkout.date ? ` · ${formatWhen(community.nextWorkout.date)}` : ''}
            </p>
            <Link
              href={planUrl}
              className="mt-3 inline-flex text-sm font-semibold text-orange-700 hover:text-orange-800"
            >
              See my plan →
            </Link>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            {firstName} hasn&apos;t shared an upcoming workout yet.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          My next group run
        </h2>
        {nextRun ? (
          <>
            <a
              href={
                nextRun.gorunPath.startsWith('http')
                  ? nextRun.gorunPath
                  : `${typeof window !== 'undefined' ? window.location.origin : ''}${
                      nextRun.gorunPath.startsWith('/') ? nextRun.gorunPath : `/${nextRun.gorunPath}`
                    }`
              }
              className="mt-2 block rounded-xl border border-orange-200 bg-orange-50/80 p-4 hover:border-orange-300 transition"
            >
              <p className="text-base font-bold text-gray-900">{nextRun.title}</p>
              <p className="mt-1 text-sm text-gray-600">
                {formatWhen(nextRun.date)} · {nextRun.gofastCity}
                {nextRun.meetUpPoint ? ` · ${nextRun.meetUpPoint}` : ''}
              </p>
              <span className="mt-3 inline-block rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white">
                RSVP
              </span>
            </a>
            <Link
              href={runsUrl}
              className="mt-3 inline-flex text-sm font-semibold text-orange-700 hover:text-orange-800"
            >
              All upcoming runs →
            </Link>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-600">No group run on the calendar right now.</p>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Reflection</h2>
        {community.reflectionPreview ? (
          <>
            <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">
              {community.reflectionPreview.caption?.trim() || 'Training reflection'}
            </p>
            <a
              href={reflectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex text-sm font-semibold text-orange-700 hover:text-orange-800"
            >
              See more →
            </a>
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-600">No published reflection yet.</p>
        )}
      </section>

      <p className="text-center text-xs text-gray-500">
        More from {firstName} lives on{' '}
        <a
          href={athletePublicLandingUrl(handle)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-orange-700 hover:underline"
        >
          their link page
        </a>
        .
      </p>
    </div>
  );
}
