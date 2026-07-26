'use client';

import Link from 'next/link';
import GoFastWithMeSetupPanel from '@/components/gofast-with-me/GoFastWithMeSetupPanel';

type Props = {
  publicSlug: string;
};

export default function GoFastWithMePlanPanel({ publicSlug }: Props) {
  const hubPlanPath = `/container/${encodeURIComponent(publicSlug)}#plan-strip`;

  return (
    <section id="plan" className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Surface my plan</h2>
        <p className="text-sm text-gray-600 mt-1">
          Your GoFast plan is the core of GoFast With Me. Publish it so followers see your plan
          strip in the hub — the week view that says &ldquo;train alongside me.&rdquo;
        </p>
      </div>

      <GoFastWithMeSetupPanel embedded />

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
        <p className="text-sm font-semibold text-gray-900">Preview in member hub</p>
        <p className="text-xs text-gray-600">
          When your plan is public, followers see the plan strip at the top of your GoFast With Me
          hub — right after What I&apos;m training for.
        </p>
        <Link
          href={hubPlanPath}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-sm font-semibold text-orange-600 hover:underline"
        >
          View hub plan strip →
        </Link>
      </div>

      <details className="rounded-xl border border-dashed border-gray-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-gray-600">
          My Runs (v2 — coming later)
        </summary>
        <p className="mt-2 text-xs text-gray-500">
          Manual hosted runs are not the primary loop. Goal + plan surfacing comes first. Run hosting
          stays available in GoRun when you need it.
        </p>
      </details>
    </section>
  );
}
