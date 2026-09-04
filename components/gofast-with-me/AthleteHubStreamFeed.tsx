'use client';

import { useMemo } from 'react';
import type { HubStreamFeedItem } from '@/lib/gofast-with-me/hub-stream-feed';
import { hubStreamFeedItemLabel } from '@/lib/gofast-with-me/hub-stream-feed';
import {
  formatTrainingDistance,
  formatTrainingDuration,
} from '@/lib/gofast-with-me/community-feed';

type Props = {
  items: HubStreamFeedItem[];
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

export default function AthleteHubStreamFeed({ items, hostFirstName, emptyMessage }: Props) {
  const sorted = useMemo(() => items, [items]);

  if (sorted.length === 0) {
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
      {sorted.map((item) => {
        if (item.kind === 'activity') {
          const distance = formatTrainingDistance(item.distanceMiles);
          const duration = formatTrainingDuration(item.durationSeconds);
          const stats = [distance, duration].filter(Boolean).join(' · ');
          return (
            <article
              key={item.id}
              className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm overflow-hidden"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                {hubStreamFeedItemLabel(item.kind)} from {hostFirstName}
              </p>
              {item.photoUrl ? (
                <img
                  src={item.photoUrl}
                  alt=""
                  className="mt-3 -mx-4 w-[calc(100%+2rem)] max-h-72 object-cover"
                />
              ) : null}
              <h3 className="mt-2 text-base font-semibold text-gray-900">{item.headline}</h3>
              {stats ? <p className="mt-1 text-sm text-gray-700">{stats}</p> : null}
              <p className="mt-2 text-xs text-gray-400">{formatWhen(item.startTime)}</p>
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
                {hubStreamFeedItemLabel(item.kind)} from {hostFirstName}
              </p>
              <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{item.body}</p>
              <p className="mt-2 text-xs text-gray-400">{formatWhen(item.createdAt)}</p>
            </article>
          );
        }

        if (item.kind === 'attendedRun') {
          const { run } = item;
          return (
            <article
              key={item.id}
              className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4 shadow-sm"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-sky-800">
                {hubStreamFeedItemLabel(item.kind)} from {hostFirstName}
              </p>
              <h3 className="mt-1 text-base font-semibold text-gray-900">{run.label}</h3>
              {run.meetUpPoint ? (
                <p className="mt-1 text-xs text-gray-600">{run.meetUpPoint}</p>
              ) : null}
              <p className="mt-2 text-xs text-gray-400">{formatWhen(run.checkedInAt)}</p>
            </article>
          );
        }

        return null;
      })}
    </section>
  );
}
