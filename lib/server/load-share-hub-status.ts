import { prisma } from "@/lib/prisma";
import { listPublicPlansForAthlete } from "@/lib/training/public-plan-service";
import type { ShareHubStatus } from "@/lib/profile/share-creator-card-logic";

const RUNNER_BASE =
  process.env.NEXT_PUBLIC_RUNNER_PHOTO_URL?.replace(/\/$/, "") ||
  "https://runner.gofastcrushgoals.com";

export async function loadShareHubStatus(athleteId: string): Promise<ShareHubStatus> {
  const now = new Date();

  const [athlete, activePlan, publishedPlanRows, upcomingHostedRuns, memberships] =
    await Promise.all([
      prisma.athlete.findUnique({
        where: { id: athleteId },
        select: {
          gofastHandle: true,
          isGoFastContainer: true,
        },
      }),
      prisma.training_plans.findFirst({
        where: { athleteId, lifecycleStatus: "ACTIVE" },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          planSchedule: true,
          publicSlug: true,
          publicVisibility: true,
        },
      }),
      listPublicPlansForAthlete(athleteId),
      prisma.city_runs.count({
        where: {
          athleteGeneratedId: athleteId,
          published: true,
          date: { gte: now },
        },
      }),
      prisma.run_crew_memberships.findMany({
        where: { athleteId },
        select: { role: true },
      }),
    ]);

  const handle = athlete?.gofastHandle?.trim() || null;
  const hasSchedule =
    activePlan?.planSchedule != null &&
    Array.isArray(activePlan.planSchedule) &&
    (activePlan.planSchedule as unknown[]).length > 0;

  const isPublished =
    !!activePlan?.publicSlug &&
    (activePlan.publicVisibility === "PUBLIC" || activePlan.publicVisibility === "UNLISTED");

  const publishedPlans = publishedPlanRows.filter(
    (p) => p.publicVisibility === "PUBLIC" || p.publicVisibility === "UNLISTED"
  );

  const adminCount = memberships.filter((m) => m.role === "admin" || m.role === "manager").length;

  return {
    profile: {
      hasHandle: !!handle,
      gofastHandle: handle,
      isGoFastContainer: !!athlete?.isGoFastContainer,
      publicPageUrl: handle ? `${RUNNER_BASE}/${handle}` : null,
      upcomingPublicRuns: upcomingHostedRuns,
      publishedPlans: publishedPlans.length,
    },
    plan: {
      hasActivePlan: !!activePlan,
      planId: activePlan?.id ?? null,
      planName: activePlan?.name ?? null,
      hasSchedule,
      isPublished,
      publicSlug: activePlan?.publicSlug ?? null,
    },
    run: {
      upcomingHostedRuns,
    },
    runcrew: {
      membershipCount: memberships.length,
      adminCount,
    },
  };
}
