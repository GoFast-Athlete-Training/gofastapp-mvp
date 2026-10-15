"use client";

import AthleteAppShell from "@/components/athlete/AthleteAppShell";
import { AthleteLinkTreeEditor } from "@/components/profile/AthleteLinkTreeEditor";

export default function GoFastLinksPage() {
  return (
    <AthleteAppShell>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <AthleteLinkTreeEditor />
      </div>
    </AthleteAppShell>
  );
}
