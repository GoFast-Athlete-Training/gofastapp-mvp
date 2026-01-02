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

export async function hydrateCrew(runCrewId: string, athleteId?: string) {
  const crew = await prisma.runCrew.findUnique({
    where: { id: runCrewId },
    include: {
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
        orderBy: {
          createdAt: 'desc',
        },
        take: 50, // Last 50 messages
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
        take: 10, // Last 10 announcements
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
    },
  });

  if (!crew) {
    return null;
  }

  // Determine user's role from membership
  let userRole = 'member';
  if (athleteId) {
    const membership = crew.memberships.find(
      (m) => m.athleteId === athleteId
    );
    userRole = membership?.role || 'member';
  }

  return {
    ...crew,
    userRole,
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
}) {
  return prisma.runCrewMessage.create({
    data,
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

