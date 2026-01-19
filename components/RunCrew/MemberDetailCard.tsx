'use client';

interface MemberDetailCardProps {
  member: {
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
  };
  showRole?: boolean;
  onRemove?: (membershipId: string, athleteName: string) => void;
  canRemove?: boolean;
  currentUserId?: string;
}

export default function MemberDetailCard({ 
  member, 
  showRole = true,
  onRemove,
  canRemove = false,
  currentUserId
}: MemberDetailCardProps) {
  const athlete = member.athlete || {};
  const displayName = athlete.firstName && athlete.lastName
    ? `${athlete.firstName} ${athlete.lastName}`
    : athlete.firstName || athlete.gofastHandle || 'Athlete';
  
  const initials = (athlete.firstName?.[0] || athlete.gofastHandle?.[0] || 'A').toUpperCase();
  const isCurrentUser = currentUserId === member.athleteId;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Photo */}
        <div className="flex-shrink-0">
          {athlete.photoURL ? (
            <img
              src={athlete.photoURL}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white text-xl font-semibold border-2 border-gray-200">
              {initials}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          {/* Name and Role */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {displayName}
              </h3>
              {showRole && member.role === 'admin' && (
                <span className="inline-block mt-1 text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                  Admin
                </span>
              )}
              {showRole && member.role === 'manager' && (
                <span className="inline-block mt-1 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  Manager
                </span>
              )}
            </div>
            {canRemove && !isCurrentUser && onRemove && (
              <button
                onClick={() => onRemove(member.id, displayName)}
                className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-md border border-red-200 hover:border-red-300 transition flex-shrink-0 font-medium"
                title="Remove member from crew"
              >
                Remove
              </button>
            )}
          </div>

          {/* GoFast Handle */}
          {athlete.gofastHandle && (
            <p className="text-sm text-gray-600 mb-2">
              <span className="font-medium">@</span>
              <span className="text-sky-600 font-medium">{athlete.gofastHandle}</span>
            </p>
          )}

          {/* Bio */}
          {athlete.bio && (
            <p className="text-sm text-gray-700 leading-relaxed mb-2 line-clamp-3">
              {athlete.bio}
            </p>
          )}

          {/* Joined Date */}
          {member.joinedAt && (
            <p className="text-xs text-gray-500">
              Joined {new Date(member.joinedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

