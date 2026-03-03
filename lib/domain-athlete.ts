import { prisma } from './prisma';
import { normalizeAthleteMemberships } from './normalize-prisma';

// Generate a simple unique ID (cuid-like format)
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `c${timestamp}${random}`;
}

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
    data: {
      ...data,
      id: generateId(),
      updatedAt: new Date(),
    },
  });
}

export async function hydrateAthlete(athleteId: string) {
  // Try to hydrate with RunCrew includes, but fallback if tables don't exist
  let athlete: any;
  let hasRunCrewTables = true;
  
  try {
    console.log('🔍 HYDRATE ATHLETE: Loading athlete with RunCrew relations for:', athleteId);
    athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      include: {
        go_fast_companies: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        runClub: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        run_crew_memberships: {
          include: {
            run_crews: {
              select: {
                // Explicitly select fields, excluding messageTopics to avoid column not found error
                id: true,
                name: true,
                description: true,
                joinCode: true,
                logo: true,
                icon: true,
                // messageTopics excluded - column may not exist in database
                run_crew_memberships: {
                  include: {
                    Athlete: {
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
        // TODO: activities will be reintroduced in Schema Phase 3
      },
    });
    
    // Check if RunCrew data was loaded successfully
    if (athlete) {
      console.log('✅ HYDRATE ATHLETE: Athlete loaded successfully');
      console.log(`   RunCrew Memberships: ${athlete.run_crew_memberships?.length || 0}`);
      
      // Log each membership for debugging
      if (athlete.run_crew_memberships && Array.isArray(athlete.run_crew_memberships)) {
        athlete.run_crew_memberships.forEach((membership: any, index: number) => {
          console.log(`   Membership ${index + 1}:`, {
            id: membership.id,
            runCrewId: membership.runCrewId,
            role: membership.role,
            hasRunCrew: !!membership.run_crews,
            runCrewName: membership.run_crews?.name || 'N/A'
          });
        });
      }
      
      // If athlete loaded but run_crew_memberships is undefined, tables might not exist
      if (athlete.run_crew_memberships === undefined) {
        console.warn('⚠️ HYDRATE ATHLETE: runCrewMemberships is undefined - RunCrew tables may not exist');
        hasRunCrewTables = false;
      }
    }
  } catch (error: any) {
    console.error('❌ HYDRATE ATHLETE: Error loading athlete with RunCrew:', error?.message);
    console.error('   Error code:', error?.code);
    console.error('   Error meta:', error?.meta);
    
    // If the error is about missing RunCrew tables or relation errors, retry without them
    const errorMessage = error?.message || '';
    const errorCode = error?.code || '';
    
    if (
      errorMessage.includes('RunCrewMembership') || 
      errorMessage.includes('does not exist') ||
      errorMessage.includes('messageTopics') ||
      errorMessage.includes('Unknown arg') ||
      errorCode === 'P2021' || // Table does not exist
      errorCode === 'P2022' || // Column does not exist
      errorCode === 'P2009'    // Query validation error
    ) {
      console.warn('⚠️ HYDRATE ATHLETE: RunCrew tables not accessible, hydrating without RunCrew data');
      hasRunCrewTables = false;
      try {
        athlete = await prisma.athlete.findUnique({
          where: { id: athleteId },
          include: {
            go_fast_companies: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            runClub: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            // TODO: activities will be reintroduced in Schema Phase 3
          },
        });
        console.log('✅ HYDRATE ATHLETE: Athlete loaded without RunCrew data');
      } catch (retryError: any) {
        console.error('❌ HYDRATE ATHLETE: Failed to load athlete even without RunCrew:', retryError?.message);
        throw retryError;
      }
    } else {
      // Re-throw if it's a different error
      console.error('❌ HYDRATE ATHLETE: Unexpected error, re-throwing');
      throw error;
    }
  }

  if (!athlete) {
    return null;
  }

  // Load activity stream (last 30 days) for weekly totals and list
  let activityList: Array<{ startTime: Date | null; duration: number | null; distance: number | null; activityType: string | null; activityName: string | null; id: string; sourceActivityId: string }> = [];
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    activityList = await prisma.athlete_activities.findMany({
      where: { athleteId: athlete.id, startTime: { gte: thirtyDaysAgo } },
      orderBy: { startTime: 'desc' },
      select: {
        id: true,
        sourceActivityId: true,
        activityType: true,
        activityName: true,
        startTime: true,
        duration: true,
        distance: true,
      },
    });
  } catch {
    // Table or relation may not exist in some envs
  }

  const METERS_PER_MILE = 1609.34;
  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setHours(0, 0, 0, 0);
  startOfThisWeek.setDate(now.getDate() - now.getDay());
  const endOfThisWeek = new Date(startOfThisWeek);
  endOfThisWeek.setDate(endOfThisWeek.getDate() + 7);

  const thisWeekActivities = activityList.filter(
    (a) => a.startTime && a.startTime >= startOfThisWeek && a.startTime < endOfThisWeek
  );
  const totalDistanceMeters = thisWeekActivities.reduce((sum, a) => sum + (a.distance ?? 0), 0);
  const totalDurationSeconds = thisWeekActivities.reduce((sum, a) => sum + (a.duration ?? 0), 0);
  const weeklyTotals = {
    distance: totalDistanceMeters,
    duration: totalDurationSeconds,
    activities: thisWeekActivities.length,
    totalDistance: totalDistanceMeters,
    totalDistanceMiles: (totalDistanceMeters / METERS_PER_MILE).toFixed(2),
    totalDuration: totalDurationSeconds,
    totalCalories: 0,
    activityCount: thisWeekActivities.length,
  };
  const weeklyActivities = activityList.slice(0, 50).map((a) => ({
    id: a.id,
    sourceActivityId: a.sourceActivityId,
    activityType: a.activityType,
    activityName: a.activityName,
    startTime: a.startTime,
    duration: a.duration,
    distance: a.distance,
  }));

  // Normalize crews with roles (handle case where tables don't exist)
  const crews = hasRunCrewTables && athlete.run_crew_memberships && Array.isArray(athlete.run_crew_memberships)
    ? athlete.run_crew_memberships.map((membership: any, index: number) => {
        if (!membership) {
          console.warn(`⚠️ HYDRATE ATHLETE: Membership ${index + 1} is null/undefined`);
          return null;
        }
        if (!membership.run_crews) {
          console.warn(`⚠️ HYDRATE ATHLETE: Membership ${index + 1} (ID: ${membership.id}) missing run_crews relation:`, {
            membershipId: membership.id,
            runCrewId: membership.runCrewId,
            role: membership.role,
            hasRunCrew: false
          });
          return null;
        }
        const crew = {
          ...membership.run_crews,
          role: membership.role || 'member',
          joinedAt: membership.joinedAt,
        };
        console.log(`✅ HYDRATE ATHLETE: Processed membership ${index + 1}: ${crew.name} (role: ${crew.role})`);
        return crew;
      }).filter((crew: any) => crew !== null) // Filter out any null entries
    : [];
  
  console.log(`✅ HYDRATE ATHLETE: Processed ${crews.length} RunCrew memberships out of ${athlete.run_crew_memberships?.length || 0} total`);

  // Determine MyCrew (primary crew) - first crew or most recent, prioritizing admin crews
  let MyCrew = '';
  
  if (crews.length > 0) {
    // Prioritize admin crews, then most recent
    const adminCrew = crews.find((c: any) => c.role === 'admin');
    if (adminCrew) {
      MyCrew = adminCrew.id;
    } else {
      // Use most recent crew
      const mostRecent = crews.sort((a: any, b: any) => 
        new Date(b.joinedAt || 0).getTime() - new Date(a.joinedAt || 0).getTime()
      )[0];
      MyCrew = mostRecent.id;
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
    role: athlete.role ?? undefined,
    runClubId: athlete.runClubId ?? undefined,
    runClub: athlete.runClub ? { id: athlete.runClub.id, name: athlete.runClub.name, slug: athlete.runClub.slug } : undefined,
    
    // RunCrew Memberships (hydrated) - empty if tables don't exist
    runCrews: crews,
    runCrewCount: crews.length,
    runCrewMemberships: (hasRunCrewTables ? normalizeAthleteMemberships(athlete.run_crew_memberships || []) : []) || [],
    
    // Debug: Log membership count
    _debug: {
      totalMemberships: athlete.run_crew_memberships?.length || 0,
      validMemberships: crews.length,
      membershipsWithRunCrew: athlete.run_crew_memberships?.filter((m: any) => m?.run_crews).length || 0
    },
    
    // Primary crew context (for localStorage)
    MyCrew: MyCrew,
    
    // Activity stream and weekly totals (from athlete_activities)
    weeklyActivities,
    weeklyActivityCount: weeklyActivities.length,
    weeklyTotals,
    
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

