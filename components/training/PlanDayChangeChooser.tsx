"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import PlanDayBriefPanel from "@/components/training/PlanDayBriefPanel";

type Props = {
  planId: string;
  dateKey: string;
  isCalendarToday: boolean;
  backHref: string;
  getToken: () => Promise<string | null>;
  onDayUpdated: () => void;
  /** Hub deep-link opens chooser expanded */
  initialOpen?: boolean;
  panelRef?: React.RefObject<HTMLDivElement | null>;
};

export default function PlanDayChangeChooser({
  planId,
  dateKey,
  isCalendarToday,
  backHref,
  getToken,
  onDayUpdated,
  initialOpen = false,
  panelRef,
}: Props) {
  const [chooserOpen, setChooserOpen] = useState(initialOpen);
  const [path, setPath] = useState<"conditions" | null>(null);
  const internalRef = useRef<HTMLDivElement | null>(null);
  const attachRef = panelRef ?? internalRef;

  const newWorkoutHref = `/workouts/create?planId=${encodeURIComponent(planId)}&date=${encodeURIComponent(dateKey)}&back=${encodeURIComponent(backHref)}`;

  useEffect(() => {
    if (initialOpen) {
      setChooserOpen(true);
      requestAnimationFrame(() => {
        attachRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [initialOpen, attachRef]);

  const openChooser = useCallback(() => {
    setChooserOpen(true);
    setPath(null);
    requestAnimationFrame(() => {
      attachRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [attachRef]);

  return (
    <div ref={attachRef} className={initialOpen ? "rounded-xl ring-2 ring-sky-300 ring-offset-2" : undefined}>
      {!chooserOpen ? (
        <button
          type="button"
          onClick={openChooser}
          className="w-full rounded-xl border border-sky-200 bg-sky-50 py-2.5 text-sm font-semibold text-sky-900 hover:bg-sky-100"
        >
          Change today&apos;s workout
        </button>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-gray-900">Change this day</p>
            <button
              type="button"
              className="text-xs text-gray-600 hover:text-gray-900"
              onClick={() => {
                setChooserOpen(false);
                setPath(null);
              }}
            >
              Close
            </button>
          </div>
          {path !== "conditions" ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Link
                href={newWorkoutHref}
                className="flex-1 inline-flex items-center justify-center rounded-xl bg-orange-600 py-2.5 px-3 text-sm font-semibold text-white hover:bg-orange-700"
              >
                New workout
              </Link>
              {isCalendarToday ? (
                <button
                  type="button"
                  onClick={() => setPath("conditions")}
                  className="flex-1 rounded-xl border border-violet-300 bg-violet-50 py-2.5 px-3 text-sm font-semibold text-violet-900 hover:bg-violet-100"
                >
                  Modify based on conditions
                </button>
              ) : (
                <p className="text-xs text-gray-600 sm:flex-1 sm:self-center">
                  Condition-based suggestions are available on calendar today only.
                </p>
              )}
            </div>
          ) : (
            <PlanDayBriefPanel
              planId={planId}
              dateKey={dateKey}
              getToken={getToken}
              onAccepted={() => {
                setPath(null);
                setChooserOpen(false);
                onDayUpdated();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
