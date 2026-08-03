'use client';

import { useRouter } from 'next/navigation';
import { Camera, MessageSquare } from 'lucide-react';

export type RunFeedItem = {
  checkinId: string;
  runId: string;
  runSlug: string | null;
  runTitle: string;
  runDate: string;
  photoUrl: string;
  shout: string | null;
  checkedInAt: string;
  athlete: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    photoURL: string | null;
  };
};

function formatFeedDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function athleteName(athlete: RunFeedItem['athlete']): string {
  const name = [athlete.firstName, athlete.lastName].filter(Boolean).join(' ').trim();
  return name || 'Runner';
}

function FeedCard({ item }: { item: RunFeedItem }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(`/gorun/${item.runSlug ?? item.runId}`)}
      className="w-full overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-gray-200/80 transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full bg-gray-100">
        <img
          src={item.photoUrl}
          alt={`${athleteName(item.athlete)} at ${item.runTitle}`}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          {item.athlete.photoURL ? (
            <img
              src={item.athlete.photoURL}
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700">
              {(item.athlete.firstName?.[0] ?? '?').toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{athleteName(item.athlete)}</p>
            <p className="truncate text-xs text-gray-500">
              {item.runTitle} · {formatFeedDate(item.runDate)}
            </p>
          </div>
        </div>
        {item.shout ? (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-600 line-clamp-2">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
            <span>{item.shout}</span>
          </p>
        ) : null}
      </div>
    </button>
  );
}

type ClubRunPhotoFeedProps = {
  items: RunFeedItem[];
};

export default function ClubRunPhotoFeed({ items }: ClubRunPhotoFeedProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
        <Camera className="mx-auto h-8 w-8 text-gray-300" aria-hidden />
        <p className="mt-3 text-sm font-medium text-gray-700">No run photos yet</p>
        <p className="mt-1 text-sm text-gray-500">
          After a run, check in and add a photo — it&apos;ll show up here for the club.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <FeedCard key={item.checkinId} item={item} />
      ))}
    </div>
  );
}
