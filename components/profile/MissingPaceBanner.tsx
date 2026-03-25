"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const STORAGE_KEY = "gofast.dismissProfilePaceBanner";

type Props = {
  fiveKPace: string | null | undefined;
};

export default function MissingPaceBanner({ fiveKPace }: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const hasPace = Boolean(fiveKPace?.trim());
  if (hasPace || dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div
      className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      role="region"
      aria-label="Set your training pace"
    >
      <div className="text-sm text-amber-950 pr-8 sm:pr-0">
        <p className="font-semibold text-amber-900">Set your current 5K pace</p>
        <p className="mt-1 text-amber-900/90">
          Training plan zones, home snapshot insights, and future pace matching use your baseline
          fitness—not your race goal.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/profile/training"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
        >
          Add pace
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="p-2 rounded-lg text-amber-800 hover:bg-amber-100/80"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
