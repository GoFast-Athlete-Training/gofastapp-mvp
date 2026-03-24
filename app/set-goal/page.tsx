import { redirect } from "next/navigation";

/** Legacy onboarding URL — goals live on /goals (GoalSetter). */
export default function SetGoalPage() {
  redirect("/goals");
}
