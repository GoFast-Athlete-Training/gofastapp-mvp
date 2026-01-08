import { prisma } from './prisma';
import { normalizeCrewResponse } from './normalize-prisma';
import { secondsToPace } from '@/utils/formatPace';

/**
 * Generate a shareable invite link for a RunCrew using handle
 * Server-side helper function for generating join links
 * 
 * @param handle - The RunCrew handle (public-facing identifier)
 * @returns The join link path: /join/runcrew/{handle}
 * 
 * @example
 * const link = getRunCrewJoinLink('boston-runners');
 * // Returns: '/join/runcrew/boston-runners'
 */
export function getRunCrewJoinLink(handle: string): string {
  if (!handle) {
    throw new Error('handle is required');
  }
  return `/join/runcrew/${handle}`;
}

/**
 * Resolve RunCrew by handle (public-facing identifier)
 * Returns the runCrewId for internal use
 * 
 * @param handle - The RunCrew handle (lowercase, unique)
 * @returns The runCrewId or null if not found
 */
export async function resolveRunCrewByHandle(handle: string): Promise<string | null> {
  if (!handle) {
    return null;
  }
  
  const crew = await prisma.run_crews.findUnique({
    where: { handle: handle.toLowerCase() },
    select: { id: true },
  });
  
  return crew?.id || null;
}

/**
 * Get public metadata by handle
 * Fetches minimal crew metadata using handle instead of ID
 * 
 * @param handle - The RunCrew handle
 * @returns Public metadata or null if not found
 */
export async function getCrewPublicMetadataByHandle(handle: string) {
  const crew = await prisma.run_crews.findUnique({
    where: { handle: handle.toLowerCase() },
    select: {
      id: true,
      handle: true,
      name: true,
      description: true,
      logo: true,
      icon: true,
      joinCode: true,
      city: true,
      state: true,
      easyMilesPace: true, // Seconds per mile
      crushingItPace: true, // Seconds per mile
      purpose: true, // Array of Purpose enum
      // Exclude: memberships, messages, announcements, runs, managers, etc.
    },
  });

  if (!crew) {
    return null;
  }

  // Return only public fields
  // NOTE: Leader info removed for now - will be added via proper hydration pattern
  return {
    id: crew.id,
    handle: crew.handle,
    name: crew.name,
    description: crew.description,
    logo: crew.logo,
    icon: crew.icon,
    joinCode: crew.joinCode,
    city: crew.city,
    state: crew.state,
    easyMilesPace: crew.easyMilesPace,
    crushingItPace: crew.crushingItPace,
    purpose: crew.purpose,
    // leader: removed - see RUNCREW_LEADER_HYDRATION_ANALYSIS.md
  };
}

/**
 * Generate a unique join code for backward compatibility
 * Uses crew name initials + random string
 */
function generateJoinCode(name: string): string {
  // Get first 3 letters of name, uppercase, remove spaces
  const initials = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, 'X');
  
  // Add random 4-digit number
  const random = Math.floor(1000 + Math.random() * 9000);
  
  return `${initials}${random}`;
}

/**
 * Generate a handle from crew name
 * Converts to lowercase, removes special chars, handles collisions
 */
function generateHandle(name: string): string {
  // Convert to lowercase, remove special chars, replace spaces with hyphens
  let base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  
  // Ensure minimum length
  if (base.length < 3) {
    base = base + '-crew';
  }
  
  return base;
}

export async function createCrew(data: {
  name: string;
  handle?: string; // Optional - auto-generated from name if not provided
  description?: string;
  joinCode?: string; // Optional - auto-generated if not provided
  athleteId: string;
  city?: string;
  state?: string;
  easyMilesPace?: number;  // Seconds per mile (e.g., 480 for "8:00")
  crushingItPace?: number;  // Seconds per mile (e.g., 420 for "7:00")
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
  // Generate handle if not provided
  let handle = data.handle?.toLowerCase().trim();
  if (!handle) {
    // Generate unique handle - keep trying until we get a unique one
    let attempts = 0;
    const baseHandle = generateHandle(data.name);
    handle = baseHandle;
    
    while (attempts < 20) {
      const existing = await prisma.run_crews.findUnique({
        where: { handle },
      });
      if (!existing) {
        break; // Found unique handle
      }
      // Append number to make unique
      handle = `${baseHandle}-${attempts + 1}`;
      attempts++;
    }
    
    // Final fallback
    if (attempts >= 20) {
      handle = `${baseHandle}-${Date.now()}`;
    }
  } else {
    // Validate handle is unique
    const existing = await prisma.run_crews.findUnique({
      where: { handle },
    });
    if (existing) {
      throw new Error(`Handle "${handle}" is already taken`);
    }
  }

  // Auto-generate joinCode if not provided (for backward compatibility)
  let joinCode = data.joinCode;
  if (!joinCode) {
    // Generate unique code - keep trying until we get a unique one
    let attempts = 0;
    while (!joinCode && attempts < 10) {
      const candidate = generateJoinCode(data.name);
      const existing = await prisma.run_crews.findUnique({
        where: { joinCode: candidate },
      });
      if (!existing) {
        joinCode = candidate;
      }
      attempts++;
    }
    // Fallback to random if we can't generate from name
    if (!joinCode) {
      joinCode = `CREW${Math.floor(10000 + Math.random() * 90000)}`;
    }
  }

  // Create the crew
  const crew = await prisma.run_crews.create({
    data: {
      name: data.name,
      handle,
      description: data.description,
      joinCode,
      city: data.city,
      state: data.state as any, // Prisma will validate enum
      easyMilesPace: data.easyMilesPace,
      crushingItPace: data.crushingItPace,
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
  search?: string; // Search by name only
  city?: string;
  state?: string;
  purpose?: string[];
  trainingForRace?: string; // race ID to filter by specific race
  raceTrainingGroups?: boolean; // true = only crews training for a race (trainingForRace IS NOT NULL)
}) {
  const limit = options?.limit || 50;

  // Build where clause with optional filters
  const where: any = {
    archivedAt: null, // Only show active crews
  };

  // Search - name only
  if (options?.search) {
    where.name = {
      contains: options.search,
      mode: 'insensitive',
    };
  }

  if (options?.city) {
    where.city = {
      contains: options.city,
      mode: 'insensitive',
    };
  }

  if (options?.state) {
    where.state = options.state;
  }

  if (options?.purpose && options.purpose.length > 0) {
    where.purpose = {
      hasSome: options.purpose,
    };
  }

  // Training for Race filter (race ID)
  if (options?.trainingForRace) {
    where.trainingForRace = options.trainingForRace;
  }

  // Race Training Groups filter (has any race)
  if (options?.raceTrainingGroups === true) {
    where.trainingForRace = { not: null };
  }

  // Get non-archived crews with member counts and race data
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
      easyMilesPace: true,
      crushingItPace: true,
      gender: true,
      ageMin: true,
      ageMax: true,
      primaryMeetUpPoint: true,
      primaryMeetUpAddress: true,
      purpose: true,
      timePreference: true,
      typicalRunMiles: true,
      trainingForRace: true,
      race_registry: {
        select: {
          id: true,
          name: true,
          raceType: true,
          miles: true,
          date: true,
          city: true,
          state: true,
          country: true,
        },
      },
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

  // Format response with public-safe data
  // Convert pace from seconds to MM:SS format for display
  return crews.map((crew) => {
    const easyPaceFormatted = secondsToPace(crew.easyMilesPace);
    const crushingPaceFormatted = secondsToPace(crew.crushingItPace);
    
    return {
      id: crew.id,
      name: crew.name,
      description: crew.description,
      logo: crew.logo,
      icon: crew.icon,
      city: crew.city,
      state: crew.state,
      easyMilesPace: easyPaceFormatted,  // Convert to MM:SS for display
      crushingItPace: crushingPaceFormatted,  // Convert to MM:SS for display
      paceRange: easyPaceFormatted && crushingPaceFormatted
        ? `Easy: ${easyPaceFormatted} | Tempo: ${crushingPaceFormatted}`
        : easyPaceFormatted || crushingPaceFormatted
        ? `${easyPaceFormatted || crushingPaceFormatted} min/mile`
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
      trainingForRace: crew.trainingForRace,
      race: crew.race_registry ? {
        id: crew.race_registry.id,
        name: crew.race_registry.name,
        raceType: crew.race_registry.raceType,
        miles: crew.race_registry.miles,
        date: crew.race_registry.date,
        city: crew.race_registry.city,
        state: crew.race_registry.state,
        country: crew.race_registry.country,
      } : null,
      memberCount: crew._count.run_crew_memberships,
      createdAt: crew.createdAt,
    };
  });
}

export async function getCrewById(runCrewId: string) {
  const crew = await prisma.run_crews.findUnique({
    where: { id: runCrewId },
    include: {
      run_crew_memberships: {
        include: {
          Athlete: {
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
      run_crew_announcements: {
        take: 10,
        orderBy: { createdAt: 'desc' },
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
      run_crew_runs: {
        orderBy: { date: 'asc' },
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

  if (!crew) {
    return null;
  }

  return normalizeCrewResponse(crew);
}

/**
 * Hydrate crew with full box structure - returns comprehensive crew data
 * This is the main function used by API routes to fetch crew data
 */
export async function hydrateCrew(runCrewId: string) {
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
      messageTopics: true,
      run_crew_announcements: {
        where: {
          archivedAt: null, // Only fetch active announcements
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
        take: 1, // Only fetch the latest active announcement
      },
      run_crew_runs: {
        select: {
          id: true,
          title: true,
          date: true,
          startTime: true,
          meetUpPoint: true,
          meetUpAddress: true,
          totalMiles: true,
          pace: true,
          stravaMapUrl: true,
          description: true,
          run_crew_run_rsvps: {
            select: {
              id: true,
              status: true,
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
      run_crew_memberships: {
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
      run_crew_messages: {
        take: 50,
        orderBy: {
          createdAt: 'desc',
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
      },
    },
  });

  if (!crew) {
    return null;
  }

  // Parse messageTopics (stored as JSON)
  let messageTopics: string[] = ['#general', '#runs', '#training tips', '#myvictories', '#social'];
  if (crew.messageTopics) {
    try {
      if (typeof crew.messageTopics === 'string') {
        messageTopics = JSON.parse(crew.messageTopics);
      } else if (Array.isArray(crew.messageTopics)) {
        // Type assertion for Prisma Json type
        messageTopics = crew.messageTopics as string[];
      }
    } catch (err) {
      console.warn('Failed to parse messageTopics, using defaults');
    }
  }

  // Build box structure
  return {
    runCrewBaseInfo: {
      runCrewId: crew.id,
      name: crew.name,
      description: crew.description,
      joinCode: crew.joinCode,
      logo: crew.logo,
      icon: crew.icon,
      messageTopics,
      archivedAt: crew.archivedAt,
    },
    membershipsBox: {
      memberships: crew.run_crew_memberships.map((m: any) => ({
        id: m.id,
        athleteId: m.athleteId,
        runCrewId: m.runCrewId,
        role: m.role,
        joinedAt: m.joinedAt,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        Athlete: m.Athlete,
      })),
    },
    messagesBox: {
      messages: crew.run_crew_messages.map((m: any) => ({
        id: m.id,
        runCrewId: m.runCrewId,
        athleteId: m.athleteId,
        content: m.content,
        topic: m.topic,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        Athlete: m.Athlete,
      })),
    },
    announcementsBox: {
      announcements: crew.run_crew_announcements.map((a: any) => ({
        id: a.id,
        runCrewId: a.runCrewId,
        athleteId: a.athleteId,
        title: a.title,
        content: a.content,
        archivedAt: a.archivedAt,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        Athlete: a.Athlete,
      })),
    },
    runsBox: {
      runs: crew.run_crew_runs.map((r: any) => ({
        id: r.id,
        title: r.title,
        date: r.date,
        startTime: r.startTime,
        meetUpPoint: r.meetUpPoint,
        meetUpAddress: r.meetUpAddress,
        totalMiles: r.totalMiles,
        pace: r.pace,
        stravaMapUrl: r.stravaMapUrl,
        description: r.description,
        run_crew_run_rsvps: r.run_crew_run_rsvps.map((rsvp: any) => ({
          id: rsvp.id,
          status: rsvp.status,
          Athlete: rsvp.Athlete,
        })),
      })),
    },
  };
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
      handle: true,
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
    handle: crew.handle,
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

/**
 * Create a new run for a RunCrew
 * Uses athleteId from authenticated user (from localStorage)
 */
export async function createRun(data: {
  runCrewId: string;
  athleteId: string; // From authenticated user (localStorage)
  title: string;
  date: Date;
  startTime?: string | null;
  meetUpPoint?: string | null;
  meetUpAddress?: string | null;
  totalMiles?: number | null;
  pace?: string | null;
  stravaMapUrl?: string | null;
  description?: string | null;
}) {
  const run = await prisma.run_crew_runs.create({
    data: {
      runCrewId: data.runCrewId,
      createdById: data.athleteId, // Map athleteId to createdById (schema field)
      title: data.title,
      date: data.date,
      startTime: data.startTime ?? '',
      meetUpPoint: data.meetUpPoint ?? '',
      meetUpAddress: data.meetUpAddress ?? null,
      totalMiles: data.totalMiles ?? null,
      pace: data.pace ?? null,
      stravaMapUrl: data.stravaMapUrl ?? null,
      description: data.description ?? null,
    },
  });

  return run;
}

/**
 * Post a message to a RunCrew
 */
export async function postMessage(data: {
  runCrewId: string;
  athleteId: string;
  content: string;
  topic?: string;
}) {
  // Archive existing active announcements when a new one is posted
  if (data.topic === '#announcement') {
    await prisma.run_crew_announcements.updateMany({
      where: {
        runCrewId: data.runCrewId,
        archivedAt: null,
      },
      data: {
        archivedAt: new Date(),
      },
    });
  }

  const message = await prisma.run_crew_messages.create({
    data: {
      runCrewId: data.runCrewId,
      athleteId: data.athleteId,
      content: data.content,
      topic: data.topic || '#general',
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

  return message;
}

/**
 * Post an announcement to a RunCrew
 * Archives existing active announcements when a new one is posted
 */
export async function postAnnouncement(data: {
  runCrewId: string;
  authorId: string;
  title: string;
  content: string;
}) {
  // Archive existing active announcements
  await prisma.run_crew_announcements.updateMany({
    where: {
      runCrewId: data.runCrewId,
      archivedAt: null,
    },
    data: {
      archivedAt: new Date(),
    },
  });

  const announcement = await prisma.run_crew_announcements.create({
    data: {
      runCrewId: data.runCrewId,
      authorId: data.authorId, // Schema uses authorId, not athleteId
      title: data.title,
      content: data.content,
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

  return announcement;
}

/**
 * RSVP to a run
 */
export async function rsvpToRun(data: {
  runId: string;
  athleteId: string;
  status: 'going' | 'maybe' | 'not-going';
}) {
  const rsvp = await prisma.run_crew_run_rsvps.upsert({
    where: {
      runId_athleteId: {
        runId: data.runId,
        athleteId: data.athleteId,
      },
    },
    update: {
      status: data.status,
    },
    create: {
      runId: data.runId,
      athleteId: data.athleteId,
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

  return rsvp;
}

/**
 * Create an event (placeholder - events may be deprecated)
 */
export async function createEvent(data: any) {
  // Events are deprecated for MVP1, but keeping function signature for API compatibility
  throw new Error('Events are deprecated for MVP1');
}
