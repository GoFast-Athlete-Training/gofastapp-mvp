"use client";

import { useParams, useSearchParams } from "next/navigation";
import { AdjustPlanIngestPage } from "@/components/training/adjust-plan/AdjustPlanIngestPage";

export default function TrainingPlanAdjustPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const planId = typeof params.planId === "string" ? params.planId : "";
  const weekRaw = searchParams.get("weekNumber");
  const weekNumber =
    weekRaw != null && weekRaw !== "" ? Math.max(1, Math.floor(Number(weekRaw))) : null;

  if (!planId) {
    return (
      <p className="p-6 text-sm text-gray-600">Missing plan. Go back to Training.</p>
    );
  }

  return <AdjustPlanIngestPage planId={planId} weekNumber={weekNumber} />;
}
