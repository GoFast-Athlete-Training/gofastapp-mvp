"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";

type Props = {
  planId: string;
  weekNumber: number;
};

export function TrainingHubWeekGear({ planId, weekNumber }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const adjustHref = `/training/plan/${encodeURIComponent(planId)}/adjust?weekNumber=${weekNumber}`;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
        className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-100"
        title="Edit this week"
      >
        <Settings className="h-4 w-4" aria-hidden />
      </button>

      {menuOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 min-w-[11rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <Link
              href={adjustHref}
              onClick={() => setMenuOpen(false)}
              className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
            >
              Replace this week
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
