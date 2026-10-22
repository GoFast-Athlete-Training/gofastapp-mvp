"use client";

import TopNav from "@/components/shared/TopNav";
import AthleteSidebar from "@/components/athlete/AthleteSidebar";
import AthleteHostedRunWizard from "@/components/runs/AthleteHostedRunWizard";
import { use } from "react";

export default function HostARunEditPage({
  params,
}: {
  params: Promise<{ cityRunId: string }>;
}) {
  const { cityRunId } = use(params);
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopNav />
      <div className="flex flex-1 overflow-hidden min-w-0">
        <AthleteSidebar />
        <main className="flex-1 overflow-y-auto min-w-0 pb-24 lg:pb-0">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            <AthleteHostedRunWizard
              mode="edit"
              cityRunId={cityRunId}
              pageTitle="Edit run"
              backHref="/gorun"
              backLabel="Back to Run"
            />
          </div>
        </main>
      </div>
    </div>
  );
}
