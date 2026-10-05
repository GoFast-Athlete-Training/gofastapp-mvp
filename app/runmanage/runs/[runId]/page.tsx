"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import RunManageStaffEditor from "@/components/runmanage/RunManageStaffEditor";
import type { WizardStep } from "@/components/runmanage/runInstanceWizard/shared";
import type { RunInstanceManageMode } from "@/lib/runmanage/paths";

const WIZARD_STEP_IDS: WizardStep[] = [
  "intake",
  "host",
  "sources",
  "associate",
  "core",
  "description",
  "route",
  "workout",
];

function parseWizardStep(raw: string | null): WizardStep | undefined {
  if (!raw?.trim()) return undefined;
  const step = raw.trim() as WizardStep;
  return WIZARD_STEP_IDS.includes(step) ? step : undefined;
}

function RunManageRunDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const runId = typeof params?.runId === "string" ? params.runId : "";
  const modeParam = searchParams?.get("mode");
  const clubId = searchParams?.get("clubId");
  const initialWizardStep = parseWizardStep(searchParams?.get("step") ?? null);
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
      initialWizardStep={initialWizardStep ?? (initialMode === "edit" ? "core" : undefined)}
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
