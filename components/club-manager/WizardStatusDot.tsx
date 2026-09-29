"use client";

import { AlertCircle, CheckCircle, Circle } from "lucide-react";
import type { WizardStepVisualStatus } from "@/lib/clubCompletionStatus";
import { wizardStepStatusLabel } from "@/lib/clubCompletionStatus";

type Props = {
  status: WizardStepVisualStatus;
  showLabel?: boolean;
  size?: "sm" | "md";
};

const SIZE = {
  sm: "h-2.5 w-2.5",
  md: "h-3.5 w-3.5",
} as const;

export function WizardStatusDot({ status, showLabel = false, size = "md" }: Props) {
  const dotClass = SIZE[size];

  let icon: React.ReactNode;
  let colorClass: string;

  switch (status) {
    case "complete":
      icon = <CheckCircle className={`${dotClass} text-emerald-600`} />;
      colorClass = "text-emerald-700";
      break;
    case "partial":
      icon = <AlertCircle className={`${dotClass} text-amber-600`} />;
      colorClass = "text-amber-700";
      break;
    case "needsRequired":
      icon = <AlertCircle className={`${dotClass} text-red-600`} />;
      colorClass = "text-red-700";
      break;
    case "notStarted":
    default:
      icon = <Circle className={`${dotClass} text-gray-300`} />;
      colorClass = "text-gray-500";
      break;
  }

  if (!showLabel) return <span className="inline-flex shrink-0">{icon}</span>;

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${colorClass}`}>
      {icon}
      {wizardStepStatusLabel(status)}
    </span>
  );
}

export function wizardStatusBadgeClasses(status: WizardStepVisualStatus): string {
  switch (status) {
    case "complete":
      return "bg-emerald-50 text-emerald-800 ring-emerald-600/20";
    case "partial":
      return "bg-amber-50 text-amber-900 ring-amber-600/20";
    case "needsRequired":
      return "bg-red-50 text-red-800 ring-red-600/20";
    case "notStarted":
    default:
      return "bg-gray-100 text-gray-600 ring-gray-300";
  }
}

/** Sidebar nav button — mirrors race ingest wizard step coloring. */
export function wizardSidebarButtonClasses(
  status: WizardStepVisualStatus,
  isActive: boolean
): string {
  const base = "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors text-left";
  if (isActive) {
    return `${base} bg-purple-50 text-purple-800 border-2 border-purple-500`;
  }
  switch (status) {
    case "needsRequired":
      return `${base} bg-red-50 border border-red-300 text-red-950 hover:bg-red-100`;
    case "partial":
      return `${base} bg-amber-50 border border-amber-300 text-amber-950 hover:bg-amber-100`;
    case "complete":
      return `${base} bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100`;
    case "notStarted":
    default:
      return `${base} bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100`;
  }
}
