export type WizardStepVisualStatus =
  | "notStarted"
  | "partial"
  | "needsRequired"
  | "complete";

export function wizardStepStatusLabel(status: WizardStepVisualStatus): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "partial":
      return "Partial";
    case "needsRequired":
      return "Incomplete";
    case "notStarted":
      return "Not started";
  }
}
