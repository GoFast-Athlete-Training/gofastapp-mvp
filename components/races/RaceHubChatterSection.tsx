"use client";

import RaceMessageFeed, { RACE_HUB_DEFAULT_TOPICS } from "@/components/races/RaceMessageFeed";
import RaceHubLatestAnnouncementBanner from "@/components/races/RaceHubLatestAnnouncementBanner";
import type { AnnouncementRow } from "@/components/races/race-hub-types";

type RaceHubChatterSectionProps = {
  raceRegistryId: string;
  latestAnnouncement?: AnnouncementRow | null;
  announcementCount?: number;
  onViewAllAnnouncements?: () => void;
  variant?: "default" | "mobile-hub";
  showHeading?: boolean;
  messageListClassName?: string;
};

export default function RaceHubChatterSection({
  raceRegistryId,
  latestAnnouncement = null,
  announcementCount = 0,
  onViewAllAnnouncements,
  variant = "default",
  showHeading = true,
  messageListClassName,
}: RaceHubChatterSectionProps) {
  const isMobileHub = variant === "mobile-hub";

  return (
    <section
      className={
        isMobileHub
          ? "flex min-h-[calc(100dvh-11rem)] flex-col min-w-0"
          : "bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 min-w-0"
      }
    >
      {showHeading ? (
        <div className={isMobileHub ? "mb-3 px-0.5" : "mb-4"}>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Race chatter</h2>
          <p className="text-sm text-gray-500">
            Pace goals, meetups, tips — this is where the crew talks. Full course and logistics live on
            the public race page.
          </p>
        </div>
      ) : null}

      {isMobileHub && latestAnnouncement ? (
        <div className="mb-3">
          <RaceHubLatestAnnouncementBanner
            announcement={latestAnnouncement}
            hasMultiple={announcementCount > 1}
            onViewAll={onViewAllAnnouncements}
          />
        </div>
      ) : null}

      <RaceMessageFeed
        raceRegistryId={raceRegistryId}
        topics={[...RACE_HUB_DEFAULT_TOPICS]}
        variant={variant}
        messageListClassName={
          messageListClassName ??
          (isMobileHub
            ? undefined
            : "min-h-[min(14rem,35vh)] max-h-[min(28rem,55vh)]")
        }
      />
    </section>
  );
}
