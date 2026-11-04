"use client";

import { Suspense } from "react";
import RunManageSeriesList from "@/components/runmanage/RunManageSeriesList";

export default function RunManageSeriesPage() {
  return (
    <Suspense fallback={<p className="text-gray-500 py-8">Loading…</p>}>
      <RunManageSeriesList />
    </Suspense>
  );
}
