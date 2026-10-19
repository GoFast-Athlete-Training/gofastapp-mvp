"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import type { ShareHubPlanStatus } from "@/lib/profile/share-creator-card-logic";
import { planScheduleLooksStructured } from "@/lib/training/plan-schedule-schema";
import { RegeneratePlanScheduleButton } from "@/components/training/RegeneratePlanScheduleButton";
import { TrainingHubPlanShareControls } from "@/components/training/hub/TrainingHubPlanShareControls";
type Panel = null | "details" | "miles";

type Props = {
  planId: string;
  planSchedule: unknown;
  sharePlan: ShareHubPlanStatus | null;
  landingSlug: string;
  firstName: string | null;
  savedWeeklyTarget: number | null;
  presetMinWeeklyMiles: number;
  weekPlannedMiles: number | null;
  presetMaxWeeklyMiles: number | null;
  archiving: boolean;
  deleting: boolean;
  parkedPlans: { id: string; name: string; race_registry?: { name: string } | null }[];
  restoringParkedId: string | null;
  getToken: () => Promise<string>;
  onRefreshShare: () => Promise<void>;
  onRefreshHub: () => Promise<void>;
  onRefreshWeek: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onRestoreParked: (id: string) => void;
};

export function TrainingHubEditPlanGear({
  planId,
  planSchedule,
  sharePlan,
  landingSlug,
  firstName,
  savedWeeklyTarget,
  presetMinWeeklyMiles,
  weekPlannedMiles,
  presetMaxWeeklyMiles,
  archiving,
  deleting,
  parkedPlans,
  restoringParkedId,
  getToken,
  onRefreshShare,
  onRefreshHub,
  onRefreshWeek,
  onArchive,
  onDelete,
  onRestoreParked,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);

  const structured = planScheduleLooksStructured(planSchedule);
  const hasPublicDescription = Boolean(sharePlan?.publicDescription?.trim());
  const descriptionMenuLabel = hasPublicDescription
    ? "Title and description"
    : "Add description";

  const closeAll = () => {
    setMenuOpen(false);
    setPanel(null);
  };

  const openPanel = (p: Panel) => {
    setPanel(p);
    setMenuOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={menuOpen || panel != null}
        aria-haspopup="true"
        onClick={() => setMenuOpen((o) => !o)}
        className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-700 hover:bg-gray-50"
        title="Edit my plan"
      >
        <Settings className="h-5 w-5" aria-hidden />
      </button>

      {menuOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 min-w-[12rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Edit my plan
            </p>
            {sharePlan ? (
              <button
                type="button"
                onClick={() => openPanel("details")}
                className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
              >
                {descriptionMenuLabel}
              </button>
            ) : null}
            {structured ? (
              <Link
                href={`/training/plan/${encodeURIComponent(planId)}/adjust`}
                onClick={closeAll}
                className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
              >
                Replace with my plan
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => openPanel("miles")}
              className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
            >
              Weekly miles
            </button>
            <div className="my-1 border-t border-gray-100" />
            <button
              type="button"
              disabled={archiving || deleting}
              onClick={() => {
                closeAll();
                onArchive();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {archiving ? "Archiving…" : "Archive"}
            </button>
            <button
              type="button"
              disabled={deleting || archiving}
              onClick={() => {
                closeAll();
                onDelete();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
            {parkedPlans.length > 0 ? (
              <>
                <div className="my-1 border-t border-gray-100" />
                <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Parked plans
                </p>
                {parkedPlans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={restoringParkedId != null}
                    onClick={() => {
                      closeAll();
                      onRestoreParked(p.id);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {restoringParkedId === p.id
                      ? "Restoring…"
                      : `Restore ${p.race_registry?.name ?? p.name}`}
                  </button>
                ))}
              </>
            ) : null}
          </div>
        </>
      ) : null}

      {panel ? (
        <>
          <button
            type="button"
            aria-label="Close panel"
            className="fixed inset-0 z-40 cursor-default bg-black/20"
            onClick={closeAll}
          />
          <div className="fixed inset-x-4 top-20 z-50 mx-auto max-w-lg max-h-[80vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl sm:inset-x-auto sm:right-6 sm:left-auto sm:w-full">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-sm font-bold text-gray-900">
                {panel === "details" ? descriptionMenuLabel : "Weekly miles"}
              </h3>
              <button
                type="button"
                onClick={closeAll}
                className="text-sm font-medium text-gray-500 hover:text-gray-900"
              >
                Close
              </button>
            </div>

            {panel === "details" && sharePlan ? (
              <TrainingHubPlanShareControls
                plan={sharePlan}
                landingSlug={landingSlug}
                firstName={firstName}
                onRefresh={onRefreshShare}
                detailsOnly
              />
            ) : null}

            {panel === "miles" ? (
              <div className="space-y-4 text-sm">
                {savedWeeklyTarget != null ? (
                  <p className="tabular-nums text-gray-900">
                    Target: <span className="font-semibold">{savedWeeklyTarget} mi/week</span>
                  </p>
                ) : (
                  <p className="text-gray-700">No target set yet</p>
                )}
                {weekPlannedMiles != null ? (
                  <p className="tabular-nums text-gray-700">
                    This week: <span className="font-medium">{weekPlannedMiles} mi planned</span>
                  </p>
                ) : null}
                <p className="text-xs text-gray-600">
                  Your weekly target stays in the preset band
                  {presetMaxWeeklyMiles != null
                    ? ` (${presetMinWeeklyMiles}–${presetMaxWeeklyMiles} mi)`
                    : ` (from ${presetMinWeeklyMiles} mi up)`}
                  .
                </p>
                <RegeneratePlanScheduleButton
                  planId={planId}
                  getToken={getToken}
                  weeklyMileageTarget={savedWeeklyTarget ?? presetMinWeeklyMiles}
                  minWeeklyMiles={presetMinWeeklyMiles}
                  onSuccess={async () => {
                    await onRefreshHub();
                    onRefreshWeek();
                  }}
                />
                <Link
                  href={`/training-setup/${planId}`}
                  onClick={closeAll}
                  className="inline-flex rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-900 hover:bg-orange-100"
                >
                  Edit weekly miles in setup
                </Link>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
