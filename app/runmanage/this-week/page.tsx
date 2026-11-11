"use client";

import { Suspense } from "react";
import { RunManageThisWeekHome } from "@/components/runmanage/RunManageThisWeekHome";

export default function RunManageThisWeekPage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
      <RunManageThisWeekHome />
    </Suspense>
  );
}
