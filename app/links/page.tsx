"use client";

import { Suspense } from "react";
import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import { AthleteLinkTreeEditor } from "@/components/profile/AthleteLinkTreeEditor";

export default function GoFastLinksPage() {
  return (
    <AthleteAppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
            </div>
          }
        >
          <AthleteLinkTreeEditor />
        </Suspense>
      </div>
    </AthleteAppShell>
  );
}
