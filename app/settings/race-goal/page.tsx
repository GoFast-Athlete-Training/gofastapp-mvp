import { redirect } from "next/navigation";

/** Legacy settings URL — goals live on /goals (GoalSetter). */
export default function RaceGoalRedirectPage() {
  redirect("/goals");
}
