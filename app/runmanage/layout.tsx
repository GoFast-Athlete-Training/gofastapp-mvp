import type { ReactNode } from "react";
import { RunManageProviders } from "@/components/runmanage/RunManageProviders";
import { RunManageShell } from "@/components/runmanage/RunManageShell";

export default function RunManageLayout({ children }: { children: ReactNode }) {
  return (
    <RunManageProviders>
      <RunManageShell>{children}</RunManageShell>
    </RunManageProviders>
  );
}
