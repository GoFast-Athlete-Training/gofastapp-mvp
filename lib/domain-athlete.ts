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
        // TODO: activities will be reintroduced in Schema Phase 3
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
          // TODO: activities will be reintroduced in Schema Phase 3
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

  // TODO: Activities will be reintroduced in Schema Phase 3
  // Calculate weekly totals
  const weeklyTotals = { distance: 0, duration: 0, activities: 0 };

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

  // Determine MyCrew (primary crew) - first crew or most recent, prioritizing admin crews
  let MyCrew = '';
  let MyCrewManagerId = '';
  
  if (crews.length > 0) {
    // Prioritize admin crews, then most recent
    const adminCrew = crews.find((c: any) => c.role === 'admin');
    if (adminCrew) {
      MyCrew = adminCrew.id;
      const manager = athlete.runCrewManagers?.find((m: any) => m.runCrewId === adminCrew.id);
      MyCrewManagerId = manager?.id || '';
    } else {
      // Use most recent crew
      const mostRecent = crews.sort((a: any, b: any) => 
        new Date(b.joinedAt || 0).getTime() - new Date(a.joinedAt || 0).getTime()
      )[0];
      MyCrew = mostRecent.id;
      const manager = athlete.runCrewManagers?.find((m: any) => m.runCrewId === mostRecent.id);
      MyCrewManagerId = manager?.id || '';
    }
  }

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
    runCrewMemberships: (hasRunCrewTables ? athlete.runCrewMemberships : []) || [],
    
    // Primary crew context (for localStorage)
    MyCrew: MyCrew,
    MyCrewManagerId: MyCrewManagerId,
    
    // TODO: Activities will be reintroduced in Schema Phase 3
    // Weekly Activities (last 7 days)
    weeklyActivities: [],
    weeklyActivityCount: 0,
    weeklyTotals: {
      totalDistance: 0,
      totalDistanceMiles: '0.00',
      totalDuration: 0,
      totalCalories: 0,
      activityCount: 0,
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

