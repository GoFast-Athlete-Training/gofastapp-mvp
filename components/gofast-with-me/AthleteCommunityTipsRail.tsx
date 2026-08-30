'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { AthleteTipPayload } from '@/lib/gofast-with-me/athlete-tips';
import { AthleteTipStructuredCard } from '@/components/gofast-with-me/AthleteTipStructuredCard';

type Props = {
  tips: AthleteTipPayload[];
  firstName: string;
  displayAsOwner: boolean;
};

export default function AthleteCommunityTipsRail({ tips, firstName, displayAsOwner }: Props) {
  const [selectedTip, setSelectedTip] = useState<AthleteTipPayload | null>(null);
  const sortedTips = useMemo(
    () => [...tips].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')),
    [tips]
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Tips</h2>
      </div>

      {sortedTips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-600">No tips yet.</p>
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-min gap-4">
            {sortedTips.map((tip) => (
              <button
                key={tip.id}
                type="button"
                onClick={() => setSelectedTip(tip)}
                className="w-72 shrink-0 text-left transition hover:-translate-y-0.5"
              >
                <AthleteTipStructuredCard tip={tip} compact className="h-full" />
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedTip ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close tip"
            onClick={() => setSelectedTip(null)}
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-gray-50 shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
              <h3 className="text-sm font-bold text-gray-900">Tip</h3>
              <button
                type="button"
                onClick={() => setSelectedTip(null)}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
              >
                <X className="h-4 w-4" aria-hidden />
                Done
              </button>
            </div>
            <div className="p-4">
              <AthleteTipStructuredCard tip={selectedTip} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
