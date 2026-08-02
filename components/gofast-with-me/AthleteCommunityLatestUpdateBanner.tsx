'use client';

import type { ContainerHubMessage } from '@/lib/gofast-with-me/container-hub-service';

type Props = {
  update: ContainerHubMessage;
  hostFirstName: string;
  onViewJourney?: () => void;
  hasMultiple?: boolean;
};

export default function AthleteCommunityLatestUpdateBanner({
  update,
  hostFirstName,
  onViewJourney,
  hasMultiple = false,
}: Props) {
  return (
    <button
      type="button"
      onClick={onViewJourney}
      className="w-full text-left rounded-2xl border border-orange-200 bg-orange-50/80 px-4 py-3 hover:bg-orange-50 transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-orange-800">
            Latest from {hostFirstName}
          </p>
          <p className="mt-1 text-sm text-gray-800 line-clamp-2 whitespace-pre-wrap">{update.body}</p>
          <p className="mt-1 text-xs text-gray-500">
            {new Date(update.createdAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>
        {onViewJourney ? (
          <span className="shrink-0 text-xs font-semibold text-orange-700">
            {hasMultiple ? 'All updates' : 'Journey'} →
          </span>
        ) : null}
      </div>
    </button>
  );
}
