import type { AutoSaveStatus } from "@/components/runclub/edit/SaveStatusPill";

export type RunDashboardInstanceToolbar = {
  autoSaveStatus: AutoSaveStatus;
  published?: boolean;
  workflowStatus?: string;
  isFounder?: boolean;
  onSubmitForReview?: () => void;
  submitting?: boolean;
  onTogglePublished?: () => void;
  togglingPublished?: boolean;
  onSaveAndPreview: () => void;
  savingPreview?: boolean;
  saveLabel?: string;
  previewPublicUrl?: string | null;
};
