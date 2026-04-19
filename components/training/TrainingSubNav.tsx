"use client";

import { Activity, BookOpen, Calendar, ClipboardList, LayoutGrid, MessageCircle, Users } from "lucide-react";

export const TRAINING_SECTION_IDS = {
  today: "training-section-today",
  analysis: "training-section-analysis",
  week: "training-section-week",
  plan: "training-section-plan",
} as const;

export type TrainingSubNavKey = keyof typeof TRAINING_SECTION_IDS;

export function scrollToTrainingSection(key: TrainingSubNavKey) {
  const id = TRAINING_SECTION_IDS[key];
  if (typeof document === "undefined") return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

type Props = {
  active: TrainingSubNavKey;
  onNavigate: (key: TrainingSubNavKey) => void;
};

const scrollItems: { key: TrainingSubNavKey; label: string; Icon: typeof Calendar }[] = [
  { key: "today", label: "Today", Icon: Calendar },
  { key: "analysis", label: "Runs & analysis", Icon: Activity },
  { key: "week", label: "This week", Icon: LayoutGrid },
  { key: "plan", label: "Plan", Icon: ClipboardList },
];

export default function TrainingSubNav({ active, onNavigate }: Props) {
  return (
    <nav
      className="w-44 shrink-0 border-r border-gray-200 bg-gray-50/80 py-4 px-2 hidden lg:block sticky top-0 self-start max-h-[calc(100vh-4rem)] overflow-y-auto"
      aria-label="Training sections"
    >
      <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Jump to
      </p>
      <ul className="space-y-0.5">
        {scrollItems.map(({ key, label, Icon }) => {
          const isActive = active === key;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onNavigate(key)}
                className={[
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium transition",
                  isActive
                    ? "bg-orange-50 text-orange-900 ring-1 ring-orange-200"
                    : "text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                <span className="leading-snug">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="px-2 mt-4 mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Tools
      </p>
      <ul className="space-y-0.5">
        <li>
          <a
            href="/ask-coach"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <MessageCircle className="h-4 w-4 shrink-0 text-orange-600" aria-hidden />
            AI Coach
          </a>
        </li>
        <li>
          <a
            href="/journal"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <BookOpen className="h-4 w-4 shrink-0 text-orange-600" aria-hidden />
            Journal
          </a>
        </li>
        <li>
          <a
            href="/my-runcrews"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Users className="h-4 w-4 shrink-0 text-orange-600" aria-hidden />
            Training pod
          </a>
        </li>
      </ul>
    </nav>
  );
}

/** Compact horizontal nav for small screens */
export function TrainingSubNavMobile({
  active,
  onNavigate,
}: {
  active: TrainingSubNavKey;
  onNavigate: (key: TrainingSubNavKey) => void;
}) {
  return (
    <div className="lg:hidden flex flex-wrap gap-1.5 mb-4">
      {scrollItems.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(key)}
            className={[
              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
              isActive
                ? "bg-orange-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200",
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
