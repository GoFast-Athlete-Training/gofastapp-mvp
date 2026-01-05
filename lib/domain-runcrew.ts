import { prisma } from './prisma';
import { normalizeCrewResponse } from './normalize-prisma';

export async function createCrew(data: {
  name: string;
  description?: string;
  joinCode: string;
  athleteId: string;
  city?: string;
  state?: string;
  paceMin?: number;
  paceMax?: number;
  gender?: string;
  ageMin?: number;
  ageMax?: number;
  primaryMeetUpPoint?: string;
  primaryMeetUpAddress?: string;
  primaryMeetUpPlaceId?: string;
  primaryMeetUpLat?: number;
  primaryMeetUpLng?: number;
  purpose?: string[];
  timePreference?: string[];
  typicalRunMiles?: number;
  longRunMilesMin?: number;
  longRunMilesMax?: number;
  trainingForRace?: string;
  trainingForDistance?: string[];
}) {
  // Create the crew
  const crew = await prisma.run_crews.create({
    data: {
      name: data.name,
      description: data.description,
      joinCode: data.joinCode,
      city: data.city,
      state: data.state as any, // Prisma will validate enum
      paceMin: data.paceMin,
      paceMax: data.paceMax,
      gender: data.gender as any, // Prisma will validate enum
      ageMin: data.ageMin,
      ageMax: data.ageMax,
      primaryMeetUpPoint: data.primaryMeetUpPoint,
      primaryMeetUpAddress: data.primaryMeetUpAddress,
      primaryMeetUpPlaceId: data.primaryMeetUpPlaceId,
      primaryMeetUpLat: data.primaryMeetUpLat,
      primaryMeetUpLng: data.primaryMeetUpLng,
      purpose: data.purpose as any || [],
      timePreference: data.timePreference as any || [],
      typicalRunMiles: data.typicalRunMiles,
      longRunMilesMin: data.longRunMilesMin,
      longRunMilesMax: data.longRunMilesMax,
      trainingForRace: data.trainingForRace || null,
      trainingForDistance: data.trainingForDistance as any || [],
    },
  });

  // Create membership with admin role
  await prisma.run_crew_memberships.create({
    data: {
      runCrewId: crew.id,
      athleteId: data.athleteId,
      role: 'admin',
    },
  });

  return crew;
}

export async function joinCrew(joinCode: string, athleteId: string) {
  // Find crew by join code
  const crew = await prisma.run_crews.findUnique({
    where: { joinCode },
  });

  if (!crew) {
    throw new Error('Crew not found');
  }

  // Check if already a member
  const existingMembership = await prisma.run_crew_memberships.findUnique({
    where: {
      runCrewId_athleteId: {
        runCrewId: crew.id,
        athleteId,
      },
    },
  });

  if (existingMembership) {
    return crew;
  }

  // Create membership with member role
  await prisma.run_crew_memberships.create({
    data: {
      runCrewId: crew.id,
      athleteId,
      role: 'member',
    },
  });

  return crew;
}

/**
 * Get discoverable runcrews - public listing for discovery page
 * Returns non-archived crews with public metadata and member counts
 */
export async function getDiscoverableRunCrews(options?: {
  limit?: number;
  city?: string;
  state?: string;
}) {
  const limit = options?.limit || 50;

  // Build where clause with optional filters
  const where: any = {
    archivedAt: null, // Only show active crews
  };

  if (options?.city) {
    where.city = {
      contains: options.city,
      mode: 'insensitive',
    };
  }

  if (options?.state) {
    where.state = options.state;
  }

  // Get non-archived crews with member counts
  const crews = await prisma.run_crews.findMany({
    where,
    select: {
      id: true,
      name: true,
      description: true,
      logo: true,
      icon: true,
      city: true,
      state: true,
      paceMin: true,
      paceMax: true,
      gender: true,
      ageMin: true,
      ageMax: true,
      primaryMeetUpPoint: true,
      primaryMeetUpAddress: true,
      purpose: true,
      timePreference: true,
      typicalRunMiles: true,
      createdAt: true,
      _count: {
        select: {
          run_crew_memberships: true, // Get member count
        },
      },
    },
    orderBy: [
      { createdAt: 'desc' }, // Most recent first
    ],
    take: limit,
  });

  // Format pace from seconds to MM:SS format
  const formatPace = (seconds?: number | null): string | null => {
    if (!seconds) return null;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Format response with public-safe data
  return crews.map((crew) => ({
    id: crew.id,
    name: crew.name,
    description: crew.description,
    logo: crew.logo,
    icon: crew.icon,
    city: crew.city,
    state: crew.state,
    paceRange: crew.paceMin && crew.paceMax
      ? `${formatPace(crew.paceMin)} - ${formatPace(crew.paceMax)} min/mile`
      : crew.paceMin
      ? `${formatPace(crew.paceMin)}+ min/mile`
      : crew.paceMax
      ? `Up to ${formatPace(crew.paceMax)} min/mile`
      : null,
    gender: crew.gender,
    ageRange: crew.ageMin && crew.ageMax
      ? `${crew.ageMin}-${crew.ageMax}`
      : crew.ageMin
      ? `${crew.ageMin}+`
      : crew.ageMax
      ? `Up to ${crew.ageMax}`
      : null,
    primaryMeetUpPoint: crew.primaryMeetUpPoint,
    primaryMeetUpAddress: crew.primaryMeetUpAddress,
    purpose: crew.purpose,
    timePreference: crew.timePreference,
    typicalRunMiles: crew.typicalRunMiles,
    memberCount: crew._count.run_crew_memberships,
    createdAt: crew.createdAt,
  }));
}

export async function getCrewById(runCrewId: string) {
  const crew = await prisma.run_crews.findUnique({
    where: { id: runCrewId },
    include: {
      run_crew_memberships: {
        include: {
          athletes: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              photoURL: true,
              city: true,
              state: true,
            },
          },
        },
      },
      run_crew_messages: {
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          athletes: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              photoURL: true,
            },
          },
        },
      },
      run_crew_announcements: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          athletes: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              photoURL: true,
            },
          },
        },
      },
      run_crew_runs: {
        orderBy: { date: 'asc' },
        include: {
          athletes: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              photoURL: true,
            },
          },
        },
      },
    },
  });

  if (!crew) {
    return null;
  }

  return normalizeCrewResponse(crew);
}

/**
 * Get public crew metadata - returns only safe, public information
 * No memberships, messages, or sensitive data
 */
export async function getCrewPublicMetadata(runCrewId: string) {
  const crew = await prisma.run_crews.findUnique({
    where: { id: runCrewId },
    select: {
      id: true,
      name: true,
      description: true,
      logo: true,
      icon: true,
      joinCode: true,
      // Exclude: memberships, messages, announcements, runs, managers, etc.
    },
  });

  if (!crew) {
    return null;
  }

  // Return only public fields
  return {
    id: crew.id,
    name: crew.name,
    description: crew.description,
    logo: crew.logo,
    icon: crew.icon,
    joinCode: crew.joinCode, // Include for manual join fallback
  };
}

/**
 * Join crew by crewId (instead of joinCode)
 * This is the new InviteLink flow
 */
export async function joinCrewById(runCrewId: string, athleteId: string) {
  // Find crew by id
  const crew = await prisma.run_crews.findUnique({
    where: { id: runCrewId },
  });

  if (!crew) {
    throw new Error('Crew not found');
  }

  // Check if already a member
  const existingMembership = await prisma.run_crew_memberships.findUnique({
    where: {
      runCrewId_athleteId: {
        runCrewId: crew.id,
        athleteId,
      },
    },
  });

  if (existingMembership) {
    return crew;
  }

  // Create membership with member role
  await prisma.run_crew_memberships.create({
    data: {
      runCrewId: crew.id,
      athleteId,
      role: 'member',
    },
  });

  return crew;
}
