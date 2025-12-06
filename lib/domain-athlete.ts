import { prisma } from './prisma';

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
  email?: string;
  firstName?: string;
  lastName?: string;
  companyId: string;
}) {
  return prisma.athlete.create({
    data,
  });
}

export async function hydrateAthlete(athleteId: string) {
  // Try to hydrate with RunCrew includes, but fallback if tables don't exist
  let athlete: any;
  let hasRunCrewTables = true;
  
  try {
    athlete = await prisma.athlete.findUnique({
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
              not: null,
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
          orderBy: {
            startTime: 'desc',
          },
        },
      },
    });
  } catch (error: any) {
    // If the error is about missing RunCrew tables, retry without them
    if (error?.message?.includes('RunCrewMembership') || 
        error?.message?.includes('does not exist')) {
      console.warn('RunCrew tables not found, hydrating without RunCrew data');
      hasRunCrewTables = false;
      athlete = await prisma.athlete.findUnique({
        where: { id: athleteId },
        include: {
          activities: {
            where: {
              startTime: {
                not: null,
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
              },
            },
            orderBy: {
              startTime: 'desc',
            },
          },
        },
      });
    } else {
      // Re-throw if it's a different error
      throw error;
    }
  }

  if (!athlete) {
    return null;
  }

  // Calculate weekly totals
  const weeklyTotals = (athlete.activities || []).reduce(
    (
      acc: { distance: number; duration: number; activities: number },
      activity
    ) => {
      return {
        distance: acc.distance + (activity.distance ?? 0),
        duration: acc.duration + (activity.duration ?? 0),
        activities: acc.activities + 1,
      };
    },
    { distance: 0, duration: 0, activities: 0 }
  );

  // Normalize crews with roles (handle case where tables don't exist)
  const crews = hasRunCrewTables && athlete.runCrewMemberships
    ? athlete.runCrewMemberships.map((membership: any) => {
        const managerRole = (athlete.runCrewManagers || []).find(
          (m: any) => m.runCrewId === membership.runCrewId
        );
        return {
          ...membership.runCrew,
          role: managerRole?.role || 'member',
          joinedAt: membership.joinedAt,
        };
      })
    : [];

  // Format athlete data for frontend consumption (matching MVP1 backend structure)
  const hydratedAthlete = {
    athleteId: athlete.id, // MVP1 uses athleteId as central identifier
    id: athlete.id,
    firebaseId: athlete.firebaseId,
    email: athlete.email,
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    gofastHandle: athlete.gofastHandle,
    birthday: athlete.birthday,
    gender: athlete.gender,
    city: athlete.city,
    state: athlete.state,
    primarySport: athlete.primarySport,
    photoURL: athlete.photoURL,
    bio: athlete.bio,
    instagram: athlete.instagram,
    companyId: athlete.companyId,
    createdAt: athlete.createdAt,
    updatedAt: athlete.updatedAt,
    
    // RunCrew Memberships (hydrated) - empty if tables don't exist
    runCrews: crews,
    runCrewCount: crews.length,
    runCrewManagers: (hasRunCrewTables ? athlete.runCrewManagers : []) || [],
    
    // Weekly Activities (last 7 days)
    weeklyActivities: athlete.activities || [],
    weeklyActivityCount: (athlete.activities || []).length,
    weeklyTotals: {
      totalDistance: weeklyTotals.distance,
      totalDistanceMiles: (weeklyTotals.distance / 1609.34).toFixed(2), // Convert meters to miles
      totalDuration: weeklyTotals.duration,
      totalCalories: (athlete.activities || []).reduce((sum: number, a: any) => sum + (a.calories ?? 0), 0),
      activityCount: weeklyTotals.activities,
    },
    
    // Garmin connection status
    garmin_is_connected: athlete.garmin_is_connected || false,
    garmin_user_id: athlete.garmin_user_id,
    garmin_connected_at: athlete.garmin_connected_at,
    
    // Computed fields
    fullName: athlete.firstName && athlete.lastName 
      ? `${athlete.firstName} ${athlete.lastName}` 
      : 'No Name Set',
    profileComplete: !!(athlete.firstName && athlete.lastName),
    hasLocation: !!(athlete.city && athlete.state),
    hasSport: !!athlete.primarySport,
    hasBio: !!athlete.bio,
  };

  return {
    athlete: hydratedAthlete,
  };
}

export async function updateAthlete(athleteId: string, data: any) {
  return prisma.athlete.update({
    where: { id: athleteId },
    data,
  });
}

