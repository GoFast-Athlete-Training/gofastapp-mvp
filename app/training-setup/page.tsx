import { Suspense } from "react";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import TrainingSetupClient from "./TrainingSetupClient";

export default function TrainingSetupPage() {
  return (
    <Suspense
      fallback={
        <AthleteAppShell>
          <div className="flex min-h-[50vh] items-center justify-center text-gray-600">
            Loading…
          </div>
        </AthleteAppShell>
      }
    >
      <TrainingSetupClient />
    </Suspense>
  );
}
