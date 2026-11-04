"use client";

import { Suspense } from "react";
import { RunManageDashboardHome } from "@/components/runmanage/RunManageDashboardHome";

export default function RunManageRunsPage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
      <RunManageDashboardHome />
    </Suspense>
  );
}
