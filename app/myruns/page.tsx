import { redirect } from "next/navigation";

/** Upcoming runs live on the Run hub at /gorun */
export default function MyRunsPage() {
  redirect("/gorun");
}
