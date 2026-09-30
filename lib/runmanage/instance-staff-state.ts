import type { RunInstanceSummary } from "@/lib/runmanage/run-instance-summary";

export type InstanceStaffState = "no_built" | "built" | "submitted" | "live";

export function instanceStaffState(instance: RunInstanceSummary): InstanceStaffState {
  if (instance.published) return "live";
  if (instance.workflowStatus === "SUBMITTED") return "submitted";
  return "built";
}

export function instanceStaffStateLabel(state: InstanceStaffState): string {
  switch (state) {
    case "no_built":
      return "No run yet";
    case "built":
      return "Draft";
    case "submitted":
      return "In review";
    case "live":
      return "On app";
  }
}

export function instanceStaffStateBadgeClasses(state: InstanceStaffState): string {
  switch (state) {
    case "no_built":
      return "bg-gray-100 text-gray-700 ring-gray-300";
    case "built":
      return "bg-gray-50 text-gray-800 ring-gray-300";
    case "submitted":
      return "bg-amber-50 text-amber-900 ring-amber-600/20";
    case "live":
      return "bg-emerald-100 text-emerald-900 ring-emerald-600/30";
  }
}
