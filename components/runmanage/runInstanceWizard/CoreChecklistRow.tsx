"use client";

import type { ReactNode } from "react";

export default function CoreChecklistRow({
  label,
  value,
  status,
  onEdit,
  editOpen,
  children,
}: {
  label: string;
  value: string;
  status: ReactNode;
  onEdit: () => void;
  editOpen: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-gray-100 py-3 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-0.5 text-sm text-gray-900">{value || "—"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status}
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-medium text-sky-700 hover:text-sky-900"
          >
            {editOpen ? "Done" : value ? "Edit" : "Add"}
          </button>
        </div>
      </div>
      {editOpen && children ? <div className="mt-3 space-y-3">{children}</div> : null}
    </div>
  );
}
