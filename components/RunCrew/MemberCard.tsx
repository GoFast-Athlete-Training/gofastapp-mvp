'use client';

interface MemberCardProps {
  member: {
    athlete: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      photoURL?: string;
    };
    joinedAt: string;
  };
}

export default function MemberCard({ member }: MemberCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
        {member.athlete.photoURL ? (
          <img
            src={member.athlete.photoURL}
            alt={`${member.athlete.firstName} ${member.athlete.lastName}`}
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <span className="text-gray-600">
            {member.athlete.firstName?.[0]}{member.athlete.lastName?.[0]}
          </span>
        )}
      </div>
      <div className="flex-1">
        <div className="font-medium">
          {member.athlete.firstName} {member.athlete.lastName}
        </div>
        <div className="text-sm text-gray-500">
          Joined {new Date(member.joinedAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

