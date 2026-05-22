"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import MemberDetailCard from "@/components/RunCrew/MemberDetailCard";
import {
  mapRaceRoleToCrewRole,
  memberInitials,
  type MembershipRow,
} from "@/components/races/race-hub-types";

type RaceHubPeopleSectionProps = {
  memberships: MembershipRow[];
  runnersExpanded: boolean;
  onToggleRunnersExpanded: () => void;
  currentUserId?: string;
  /** Always show full member list (mobile People tab). */
  expanded?: boolean;
};

export default function RaceHubPeopleSection({
  memberships,
  runnersExpanded,
  onToggleRunnersExpanded,
  currentUserId,
  expanded = false,
}: RaceHubPeopleSectionProps) {
  const showList = expanded || runnersExpanded;

  if (expanded) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Who&apos;s here</h2>
          <p className="text-sm text-gray-500 mt-1">
            {memberships.length === 0
              ? "No members yet. Invite friends from the public race page."
              : `${memberships.length} runner${memberships.length === 1 ? "" : "s"} in this hub`}
          </p>
        </div>
        {memberships.length === 0 ? (
          <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-200 p-6 text-center">
            No members yet. Invite friends from the public race page.
          </p>
        ) : (
          <div className="space-y-2">
            {memberships.map((m) => (
              <MemberDetailCard
                key={m.id}
                member={{
                  id: m.id,
                  athleteId: m.athleteId,
                  role: mapRaceRoleToCrewRole(m.role),
                  athlete: {
                    id: m.Athlete.id,
                    firstName: m.Athlete.firstName,
                    lastName: m.Athlete.lastName,
                    gofastHandle: m.Athlete.gofastHandle,
                    photoURL: m.Athlete.photoURL,
                    bio: m.Athlete.bio,
                  },
                  joinedAt: m.joinedAt,
                }}
                showRole
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="border-t border-gray-200 pt-5 mt-2">
      <button
        type="button"
        onClick={onToggleRunnersExpanded}
        className="w-full flex items-center justify-between gap-3 text-left rounded-xl border border-gray-100 bg-gray-50/80 hover:bg-gray-100/80 px-3 py-2.5 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide shrink-0">
            Who&apos;s here
          </span>
          {memberships.length > 0 ? (
            <div className="flex items-center -space-x-2">
              {memberships.slice(0, 6).map((m) => (
                <div
                  key={m.id}
                  className="relative w-8 h-8 rounded-full border-2 border-white bg-gray-200 overflow-hidden flex items-center justify-center text-[10px] font-semibold text-gray-700 shrink-0"
                  title={
                    [m.Athlete.firstName, m.Athlete.lastName].filter(Boolean).join(" ") ||
                    m.Athlete.gofastHandle ||
                    "Runner"
                  }
                >
                  {m.Athlete.photoURL ? (
                    <img src={m.Athlete.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    memberInitials(m.Athlete)
                  )}
                </div>
              ))}
            </div>
          ) : null}
          <span className="text-sm text-gray-500 truncate">
            {memberships.length === 0
              ? "No one yet"
              : `${memberships.length} runner${memberships.length === 1 ? "" : "s"}`}
            {memberships.length > 6 ? ` · +${memberships.length - 6} more` : ""}
          </span>
        </div>
        {runnersExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
        )}
      </button>
      {showList ? (
        <div className="mt-3 space-y-2 max-h-[min(24rem,50vh)] overflow-y-auto pr-1">
          {memberships.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              No members yet. Invite friends from the public race page.
            </p>
          ) : (
            memberships.map((m) => (
              <MemberDetailCard
                key={m.id}
                member={{
                  id: m.id,
                  athleteId: m.athleteId,
                  role: mapRaceRoleToCrewRole(m.role),
                  athlete: {
                    id: m.Athlete.id,
                    firstName: m.Athlete.firstName,
                    lastName: m.Athlete.lastName,
                    gofastHandle: m.Athlete.gofastHandle,
                    photoURL: m.Athlete.photoURL,
                    bio: m.Athlete.bio,
                  },
                  joinedAt: m.joinedAt,
                }}
                showRole
                currentUserId={currentUserId}
              />
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
