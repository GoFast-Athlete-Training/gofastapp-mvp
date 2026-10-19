"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import type { PlanDayCard } from "@/lib/training/fetch-plan-week-client";
import { TrainingHubIngestScopeFlow } from "@/components/training/hub/TrainingHubIngestScopeFlow";

type Props = {
  planId: string;
  weekNumber: number;
  weekDays: PlanDayCard[];
  getToken: () => Promise<string>;
  onCommitted: () => void;
};

export function TrainingHubWeekGear({
  planId,
  weekNumber,
  weekDays,
  getToken,
  onCommitted,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const closeAll = () => {
    setMenuOpen(false);
    setPanelOpen(false);
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-expanded={menuOpen || panelOpen}
        onClick={() => setMenuOpen((o) => !o)}
        className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-100"
        title="Edit this week"
      >
        <Settings className="h-4 w-4" aria-hidden />
      </button>

      {menuOpen && !panelOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 min-w-[11rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setPanelOpen(true);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
            >
              Replace this week
            </button>
          </div>
        </>
      ) : null}

      {panelOpen ? (
        <>
          <button
            type="button"
            aria-label="Close panel"
            className="fixed inset-0 z-40 cursor-default bg-black/20"
            onClick={closeAll}
          />
          <div className="fixed inset-x-4 top-24 z-50 mx-auto max-w-lg max-h-[75vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl sm:inset-x-auto sm:right-6 sm:left-auto sm:w-full">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Replace this week</h3>
            <TrainingHubIngestScopeFlow
              planId={planId}
              weekNumber={weekNumber}
              weekDays={weekDays}
              getToken={getToken}
              allowedScopes={["week"]}
              onCommitted={() => {
                onCommitted();
                closeAll();
              }}
              onClose={closeAll}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
