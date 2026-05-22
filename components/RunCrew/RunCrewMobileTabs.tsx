"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Link as LinkIcon, MessageCircle, Route, Users } from "lucide-react";
import MobileHubTabs from "@/components/shared/MobileHubTabs";
import MessageFeed from "@/components/RunCrew/MessageFeed";
import MemberDetailCard from "@/components/RunCrew/MemberDetailCard";
import TrainingPanel from "@/components/RunCrew/TrainingPanel";

type RunCrewMobileTabsProps = {
  runCrewId: string;
  memberships: Array<{
    id: string;
    athleteId: string;
    role: string;
    athlete?: Record<string, unknown>;
    joinedAt?: string;
  }>;
  messageTopics: string[];
  isAdmin: boolean;
  inviteUrl: string;
  copiedLink: boolean;
  onCopyLink: () => void;
  trainingWeek: Parameters<typeof TrainingPanel>[0]["trainingWeek"];
  currentUserId?: string;
};

const TABS = [
  { id: "chatter", label: "Chatter", icon: <MessageCircle className="h-5 w-5" /> },
  { id: "runs", label: "Runs", icon: <Route className="h-5 w-5" /> },
  { id: "people", label: "People", icon: <Users className="h-5 w-5" /> },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function RunCrewMobileTabs({
  runCrewId,
  memberships,
  messageTopics,
  isAdmin,
  inviteUrl,
  copiedLink,
  onCopyLink,
  trainingWeek,
  currentUserId,
}: RunCrewMobileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("chatter");

  return (
    <MobileHubTabs tabs={[...TABS]} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as TabId)}>
      {activeTab === "chatter" ? (
        <section className="flex min-h-[calc(100dvh-11rem)] flex-col min-w-0">
          <MessageFeed
            crewId={runCrewId}
            topics={messageTopics}
            selectedTopic="#general"
            isAdmin={isAdmin}
            variant="mobile-hub"
          />
        </section>
      ) : null}

      {activeTab === "runs" ? (
        <div className="space-y-4">
          <TrainingPanel trainingWeek={trainingWeek} />
        </div>
      ) : null}

      {activeTab === "people" ? (
        <div className="space-y-6">
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Members</h2>
              <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {memberships.length}
              </span>
            </div>
            {memberships.length === 0 ? (
              <div className="border border-dashed border-gray-300 rounded-xl p-6 text-center text-sm text-gray-500">
                <p className="mb-2">No members yet.</p>
                <p>Share your invite code to build the crew.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {memberships.map((membershipItem: {
                  id: string;
                  athleteId: string;
                  role: string;
                  athlete?: {
                    id?: string;
                    firstName?: string | null;
                    lastName?: string | null;
                    gofastHandle?: string | null;
                    photoURL?: string | null;
                    bio?: string | null;
                  };
                  joinedAt?: string;
                }) => (
                  <MemberDetailCard
                    key={membershipItem.id}
                    member={{
                      id: membershipItem.id,
                      athleteId: membershipItem.athleteId,
                      role: (membershipItem.role as "member" | "manager" | "admin") || "member",
                      athlete: {
                        id: membershipItem.athlete?.id || membershipItem.athleteId,
                        firstName: membershipItem.athlete?.firstName ?? null,
                        lastName: membershipItem.athlete?.lastName ?? null,
                        gofastHandle: membershipItem.athlete?.gofastHandle ?? null,
                        photoURL: membershipItem.athlete?.photoURL ?? null,
                        bio: membershipItem.athlete?.bio ?? null,
                      },
                      joinedAt: membershipItem.joinedAt,
                    }}
                    showRole
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Invite Teammates</h2>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                Invite Link
              </label>
              <div className="flex items-center gap-2 min-w-0">
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="flex-1 min-w-0 px-3 py-2 text-xs border border-gray-300 rounded-lg bg-gray-50 font-mono truncate"
                />
                <button
                  type="button"
                  onClick={onCopyLink}
                  className="px-3 sm:px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-1 sm:gap-2 flex-shrink-0"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Share this link to invite members</p>
            </div>
          </section>

          {isAdmin ? (
            <Link
              href={`/runcrew/${runCrewId}/admin`}
              className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-center text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              View as Admin
            </Link>
          ) : null}
        </div>
      ) : null}
    </MobileHubTabs>
  );
}
