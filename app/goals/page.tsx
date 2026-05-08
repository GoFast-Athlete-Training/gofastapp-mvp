"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import GoalSetter from "@/components/athlete/GoalSetter";

function GoalsRaceContent() {
  const searchParams = useSearchParams();
  const raceRegistryId = searchParams.get("raceRegistryId")?.trim() || undefined;

  return (
    <div className="max-w-3xl">
      <GoalSetter initialRaceRegistryId={raceRegistryId} hideBackLink={false} />
    </div>
  );
}

export default function GoalsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <GoalsRaceContent />
    </Suspense>
  );
}
