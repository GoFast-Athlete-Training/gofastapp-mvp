"use client";

import TopNav from "@/components/shared/TopNav";
import RaceGoalEditor from "@/components/athlete/RaceGoalEditor";

export default function SetGoalPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <RaceGoalEditor variant="onboarding" />
    </div>
  );
}
