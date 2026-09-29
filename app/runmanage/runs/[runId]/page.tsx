"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import RunManageStaffEditor from "@/components/runmanage/RunManageStaffEditor";
import type { RunInstanceManageMode } from "@/lib/runmanage/paths";

function RunManageRunDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const runId = typeof params?.runId === "string" ? params.runId : "";
  const modeParam = searchParams?.get("mode");
  const clubId = searchParams?.get("clubId");
  const initialMode: RunInstanceManageMode =
    modeParam === "edit" || modeParam === "rsvps" || modeParam === "view"
      ? modeParam
      : "view";

  if (!runId) {
    return <p className="text-gray-500">Missing run id.</p>;
  }

  return (
    <RunManageStaffEditor
      runId={runId}
      clubId={clubId}
      initialMode={initialMode}
      backTo="/runmanage/runs"
      showBackButton
    />
  );
}

export default function RunManageRunDetailPage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading run…</p>}>
      <RunManageRunDetailContent />
    </Suspense>
  );
}
