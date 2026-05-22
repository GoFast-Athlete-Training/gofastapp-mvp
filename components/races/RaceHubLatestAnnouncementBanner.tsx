"use client";

import { Megaphone } from "lucide-react";
import type { AnnouncementRow } from "@/components/races/race-hub-types";

type RaceHubLatestAnnouncementBannerProps = {
  announcement: AnnouncementRow | null;
  onViewAll?: () => void;
  hasMultiple?: boolean;
};

export default function RaceHubLatestAnnouncementBanner({
  announcement,
  onViewAll,
  hasMultiple = false,
}: RaceHubLatestAnnouncementBannerProps) {
  if (!announcement) return null;

  const authorName = [announcement.Athlete?.firstName, announcement.Athlete?.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Latest announcement
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">{announcement.title}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-gray-700">{announcement.content}</p>
          {authorName ? (
            <p className="mt-1 text-xs text-gray-500">Posted by {authorName}</p>
          ) : null}
        </div>
        {hasMultiple && onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="shrink-0 text-xs font-semibold text-orange-600 hover:text-orange-700"
          >
            All
          </button>
        ) : null}
      </div>
    </div>
  );
}
