import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeHandle } from "@/lib/server/load-public-athlete-page";
import { loadPublicPublishedPlanStrip } from "@/lib/gofast-with-me/container-hub-service";
import { resolveMyPlanInitialWeek } from "@/lib/gofast-with-me/myplan-week-param";
import { athleteCommunityPath, athletePublicLandingUrl } from "@/lib/gofast-with-me/athlete-community-routes";
import { publicPlanPagePath } from "@/lib/gofast-with-me/plan-sharing-utils";
import PublicPlanWeekViewer from "@/components/training/PublicPlanWeekViewer";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ week?: string }>;
};

function displayName(first: string | null, last: string | null, handle: string): string {
  const composed = [first, last].filter(Boolean).join(" ");
  if (composed) return composed;
  return `@${handle}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle: raw } = await params;
  const handle = normalizeHandle(raw || "");
  if (!handle) return { title: "Training · GoFast" };
  return {
    title: `@${handle} · Training week · GoFast`,
    description: `See ${handle}'s training week on GoFast`,
  };
}

export default async function AthleteMyPlanPage({ params, searchParams }: Props) {
  const { handle: rawHandle } = await params;
  const { week: weekParam } = await searchParams;
  const handle = normalizeHandle(rawHandle || "");
  if (!handle) notFound();

  const athlete = await prisma.athlete.findFirst({
    where: { gofastHandle: { equals: handle, mode: "insensitive" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gofastHandle: true,
      photoURL: true,
    },
  });
  if (!athlete) notFound();

  const strip = await loadPublicPublishedPlanStrip(athlete.id);
  if (!strip) notFound();

  const planRow = await prisma.training_plans.findFirst({
    where: { id: strip.planId },
    select: { startDate: true },
  });
  const planStart = planRow?.startDate ?? new Date();

  const initialWeek = resolveMyPlanInitialWeek({
    weekParam,
    totalWeeks: strip.totalWeeks,
    planStartDate: planStart,
  });

  const canonicalHandle = athlete.gofastHandle?.trim() || handle;
  const name = displayName(athlete.firstName, athlete.lastName, canonicalHandle);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-5 py-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
            Training week
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">{strip.name}</h1>
          <p className="mt-2 text-sm text-gray-600">
            {name}
            {athlete.gofastHandle ? (
              <>
                {" · "}
                <a
                  href={athletePublicLandingUrl(athlete.gofastHandle)}
                  className="font-medium text-orange-700 hover:underline"
                >
                  @{athlete.gofastHandle}
                </a>
              </>
            ) : null}
          </p>
          {strip.publicDescription ? (
            <p className="mt-3 text-sm leading-relaxed text-gray-700">{strip.publicDescription}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link
              href={publicPlanPagePath(strip.slug)}
              className="font-semibold text-sky-800 hover:underline"
            >
              Full plan
            </Link>
            <Link
              href={athleteCommunityPath(canonicalHandle, "plan")}
              className="font-medium text-gray-600 hover:underline"
            >
              Community
            </Link>
            <Link
              href={`/u/${encodeURIComponent(canonicalHandle)}/myplan?week=race`}
              className="font-medium text-gray-600 hover:underline"
            >
              Race week
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <PublicPlanWeekViewer
          weeks={strip.weeks}
          totalWeeks={strip.totalWeeks}
          initialWeekNumber={initialWeek}
          ctaHref={publicPlanPagePath(strip.slug)}
          ctaLabel="View full plan"
        />
      </main>
    </div>
  );
}
