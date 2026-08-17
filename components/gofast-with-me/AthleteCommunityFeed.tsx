'use client';

import Link from 'next/link';
import type { CommunityFeedItem } from '@/lib/gofast-with-me/community-feed';
import {
  communityFeedItemLabel,
  formatTrainingDistance,
  formatTrainingDuration,
} from '@/lib/gofast-with-me/community-feed';

type Props = {
  items: CommunityFeedItem[];
  hostFirstName: string;
  emptyMessage?: string;
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

export default function AthleteCommunityFeed({ items, hostFirstName, emptyMessage }: Props) {
  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-600">
          {emptyMessage ?? `No posts from ${hostFirstName} yet. Check back soon.`}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3" aria-label="Community feed">
      {items.map((item) => {
        if (item.kind === 'activity') {
          const { post } = item;
          const { activity } = post;
          const distance = formatTrainingDistance(activity.distanceMiles);
          const duration = formatTrainingDuration(activity.durationSeconds);
          const stats = [distance, duration].filter(Boolean).join(' · ');
          return (
            <article
              key={item.id}
              className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm overflow-hidden"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                {communityFeedItemLabel(item.kind)} from {hostFirstName}
              </p>
              {post.photoUrl ? (
                <img
                  src={post.photoUrl}
                  alt=""
                  className="mt-3 -mx-4 w-[calc(100%+2rem)] max-h-72 object-cover"
                />
              ) : null}
              <h3 className="mt-2 text-base font-semibold text-gray-900">
                {activity.activityName?.trim() || 'Workout'}
              </h3>
              {stats ? <p className="mt-1 text-sm text-gray-700">{stats}</p> : null}
              {post.matchedWorkout ? (
                <p className="mt-2 text-xs text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2">
                  Planned: {post.matchedWorkout.title}
                  {post.matchedWorkout.planName ? ` · ${post.matchedWorkout.planName}` : ''}
                </p>
              ) : null}
              {post.caption ? (
                <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{post.caption}</p>
              ) : null}
              <p className="mt-2 text-xs text-gray-400">{formatWhen(activity.startTime)}</p>
            </article>
          );
        }

        if (item.kind === 'dailylog') {
          return (
            <article
              key={item.id}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">
                {communityFeedItemLabel(item.kind)} from {hostFirstName}
              </p>
              <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{item.body}</p>
              <p className="mt-2 text-xs text-gray-400">{formatWhen(item.createdAt)}</p>
            </article>
          );
        }

        if (item.kind === 'tip') {
          const tip = item.tip;
          return (
            <article
              key={item.id}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700">
                {communityFeedItemLabel(item.kind)}
              </p>
              <h3 className="mt-1 text-base font-semibold text-gray-900">{tip.title}</h3>
              <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap line-clamp-6">
                {tip.body}
              </p>
              {tip.mediaUrl ? (
                <img
                  src={tip.mediaUrl}
                  alt=""
                  className="mt-3 max-h-48 w-full rounded-xl object-cover"
                />
              ) : null}
              <p className="mt-2 text-xs text-gray-400">{formatWhen(item.sortAt)}</p>
            </article>
          );
        }

        const href = item.run.gorunPath.startsWith('/')
          ? item.run.gorunPath
          : `/${item.run.gorunPath}`;
        return (
          <Link
            key={item.id}
            href={href}
            className="block rounded-2xl border border-orange-200 bg-orange-50/60 p-4 shadow-sm hover:bg-orange-50 transition"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-orange-800">
              Join this run
            </p>
            <h3 className="mt-1 text-base font-semibold text-gray-900">{item.run.title}</h3>
            <p className="mt-1 text-xs text-gray-600">
              {formatWhen(item.run.date)}
              {item.run.meetUpPoint ? ` · ${item.run.meetUpPoint}` : ''}
            </p>
            <span className="mt-2 inline-block text-xs font-semibold text-orange-700">
              RSVP on GoRun →
            </span>
          </Link>
        );
      })}
    </section>
  );
}
