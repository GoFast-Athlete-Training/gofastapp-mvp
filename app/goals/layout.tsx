import type { ReactNode } from "react";
import GoalHubShell from "@/components/goals/GoalHubShell";

export const dynamic = "force-dynamic";

export default function GoalsLayout({ children }: { children: ReactNode }) {
  return <GoalHubShell>{children}</GoalHubShell>;
}
