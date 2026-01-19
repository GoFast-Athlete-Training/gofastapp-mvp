'use client';

import { useState } from 'react';
import MemberDetailCard from './MemberDetailCard';

interface MemberListProps {
  members: Array<{
    id: string;
    athleteId: string;
    role: 'member' | 'manager' | 'admin';
    athlete: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      gofastHandle: string | null;
      photoURL: string | null;
      bio: string | null;
    };
    joinedAt?: string;
  }>;
  showRole?: boolean;
  onRemove?: (membershipId: string, athleteName: string) => void;
  canRemove?: boolean;
  currentUserId?: string;
}

export default function MemberList({
  members,
  showRole = true,
  onRemove,
  canRemove = false,
  currentUserId
}: MemberListProps) {
  const [selectedMember, setSelectedMember] = useState<typeof members[0] | null>(null);

  const getDisplayName = (athlete: any) => {
    if (athlete.firstName && athlete.lastName) {
      return `${athlete.firstName} ${athlete.lastName}`;
    }
    return athlete.firstName || athlete.gofastHandle || 'Athlete';
  };

  const getInitials = (athlete: any) => {
    return (athlete.firstName?.[0] || athlete.gofastHandle?.[0] || 'A').toUpperCase();
  };

  return (
    <>
      <div className="space-y-2">
        {members.map((member) => {
          const athlete = member.athlete || {};
          const displayName = getDisplayName(athlete);
          const initials = getInitials(athlete);

          return (
            <div
              key={member.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition cursor-pointer"
              onClick={() => setSelectedMember(member)}
            >
              {/* Clickable Photo */}
              <div className="flex-shrink-0">
                {athlete.photoURL ? (
                  <img
                    src={athlete.photoURL}
                    alt={displayName}
                    className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 cursor-pointer hover:border-gray-300 transition"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-sm font-semibold border-2 border-gray-200 cursor-pointer hover:border-gray-300 transition">
                    {initials}
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {displayName}
                  </p>
                  {showRole && member.role === 'admin' && (
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                      Admin
                    </span>
                  )}
                  {showRole && member.role === 'manager' && (
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      Manager
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal for Member Details */}
      {selectedMember && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Member Details</h2>
              <button
                onClick={() => setSelectedMember(null)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <MemberDetailCard
              member={selectedMember}
              showRole={showRole}
              onRemove={onRemove}
              canRemove={canRemove}
              currentUserId={currentUserId}
            />
          </div>
        </div>
      )}
    </>
  );
}

