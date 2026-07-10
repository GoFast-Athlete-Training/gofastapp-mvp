import Link from "next/link";
import { Megaphone } from "lucide-react";
import {
  listDiscoverablePublicPlans,
  mapPublicPlanApiResponse,
} from "@/lib/training/public-plan-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Training plans · GoFast",
  description: "Discover athlete-led training plans you can follow on GoFast.",
};

function authorLabel(
  firstName: string | null,
  lastName: string | null,
  handle: string | null
): string {
  const name = [firstName, lastName].filter(Boolean).join(" ");
  if (name) return name;
  return handle ? `@${handle}` : "Runner";
}

export default async function PublicPlansDiscoveryPage() {
  const rows = await listDiscoverablePublicPlans(48);
  const plans = rows.map(mapPublicPlanApiResponse);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-5 py-8">
          <div className="flex items-center gap-2 text-violet-700 text-xs font-semibold uppercase tracking-[0.2em] mb-2">
            <Megaphone className="w-4 h-4" />
            Discover
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Public training plans</h1>
          <p className="mt-2 text-sm text-gray-600 max-w-xl">
            Athlete-led builds you can follow — preview the schedule, then start in GoFast with your
            race and paces.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        {plans.length === 0 ? (
          <p className="text-gray-600 text-sm">No public plans yet. Check back soon.</p>
        ) : (
          <ul className="space-y-4">
            {plans.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/plans/${encodeURIComponent(p.slug ?? "")}`}
                  className="block rounded-2xl border border-gray-200 bg-white p-5 hover:border-violet-200 hover:shadow-sm transition-all"
                >
                  <h2 className="text-lg font-semibold text-gray-900">{p.title}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Led by{" "}
                    {authorLabel(p.author.firstName, p.author.lastName, p.author.gofastHandle)}
                    {p.durationWeeks ? ` · ${p.durationWeeks} weeks` : ""}
                    {p.targetDistanceLabel ? ` · ${p.targetDistanceLabel}` : ""}
                  </p>
                  {p.description ? (
                    <p className="text-sm text-gray-700 mt-2 line-clamp-3">{p.description}</p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-8 text-center text-sm text-gray-500">
          <Link href="/training/lead" className="text-violet-700 font-medium hover:underline">
            Share your own plan
          </Link>
        </p>
      </main>
    </div>
  );
}
