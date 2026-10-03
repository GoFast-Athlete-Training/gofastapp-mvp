"use client";

import { FileUp, PenLine, Sparkles } from "lucide-react";

export type IntakeMode = "manual" | "paste" | "csv";

type ModeMeta = {
  label: string;
  icon: typeof PenLine;
  description: string;
};

type Props = {
  mode: IntakeMode | null;
  onChange: (mode: IntakeMode) => void;
  className?: string;
  descriptions?: Partial<Record<IntakeMode, string>>;
};

const DEFAULT_DESCRIPTIONS: Record<IntakeMode, string> = {
  manual: "Continue with empty fields — fill each step yourself.",
  paste: "Paste freeform text — we extract title, date, meet-up, miles, pace, and route hints.",
  csv: "Upload one row using the downloadable template.",
};

const MODES: IntakeMode[] = ["manual", "paste", "csv"];

function modeMeta(mode: IntakeMode, descriptions: Partial<Record<IntakeMode, string>>): ModeMeta {
  const byMode: Record<IntakeMode, Omit<ModeMeta, "description">> = {
    manual: { label: "Manual", icon: PenLine },
    paste: { label: "AI parse", icon: Sparkles },
    csv: { label: "CSV upload", icon: FileUp },
  };
  return {
    ...byMode[mode],
    description: descriptions[mode] ?? DEFAULT_DESCRIPTIONS[mode],
  };
}

export default function IntakeModePicker({
  mode,
  onChange,
  className = "",
  descriptions = {},
}: Props) {
  if (mode === null) {
    return (
      <div className={`grid gap-3 sm:grid-cols-3 ${className}`}>
        {MODES.map((id) => {
          const { label, icon: Icon, description } = modeMeta(id, descriptions);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-300 hover:bg-sky-50/50"
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Icon className="h-4 w-4 shrink-0 text-sky-600" />
                {label}
              </span>
              <p className="mt-2 text-sm text-slate-600">{description}</p>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {MODES.map((id) => {
        const { label, icon: Icon } = modeMeta(id, descriptions);
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-sky-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:bg-sky-50"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
