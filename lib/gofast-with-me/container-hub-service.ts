import { prisma } from '@/lib/prisma';
import { getAthleteById } from '@/lib/domain-athlete';
import { loadPublicAthletePage, normalizeHandle } from '@/lib/server/load-public-athlete-page';
import {
  computeAllPublicPlanWeeks,
  getPublicPlanBySlug,
  listPublicPlansForAthlete,
} from '@/lib/training/public-plan-service';
import { effectiveTrainingWeekCount } from '@/lib/training/plan-utils';
import type { PublicPlanWeek } from '@/lib/training/public-plan-service';
import {
  containerMessageInclude,
  mapContainerMessageRow,
  type MappedContainerMessage,
} from '@/lib/gofast-with-me/container-message-map';
import type {
  GoFastWithMeChasingGoal,
  GoFastWithMeTrainingFor,
  GoFastWithMeTrainingSummary,
} from '@/lib/gofast-with-me/training-for-types';
import { athleteCommunityRelationship } from '@/lib/gofast-with-me/athlete-community-access';

export type ContainerHubMessage = MappedContainerMessage;
export type { GoFastWithMeChasingGoal, GoFastWithMeTrainingFor, GoFastWithMeTrainingSummary };

export type ContainerHubPayload = {
  /** Owner of this athlete community. */
  isOwner: boolean;
  /** Caller follows this athlete (not enrollment in a training plan). */
  isFollowing: boolean;
  /** Can post Chatter and use follower interactions. */
  canParticipate: boolean;
  /** @deprecated use isOwner */
  isHost: boolean;
  /** @deprecated use isFollowing */
  isMember: boolean;
  /** @deprecated use canParticipate */
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
  trainingFor: GoFastWithMeTrainingFor;
  messages: ContainerHubMessage[];
};

export type AthleteCommunityPayload = ContainerHubPayload & {
  handle: string;
};

async function loadPublishedPlanWeeks(hostAthleteId: string) {
  const rows = await listPublicPlansForAthlete(hostAthleteId);
  const first = rows.find((p) => p.publicSlug?.trim());
  if (!first?.publicSlug) return null;

  const plan = await getPublicPlanBySlug(first.publicSlug);
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

async function resolveFollowRelationship(
  hostAthleteId: string,
  callerAthleteId: string | null
): Promise<{ isOwner: boolean; isFollowing: boolean; canParticipate: boolean }> {
  if (!callerAthleteId || callerAthleteId === hostAthleteId) {
    return athleteCommunityRelationship({
      hostAthleteId,
      callerAthleteId,
      hasMembership: false,
    });
  }
  const membership = await prisma.gofast_container_memberships.findUnique({
    where: {
      containerAthleteId_memberAthleteId: {
        containerAthleteId: hostAthleteId,
        memberAthleteId: callerAthleteId,
      },
    },
  });
  return athleteCommunityRelationship({
    hostAthleteId,
    callerAthleteId,
    hasMembership: Boolean(membership),
  });
}

export async function loadAthleteCommunityForHost(
  hostAthleteId: string,
  callerAthleteId: string | null,
  options?: { messageTopic?: string; messageLimit?: number }
): Promise<ContainerHubPayload | null> {
  const host = await getAthleteById(hostAthleteId);
  if (!host?.isGoFastContainer) return null;

  const relationship = await resolveFollowRelationship(host.id, callerAthleteId);

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
    prisma.gofast_container_messages.findMany({
      where: {
        containerAthleteId: host.id,
        ...(options?.messageTopic ? { topic: options.messageTopic } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.messageLimit ?? 40,
      include: containerMessageInclude,
    }),
  ]);

  return {
    isOwner: relationship.isOwner,
    isFollowing: relationship.isFollowing,
    canParticipate: relationship.canParticipate,
    isHost: relationship.isOwner,
    isMember: relationship.isFollowing,
    canAccessFeed: relationship.canParticipate,
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
    trainingFor: {
      trainingSummary: publicPage?.trainingSummary ?? null,
      primaryChasingGoal: publicPage?.primaryChasingGoal ?? null,
    },
    messages: messageRows.map(mapContainerMessageRow),
  };
}

export async function loadAthleteCommunityByHandle(
  rawHandle: string,
  callerAthleteId: string | null,
  options?: { messageTopic?: string; messageLimit?: number }
): Promise<AthleteCommunityPayload | null> {
  const publicPage = await loadPublicAthletePage(rawHandle);
  if (!publicPage?.isGoFastContainer || !publicPage.athlete.id) return null;

  const payload = await loadAthleteCommunityForHost(
    publicPage.athlete.id,
    callerAthleteId,
    options
  );
  if (!payload) return null;

  const handle =
    publicPage.athlete.gofastHandle?.trim() ||
    normalizeHandle(rawHandle);

  return { ...payload, handle };
}

/** Authenticated hub boot — requires caller id. */
export async function loadContainerHubForHost(
  hostAthleteId: string,
  callerAthleteId: string,
  options?: { messageTopic?: string; messageLimit?: number }
): Promise<ContainerHubPayload | null> {
  return loadAthleteCommunityForHost(hostAthleteId, callerAthleteId, options);
}
