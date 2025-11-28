import { prisma } from './prisma';

// Lightweight type for type safety
type ManagerLite = {
  athleteId: string;
  role: string;
};

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

  // Create membership
  await prisma.runCrewMembership.create({
    data: {
      runCrewId: crew.id,
      athleteId: data.athleteId,
    },
  });

  // Create admin role
  await prisma.runCrewManager.create({
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

  // Create membership
  await prisma.runCrewMembership.create({
    data: {
      runCrewId: crew.id,
      athleteId,
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
      managers: {
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

  // Determine user's role
  let userRole = 'member';
  if (athleteId) {
    const manager = crew.managers.find(
      (m: ManagerLite) => m.athleteId === athleteId
    );
    userRole = manager?.role || 'member';
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

