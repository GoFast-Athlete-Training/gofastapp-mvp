"use client";

import { useState } from "react";
import { CalendarDays, Info, MessageCircle, Users } from "lucide-react";
import MobileHubTabs from "@/components/shared/MobileHubTabs";
import RaceHubAnnouncementsSection from "@/components/races/RaceHubAnnouncementsSection";
import RaceHubChatterSection from "@/components/races/RaceHubChatterSection";
import {
  RaceHubAtAGlanceSection,
  RaceHubMyResultSection,
} from "@/components/races/RaceHubInfoSections";
import {
  RaceHubEventsSection,
  RaceHubShakeoutsSection,
} from "@/components/races/RaceHubEventsSections";
import RaceHubPeopleSection from "@/components/races/RaceHubPeopleSection";
import type {
  AnnouncementRow,
  MembershipRow,
  MyRaceResultRow,
  RaceEventRow,
  ShakeoutRunRow,
} from "@/components/races/race-hub-types";

type RaceHubMobileTabsProps = {
  raceRegistryId: string;
  announcements: AnnouncementRow[];
  isAdmin: boolean;
  showAnnounceForm: boolean;
  onToggleAnnounceForm: () => void;
  announceTitle: string;
  announceBody: string;
  onAnnounceTitleChange: (value: string) => void;
  onAnnounceBodyChange: (value: string) => void;
  onCancelAnnounceForm: () => void;
  onPostAnnouncement: (e: React.FormEvent) => void;
  postingAnnounce: boolean;
  dateLabel: string | null;
  raceStartLabel: string | null;
  locationText: string | null;
  distanceChips: string[];
  distanceFallback: string | null;
  publicRaceUrl: string | null;
  courseTipsUrl: string | null;
  shakeouts: ShakeoutRunRow[];
  events: RaceEventRow[];
  memberships: MembershipRow[];
  currentUserId?: string;
  onSetShakeoutRunRsvp: (runId: string, status: "going" | "not-going") => void;
  onSetRsvp: (eventId: string, status: "going" | "not-going" | "maybe") => void;
  showPostRaceResultCard: boolean;
  myRaceResult: MyRaceResultRow | null;
  onOpenLogSheet: () => void;
};

const TABS = [
  { id: "chatter", label: "Chatter", icon: <MessageCircle className="h-5 w-5" /> },
  { id: "info", label: "Info", icon: <Info className="h-5 w-5" /> },
  { id: "events", label: "Events", icon: <CalendarDays className="h-5 w-5" /> },
  { id: "people", label: "People", icon: <Users className="h-5 w-5" /> },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function RaceHubMobileTabs(props: RaceHubMobileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("chatter");
  const latestAnnouncement = props.announcements[0] ?? null;

  return (
    <MobileHubTabs tabs={[...TABS]} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as TabId)}>
      {activeTab === "chatter" ? (
        <RaceHubChatterSection
          raceRegistryId={props.raceRegistryId}
          variant="mobile-hub"
          showHeading
          latestAnnouncement={latestAnnouncement}
          announcementCount={props.announcements.length}
          onViewAllAnnouncements={() => setActiveTab("info")}
        />
      ) : null}

      {activeTab === "info" ? (
        <div className="space-y-6">
          {props.showPostRaceResultCard ? (
            <RaceHubMyResultSection
              myRaceResult={props.myRaceResult}
              onOpenLogSheet={props.onOpenLogSheet}
            />
          ) : null}
          <RaceHubAtAGlanceSection
            dateLabel={props.dateLabel}
            raceStartLabel={props.raceStartLabel}
            locationText={props.locationText}
            distanceChips={props.distanceChips}
            distanceFallback={props.distanceFallback}
            publicRaceUrl={props.publicRaceUrl}
            courseTipsUrl={props.courseTipsUrl}
          />
          <RaceHubAnnouncementsSection
            announcements={props.announcements}
            isAdmin={props.isAdmin}
            showAnnounceForm={props.showAnnounceForm}
            onToggleAnnounceForm={props.onToggleAnnounceForm}
            announceTitle={props.announceTitle}
            announceBody={props.announceBody}
            onAnnounceTitleChange={props.onAnnounceTitleChange}
            onAnnounceBodyChange={props.onAnnounceBodyChange}
            onCancelAnnounceForm={props.onCancelAnnounceForm}
            onPostAnnouncement={props.onPostAnnouncement}
            postingAnnounce={props.postingAnnounce}
            compact
          />
        </div>
      ) : null}

      {activeTab === "events" ? (
        <div className="space-y-8">
          <RaceHubShakeoutsSection
            shakeouts={props.shakeouts}
            onSetShakeoutRunRsvp={props.onSetShakeoutRunRsvp}
          />
          <RaceHubEventsSection events={props.events} onSetRsvp={props.onSetRsvp} />
        </div>
      ) : null}

      {activeTab === "people" ? (
        <RaceHubPeopleSection
          memberships={props.memberships}
          runnersExpanded
          onToggleRunnersExpanded={() => undefined}
          currentUserId={props.currentUserId}
          expanded
        />
      ) : null}
    </MobileHubTabs>
  );
}
