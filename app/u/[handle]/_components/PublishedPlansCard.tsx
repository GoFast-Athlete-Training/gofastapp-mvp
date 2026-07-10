import Link from 'next/link';
import { Megaphone } from 'lucide-react';

export type PublishedPlanCard = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  targetDistanceLabel: string | null;
  durationWeeks: number | null;
};

type Props = {
  plans: PublishedPlanCard[];
  hostFirstName: string | null;
};

export default function PublishedPlansCard({ plans, hostFirstName }: Props) {
  if (!plans.length) return null;
  const hostLabel = hostFirstName ?? 'this runner';

  return (
    <section className="bg-gradient-to-br from-violet-50 to-indigo-50/80 border border-violet-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-800 tracking-wider uppercase mb-2">
          <Megaphone className="w-3.5 h-3.5" />
          Training plans
        </div>
        <h2 className="text-xl font-bold text-stone-900 leading-snug">
          Follow {hostLabel}&apos;s training build
        </h2>
        <p className="text-sm text-stone-600 mt-2">
          Preview a published plan week-by-week, then start in GoFast with your race and paces.
        </p>
        <ul className="mt-4 space-y-3">
          {plans.map((p) => (
            <li key={p.id}>
              <Link
                href={`/plans/${encodeURIComponent(p.slug)}`}
                className="block rounded-xl border border-violet-100 bg-white/80 px-4 py-3 hover:border-violet-300 hover:bg-white transition-colors"
              >
                <p className="font-semibold text-stone-900">{p.title}</p>
                <p className="text-xs text-stone-500 mt-0.5">
                  {p.durationWeeks ? `${p.durationWeeks} weeks` : null}
                  {p.targetDistanceLabel
                    ? `${p.durationWeeks ? ' · ' : ''}${p.targetDistanceLabel}`
                    : null}
                </p>
                {p.description ? (
                  <p className="text-sm text-stone-600 mt-1 line-clamp-2">{p.description}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
