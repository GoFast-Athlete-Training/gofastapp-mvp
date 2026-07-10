import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Megaphone, User } from "lucide-react";
import {
  computeAllPublicPlanWeeks,
  getPublicPlanBySlug,
} from "@/lib/training/public-plan-service";
import { effectiveTrainingWeekCount } from "@/lib/training/plan-utils";
import PublicPlanWeekViewer from "@/components/training/PublicPlanWeekViewer";

export const dynamic = "force-dynamic";

type RouteParams = { slug: string };

function authorName(
  firstName: string | null,
  lastName: string | null,
  handle: string | null
): string {
  const composed = [firstName, lastName].filter(Boolean).join(" ");
  if (composed) return composed;
  return handle ? `@${handle}` : "Runner";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const plan = await getPublicPlanBySlug(slug, { allowUnlisted: true });
  if (!plan) return { title: "Plan not found · GoFast" };
  return {
    title: `${plan.name} · GoFast Training Plan`,
    description:
      plan.publicDescription?.slice(0, 160) ??
      `Training plan led by ${authorName(plan.Athlete.firstName, plan.Athlete.lastName, plan.Athlete.gofastHandle)} on GoFast`,
  };
}

export default async function PublicTrainingPlanPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const plan = await getPublicPlanBySlug(slug, { allowUnlisted: true });
  if (
    !plan ||
    plan.publicVisibility === "DRAFT" ||
    plan.publicVisibility === "ARCHIVED" ||
    !plan.planSchedule
  ) {
    notFound();
  }

  const author = plan.Athlete;
  const name = authorName(author.firstName, author.lastName, author.gofastHandle);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-br from-violet-900 via-violet-800 to-indigo-900 text-white">
        <div className="max-w-3xl mx-auto px-5 py-12">
          <div className="flex items-center gap-2 text-violet-200 text-xs font-semibold uppercase tracking-[0.2em] mb-3">
            <Megaphone className="w-3.5 h-3.5" />
            Training plan
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{plan.name}</h1>
          {plan.publicDescription ? (
            <p className="mt-4 text-violet-100/90 text-base leading-relaxed max-w-2xl">
              {plan.publicDescription}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-violet-100">
            <span className="inline-flex items-center gap-2">
              {author.photoURL ? (
                <img
                  src={author.photoURL}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover border border-white/20"
                />
              ) : (
                <User className="w-5 h-5" />
              )}
              Led by {name}
              {author.gofastHandle ? (
                <Link
                  href={`/u/${encodeURIComponent(author.gofastHandle)}`}
                  className="text-amber-300 hover:text-amber-200 font-medium"
                >
                  @{author.gofastHandle}
                </Link>
              ) : null}
            </span>
            <span>{effectiveWeeks} weeks</span>
            {plan.race_registry?.distanceLabel ? (
              <span>{plan.race_registry.distanceLabel}</span>
            ) : null}
            {plan.race_registry?.name ? <span>{plan.race_registry.name}</span> : null}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-10 space-y-8">
        <PublicPlanWeekViewer weeks={weeks} totalWeeks={effectiveWeeks} />

        {plan.training_plan_preset?.publicDescription ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">About the engine</h2>
            <p className="text-sm text-gray-600">{plan.training_plan_preset.publicDescription}</p>
            <p className="mt-2 text-xs text-gray-500">
              Preset: {plan.training_plan_preset.title} — company-curated generation blueprint.
            </p>
          </section>
        ) : null}

        <p className="text-center text-sm text-gray-500 pb-8">
          <Link href="/training" className="text-violet-700 hover:underline font-medium">
            Back to Training Hub
          </Link>
        </p>
      </main>
    </div>
  );
}
