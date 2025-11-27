'use client';

interface LeaderboardProps {
  members: Array<{
    athlete: {
      id: string;
      firstName: string;
      lastName: string;
      photoURL?: string;
    };
  }>;
  activities?: Array<{
    athleteId: string;
    distance?: number;
    duration?: number;
  }>;
}

export default function Leaderboard({ members, activities = [] }: LeaderboardProps) {
  // Calculate leaderboard stats (simplified - would need proper aggregation)
  const memberStats = members.map((member) => {
    const memberActivities = activities.filter(
      (a) => a.athleteId === member.athlete.id
    );
    const totalDistance = memberActivities.reduce(
      (sum, a) => sum + (a.distance || 0),
      0
    );
    const totalDuration = memberActivities.reduce(
      (sum, a) => sum + (a.duration || 0),
      0
    );

    return {
      ...member,
      totalDistance,
      totalDuration,
      activityCount: memberActivities.length,
    };
  });

  // Sort by distance (descending)
  const sorted = memberStats.sort((a, b) => b.totalDistance - a.totalDistance);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Leaderboard</h2>
      
      {sorted.length > 0 ? (
        <div className="space-y-3">
          {sorted.map((member, index) => (
            <div
              key={member.athlete.id}
              className="flex items-center justify-between p-3 border rounded"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium">{index + 1}</span>
                </div>
                <div>
                  <div className="font-medium">
                    {member.athlete.firstName} {member.athlete.lastName}
                  </div>
                  <div className="text-sm text-gray-500">
                    {member.activityCount} activities
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">
                  {(member.totalDistance / 1609.34).toFixed(1)} mi
                </div>
                {member.totalDuration > 0 && (
                  <div className="text-sm text-gray-500">
                    {Math.floor(member.totalDuration / 3600)}h{' '}
                    {Math.floor((member.totalDuration % 3600) / 60)}m
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No activity data yet</p>
      )}
    </div>
  );
}

