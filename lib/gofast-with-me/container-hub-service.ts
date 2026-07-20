import { prisma } from '@/lib/prisma';
import { getAthleteById } from '@/lib/domain-athlete';
import { canAccessGoFastContainer } from '@/lib/gofast-container-access';
import { loadPublicAthletePage } from '@/lib/server/load-public-athlete-page';
import {
  computeAllPublicPlanWeeks,
  getPublicPlanBySlug,
  listPublicPlansForAthlete,
} from '@/lib/training/public-plan-service';
import { effectiveTrainingWeekCount } from '@/lib/training/plan-utils';
import type { PublicPlanWeek } from '@/lib/training/public-plan-service';

export type ContainerHubMessage = {
  id: string;
  body: string;
  topic: string;
  routeId: string | null;
  createdAt: string;
  author: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    photoURL: string | null;
    gofastHandle: string | null;
  };
  route: {
    id: string;
    name: string;
    distanceMiles: number | null;
    citySlug: string | null;
  } | null;
};

export type ContainerHubPayload = {
  isHost: boolean;
  isMember: boolean;
  canAccessFeed: boolean;
  host: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    gofastHandle: string | null;
    photoURL: string | null;
  };
  memberCount: number;
  members: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    photoURL: string | null;
    gofastHandle: string | null;
    joinedAt: string;
  }[];
  upcomingRuns: {
    id: string;
    title: string;
    date: string;
    citySlug: string;
    meetUpPoint: string;
    gorunPath: string;
  }[];
  publishedPlan: {
    slug: string;
    name: string;
    totalWeeks: number;
    weeks: PublicPlanWeek[];
  } | null;
  messages: ContainerHubMessage[];
};

function mapMessageRow(m: {
  id: string;
  body: string;
  topic: string;
  routeId: string | null;
  createdAt: Date;
  authorAthlete: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    photoURL: string | null;
    gofastHandle: string | null;
  };
  route: {
    id: string;
    name: string;
    distanceMiles: number | null;
    citySlug: string | null;
  } | null;
}): ContainerHubMessage {
  return {
    id: m.id,
    body: m.body,
    topic: m.topic,
    routeId: m.routeId,
    createdAt: m.createdAt.toISOString(),
    author: m.authorAthlete,
    route: m.route,
  };
}

async function loadPublishedPlanWeeks(hostAthleteId: string) {
  const rows = await listPublicPlansForAthlete(hostAthleteId);
  const first = rows.find((p) => p.publicSlug?.trim());
  if (!first?.publicSlug) return null;

  const plan = await getPublicPlanBySlug(first.publicSlug, { allowUnlisted: true });
  if (
    !plan ||
    plan.publicVisibility === 'DRAFT' ||
    plan.publicVisibility === 'ARCHIVED' ||
    !plan.planSchedule
  ) {
    return null;
  }

  const raceDate = plan.race_registry?.raceDate ?? null;
  const effectiveWeeks = effectiveTrainingWeekCount(
    plan.startDate,
    plan.totalWeeks,
    raceDate
  );
  const weeks = await computeAllPublicPlanWeeks({
    planSchedule: plan.planSchedule,
    startDate: plan.startDate,
    totalWeeks: plan.totalWeeks,
    race_registry: plan.race_registry,
  });

  return {
    slug: first.publicSlug,
    name: plan.name,
    totalWeeks: effectiveWeeks,
    weeks,
  };
}

export async function loadContainerHubForHost(
  hostAthleteId: string,
  callerAthleteId: string,
  options?: { messageTopic?: string; messageLimit?: number }
): Promise<ContainerHubPayload | null> {
  const host = await getAthleteById(hostAthleteId);
  if (!host?.isGoFastContainer) return null;

  const isHost = callerAthleteId === host.id;
  const canAccessFeed = await canAccessGoFastContainer(host.id, callerAthleteId);
  const isMember = canAccessFeed && !isHost;

  const handle = host.gofastHandle?.trim();
  const publicPage = handle ? await loadPublicAthletePage(handle) : null;

  const [memberRows, memberCount, publishedPlan, messageRows] = await Promise.all([
    prisma.gofast_container_memberships.findMany({
      where: { containerAthleteId: host.id },
      orderBy: { joinedAt: 'desc' },
      take: 24,
      include: {
        memberAthlete: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoURL: true,
            gofastHandle: true,
          },
        },
      },
    }),
    prisma.gofast_container_memberships.count({ where: { containerAthleteId: host.id } }),
    loadPublishedPlanWeeks(host.id),
    canAccessFeed
      ? prisma.gofast_container_messages.findMany({
          where: {
            containerAthleteId: host.id,
            ...(options?.messageTopic ? { topic: options.messageTopic } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: options?.messageLimit ?? 40,
          include: {
            authorAthlete: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                photoURL: true,
                gofastHandle: true,
              },
            },
            route: {
              select: {
                id: true,
                name: true,
                distanceMiles: true,
                citySlug: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    isHost,
    isMember,
    canAccessFeed,
    host: {
      id: host.id,
      firstName: host.firstName,
      lastName: host.lastName,
      gofastHandle: host.gofastHandle,
      photoURL: host.photoURL,
    },
    memberCount,
    members: memberRows.map((r) => ({
      id: r.memberAthlete.id,
      firstName: r.memberAthlete.firstName,
      lastName: r.memberAthlete.lastName,
      photoURL: r.memberAthlete.photoURL,
      gofastHandle: r.memberAthlete.gofastHandle,
      joinedAt: r.joinedAt.toISOString(),
    })),
    upcomingRuns: publicPage?.upcomingRuns ?? [],
    publishedPlan,
    messages: messageRows.map(mapMessageRow),
  };
}
