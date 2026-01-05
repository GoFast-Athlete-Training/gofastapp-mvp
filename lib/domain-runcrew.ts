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

export async function hydrateCrew(runCrewId: string) {
  // First, try to get messageTopics safely using raw query (column may not exist)
  let messageTopics = ['#general', '#runs', '#training tips', '#myvictories', '#social'];
  try {
    const crewWithTopics = await prisma.$queryRaw<Array<{ messageTopics: any }>>`
      SELECT messageTopics FROM run_crews WHERE id = ${runCrewId} LIMIT 1
    `;
    if (crewWithTopics && crewWithTopics[0]?.messageTopics) {
      const topics = crewWithTopics[0].messageTopics;
      if (Array.isArray(topics)) {
        messageTopics = topics;
      } else if (typeof topics === 'string') {
        try {
          messageTopics = JSON.parse(topics);
        } catch {
          // Use default if parsing fails
        }
      }
    }
  } catch (err: any) {
    // Column doesn't exist or query failed - use default
    // This is expected if migration hasn't been run yet
    console.log('ℹ️ messageTopics column not available, using default topics');
  }

  // Use select to explicitly choose fields, excluding messageTopics to avoid Prisma error
  const crew = await prisma.run_crews.findUnique({
    where: { id: runCrewId },
    select: {
      id: true,
      name: true,
      description: true,
      joinCode: true,
      logo: true,
      icon: true,
      archivedAt: true,
      // Explicitly exclude messageTopics to avoid column not found error
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
      run_crew_messages: {
        select: {
          id: true,
          runCrewId: true,
          athleteId: true,
          content: true,
          topic: true,
          createdAt: true,
          // updatedAt excluded until migration runs - will add back after migration
          // updatedAt: true, // Track when message was edited
          Athlete: {
            select: {
              id: true,
              firstName: true,
              gofastHandle: true,
              photoURL: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50,
      },
      run_crew_announcements: {
        where: {
          archivedAt: null, // Only show active announcements (archivedAt is null)
        },
        include: {
          Athlete: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              photoURL: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1, // Only one active announcement per crew
      },
      run_crew_runs: {
        include: {
          Athlete: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              photoURL: true,
            },
          },
          run_crew_run_rsvps: {
            include: {
              Athlete: {
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
        orderBy: {
          date: 'asc',
        },
      },
      join_codes: true,
    },
  });

  if (!crew) {
    return null;
  }

  // Map Prisma result to box-grouped response
  const response = {
    runCrewBaseInfo: {
      runCrewId: crew.id,
      name: crew.name,
      description: crew.description,
      joinCode: crew.joinCode,
      logo: crew.logo,
      icon: crew.icon,
      archivedAt: crew.archivedAt,
      messageTopics,
    },
    membershipsBox: {
      memberships: crew.run_crew_memberships,
    },
    messagesBox: {
      messages: crew.run_crew_messages,
    },
    announcementsBox: {
      announcements: crew.run_crew_announcements,
    },
    runsBox: {
      runs: crew.run_crew_runs,
    },
    joinCodesBox: {
      joinCodes: crew.join_codes,
    },
  };

  // Normalize Prisma snake_case relations to camelCase for frontend
  return normalizeCrewResponse(response);
}

export async function getCrewById(runCrewId: string) {
  return prisma.run_crews.findUnique({
    where: { id: runCrewId },
  });
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

export async function createRun(data: {
  runCrewId: string;
  createdById: string;
  title: string;
  date: Date;
  startTime: string;
  meetUpPoint: string;
  meetUpAddress?: string;
  totalMiles?: number;
  pace?: string;
  stravaMapUrl?: string;
  description?: string;
}) {
  return prisma.run_crew_runs.create({
    data,
  });
}

export async function postMessage(data: {
  runCrewId: string;
  athleteId: string;
  content: string;
  topic?: string;
}) {
  return prisma.run_crew_messages.create({
    data: {
      runCrewId: data.runCrewId,
      athleteId: data.athleteId,
      content: data.content,
      topic: data.topic || 'general',
    },
    include: {
      Athlete: {
        select: {
          id: true,
          firstName: true,
          gofastHandle: true,
          photoURL: true,
        },
      },
    },
  });
}

export async function postAnnouncement(data: {
  runCrewId: string;
  authorId: string;
  title: string;
  content: string;
}) {
  // Archive all existing active announcements for this crew (where archivedAt is null)
  await prisma.run_crew_announcements.updateMany({
    where: {
      runCrewId: data.runCrewId,
      archivedAt: null, // Only archive active announcements
    },
    data: {
      archivedAt: new Date(),
    },
  });

  // Create new active announcement (archivedAt is null by default)
  return prisma.run_crew_announcements.create({
    data,
    include: {
      Athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          photoURL: true,
        },
      },
    },
  });
}

export async function createEvent(data: {
  runCrewId: string;
  organizerId: string;
  title: string;
  date: Date;
  time: string;
  location: string;
  address?: string;
  description?: string;
  eventType?: string;
}) {
  return prisma.run_crew_events.create({
    data,
    include: {
      Athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          photoURL: true,
        },
      },
      run_crew_event_rsvps: {
        include: {
          Athlete: {
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
}

export async function rsvpToRun(data: {
  runId: string;
  athleteId: string;
  status: 'going' | 'maybe' | 'not-going';
}) {
  return prisma.run_crew_run_rsvps.upsert({
    where: {
      runId_athleteId: {
        runId: data.runId,
        athleteId: data.athleteId,
      },
    },
    create: data,
    update: {
      status: data.status,
    },
    include: {
      Athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          photoURL: true,
        },
      },
    },
  });
}

