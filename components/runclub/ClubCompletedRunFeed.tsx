'use client';

import { Camera, MessageSquare } from 'lucide-react';
import type { CompletedRunFeedItem } from '@/lib/runclub/completed-run-feed';

function formatFeedDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function FeedCard({ item }: { item: CompletedRunFeedItem }) {
  return (
    <article className="w-full overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-gray-200/80">
      {item.postRunPhotoUrl ? (
        <div className="relative aspect-[4/3] w-full bg-gray-100">
          <img
            src={item.postRunPhotoUrl}
            alt={`${item.runTitle} group photo`}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}
      <div className="px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">{item.runTitle}</p>
        <p className="text-xs text-gray-500 mt-0.5">{formatFeedDate(item.runDate)}</p>
        {item.meetUpPoint ? (
          <p className="text-xs text-gray-400 mt-1 truncate">{item.meetUpPoint}</p>
        ) : null}
        {item.postRunNote ? (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-600 line-clamp-3">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
            <span>{item.postRunNote}</span>
          </p>
        ) : null}
      </div>
    </article>
  );
}

type ClubCompletedRunFeedProps = {
  items: CompletedRunFeedItem[];
};

export default function ClubCompletedRunFeed({ items }: ClubCompletedRunFeedProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
        <Camera className="mx-auto h-8 w-8 text-gray-300" aria-hidden />
        <p className="mt-3 text-sm font-medium text-gray-700">No published run recaps yet</p>
        <p className="mt-1 text-sm text-gray-500">
          When your club manager publishes photos and notes from recent runs, they&apos;ll show up
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <FeedCard key={item.runId} item={item} />
      ))}
    </div>
  );
}
