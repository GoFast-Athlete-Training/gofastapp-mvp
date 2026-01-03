import { prisma } from './prisma';

export async function createCrew(data: {
  name: string;
  description?: string;
  joinCode: string;
  athleteId: string;
}) {
  // Create the crew
  const crew = await prisma.runCrew.create({
    data: {
      name: data.name,
      description: data.description,
      joinCode: data.joinCode,
    },
  });

  // Create membership with admin role
  await prisma.runCrewMembership.create({
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
  const crew = await prisma.runCrew.findUnique({
    where: { joinCode },
  });

  if (!crew) {
    throw new Error('Crew not found');
  }

  // Check if already a member
  const existingMembership = await prisma.runCrewMembership.findUnique({
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
  await prisma.runCrewMembership.create({
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
  let messageTopics = ['general', 'runs', 'social'];
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
  const crew = await prisma.runCrew.findUnique({
    where: { id: runCrewId },
    select: {
      id: true,
      name: true,
      description: true,
      joinCode: true,
      logo: true,
      icon: true,
      // Explicitly exclude messageTopics to avoid column not found error
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
      messages: {
        select: {
          id: true,
          runCrewId: true,
          athleteId: true,
          content: true,
          topic: true,
          createdAt: true,
          updatedAt: true, // Track when message was edited
          athlete: {
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
      announcements: {
        include: {
          author: {
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
        take: 10,
      },
      runs: {
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          rsvps: {
            include: {
              athlete: {
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
      joinCodes: true,
    },
  });

  if (!crew) {
    return null;
  }

  // Map Prisma result to box-grouped response
  return {
    meta: {
      runCrewId: crew.id,
      name: crew.name,
      description: crew.description,
      joinCode: crew.joinCode,
      logo: crew.logo,
      icon: crew.icon,
      messageTopics,
    },
    membershipsBox: {
      memberships: crew.memberships,
    },
    messagesBox: {
      messages: crew.messages,
    },
    announcementsBox: {
      announcements: crew.announcements,
    },
    runsBox: {
      runs: crew.runs,
    },
    joinCodesBox: {
      joinCodes: crew.joinCodes,
    },
  };
}

export async function getCrewById(runCrewId: string) {
  return prisma.runCrew.findUnique({
    where: { id: runCrewId },
  });
}

/**
 * Get public crew metadata - returns only safe, public information
 * No memberships, messages, or sensitive data
 */
export async function getCrewPublicMetadata(runCrewId: string) {
  const crew = await prisma.runCrew.findUnique({
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
  const crew = await prisma.runCrew.findUnique({
    where: { id: runCrewId },
  });

  if (!crew) {
    throw new Error('Crew not found');
  }

  // Check if already a member
  const existingMembership = await prisma.runCrewMembership.findUnique({
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
  await prisma.runCrewMembership.create({
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
  description?: string;
}) {
  return prisma.runCrewRun.create({
    data,
  });
}

export async function postMessage(data: {
  runCrewId: string;
  athleteId: string;
  content: string;
  topic?: string;
}) {
  return prisma.runCrewMessage.create({
    data: {
      runCrewId: data.runCrewId,
      athleteId: data.athleteId,
      content: data.content,
      topic: data.topic || 'general',
    },
    include: {
      athlete: {
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
  return prisma.runCrewAnnouncement.create({
    data,
    include: {
      author: {
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
  return prisma.runCrewEvent.create({
    data,
    include: {
      organizer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          photoURL: true,
        },
      },
      rsvps: {
        include: {
          athlete: {
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
  return prisma.runCrewRunRSVP.upsert({
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
      athlete: {
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

