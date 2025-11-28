import { prisma } from './prisma';

// Lightweight types for type safety
type ActivityLite = {
  distance?: number | null;
  duration?: number | null;
};

type MembershipLite = {
  runCrewId: string;
  joinedAt: Date;
  runCrew: any; // Will be spread, so any is acceptable here
};

type ManagerLite = {
  runCrewId: string;
  role: string;
};

export async function getAthleteById(athleteId: string) {
  return prisma.athlete.findUnique({
    where: { id: athleteId },
  });
}

export async function getAthleteByFirebaseId(firebaseId: string) {
  return prisma.athlete.findUnique({
    where: { firebaseId },
  });
}

export async function createAthlete(data: {
  firebaseId: string;
  email: string;
  firstName?: string;
  lastName?: string;
}) {
  return prisma.athlete.create({
    data,
  });
}

export async function hydrateAthlete(athleteId: string) {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    include: {
      runCrewMemberships: {
        include: {
          runCrew: {
            include: {
              managers: true,
              memberships: {
                include: {
                  athlete: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      photoURL: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      runCrewManagers: {
        include: {
          runCrew: true,
        },
      },
      activities: {
        where: {
          startTime: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: {
          startTime: 'desc',
        },
      },
    },
  });

  if (!athlete) {
    return null;
  }

  // Calculate weekly totals
  const weeklyTotals = athlete.activities.reduce(
    (
      acc: { distance: number; duration: number; activities: number },
      activity: ActivityLite
    ) => {
      return {
        distance: acc.distance + (activity.distance || 0),
        duration: acc.duration + (activity.duration || 0),
        activities: acc.activities + 1,
      };
    },
    { distance: 0, duration: 0, activities: 0 }
  );

  // Normalize crews with roles
  const crews = athlete.runCrewMemberships.map(
    (membership: MembershipLite) => {
      const managerRole = athlete.runCrewManagers.find(
        (m: ManagerLite) => m.runCrewId === membership.runCrewId
      );
      return {
        ...membership.runCrew,
        role: managerRole?.role || 'member',
        joinedAt: membership.joinedAt,
      };
    }
  );

  return {
    athlete: {
      id: athlete.id,
      firebaseId: athlete.firebaseId,
      email: athlete.email,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      photoURL: athlete.photoURL,
      gofastHandle: athlete.gofastHandle,
      city: athlete.city,
      state: athlete.state,
      primarySport: athlete.primarySport,
      bio: athlete.bio,
      garmin_is_connected: athlete.garmin_is_connected,
    },
    crews,
    weeklyActivities: athlete.activities,
    weeklyTotals,
  };
}

export async function updateAthlete(athleteId: string, data: any) {
  return prisma.athlete.update({
    where: { id: athleteId },
    data,
  });
}

