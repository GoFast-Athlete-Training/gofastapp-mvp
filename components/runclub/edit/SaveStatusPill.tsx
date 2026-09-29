"use client";

import { Loader2 } from "lucide-react";

export type AutoSaveStatus = "saved" | "unsaved" | "saving" | "error" | "sync_failed";

type Props = {
  status: AutoSaveStatus;
  className?: string;
  /** Shown on sync_failed — platform push error or skip reason */
  detail?: string | null;
};

export default function SaveStatusPill({ status, className = "", detail }: Props) {
  if (status === "saved") {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900 ${className}`}
      >
        Saved
      </span>
    );
  }
  if (status === "saving") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-900 ${className}`}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    );
  }
  if (status === "unsaved") {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-950 ${className}`}
      >
        Unsaved — auto-saves
      </span>
    );
  }
  if (status === "sync_failed") {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-950 ${className}`}
        title={detail ?? "Saved in Company; platform sync did not complete"}
      >
        Saved — platform sync failed
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-900 ${className}`}
    >
      Save failed
    </span>
  );
}
